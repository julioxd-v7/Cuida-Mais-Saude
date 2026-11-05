import { z } from 'zod';

import { translateDbError } from '../../db/errors.ts';
import { errors, HttpError, validationError } from '../../http/errors.ts';
import type { RequestContext, Router } from '../../http/router.ts';
import type { Deps } from '../deps.ts';
import { authenticate, type AuthContext } from '../guard.ts';

/**
 * Conversas: chamados de suporte (agora) e chat cliente ↔ profissional
 * (quando houver solicitação de atendimento — próxima etapa).
 *
 * Acesso: só participantes leem e escrevem. Administradores também acessam
 * chamados de suporte. O app atualiza as mensagens consultando
 * GET /v1/conversations/:id?after=<id da última mensagem> a cada poucos segundos.
 * (Cursor por id, não por data: o banco guarda microssegundos e o JavaScript não.)
 */

const bodySchema = z.string().trim().min(1, 'Escreva uma mensagem.').max(2000, 'A mensagem pode ter até 2000 caracteres.');

const openSupportSchema = z
  .object({
    subject: z.string().trim().min(3, 'Informe o assunto.').max(120, 'Assunto longo demais.'),
    message: bodySchema,
  })
  .strict();

const sendSchema = z.object({ body: bodySchema }).strict();
const statusSchema = z.object({ status: z.enum(['open', 'closed']) }).strict();

type Row = Record<string, unknown>;

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function toConversation(row: Row) {
  return {
    id: String(row.id),
    kind: String(row.kind),
    subject: row.subject === null ? null : String(row.subject),
    status: String(row.status),
    lastMessageAt: iso(row.last_message_at),
    lastMessage: row.last_body === undefined || row.last_body === null ? null : String(row.last_body),
    unreadCount: row.unread === undefined ? 0 : Number(row.unread),
    createdAt: iso(row.created_at),
  };
}

function toMessage(row: Row, viewerId: string) {
  return {
    id: String(row.id),
    body: String(row.body),
    createdAt: iso(row.created_at),
    mine: row.sender_id === viewerId,
    /** Mensagem da equipe do Cuidar Mais (aparece como "Suporte"). */
    fromSupport: row.participant_role === 'support',
  };
}

