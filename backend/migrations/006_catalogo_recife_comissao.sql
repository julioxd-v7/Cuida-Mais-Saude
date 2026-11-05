-- =============================================================================
-- CUIDAR MAIS — Migration 006 (Fase F0 da docs/ESPECIFICACAO_MVP.md)
--
--  * Catálogo de categorias de serviço (CAT-01..03): MVP só NÃO CLÍNICO.
--    Categorias clínicas ficam cadastradas e DESATIVADAS; só um admin as
--    ativa, e só com parecer jurídico registrado (legal_clearances).
--  * Aprovação por categoria (CAT-04): caregiver_categories.
--  * Área-piloto: Recife ativo; demais municípios da RMR inativos; São Paulo
--    inativo (P3). Faixas de preço de Recife PROVISÓRIAS (D13).
--  * Configurações comerciais (ADM-22): comissão 20% (P2) e padrões
--    provisórios da seção 11, editáveis pelo admin.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Pareceres jurídicos/regulatórios (ADM-21) — pré-requisito de categoria clínica
-- ---------------------------------------------------------------------------
CREATE TABLE legal_clearances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic         text NOT NULL CHECK (topic IN ('clinical_services', 'payments_live', 'other')),
  document_ref  text NOT NULL CHECK (char_length(btrim(document_ref)) BETWEEN 3 AND 300),
  issued_on     date NOT NULL,
  responsible   text NOT NULL CHECK (char_length(btrim(responsible)) BETWEEN 3 AND 160),
  valid_until   date,
  created_by    uuid REFERENCES users (id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER legal_clearances_guard BEFORE INSERT OR UPDATE OR DELETE ON legal_clearances
  FOR EACH ROW EXECUTE FUNCTION guard_admin_only_table();

CREATE FUNCTION has_valid_clearance(p_topic text) RETURNS boolean
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT EXISTS (
    SELECT 1 FROM legal_clearances
     WHERE topic = p_topic AND issued_on <= current_date
       AND (valid_until IS NULL OR valid_until >= current_date)
  );
$$;

-- ---------------------------------------------------------------------------
-- Catálogo de categorias (CAT-01, CAT-02, CAT-03)
-- ---------------------------------------------------------------------------
CREATE TABLE service_categories (
  code                 text PRIMARY KEY CHECK (code ~ '^[a-z_]{3,40}$'),
  name                 text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 80),
  description          text NOT NULL DEFAULT '',
  includes             text[] NOT NULL DEFAULT '{}',
  excludes             text[] NOT NULL DEFAULT '{}',
  required_documents   text[] NOT NULL DEFAULT '{}',
  min_hours            integer CHECK (min_hours IS NULL OR min_hours BETWEEN 1 AND 24),
  max_hours            integer CHECK (max_hours IS NULL OR max_hours BETWEEN 1 AND 24),
  cancellation_policy  text,
  emergency_notice     text,
  clinical             boolean NOT NULL DEFAULT false,
  allowed_professions  text[] NOT NULL DEFAULT ARRAY['caregiver', 'nurse', 'physiotherapist'],
  enabled              boolean NOT NULL DEFAULT false,
  sort_order           integer NOT NULL DEFAULT 100,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (min_hours IS NULL OR max_hours IS NULL OR min_hours <= max_hours),
  -- CAT-02: só ativa com a ficha completa.
  CHECK (NOT enabled OR (
    cardinality(includes) > 0 AND cardinality(excludes) > 0
    AND min_hours IS NOT NULL AND max_hours IS NOT NULL
    AND cancellation_policy IS NOT NULL AND char_length(btrim(cancellation_policy)) > 0
    AND emergency_notice IS NOT NULL AND char_length(btrim(emergency_notice)) > 0
  ))
);

CREATE FUNCTION guard_service_category() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NOT is_privileged() THEN
    RAISE EXCEPTION 'Somente a administração altera o catálogo' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- CAT-03: categoria clínica só ativa com parecer válido.
  IF TG_OP <> 'DELETE' AND NEW.enabled AND NEW.clinical AND NOT has_valid_clearance('clinical_services') THEN
    RAISE EXCEPTION 'CLINICAL_CLEARANCE_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER service_categories_guard BEFORE INSERT OR UPDATE OR DELETE ON service_categories
  FOR EACH ROW EXECUTE FUNCTION guard_service_category();

