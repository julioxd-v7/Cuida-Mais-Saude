-- =============================================================================
-- CUIDAR MAIS — Migration 001: usuários, perfis, beneficiários, sessões,
-- recuperação de senha e auditoria.
--
-- Os nomes NÃO levam schema: o executor de migrations define o schema
-- (padrão "app") via search_path. Isso permite rodar os testes num schema
-- temporário no mesmo banco, sem tocar nos dados reais.
--
-- Todas as funções usam "SET search_path FROM CURRENT", ficando presas ao
-- schema em que foram criadas.
--
-- Defesa em profundidade: além das checagens do backend, o próprio banco
-- impede que papel, estado da conta e estado de verificação sejam alterados
-- por um UPDATE comum. Só as funções privilegiadas abaixo conseguem.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------

CREATE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Liga a "chave" de operação privilegiada só até o fim da transação atual.
CREATE FUNCTION enable_privileged() RETURNS void
LANGUAGE sql SET search_path FROM CURRENT AS $$
  SELECT set_config('cuidar.privileged', 'on', true);
$$;

CREATE FUNCTION disable_privileged() RETURNS void
LANGUAGE sql SET search_path FROM CURRENT AS $$
  SELECT set_config('cuidar.privileged', 'off', true);
$$;

CREATE FUNCTION is_privileged() RETURNS boolean
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT coalesce(current_setting('cuidar.privileged', true), '') = 'on';
$$;

-- ---------------------------------------------------------------------------
-- Usuários
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL CHECK (email = lower(btrim(email)) AND email LIKE '%_@_%._%'),
  password_hash       text NOT NULL,
  full_name           text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 3 AND 120),
  phone               text NOT NULL CHECK (phone ~ '^[1-9][0-9][0-9]{8,9}$'),
  role                text NOT NULL CHECK (role IN ('client', 'caregiver', 'admin')),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  terms_version       text NOT NULL,
  terms_accepted_at   timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (email);

CREATE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Papel e estado só mudam por função privilegiada; ninguém se cadastra admin.
CREATE FUNCTION guard_users_privileged() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF is_privileged() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Papel administrativo não pode ser criado por cadastro'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.status <> 'active' THEN
      RAISE EXCEPTION 'Conta nova deve começar ativa' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Papel e estado da conta só podem ser alterados por ação administrativa'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER users_guard BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_users_privileged();

-- ---------------------------------------------------------------------------
-- Perfil do cliente (quem contrata)
-- ---------------------------------------------------------------------------

