-- =============================================================================
-- CUIDAR MAIS — Migration 002: categorias profissionais, tipos de serviço,
-- CPF, registro no conselho, documentos de verificação e selo de verificado.
--
-- Categorias no MVP: cuidador(a) de idosos, enfermeiro(a), fisioterapeuta.
-- Técnico de enfermagem fica fora do MVP (exige supervisão de enfermeiro).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Catálogo: o que cada categoria pode atender e o que precisa comprovar
-- ---------------------------------------------------------------------------

-- Tipos de serviço:
--   care               cuidado e companhia (atividades diárias, conforto, segurança)
--   nursing_procedure  procedimentos de enfermagem (medicação, curativos, sinais vitais)
--   nursing_assessment avaliação e plano de cuidados de enfermagem
--   physiotherapy      avaliação e tratamento fisioterapêutico
CREATE FUNCTION profession_service_types(p_profession text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path FROM CURRENT AS $$
  SELECT CASE p_profession
    WHEN 'caregiver'       THEN ARRAY['care']
    WHEN 'nurse'           THEN ARRAY['care', 'nursing_procedure', 'nursing_assessment']
    WHEN 'physiotherapist' THEN ARRAY['physiotherapy']
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE FUNCTION profession_requires_council(p_profession text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path FROM CURRENT AS $$
  SELECT p_profession IN ('nurse', 'physiotherapist');
$$;

-- Documentos obrigatórios para enviar o perfil para análise.
CREATE FUNCTION profession_required_documents(p_profession text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path FROM CURRENT AS $$
  SELECT CASE p_profession
    WHEN 'caregiver'       THEN ARRAY['identity', 'criminal_record', 'proof_of_address', 'course_certificate']
    WHEN 'nurse'           THEN ARRAY['identity', 'criminal_record', 'proof_of_address', 'council_card']
    WHEN 'physiotherapist' THEN ARRAY['identity', 'criminal_record', 'proof_of_address', 'council_card']
    ELSE ARRAY[]::text[]
  END;
$$;

-- CPF válido (dígitos verificadores). Também validado no backend e no app.
CREATE FUNCTION cpf_is_valid(p_cpf text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path FROM CURRENT AS $$
DECLARE
  digits int[];
  total int;
  check1 int;
  check2 int;
BEGIN
  IF p_cpf IS NULL OR p_cpf !~ '^[0-9]{11}$' OR p_cpf ~ '^(.)\1{10}$' THEN
    RETURN false;
  END IF;
  SELECT array_agg(substr(p_cpf, i, 1)::int ORDER BY i) INTO digits FROM generate_series(1, 11) AS i;

  total := 0;
  FOR i IN 1..9 LOOP total := total + digits[i] * (11 - i); END LOOP;
  check1 := (total * 10) % 11;
  IF check1 = 10 THEN check1 := 0; END IF;

  total := 0;
  FOR i IN 1..10 LOOP total := total + digits[i] * (12 - i); END LOOP;
  check2 := (total * 10) % 11;
  IF check2 = 10 THEN check2 := 0; END IF;

  RETURN check1 = digits[10] AND check2 = digits[11];
END;
$$;

-- ---------------------------------------------------------------------------
-- Perfil profissional: categoria, CPF, conselho, bairro de atuação
-- (o endereço residencial do profissional NUNCA é exibido a clientes)
-- ---------------------------------------------------------------------------

ALTER TABLE caregiver_profiles
  ADD COLUMN profession text CHECK (profession IS NULL OR profession IN ('caregiver', 'nurse', 'physiotherapist')),
  ADD COLUMN cpf text CHECK (cpf IS NULL OR cpf_is_valid(cpf)),
  ADD COLUMN council_number text CHECK (council_number IS NULL OR council_number ~ '^[0-9A-Za-z./-]{3,20}$'),
  ADD COLUMN council_state char(2),
  ADD COLUMN service_district text CHECK (service_district IS NULL OR char_length(service_district) <= 80);

CREATE UNIQUE INDEX caregiver_profiles_cpf_key ON caregiver_profiles (cpf) WHERE cpf IS NOT NULL;

-- Completo = dados profissionais + identificação + conselho (quando exigido).
CREATE OR REPLACE FUNCTION caregiver_profile_is_complete(p caregiver_profiles) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path FROM CURRENT AS $$
  SELECT p.profession IS NOT NULL
     AND p.cpf IS NOT NULL
     AND (NOT profession_requires_council(p.profession)
          OR (p.council_number IS NOT NULL AND p.council_state IS NOT NULL))
     AND p.bio IS NOT NULL AND char_length(btrim(p.bio)) >= 30
     AND p.experience_years IS NOT NULL
     AND cardinality(p.specialties) > 0
     AND p.service_city IS NOT NULL AND char_length(btrim(p.service_city)) >= 2
     AND p.service_state IS NOT NULL
     AND p.service_radius_km IS NOT NULL
     AND cardinality(p.availability_days) > 0
     AND cardinality(p.availability_periods) > 0;
$$;

-- Mudar profissão, CPF ou conselho de um perfil em análise ou aprovado volta
-- o perfil para "completed": precisa de nova análise (o selo some).
CREATE OR REPLACE FUNCTION guard_caregiver_verification() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF is_privileged() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.verification_status <> 'incomplete' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Perfil de cuidador deve começar incompleto' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verification_note IS DISTINCT FROM OLD.verification_note
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
    RAISE EXCEPTION 'Estado de verificação só pode ser alterado pelo fluxo de verificação'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF OLD.verification_status IN ('pending_review', 'approved')
     AND (NEW.profession IS DISTINCT FROM OLD.profession
          OR NEW.cpf IS DISTINCT FROM OLD.cpf
          OR NEW.council_number IS DISTINCT FROM OLD.council_number
          OR NEW.council_state IS DISTINCT FROM OLD.council_state) THEN
    NEW.verification_status := 'completed';
    NEW.submitted_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Documentos de verificação (arquivos ficam no armazenamento privado;
-- aqui só os metadados)
-- ---------------------------------------------------------------------------

CREATE TABLE caregiver_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id  uuid NOT NULL REFERENCES caregiver_profiles (user_id) ON DELETE CASCADE,
  -- identity          documento com foto (RG ou CNH)
  -- criminal_record   certidão de antecedentes criminais
  -- proof_of_address  comprovante de residência (não é mostrado a clientes)
  -- course_certificate certificado de curso de cuidador
  -- council_card      carteira/registro no conselho (COREN, CREFITO)
  -- other             outros certificados
  doc_type      text NOT NULL
                CHECK (doc_type IN ('identity', 'criminal_record', 'proof_of_address', 'course_certificate', 'council_card', 'other')),
  storage_path  text NOT NULL UNIQUE,
  content_type  text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic')),
  size_bytes    integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  -- uploading → submitted → accepted | rejected
  status        text NOT NULL DEFAULT 'uploading'
                CHECK (status IN ('uploading', 'submitted', 'accepted', 'rejected')),
  review_note   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  submitted_at  timestamptz,
  reviewed_at   timestamptz,
  reviewed_by   uuid REFERENCES users (id)
);

CREATE INDEX caregiver_documents_caregiver_idx ON caregiver_documents (caregiver_id, doc_type);

CREATE FUNCTION guard_caregiver_documents() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF is_privileged() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'uploading' OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL THEN
      RAISE EXCEPTION 'Documento deve começar em envio' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- O dono só pode concluir o envio (uploading → submitted). Analisar é do admin.
  IF NEW.caregiver_id IS DISTINCT FROM OLD.caregiver_id
     OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.doc_type IS DISTINCT FROM OLD.doc_type
     OR NEW.review_note IS DISTINCT FROM OLD.review_note
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NOT (NEW.status = OLD.status OR (OLD.status = 'uploading' AND NEW.status = 'submitted')) THEN
    RAISE EXCEPTION 'Análise de documentos é exclusiva da equipe de verificação'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER caregiver_documents_guard BEFORE INSERT OR UPDATE ON caregiver_documents
  FOR EACH ROW EXECUTE FUNCTION guard_caregiver_documents();

-- Documentos obrigatórios que ainda faltam (enviados ou aceitos contam).
CREATE FUNCTION caregiver_missing_documents(p_user_id uuid) RETURNS text[]
LANGUAGE sql STABLE SET search_path FROM CURRENT AS $$
  SELECT coalesce(array_agg(required ORDER BY required), ARRAY[]::text[])
    FROM caregiver_profiles p,
         unnest(profession_required_documents(p.profession)) AS required
   WHERE p.user_id = p_user_id
     AND NOT EXISTS (
       SELECT 1 FROM caregiver_documents d
        WHERE d.caregiver_id = p.user_id AND d.doc_type = required AND d.status IN ('submitted', 'accepted')
     );
$$;

-- ---------------------------------------------------------------------------
-- Envio para análise e decisão do admin passam a exigir os documentos
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

CREATE OR REPLACE FUNCTION admin_set_caregiver_status(
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

  IF p_status = 'approved' AND cardinality(caregiver_missing_documents(p_caregiver_id)) > 0 THEN
    RAISE EXCEPTION 'DOCUMENTS_MISSING' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM enable_privileged();
  UPDATE caregiver_profiles
     SET verification_status = p_status,
         verification_note = p_note,
         reviewed_at = now(),
         reviewed_by = p_admin_id
   WHERE user_id = p_caregiver_id
  RETURNING * INTO p;

  -- Aprovar aceita os documentos enviados; reprovar os marca como reprovados.
  IF p_status IN ('approved', 'rejected') THEN
    UPDATE caregiver_documents
       SET status = CASE WHEN p_status = 'approved' THEN 'accepted' ELSE 'rejected' END,
           review_note = CASE WHEN p_status = 'rejected' THEN p_note END,
           reviewed_at = now(),
           reviewed_by = p_admin_id
     WHERE caregiver_id = p_caregiver_id AND status = 'submitted';
  END IF;
  PERFORM disable_privileged();

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'caregiver.verification_changed', 'caregiver_profile', p_caregiver_id,
          jsonb_build_object('status', p_status, 'note', p_note));

  RETURN p;
END;
$$;

-- Reprovado reenvia: os documentos reprovados não contam mais como enviados,
-- então ele precisa mandar novos (caregiver_missing_documents só conta
-- submitted/accepted).

-- ---------------------------------------------------------------------------
-- Supabase: RLS e bloqueio da API pública também na tabela nova.
-- Bucket privado para os arquivos (quando o Supabase Storage existir).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r text;
BEGIN
  ALTER TABLE caregiver_documents ENABLE ROW LEVEL SECURITY;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', current_schema(), r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM %I', current_schema(), r);
    END IF;
  END LOOP;

  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', current_schema());

  -- Só no schema real (não nos schemas temporários de teste).
  IF current_schema() = 'app' AND to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('caregiver-documents', 'caregiver-documents', false, 10485760,
            ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;
