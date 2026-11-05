-- =============================================================================
-- CUIDAR MAIS — Migration 005: login com Google, gestão de acesso e exclusão
-- de conta a pedido do titular (LGPD art. 18; exigência das lojas de apps).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Login com Google: conta pode existir sem senha (só Google)
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN google_sub text CHECK (google_sub IS NULL OR google_sub ~ '^[0-9]{5,40}$'),
  ADD COLUMN deletion_requested_at timestamptz;

CREATE UNIQUE INDEX users_google_sub_key ON users (google_sub) WHERE google_sub IS NOT NULL;

-- Toda conta precisa de pelo menos uma forma de entrar.
ALTER TABLE users ADD CONSTRAINT users_has_login_method CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL);

-- Cadastro pelo Google: mesmo fluxo do cadastro comum, sem senha.
CREATE FUNCTION register_google_user(
  p_email text,
  p_google_sub text,
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

  INSERT INTO users (email, password_hash, google_sub, full_name, phone, role, terms_version, terms_accepted_at)
  VALUES (lower(btrim(p_email)), NULL, p_google_sub, btrim(p_full_name), p_phone, p_role, p_terms_version, now())
  RETURNING * INTO u;

  IF p_role = 'client' THEN
    INSERT INTO client_profiles (user_id) VALUES (u.id);
  ELSE
    INSERT INTO caregiver_profiles (user_id) VALUES (u.id);
  END IF;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (u.id, 'user.registered', 'user', u.id, jsonb_build_object('role', p_role, 'method', 'google'));

  RETURN u;
END;
$$;

-- ---------------------------------------------------------------------------
-- Exclusão de conta
--
-- O pedido é imediato: a conta deixa de entrar, some da busca e todas as
-- sessões são encerradas. A eliminação definitiva dos dados (e dos arquivos
-- no armazenamento) é feita pela equipe no prazo informado ao usuário,
-- guardando só o que a lei obriga (ex.: registros de auditoria).
-- ---------------------------------------------------------------------------
CREATE FUNCTION guard_deletion_flag() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NOT is_privileged() AND NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at THEN
    RAISE EXCEPTION 'Use o fluxo de exclusão de conta' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_deletion_guard BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_deletion_flag();

CREATE FUNCTION request_account_deletion(p_user_id uuid, p_reason text) RETURNS users
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  u users;
BEGIN
  SELECT * INTO u FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  IF u.role = 'admin' THEN
    RAISE EXCEPTION 'Contas administrativas são encerradas pela equipe' USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM enable_privileged();
  UPDATE users SET deletion_requested_at = coalesce(deletion_requested_at, now()) WHERE id = p_user_id RETURNING * INTO u;
  UPDATE caregiver_profiles SET available_now = false WHERE user_id = p_user_id;
  PERFORM disable_privileged();

  UPDATE sessions SET revoked_at = now() WHERE user_id = p_user_id AND revoked_at IS NULL;
  DELETE FROM client_favorites WHERE client_id = p_user_id OR caregiver_id = p_user_id;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_user_id, 'user.deletion_requested', 'user', p_user_id,
          jsonb_build_object('reason', left(coalesce(p_reason, ''), 300)));
  RETURN u;
END;
$$;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', current_schema(), r);
    END IF;
  END LOOP;
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', current_schema());
END;
$$;