DO $$
BEGIN
  PERFORM enable_privileged();
  INSERT INTO service_categories
    (code, name, description, includes, excludes, required_documents, min_hours, max_hours,
     cancellation_policy, emergency_notice, clinical, allowed_professions, enabled, sort_order)
  VALUES
    ('companionship', 'Companhia e acompanhamento',
     'Presença, conversa e companhia, inclusive em atividades fora de casa.',
     ARRAY['Presença e conversa', 'Acompanhamento em passeios e atividades externas', 'Apoio não clínico no dia a dia'],
     ARRAY['Qualquer ato de saúde (medicação, curativos, procedimentos)', 'Avaliação ou orientação clínica'],
     ARRAY['identity', 'criminal_record', 'proof_of_address'],
     2, 12,
     'Cancelamento grátis até 24 horas antes do início. Depois disso, parte do valor é paga ao profissional.',
     'O Cuidar+ não é serviço de emergência. Em emergência médica ligue 192 (SAMU); em risco à segurança, 190.',
     false, ARRAY['caregiver', 'nurse', 'physiotherapist'], true, 10),
    ('daily_support', 'Apoio cotidiano domiciliar',
     'Ajuda em tarefas rotineiras permitidas e organização leve da casa da pessoa atendida.',
     ARRAY['Tarefas rotineiras permitidas', 'Organização leve', 'Suporte não especializado'],
     ARRAY['Medicação, curativos ou procedimentos', 'Faxina pesada ou serviços domésticos gerais'],
     ARRAY['identity', 'criminal_record', 'proof_of_address'],
     2, 12,
     'Cancelamento grátis até 24 horas antes do início. Depois disso, parte do valor é paga ao profissional.',
     'O Cuidar+ não é serviço de emergência. Em emergência médica ligue 192 (SAMU); em risco à segurança, 190.',
     false, ARRAY['caregiver', 'nurse', 'physiotherapist'], true, 20),
    ('appointment_escort', 'Acompanhamento a compromissos',
     'Ir junto a consultas, exames e outras atividades, sem executar atos de saúde.',
     ARRAY['Acompanhar a consultas e exames', 'Acompanhar em compromissos e atividades'],
     ARRAY['Executar atos de saúde', 'Tomar decisões clínicas pela pessoa atendida'],
     ARRAY['identity', 'criminal_record', 'proof_of_address'],
     2, 8,
     'Cancelamento grátis até 24 horas antes do início. Depois disso, parte do valor é paga ao profissional.',
     'O Cuidar+ não é serviço de emergência. Em emergência médica ligue 192 (SAMU); em risco à segurança, 190.',
     false, ARRAY['caregiver', 'nurse', 'physiotherapist'], true, 30),
    ('family_support', 'Apoio à família',
     'Comunicação com a família, registro de horários e confirmação do atendimento, respeitando a privacidade.',
     ARRAY['Comunicação operacional com a família', 'Registro de horários', 'Confirmação do atendimento'],
     ARRAY['Diagnóstico ou orientação clínica', 'Compartilhar informações sem autorização'],
     ARRAY['identity', 'criminal_record', 'proof_of_address'],
     2, 12,
     'Cancelamento grátis até 24 horas antes do início. Depois disso, parte do valor é paga ao profissional.',
     'O Cuidar+ não é serviço de emergência. Em emergência médica ligue 192 (SAMU); em risco à segurança, 190.',
     false, ARRAY['caregiver', 'nurse', 'physiotherapist'], true, 40),
    -- Tipos anteriores: guardados, desativados.
    ('care', 'Cuidado e companhia (substituído)', 'Tipo anterior, substituído pelas categorias não clínicas.',
     '{}', '{}', '{}', NULL, NULL, NULL, NULL, false, ARRAY['caregiver', 'nurse'], false, 900),
    ('nursing_procedure', 'Procedimentos de enfermagem', 'Serviço clínico: só após parecer jurídico e regulatório.',
     '{}', '{}', ARRAY['identity', 'criminal_record', 'proof_of_address', 'council_card'], NULL, NULL, NULL, NULL,
     true, ARRAY['nurse'], false, 910),
    ('nursing_assessment', 'Avaliação e plano de enfermagem', 'Serviço clínico: só após parecer jurídico e regulatório.',
     '{}', '{}', ARRAY['identity', 'criminal_record', 'proof_of_address', 'council_card'], NULL, NULL, NULL, NULL,
     true, ARRAY['nurse'], false, 920),
    ('physiotherapy', 'Fisioterapia', 'Serviço clínico: só após parecer jurídico e regulatório.',
     '{}', '{}', ARRAY['identity', 'criminal_record', 'proof_of_address', 'council_card'], NULL, NULL, NULL, NULL,
     true, ARRAY['physiotherapist'], false, 930);
  PERFORM disable_privileged();