CREATE TABLE client_profiles (
  user_id             uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  contact_preference  text NOT NULL DEFAULT 'whatsapp'
                      CHECK (contact_preference IN ('whatsapp', 'phone', 'email')),
  -- Endereço principal: opcional no cadastro; exigido quando houver atendimento.
  address_street      text,
  address_number      text,
  address_complement  text,
  address_district    text,
  address_city        text,
  address_state       char(2),
  address_postal_code text CHECK (address_postal_code ~ '^[0-9]{8}$'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER client_profiles_touch BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- Beneficiários (pessoas que recebem o cuidado)
-- Só o mínimo. Dados de saúde NÃO entram aqui nesta etapa.
-- ---------------------------------------------------------------------------

CREATE TABLE care_recipients (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  full_name           text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  relationship        text NOT NULL
                      CHECK (relationship IN ('self', 'parent', 'grandparent', 'spouse', 'child', 'sibling', 'other')),
  -- Necessidades GERAIS de assistência (categorias, não diagnósticos).
  assistance_needs    text[] NOT NULL DEFAULT '{}'
                      CHECK (assistance_needs <@ ARRAY['mobility', 'hygiene', 'feeding', 'medication_reminder', 'companionship']::text[]),
  address_street      text,
  address_number      text,
  address_complement  text,
  address_district    text,
  address_city        text,
  address_state       char(2),
  address_postal_code text CHECK (address_postal_code ~ '^[0-9]{8}$'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX care_recipients_guardian_idx ON care_recipients (guardian_id);

CREATE TRIGGER care_recipients_touch BEFORE UPDATE ON care_recipients
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Só clientes podem ter beneficiários.
CREATE FUNCTION guard_recipient_guardian() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.guardian_id AND role = 'client') THEN
    RAISE EXCEPTION 'Beneficiário precisa pertencer a um cliente' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER care_recipients_guard BEFORE INSERT OR UPDATE OF guardian_id ON care_recipients
  FOR EACH ROW EXECUTE FUNCTION guard_recipient_guardian();

-- ---------------------------------------------------------------------------
-- Perfil do cuidador
-- ---------------------------------------------------------------------------

CREATE TABLE caregiver_profiles (
  user_id               uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  bio                   text CHECK (bio IS NULL OR char_length(bio) <= 1000),
  experience_years      integer CHECK (experience_years IS NULL OR experience_years BETWEEN 0 AND 60),
  specialties           text[] NOT NULL DEFAULT '{}'
                        CHECK (specialties <@ ARRAY['elderly', 'post_surgery', 'disability', 'dementia', 'palliative', 'special_needs_children']::text[]),
  service_city          text,
  service_state         char(2),
  service_radius_km     integer CHECK (service_radius_km IS NULL OR service_radius_km BETWEEN 1 AND 100),
  availability_days     text[] NOT NULL DEFAULT '{}'
                        CHECK (availability_days <@ ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[]),
  availability_periods  text[] NOT NULL DEFAULT '{}'
                        CHECK (availability_periods <@ ARRAY['morning', 'afternoon', 'night', 'overnight']::text[]),
  -- incomplete   : faltam dados obrigatórios
  -- completed    : dados completos, ainda não enviado para análise
  -- pending_review: enviado, aguardando análise administrativa
  -- approved / rejected / suspended: decisão administrativa
  verification_status   text NOT NULL DEFAULT 'incomplete'
                        CHECK (verification_status IN ('incomplete', 'completed', 'pending_review', 'approved', 'rejected', 'suspended')),
  verification_note     text,
  submitted_at          timestamptz,
  reviewed_at           timestamptz,
  reviewed_by           uuid REFERENCES users (id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER caregiver_profiles_touch BEFORE UPDATE ON caregiver_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Campos de verificação só mudam por função privilegiada.
CREATE FUNCTION guard_caregiver_verification() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF is_privileged() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.verification_status <> 'incomplete' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Perfil de cuidador deve começar incompleto' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verification_note IS DISTINCT FROM OLD.verification_note
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
    RAISE EXCEPTION 'Estado de verificação só pode ser alterado pelo fluxo de verificação'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER caregiver_profiles_guard BEFORE INSERT OR UPDATE ON caregiver_profiles
  FOR EACH ROW EXECUTE FUNCTION guard_caregiver_verification();

-- Perfil tem tudo o que é obrigatório para ser analisado?
CREATE FUNCTION caregiver_profile_is_complete(p caregiver_profiles) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path FROM CURRENT AS $$
  SELECT p.bio IS NOT NULL AND char_length(btrim(p.bio)) >= 30
     AND p.experience_years IS NOT NULL
     AND cardinality(p.specialties) > 0
     AND p.service_city IS NOT NULL AND char_length(btrim(p.service_city)) >= 2
     AND p.service_state IS NOT NULL
     AND p.service_radius_km IS NOT NULL
     AND cardinality(p.availability_days) > 0
     AND cardinality(p.availability_periods) > 0;
$$;

-- Após editar o perfil: incompleto <-> completo é automático.
-- Um perfil reprovado que volta a ser editado continua "rejected" até ser reenviado.
-- Em análise ou aprovado: editar dados obrigatórios a ponto de ficarem incompletos
-- volta o perfil para "incomplete" (precisa nova análise).
CREATE FUNCTION sync_caregiver_completion(p_user_id uuid) RETURNS caregiver_profiles
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  p caregiver_profiles;
  complete boolean;
  next_status text;
BEGIN
  SELECT * INTO p FROM caregiver_profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de cuidador não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  complete := caregiver_profile_is_complete(p);
  next_status := p.verification_status;

  IF p.verification_status = 'incomplete' AND complete THEN
    next_status := 'completed';
  ELSIF p.verification_status IN ('completed', 'pending_review', 'approved') AND NOT complete THEN
    next_status := 'incomplete';
  END IF;

  IF next_status IS DISTINCT FROM p.verification_status THEN
    PERFORM enable_privileged();
    UPDATE caregiver_profiles SET verification_status = next_status WHERE user_id = p_user_id
      RETURNING * INTO p;
    PERFORM disable_privileged();
  END IF;

  RETURN p;
END;
$$;

-- O cuidador envia o perfil para análise. Não aprova nada.
CREATE FUNCTION caregiver_submit_for_review(p_user_id uuid) RETURNS caregiver_profiles
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  p caregiver_profiles;
BEGIN
  SELECT * INTO p FROM caregiver_profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de cuidador não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT caregiver_profile_is_complete(p) THEN
    RAISE EXCEPTION 'PROFILE_INCOMPLETE' USING ERRCODE = 'check_violation';
  END IF;

  IF p.verification_status NOT IN ('completed', 'rejected') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM enable_privileged();
  UPDATE caregiver_profiles
     SET verification_status = 'pending_review', submitted_at = now(), verification_note = NULL
   WHERE user_id = p_user_id
  RETURNING * INTO p;
  PERFORM disable_privileged();

  INSERT INTO audit_log (actor_id, action, target_type, target_id)
  VALUES (p_user_id, 'caregiver.submitted_for_review', 'caregiver_profile', p_user_id);

  RETURN p;
END;
$$;

-- ---------------------------------------------------------------------------
-- Sessões (tokens opacos; só o hash SHA-256 fica no banco)
-- ---------------------------------------------------------------------------

CREATE TABLE sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  access_token_hash   text NOT NULL UNIQUE,
  refresh_token_hash  text NOT NULL UNIQUE,
  access_expires_at   timestamptz NOT NULL,
  refresh_expires_at  timestamptz NOT NULL,
  revoked_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_used_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

-- ---------------------------------------------------------------------------
-- Recuperação de senha (código de uso único; só o hash fica no banco)
-- ---------------------------------------------------------------------------

CREATE TABLE password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_resets_user_idx ON password_resets (user_id);

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id     uuid REFERENCES users (id) ON DELETE SET NULL,
  action       text NOT NULL,
  target_type  text NOT NULL,
  target_id    uuid,
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_target_idx ON audit_log (target_type, target_id);

-- Auditoria é só de inclusão.
CREATE FUNCTION guard_audit_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria não podem ser alterados ou apagados'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION guard_audit_append_only();

-- ---------------------------------------------------------------------------
-- Cadastro atômico: usuário + perfil do papel na mesma transação
-- ---------------------------------------------------------------------------

CREATE FUNCTION register_user(
  p_email text,
  p_password_hash text,
  p_full_name text,
  p_phone text,
  p_role text,
  p_terms_version text
) RETURNS users
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  u users;
BEGIN
  IF p_role NOT IN ('client', 'caregiver') THEN
    RAISE EXCEPTION 'Papel inválido para cadastro público' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO users (email, password_hash, full_name, phone, role, terms_version, terms_accepted_at)
  VALUES (lower(btrim(p_email)), p_password_hash, btrim(p_full_name), p_phone, p_role, p_terms_version, now())
  RETURNING * INTO u;

  IF p_role = 'client' THEN
    INSERT INTO client_profiles (user_id) VALUES (u.id);
  ELSE
    INSERT INTO caregiver_profiles (user_id) VALUES (u.id);
  END IF;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (u.id, 'user.registered', 'user', u.id, jsonb_build_object('role', p_role));

  RETURN u;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ações administrativas (sempre conferem se quem age é admin ativo)
-- ---------------------------------------------------------------------------

CREATE FUNCTION assert_active_admin(p_admin_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin' AND status = 'active') THEN
    RAISE EXCEPTION 'Ação permitida somente a administradores' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- Decisão sobre a verificação do cuidador.
CREATE FUNCTION admin_set_caregiver_status(
  p_admin_id uuid,
  p_caregiver_id uuid,
  p_status text,
  p_note text DEFAULT NULL
) RETURNS caregiver_profiles
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  p caregiver_profiles;
  allowed boolean;
BEGIN
  PERFORM assert_active_admin(p_admin_id);

  IF p_admin_id = p_caregiver_id THEN
    RAISE EXCEPTION 'Ninguém pode decidir a própria verificação' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO p FROM caregiver_profiles WHERE user_id = p_caregiver_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de cuidador não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  allowed := CASE p_status
    WHEN 'approved'       THEN p.verification_status = 'pending_review'
    WHEN 'rejected'       THEN p.verification_status = 'pending_review'
    WHEN 'suspended'      THEN p.verification_status IN ('completed', 'pending_review', 'approved', 'rejected')
    WHEN 'pending_review' THEN p.verification_status = 'suspended'
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'check_violation';
  END IF;

  IF p_status = 'approved' AND NOT caregiver_profile_is_complete(p) THEN
    RAISE EXCEPTION 'PROFILE_INCOMPLETE' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM enable_privileged();
  UPDATE caregiver_profiles
     SET verification_status = p_status,
         verification_note = p_note,
         reviewed_at = now(),
         reviewed_by = p_admin_id
   WHERE user_id = p_caregiver_id
  RETURNING * INTO p;
  PERFORM disable_privileged();

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'caregiver.verification_changed', 'caregiver_profile', p_caregiver_id,
          jsonb_build_object('status', p_status, 'note', p_note));

  RETURN p;
END;
$$;

-- Suspender ou reativar uma conta. Suspender revoga todas as sessões.
CREATE FUNCTION admin_set_user_status(p_admin_id uuid, p_user_id uuid, p_status text) RETURNS users
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  u users;
BEGIN
  PERFORM assert_active_admin(p_admin_id);

  IF p_admin_id = p_user_id THEN
    RAISE EXCEPTION 'Administrador não pode alterar a própria conta' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM enable_privileged();
  UPDATE users SET status = p_status WHERE id = p_user_id RETURNING * INTO u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM disable_privileged();

  IF p_status = 'suspended' THEN
    UPDATE sessions SET revoked_at = now() WHERE user_id = p_user_id AND revoked_at IS NULL;
  END IF;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'user.status_changed', 'user', p_user_id, jsonb_build_object('status', p_status));

  RETURN u;
END;
$$;

-- Concede o papel de admin. Usada APENAS pelo script de linha de comando
-- (npm run admin:grant), por quem tem acesso direto ao banco.
-- Não existe rota HTTP que chame esta função.
CREATE FUNCTION grant_admin_by_email(p_email text) RETURNS users
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  u users;
BEGIN
  PERFORM enable_privileged();
  UPDATE users SET role = 'admin' WHERE email = lower(btrim(p_email)) RETURNING * INTO u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM disable_privileged();

  DELETE FROM client_profiles WHERE user_id = u.id;
  DELETE FROM caregiver_profiles WHERE user_id = u.id;
  UPDATE sessions SET revoked_at = now() WHERE user_id = u.id AND revoked_at IS NULL;

  INSERT INTO audit_log (actor_id, action, target_type, target_id)
  VALUES (NULL, 'user.admin_granted', 'user', u.id);

  RETURN u;
END;
$$;

-- ---------------------------------------------------------------------------
-- Supabase: o banco é acessado SOMENTE pelo backend. Bloqueia a API pública
-- do Supabase (roles anon/authenticated) a este schema e liga RLS sem
-- políticas (nega tudo para quem não é dono das tabelas).
-- Em um PostgreSQL comum esses roles não existem e o bloco é ignorado.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r text;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'client_profiles', 'care_recipients', 'caregiver_profiles',
                           'sessions', 'password_resets', 'audit_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', current_schema(), r);
    END IF;
  END LOOP;

  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', current_schema());
END;
$$;