/** Confere se a pessoa pode ver a conversa. Outra conta → 404 (não revela que existe). */
async function loadConversationFor(deps: Deps, auth: AuthContext, conversationId: string) {
  let rows: Row[];
  try {
    rows = await deps.db.query(
      `SELECT c.*, p.participant_role AS my_role
         FROM conversations c
         LEFT JOIN conversation_participants p ON p.conversation_id = c.id AND p.user_id = $2
        WHERE c.id = $1`,
      [conversationId, auth.userId],
    );
  } catch (error) {
    throw translateDbError(error);
  }
  const conversation = rows[0];
  if (!conversation) throw errors.notFound();
  const isParticipant = conversation.my_role !== null && conversation.my_role !== undefined;
  const isSupportAdmin = auth.role === 'admin' && conversation.kind === 'support';
  if (!isParticipant && !isSupportAdmin) throw errors.notFound();
  return { conversation, isParticipant };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function afterParam(ctx: RequestContext): string | null {
  const value = new URL(ctx.req.url ?? '/', 'http://localhost').searchParams.get('after');
  return value && UUID.test(value) ? value : null;
}

export function registerMessageRoutes(router: Router, deps: Deps): void {
  router.add('GET', '/v1/conversations', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client', 'caregiver']);
    const rows = await deps.db.query(
      `SELECT c.*,
              (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              (SELECT count(*)::int FROM messages m
                WHERE m.conversation_id = c.id
                  AND m.created_at > coalesce(p.last_read_at, '-infinity'::timestamptz)
                  AND m.sender_id IS DISTINCT FROM $1) AS unread
         FROM conversations c
         JOIN conversation_participants p ON p.conversation_id = c.id AND p.user_id = $1
        ORDER BY c.last_message_at DESC
        LIMIT 50`,
      [auth.userId],
    );
    return { status: 200, body: { conversations: rows.map(toConversation) } };
  });

  router.add('POST', '/v1/support/conversations', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client', 'caregiver']);
    const parsed = openSupportSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    if (!deps.limits.messages.consume(`msg:${auth.userId}`)) throw errors.rateLimited();

    try {
      const [row] = await deps.db.query(`SELECT * FROM open_support_conversation($1, $2, $3)`, [
        auth.userId,
        parsed.data.subject,
        parsed.data.message,
      ]);
      if (!row) throw new Error('Chamado não criado');
      return { status: 201, body: { conversation: toConversation({ ...row, last_body: parsed.data.message }) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  router.add('GET', '/v1/conversations/:id', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client', 'caregiver', 'admin']);
    const { conversation, isParticipant } = await loadConversationFor(deps, auth, ctx.params.id ?? '');
    const after = afterParam(ctx);

    const rows = await deps.db.query(
      `SELECT * FROM (
         SELECT m.*, p.participant_role
           FROM messages m
           LEFT JOIN conversation_participants p ON p.conversation_id = m.conversation_id AND p.user_id = m.sender_id
          WHERE m.conversation_id = $1
            AND ($2::uuid IS NULL OR (m.created_at, m.id) > (
                  SELECT a.created_at, a.id FROM messages a WHERE a.id = $2::uuid AND a.conversation_id = $1))
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 200
       ) recent ORDER BY created_at, id`,
      [conversation.id, after],
    );

    if (isParticipant) {
      await deps.db.query(
        `UPDATE conversation_participants SET last_read_at = now() WHERE conversation_id = $1 AND user_id = $2 RETURNING user_id`,
        [conversation.id, auth.userId],
      );
    }

    return {
      status: 200,
      body: { conversation: toConversation(conversation), messages: rows.map((row) => toMessage(row, auth.userId)) },
    };
  });

  router.add('POST', '/v1/conversations/:id/messages', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client', 'caregiver', 'admin']);
    const parsed = sendSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    if (!deps.limits.messages.consume(`msg:${auth.userId}`)) throw errors.rateLimited();

    const { conversation, isParticipant } = await loadConversationFor(deps, auth, ctx.params.id ?? '');
    if (conversation.status !== 'open') {
      throw new HttpError(409, 'CONVERSATION_CLOSED', 'Esta conversa foi encerrada. Abra um novo chamado se precisar.');
    }

    try {
      const [row] =
        auth.role === 'admin'
          ? await deps.db.query(`SELECT *, 'support'::text AS participant_role FROM support_reply($1, $2, $3)`, [
              auth.userId,
              conversation.id,
              parsed.data.body,
            ])
          : isParticipant
            ? await deps.db.query(
                `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3)
                 RETURNING *, (SELECT participant_role FROM conversation_participants
                                WHERE conversation_id = $1 AND user_id = $2) AS participant_role`,
                [conversation.id, auth.userId, parsed.data.body],
              )
            : [];
      if (!row) throw errors.notFound();
      return { status: 201, body: { message: toMessage(row, auth.userId) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /** Encerrar ou reabrir: o dono do chamado de suporte ou um admin. */
  router.add('POST', '/v1/conversations/:id/status', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client', 'caregiver', 'admin']);
    const parsed = statusSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    const { conversation } = await loadConversationFor(deps, auth, ctx.params.id ?? '');

    const isOwner = conversation.created_by === auth.userId;
    if (conversation.kind !== 'support' || !(isOwner || auth.role === 'admin')) throw errors.forbidden();
    if (parsed.data.status === 'open' && auth.role !== 'admin') throw errors.forbidden();

    const [row] = await deps.db.query(`UPDATE conversations SET status = $2 WHERE id = $1 RETURNING *`, [
      conversation.id,
      parsed.data.status,
    ]);
    if (!row) throw errors.notFound();
    return { status: 200, body: { conversation: toConversation(row) } };
  });

  /** Admin: fila de chamados de suporte (abertos primeiro). */
  router.add('GET', '/v1/admin/support/conversations', async (ctx) => {
    await authenticate(deps, ctx, ['admin']);
    const rows = await deps.db.query(
      `SELECT c.*, u.full_name AS opened_by_name, u.role AS opened_by_role,
              (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body
         FROM conversations c JOIN users u ON u.id = c.created_by
        WHERE c.kind = 'support'
        ORDER BY (c.status = 'open') DESC, c.last_message_at DESC
        LIMIT 100`,
    );
    return {
      status: 200,
      body: {
        conversations: rows.map((row) => ({
          ...toConversation(row),
          openedBy: { id: String(row.created_by), name: String(row.opened_by_name), role: String(row.opened_by_role) },
        })),
      },
    };
  });
}