END;
$$;

-- Faixas e valores passam a referenciar o catálogo (em vez de lista fixa).
ALTER TABLE service_price_ranges DROP CONSTRAINT service_price_ranges_service_type_check,
  ADD CONSTRAINT service_price_ranges_category_fk FOREIGN KEY (service_type) REFERENCES service_categories (code);
ALTER TABLE caregiver_service_rates DROP CONSTRAINT caregiver_service_rates_service_type_check,
  ADD CONSTRAINT caregiver_service_rates_category_fk FOREIGN KEY (service_type) REFERENCES service_categories (code);

CREATE OR REPLACE FUNCTION is_service_type(p text) RETURNS boolean
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT EXISTS (SELECT 1 FROM service_categories WHERE code = p);
$$;

-- ---------------------------------------------------------------------------
-- Categorias de cada profissional, aprovadas uma a uma (CAT-04)
-- ---------------------------------------------------------------------------
CREATE TABLE caregiver_categories (
  caregiver_id   uuid NOT NULL REFERENCES caregiver_profiles (user_id) ON DELETE CASCADE,
  category_code  text NOT NULL REFERENCES service_categories (code),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  note           text CHECK (note IS NULL OR char_length(note) <= 500),
  requested_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz,
  reviewed_by    uuid REFERENCES users (id),
  PRIMARY KEY (caregiver_id, category_code)
);

-- Só o fluxo privilegiado (funções abaixo) grava aqui.
CREATE TRIGGER caregiver_categories_guard BEFORE INSERT OR UPDATE OR DELETE ON caregiver_categories
  FOR EACH ROW EXECUTE FUNCTION guard_admin_only_table();

-- Profissional escolhe as categorias que quer oferecer (substitui a lista inteira).
CREATE FUNCTION caregiver_set_categories(p_user_id uuid, p_codes text[]) RETURNS void
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  p caregiver_profiles;
  c text;
BEGIN
  SELECT * INTO p FROM caregiver_profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de cuidador não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
  FOREACH c IN ARRAY coalesce(p_codes, '{}') LOOP
    IF NOT EXISTS (
      SELECT 1 FROM service_categories s
       WHERE s.code = c AND s.enabled AND (p.profession IS NULL OR p.profession = ANY (s.allowed_professions))
    ) THEN
      RAISE EXCEPTION 'CATEGORY_NOT_AVAILABLE' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  PERFORM enable_privileged();
  DELETE FROM caregiver_categories WHERE caregiver_id = p_user_id AND NOT (category_code = ANY (coalesce(p_codes, '{}')));
  DELETE FROM caregiver_service_rates WHERE caregiver_id = p_user_id AND NOT (service_type = ANY (coalesce(p_codes, '{}')));
  INSERT INTO caregiver_categories (caregiver_id, category_code, status)
  SELECT p_user_id, code, 'pending'
    FROM unnest(coalesce(p_codes, '{}')) AS code
  ON CONFLICT (caregiver_id, category_code) DO NOTHING;
  PERFORM disable_privileged();
END;
$$;

