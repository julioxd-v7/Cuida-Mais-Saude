-- =============================================================================
-- CUIDAR MAIS — Migration 003: conversas e mensagens.
--
-- Uma estrutura única para:
--   support : pessoa (cliente ou profissional) ↔ equipe de suporte
--   service : cliente ↔ profissional, SOMENTE ligada a uma solicitação de
--             atendimento (criada pelo fluxo de solicitações, próxima etapa).
--             Por isso não há como abrir conversa "service" por conta própria.
--
-- Mensagens são só de inclusão (não se edita nem apaga o que foi dito),
-- o que ajuda na mediação de conflitos e na segurança das duas partes.
-- =============================================================================

CREATE TABLE conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             text NOT NULL CHECK (kind IN ('support', 'service')),
  subject          text CHECK (subject IS NULL OR char_length(btrim(subject)) BETWEEN 3 AND 120),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Preenchido quando existir a tabela de solicitações (kind = 'service').
  service_request_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  last_message_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversations_kind_status_idx ON conversations (kind, status, last_message_at DESC);

CREATE TRIGGER conversations_touch BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE conversation_participants (
  conversation_id  uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- member: dono/parte da conversa | support: atendente da equipe
  participant_role text NOT NULL CHECK (participant_role IN ('member', 'support')),
  last_read_at     timestamptz,
  joined_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX conversation_participants_user_idx ON conversation_participants (user_id);

CREATE TABLE messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id        uuid REFERENCES users (id) ON DELETE SET NULL,
  body             text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);

-- Conversa "service" só nasce pelo fluxo de solicitações (função privilegiada futura).
CREATE FUNCTION guard_conversations() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF is_privileged() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.kind <> 'support' THEN
    RAISE EXCEPTION 'Conversa entre cliente e profissional só existe a partir de uma solicitação'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.kind IS DISTINCT FROM OLD.kind OR NEW.created_by IS DISTINCT FROM OLD.created_by) THEN
    RAISE EXCEPTION 'Conversa não pode mudar de tipo ou de dono' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversations_guard BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION guard_conversations();

-- Mensagens: só de inclusão; só quem participa escreve; conversa fechada não recebe.
CREATE FUNCTION guard_messages() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  c conversations;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Mensagens não podem ser alteradas ou apagadas' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO c FROM conversations WHERE id = NEW.conversation_id;
  IF c.status <> 'open' THEN
    RAISE EXCEPTION 'CONVERSATION_CLOSED' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM conversation_participants
     WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'Só participantes podem escrever nesta conversa' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  UPDATE conversation_participants SET last_read_at = NEW.created_at
   WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_guard BEFORE INSERT OR UPDATE OR DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION guard_messages();

-- Abre um chamado de suporte já com a primeira mensagem (atômico).
CREATE FUNCTION open_support_conversation(p_user_id uuid, p_subject text, p_body text) RETURNS conversations
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  c conversations;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND role IN ('client', 'caregiver') AND status = 'active') THEN
    RAISE EXCEPTION 'Somente clientes e profissionais abrem chamados' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO conversations (kind, subject, created_by) VALUES ('support', btrim(p_subject), p_user_id)
  RETURNING * INTO c;
  INSERT INTO conversation_participants (conversation_id, user_id, participant_role)
  VALUES (c.id, p_user_id, 'member');
  INSERT INTO messages (conversation_id, sender_id, body) VALUES (c.id, p_user_id, btrim(p_body));

  SELECT * INTO c FROM conversations WHERE id = c.id;
  RETURN c;
END;
$$;

-- Admin responde um chamado: entra como atendente (se ainda não estiver) e envia.
CREATE FUNCTION support_reply(p_admin_id uuid, p_conversation_id uuid, p_body text) RETURNS messages
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
  m messages;
BEGIN
  PERFORM assert_active_admin(p_admin_id);
  IF NOT EXISTS (SELECT 1 FROM conversations WHERE id = p_conversation_id AND kind = 'support') THEN
    RAISE EXCEPTION 'Chamado não encontrado' USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO conversation_participants (conversation_id, user_id, participant_role)
  VALUES (p_conversation_id, p_admin_id, 'support')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  INSERT INTO messages (conversation_id, sender_id, body) VALUES (p_conversation_id, p_admin_id, btrim(p_body))
  RETURNING * INTO m;
  RETURN m;
END;
$$;

DO $$
DECLARE
  r text;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversations', 'conversation_participants', 'messages'] LOOP
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
