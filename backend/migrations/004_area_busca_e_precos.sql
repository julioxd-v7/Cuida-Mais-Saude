-- =============================================================================
-- CUIDAR MAIS — Migration 004: área de atendimento (lançamento por cidade),
-- faixas de preço, valores do profissional, "disponível agora", favoritos.
--
-- Decisão de produto (docs/DECISOES_PRODUTO.md): o app começa em UMA cidade,
-- para testes e mais segurança. Abrir novas cidades (até o Brasil todo) é só
-- cadastrar novas áreas — não exige mudar código.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Comparação de cidades sem acento e sem diferença de maiúsculas
-- ("São Paulo" = "sao paulo" = "SAO  PAULO")
-- ---------------------------------------------------------------------------
CREATE FUNCTION normalize_city(p_city text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path FROM CURRENT AS $$
  SELECT lower(translate(
    btrim(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g')),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
  ));
$$;

-- ---------------------------------------------------------------------------
-- Áreas de atendimento (cidades liberadas)
-- ---------------------------------------------------------------------------
CREATE TABLE service_areas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city        text NOT NULL CHECK (char_length(btrim(city)) BETWEEN 2 AND 80),
  state       char(2) NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  city_key    text GENERATED ALWAYS AS (normalize_city(city)) STORED,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_key, state)
);

CREATE FUNCTION service_area_is_active(p_city text, p_state text) RETURNS boolean
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT EXISTS (
    SELECT 1 FROM service_areas
     WHERE active AND city_key = normalize_city(p_city) AND state = upper(btrim(coalesce(p_state, '')))
  );
$$;

-- Tipos de serviço (mesma lista da migration 002).
CREATE FUNCTION is_service_type(p text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path FROM CURRENT AS $$
  SELECT p IN ('care', 'nursing_procedure', 'nursing_assessment', 'physiotherapy');
$$;

-- ---------------------------------------------------------------------------
-- Faixa de preço por hora, por cidade e tipo de serviço (centavos)
-- ---------------------------------------------------------------------------
CREATE TABLE service_price_ranges (
  service_area_id   uuid NOT NULL REFERENCES service_areas (id) ON DELETE CASCADE,
  service_type      text NOT NULL CHECK (is_service_type(service_type)),
  min_hourly_cents  integer NOT NULL CHECK (min_hourly_cents BETWEEN 100 AND 10000000),
  max_hourly_cents  integer NOT NULL CHECK (max_hourly_cents BETWEEN 100 AND 10000000),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_area_id, service_type),
  CHECK (max_hourly_cents >= min_hourly_cents)
);

-- Áreas e faixas só mudam pelo fluxo administrativo (funções abaixo).
CREATE FUNCTION guard_admin_only_table() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF is_privileged() THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Somente a administração altera áreas e preços' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER service_areas_guard BEFORE INSERT OR UPDATE OR DELETE ON service_areas
  FOR EACH ROW EXECUTE FUNCTION guard_admin_only_table();
CREATE TRIGGER service_price_ranges_guard BEFORE INSERT OR UPDATE OR DELETE ON service_price_ranges
  FOR EACH ROW EXECUTE FUNCTION guard_admin_only_table();

-- Cidade de lançamento. Os valores das faixas são EXEMPLOS para testes e
-- precisam ser definidos pelo time (podem ser alterados pelo admin).
DO $$
DECLARE
  area_id uuid;
BEGIN
  PERFORM enable_privileged();
  INSERT INTO service_areas (city, state) VALUES ('São Paulo', 'SP') RETURNING id INTO area_id;
  INSERT INTO service_price_ranges (service_area_id, service_type, min_hourly_cents, max_hourly_cents) VALUES
    (area_id, 'care',               2500,  6000),
    (area_id, 'nursing_procedure',  5000, 15000),
    (area_id, 'nursing_assessment', 8000, 20000),
    (area_id, 'physiotherapy',      8000, 25000);
  PERFORM disable_privileged();
END;
$$;

CREATE FUNCTION admin_upsert_service_area(p_admin_id uuid, p_city text, p_state text, p_active boolean)
RETURNS service_areas
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  a service_areas;
BEGIN
  PERFORM assert_active_admin(p_admin_id);
  PERFORM enable_privileged();
  INSERT INTO service_areas (city, state, active) VALUES (btrim(p_city), upper(btrim(p_state)), p_active)
  ON CONFLICT (city_key, state) DO UPDATE SET active = EXCLUDED.active, updated_at = now()
  RETURNING * INTO a;
  PERFORM disable_privileged();

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'service_area.upserted', 'service_area', a.id,
          jsonb_build_object('city', a.city, 'state', a.state, 'active', a.active));
  RETURN a;
END;
$$;