-- Admin aprova/recusa/suspende uma categoria de um profissional.
CREATE FUNCTION admin_set_caregiver_category(
  p_admin_id uuid, p_caregiver_id uuid, p_code text, p_status text, p_note text DEFAULT NULL
) RETURNS caregiver_categories
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  r caregiver_categories;
BEGIN
  PERFORM assert_active_admin(p_admin_id);
  IF p_status NOT IN ('approved', 'rejected', 'suspended', 'pending') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'check_violation';
  END IF;
  IF p_status = 'approved' AND NOT EXISTS (SELECT 1 FROM service_categories WHERE code = p_code AND enabled) THEN
    RAISE EXCEPTION 'CATEGORY_NOT_AVAILABLE' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM enable_privileged();
  UPDATE caregiver_categories
     SET status = p_status, note = p_note, reviewed_at = now(), reviewed_by = p_admin_id
   WHERE caregiver_id = p_caregiver_id AND category_code = p_code
  RETURNING * INTO r;
  PERFORM disable_privileged();
  IF r IS NULL THEN
    RAISE EXCEPTION 'Categoria não solicitada pelo profissional' USING ERRCODE = 'no_data_found';
  END IF;
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'caregiver.category_' || p_status, 'caregiver_profile', p_caregiver_id,
          jsonb_build_object('category', p_code, 'note', p_note));
  RETURN r;
END;
$$;

-- Ao aprovar o perfil, as categorias pendentes (ativas) também são aprovadas.
-- Ao perder a aprovação, nada muda nas categorias: a busca já exige perfil aprovado.
CREATE FUNCTION approve_pending_categories() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  -- Roda dentro de admin_set_caregiver_status (já privilegiada): restaura o estado ao sair.
  was_privileged boolean := is_privileged();
BEGIN
  IF NEW.verification_status = 'approved' AND OLD.verification_status IS DISTINCT FROM 'approved' THEN
    PERFORM enable_privileged();
    UPDATE caregiver_categories c
       SET status = 'approved', reviewed_at = now(), reviewed_by = NEW.reviewed_by
      FROM service_categories s
     WHERE c.caregiver_id = NEW.user_id AND c.status = 'pending' AND s.code = c.category_code AND s.enabled;
    IF NOT was_privileged THEN
      PERFORM disable_privileged();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER caregiver_profiles_approve_categories AFTER UPDATE ON caregiver_profiles
  FOR EACH ROW EXECUTE FUNCTION approve_pending_categories();

-- Categorias que o profissional pode efetivamente oferecer.
CREATE FUNCTION caregiver_offered_categories(p_user_id uuid) RETURNS text[]
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT coalesce(array_agg(c.category_code ORDER BY s.sort_order), ARRAY[]::text[])
    FROM caregiver_categories c JOIN service_categories s ON s.code = c.category_code
   WHERE c.caregiver_id = p_user_id AND c.status = 'approved' AND s.enabled;
$$;

-- ---------------------------------------------------------------------------
-- Valor por hora: agora por categoria solicitada (pendente ou aprovada)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_caregiver_rate() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  p caregiver_profiles;
  range service_price_ranges;
BEGIN
  IF is_privileged() THEN
    RETURN NEW;
  END IF;

  SELECT * INTO p FROM caregiver_profiles WHERE user_id = NEW.caregiver_id;
  IF NOT EXISTS (
    SELECT 1 FROM caregiver_categories c JOIN service_categories s ON s.code = c.category_code
     WHERE c.caregiver_id = NEW.caregiver_id AND c.category_code = NEW.service_type
       AND c.status IN ('pending', 'approved') AND s.enabled
  ) THEN
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

-- Envio para análise: exige categoria escolhida e valor para ela.
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
    SELECT 1 FROM caregiver_categories c JOIN service_categories s ON s.code = c.category_code
     WHERE c.caregiver_id = p_user_id AND c.status IN ('pending', 'approved') AND s.enabled
  ) THEN
    RAISE EXCEPTION 'CATEGORIES_MISSING' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM caregiver_service_rates r
      JOIN caregiver_categories c ON c.caregiver_id = r.caregiver_id AND c.category_code = r.service_type
     WHERE r.caregiver_id = p_user_id AND c.status IN ('pending', 'approved')
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