CREATE FUNCTION admin_set_price_range(
  p_admin_id uuid, p_area_id uuid, p_service_type text, p_min integer, p_max integer
) RETURNS service_price_ranges
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  r service_price_ranges;
BEGIN
  PERFORM assert_active_admin(p_admin_id);
  IF NOT EXISTS (SELECT 1 FROM service_areas WHERE id = p_area_id) THEN
    RAISE EXCEPTION 'Área não encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM enable_privileged();
  INSERT INTO service_price_ranges (service_area_id, service_type, min_hourly_cents, max_hourly_cents)
  VALUES (p_area_id, p_service_type, p_min, p_max)
  ON CONFLICT (service_area_id, service_type)
  DO UPDATE SET min_hourly_cents = EXCLUDED.min_hourly_cents, max_hourly_cents = EXCLUDED.max_hourly_cents, updated_at = now()
  RETURNING * INTO r;
  PERFORM disable_privileged();

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'price_range.set', 'service_area', p_area_id,
          jsonb_build_object('serviceType', p_service_type, 'min', p_min, 'max', p_max));
  RETURN r;
END;
$$;

-- ---------------------------------------------------------------------------
-- Valor por hora de cada profissional, dentro da faixa da cidade
-- ---------------------------------------------------------------------------
CREATE TABLE caregiver_service_rates (
  caregiver_id      uuid NOT NULL REFERENCES caregiver_profiles (user_id) ON DELETE CASCADE,
  service_type      text NOT NULL CHECK (is_service_type(service_type)),
  hourly_rate_cents integer NOT NULL CHECK (hourly_rate_cents BETWEEN 100 AND 10000000),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (caregiver_id, service_type)
);

CREATE FUNCTION guard_caregiver_rate() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  p caregiver_profiles;
  range service_price_ranges;
BEGIN
  IF is_privileged() THEN
    RETURN NEW;
  END IF;

  SELECT * INTO p FROM caregiver_profiles WHERE user_id = NEW.caregiver_id;
  IF NOT (NEW.service_type = ANY (profession_service_types(p.profession))) THEN
    RAISE EXCEPTION 'SERVICE_NOT_ALLOWED' USING ERRCODE = 'check_violation';
  END IF;

  SELECT r.* INTO range
    FROM service_price_ranges r
    JOIN service_areas a ON a.id = r.service_area_id
   WHERE a.active AND a.city_key = normalize_city(p.service_city) AND a.state = p.service_state
     AND r.service_type = NEW.service_type;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_AREA_UNAVAILABLE' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.hourly_rate_cents NOT BETWEEN range.min_hourly_cents AND range.max_hourly_cents THEN
    RAISE EXCEPTION 'RATE_OUT_OF_RANGE' USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER caregiver_service_rates_guard BEFORE INSERT OR UPDATE ON caregiver_service_rates
  FOR EACH ROW EXECUTE FUNCTION guard_caregiver_rate();

-- ---------------------------------------------------------------------------
-- "Disponível agora" (atendimento imediato). Só perfis aprovados; expira
-- sozinho depois de 8 horas para não mostrar quem esqueceu ligado.
-- ---------------------------------------------------------------------------
ALTER TABLE caregiver_profiles
  ADD COLUMN available_now boolean NOT NULL DEFAULT false,
  ADD COLUMN available_now_at timestamptz;

CREATE FUNCTION caregiver_is_available_now(p caregiver_profiles) RETURNS boolean
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT p.available_now AND p.verification_status = 'approved'
     AND p.available_now_at > now() - interval '8 hours';
$$;

-- Perdeu a aprovação (suspensão, nova análise): sai do "disponível agora".
CREATE FUNCTION guard_available_now() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW.available_now AND NEW.verification_status <> 'approved' THEN
    NEW.available_now := false;
  END IF;
  IF NEW.available_now AND NOT OLD.available_now THEN
    NEW.available_now_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER caregiver_profiles_zz_available_now BEFORE UPDATE ON caregiver_profiles
  FOR EACH ROW EXECUTE FUNCTION guard_available_now();

-- ---------------------------------------------------------------------------
-- Envio para análise: agora exige cidade liberada e pelo menos um valor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION caregiver_submit_for_review(p_user_id uuid) RETURNS caregiver_profiles
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

  IF NOT service_area_is_active(p.service_city, p.service_state) THEN
    RAISE EXCEPTION 'SERVICE_AREA_UNAVAILABLE' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM caregiver_service_rates r
     WHERE r.caregiver_id = p_user_id AND r.service_type = ANY (profession_service_types(p.profession))
  ) THEN
    RAISE EXCEPTION 'RATES_MISSING' USING ERRCODE = 'check_violation';
  END IF;

  IF cardinality(caregiver_missing_documents(p_user_id)) > 0 THEN
    RAISE EXCEPTION 'DOCUMENTS_MISSING' USING ERRCODE = 'check_violation';
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
-- Favoritos do cliente
-- ---------------------------------------------------------------------------
CREATE TABLE client_favorites (
  client_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  caregiver_id  uuid NOT NULL REFERENCES caregiver_profiles (user_id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, caregiver_id)
);

CREATE FUNCTION guard_client_favorite() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.client_id AND role = 'client') THEN
    RAISE EXCEPTION 'Favoritos são só de clientes' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER client_favorites_guard BEFORE INSERT OR UPDATE ON client_favorites
  FOR EACH ROW EXECUTE FUNCTION guard_client_favorite();

-- ---------------------------------------------------------------------------
-- Mesma proteção das outras tabelas: nada pela API pública do Supabase
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r text;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['service_areas', 'service_price_ranges', 'caregiver_service_rates', 'client_favorites'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', current_schema(), r);
    END IF;
  END LOOP;
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', current_schema());
END;
$$;