-- Dados anteriores (tipo "care"): viram as categorias não clínicas equivalentes.
DO $$
BEGIN
  PERFORM enable_privileged();
  INSERT INTO caregiver_categories (caregiver_id, category_code, status, reviewed_at, reviewed_by)
  SELECT r.caregiver_id, nc.code,
         CASE WHEN p.verification_status = 'approved' THEN 'approved' ELSE 'pending' END,
         CASE WHEN p.verification_status = 'approved' THEN now() END,
         CASE WHEN p.verification_status = 'approved' THEN p.reviewed_by END
    FROM caregiver_service_rates r
    JOIN caregiver_profiles p ON p.user_id = r.caregiver_id
   CROSS JOIN (VALUES ('companionship'), ('daily_support')) AS nc(code)
   WHERE r.service_type = 'care'
  ON CONFLICT DO NOTHING;
  INSERT INTO caregiver_service_rates (caregiver_id, service_type, hourly_rate_cents)
  SELECT r.caregiver_id, nc.code, r.hourly_rate_cents
    FROM caregiver_service_rates r
   CROSS JOIN (VALUES ('companionship'), ('daily_support')) AS nc(code)
   WHERE r.service_type = 'care'
  ON CONFLICT DO NOTHING;
  PERFORM disable_privileged();
END;
$$;

-- ---------------------------------------------------------------------------
-- Área-piloto: Recife (P3). Demais municípios da RMR cadastrados, inativos.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  recife uuid;
  m text;
BEGIN
  PERFORM enable_privileged();
  UPDATE service_areas SET active = false, updated_at = now() WHERE NOT (city_key = 'recife' AND state = 'PE');

  INSERT INTO service_areas (city, state, active) VALUES ('Recife', 'PE', true)
  ON CONFLICT (city_key, state) DO UPDATE SET active = true
  RETURNING id INTO recife;

  FOREACH m IN ARRAY ARRAY['Olinda', 'Jaboatão dos Guararapes', 'Paulista', 'Camaragibe', 'Cabo de Santo Agostinho',
                           'São Lourenço da Mata', 'Igarassu', 'Abreu e Lima', 'Ipojuca', 'Moreno', 'Itapissuma',
                           'Ilha de Itamaracá', 'Araçoiaba'] LOOP
    INSERT INTO service_areas (city, state, active) VALUES (m, 'PE', false) ON CONFLICT DO NOTHING;
  END LOOP;

  -- Valores PROVISÓRIOS (D13): o ticket de R$ 200 do plano é só hipótese.
  INSERT INTO service_price_ranges (service_area_id, service_type, min_hourly_cents, max_hourly_cents) VALUES
    (recife, 'companionship',      2000, 4500),
    (recife, 'daily_support',      2000, 4500),
    (recife, 'appointment_escort', 2500, 5000),
    (recife, 'family_support',     2000, 4000)
  ON CONFLICT (service_area_id, service_type) DO NOTHING;
  PERFORM disable_privileged();
END;
$$;

-- ---------------------------------------------------------------------------
-- Configurações comerciais (ADM-22). Valores com provisional = true vêm da
-- seção 11 da especificação e aparecem como "provisório" no painel.
-- ---------------------------------------------------------------------------
CREATE TABLE platform_settings (
  key          text PRIMARY KEY CHECK (key ~ '^[a-z_]{3,60}$'),
  value        numeric NOT NULL,
  unit         text NOT NULL CHECK (unit IN ('ratio', 'hours', 'minutes', 'days', 'cents', 'count', 'months')),
  min_value    numeric NOT NULL,
  max_value    numeric NOT NULL,
  provisional  boolean NOT NULL DEFAULT true,
  description  text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES users (id),
  CHECK (value BETWEEN min_value AND max_value)
);

CREATE TRIGGER platform_settings_guard BEFORE INSERT OR UPDATE OR DELETE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION guard_admin_only_table();

DO $$
BEGIN
  PERFORM enable_privileged();
  INSERT INTO platform_settings (key, value, unit, min_value, max_value, provisional, description) VALUES
    ('commission_rate',              0.20,  'ratio',   0,   0.5, false, 'Comissão da plataforma sobre o serviço concluído (P2). Repasse = 1 − comissão.'),
    ('cancel_free_hours',            24,    'hours',   0,   168, false, 'Cancelamento grátis até X horas antes do início.'),
    ('late_cancel_fee_ratio',        0.50,  'ratio',   0,   1,   true,  'Parte do valor paga ao profissional no cancelamento tardio (D3).'),
    ('immediate_free_cancel_minutes', 5,    'minutes', 0,   60,  false, 'No imediato, cancelamento grátis até X minutos após o aceite.'),
    ('immediate_accept_timeout_minutes', 10, 'minutes', 1,  60,  true,  'Tempo-limite de aceite do pedido imediato (D5).'),
    ('completion_confirm_hours',     24,    'hours',   1,   168, true,  'Janela para o cliente confirmar ou contestar a conclusão (D4).'),
    ('payout_delay_days',            7,     'days',    0,   60,  true,  'Repasse liberado D+N após a conclusão confirmada (D2).'),
    ('two_level_approval_cents',     50000, 'cents',   0,   100000000, true, 'Repasses e estornos acima deste valor exigem dois aprovadores (D8).'),
    ('no_show_alert_count',          3,     'count',   1,   20,  true,  'Ausências em 30 dias que geram alerta para operações (D6).'),
    ('profile_review_months',        12,    'months',  1,   36,  true,  'Periodicidade da revisão de perfil (D9).'),
    ('estimated_tax_ratio',          0.08,  'ratio',   0,   0.5, true,  'Tributo estimado sobre a comissão, só para relatórios (hipótese do plano).');
  PERFORM disable_privileged();
END;
$$;

CREATE FUNCTION admin_set_setting(p_admin_id uuid, p_key text, p_value numeric) RETURNS platform_settings
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  old_value numeric;
  s platform_settings;
BEGIN
  PERFORM assert_active_admin(p_admin_id);
  SELECT value INTO old_value FROM platform_settings WHERE key = p_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração desconhecida' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM enable_privileged();
  UPDATE platform_settings SET value = p_value, provisional = false, updated_at = now(), updated_by = p_admin_id
   WHERE key = p_key RETURNING * INTO s;
  PERFORM disable_privileged();
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'setting.changed', 'platform_setting', NULL,
          jsonb_build_object('key', p_key, 'from', old_value, 'to', p_value));
  RETURN s;
END;
$$;

CREATE FUNCTION setting(p_key text) RETURNS numeric
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT value FROM platform_settings WHERE key = p_key;
$$;

-- ---------------------------------------------------------------------------
-- Funções administrativas do catálogo e dos pareceres
-- ---------------------------------------------------------------------------
CREATE FUNCTION admin_update_category(
  p_admin_id uuid, p_code text, p_name text, p_description text, p_includes text[], p_excludes text[],
  p_min_hours integer, p_max_hours integer, p_cancellation_policy text, p_emergency_notice text, p_enabled boolean
) RETURNS service_categories
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  before service_categories;
  s service_categories;
BEGIN
  PERFORM assert_active_admin(p_admin_id);
  SELECT * INTO before FROM service_categories WHERE code = p_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoria não encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM enable_privileged();
  UPDATE service_categories SET
    name = coalesce(p_name, name),
    description = coalesce(p_description, description),
    includes = coalesce(p_includes, includes),
    excludes = coalesce(p_excludes, excludes),
    min_hours = coalesce(p_min_hours, min_hours),
    max_hours = coalesce(p_max_hours, max_hours),
    cancellation_policy = coalesce(p_cancellation_policy, cancellation_policy),
    emergency_notice = coalesce(p_emergency_notice, emergency_notice),
    enabled = coalesce(p_enabled, enabled)
  WHERE code = p_code
  RETURNING * INTO s;
  PERFORM disable_privileged();
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'category.updated', 'service_category', NULL,
          jsonb_build_object('code', p_code, 'enabledFrom', before.enabled, 'enabledTo', s.enabled));
  RETURN s;
END;
$$;

CREATE FUNCTION admin_add_legal_clearance(
  p_admin_id uuid, p_topic text, p_document_ref text, p_issued_on date, p_responsible text, p_valid_until date
) RETURNS legal_clearances
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  l legal_clearances;
BEGIN
  PERFORM assert_active_admin(p_admin_id);
  PERFORM enable_privileged();
  INSERT INTO legal_clearances (topic, document_ref, issued_on, responsible, valid_until, created_by)
  VALUES (p_topic, p_document_ref, p_issued_on, p_responsible, p_valid_until, p_admin_id)
  RETURNING * INTO l;
  PERFORM disable_privileged();
  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'legal_clearance.added', 'legal_clearance', l.id,
          jsonb_build_object('topic', p_topic, 'documentRef', p_document_ref));
  RETURN l;
END;
$$;

-- Mesmas proteções das outras tabelas.
DO $$
DECLARE
  r text;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['legal_clearances', 'service_categories', 'caregiver_categories', 'platform_settings'] LOOP
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
