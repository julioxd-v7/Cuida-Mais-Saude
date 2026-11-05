import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import {
  DOCUMENT_CONTENT_TYPES,
  DOCUMENT_TYPES,
  extensionFor,
  MAX_DOCUMENT_BYTES,
  PROFESSION_CATALOG,
  type Profession,
} from '../../catalog.ts';
import { translateDbError } from '../../db/errors.ts';
import { errors, HttpError, validationError } from '../../http/errors.ts';
import type { Router } from '../../http/router.ts';
import type { Deps } from '../deps.ts';
import { authenticate } from '../guard.ts';
import { toCaregiverDocument, toCaregiverProfile, toUser } from '../mappers.ts';

/**
 * Documentos de verificação do profissional.
 *
 * Fluxo de envio (o arquivo não passa pelo backend):
 *   1. POST /v1/me/caregiver-documents          → cria o registro e devolve um link de envio
 *   2. o app envia o arquivo direto para o link (PUT)
 *   3. POST /v1/me/caregiver-documents/:id/complete → o backend confere se o arquivo chegou
 *
 * Só o próprio profissional e administradores acessam os documentos.
 * Leitura pelo admin usa links que expiram em 5 minutos e fica registrada na auditoria.
 */

const MAX_DOCUMENTS_PER_CAREGIVER = 30;
const DOWNLOAD_URL_TTL_SECONDS = 300;

const createSchema = z
  .object({
    docType: z.enum(DOCUMENT_TYPES, { errorMap: () => ({ message: 'Tipo de documento desconhecido.' }) }),
    contentType: z.enum(DOCUMENT_CONTENT_TYPES, {
      errorMap: () => ({ message: 'Envie PDF ou imagem (JPG, PNG, WEBP ou HEIC).' }),
    }),
    sizeBytes: z
      .number()
      .int()
      .min(1, 'Arquivo vazio.')
      .max(MAX_DOCUMENT_BYTES, 'O arquivo pode ter no máximo 10 MB.'),
  })
  .strict();

function storageUnavailable(): HttpError {
  return new HttpError(
    503,
    'DOCUMENT_STORAGE_UNAVAILABLE',
    'O envio de documentos ainda não está disponível. Tente mais tarde ou fale com o suporte.',
  );
}

async function loadProfileStatus(deps: Deps, userId: string): Promise<string> {
  const [row] = await deps.db.query<{ verification_status: string }>(
    `SELECT verification_status FROM caregiver_profiles WHERE user_id = $1`,
    [userId],
  );
  if (!row) throw errors.notFound();
  return row.verification_status;
}

function underReview(): HttpError {
  return new HttpError(
    409,
    'UNDER_REVIEW',
    'Seu perfil está em análise. Aguarde o resultado para alterar documentos.',
  );
}

export function registerDocumentRoutes(router: Router, deps: Deps): void {
  router.add('GET', '/v1/me/caregiver-documents', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['caregiver']);
    const [profile] = await deps.db.query<{ profession: string | null }>(
      `SELECT profession FROM caregiver_profiles WHERE user_id = $1`,
      [auth.userId],
    );
    const rows = await deps.db.query(
      `SELECT * FROM caregiver_documents WHERE caregiver_id = $1 AND status <> 'uploading' ORDER BY created_at DESC`,
      [auth.userId],
    );
    const [missing] = await deps.db.query<{ missing: string[] }>(
      `SELECT caregiver_missing_documents($1) AS missing`,
      [auth.userId],
    );
    const profession = profile?.profession as Profession | null | undefined;
    return {
      status: 200,
      body: {
        documents: rows.map(toCaregiverDocument),
        requiredDocuments: profession ? PROFESSION_CATALOG[profession].requiredDocuments : [],
        missingDocuments: missing?.missing ?? [],
        uploadsAvailable: deps.storage.available,
      },
    };
  });

  router.add('POST', '/v1/me/caregiver-documents', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['caregiver']);
    const parsed = createSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    if (!deps.storage.available) throw storageUnavailable();

    if ((await loadProfileStatus(deps, auth.userId)) === 'pending_review') throw underReview();

    const [count] = await deps.db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM caregiver_documents WHERE caregiver_id = $1`,
      [auth.userId],
    );
    if ((count?.total ?? 0) >= MAX_DOCUMENTS_PER_CAREGIVER) {
      throw new HttpError(409, 'TOO_MANY_DOCUMENTS', 'Limite de documentos atingido. Remova envios antigos ou fale com o suporte.');
    }

    const id = randomUUID();
    const path = `caregivers/${auth.userId}/${id}.${extensionFor(parsed.data.contentType)}`;

    try {
      const [row] = await deps.db.query(
        `INSERT INTO caregiver_documents (id, caregiver_id, doc_type, storage_path, content_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [id, auth.userId, parsed.data.docType, path, parsed.data.contentType, parsed.data.sizeBytes],
      );
      if (!row) throw new Error('Inserção não retornou o documento');
      const upload = await deps.storage.createUploadUrl(path, parsed.data.contentType);
      return { status: 201, body: { document: toCaregiverDocument(row), upload } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  router.add('POST', '/v1/me/caregiver-documents/:id/complete', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['caregiver']);
    if (!deps.storage.available) throw storageUnavailable();

    let doc: Record<string, unknown> | undefined;
    try {
      [doc] = await deps.db.query(
        `SELECT * FROM caregiver_documents WHERE id = $1 AND caregiver_id = $2`,
        [ctx.params.id, auth.userId],
      );
    } catch (error) {
      throw translateDbError(error);
    }
    if (!doc) throw errors.notFound();
    if (doc.status !== 'uploading') return { status: 200, body: { document: toCaregiverDocument(doc) } };

    const stored = await deps.storage.stat(String(doc.storage_path));
    if (!stored || stored.size <= 0) {
      throw new HttpError(409, 'UPLOAD_NOT_FOUND', 'O arquivo não chegou. Tente enviar de novo.');
    }
    if (stored.size > MAX_DOCUMENT_BYTES) {
      await deps.storage.remove(String(doc.storage_path));
      await deps.db.query(`DELETE FROM caregiver_documents WHERE id = $1 RETURNING id`, [doc.id]);
      throw new HttpError(400, 'FILE_TOO_LARGE', 'O arquivo pode ter no máximo 10 MB.');
    }

    const [updated] = await deps.db.query(
      `UPDATE caregiver_documents SET status = 'submitted', submitted_at = now(), size_bytes = $2
        WHERE id = $1 RETURNING *`,
      [doc.id, stored.size],
    );
    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'caregiver.document_submitted', 'caregiver_document', $2, jsonb_build_object('docType', $3::text))
       RETURNING id`,
      [auth.userId, doc.id, doc.doc_type],
    );
    if (!updated) throw errors.notFound();
    return { status: 200, body: { document: toCaregiverDocument(updated) } };
  });

  router.add('DELETE', '/v1/me/caregiver-documents/:id', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['caregiver']);
    if ((await loadProfileStatus(deps, auth.userId)) === 'pending_review') throw underReview();

    let row: { storage_path: string } | undefined;
    try {
      [row] = await deps.db.query<{ storage_path: string }>(
        `DELETE FROM caregiver_documents
          WHERE id = $1 AND caregiver_id = $2 AND status IN ('uploading', 'submitted', 'rejected')
        RETURNING storage_path`,
        [ctx.params.id, auth.userId],
      );
    } catch (error) {
      throw translateDbError(error);
    }
    if (!row) throw errors.notFound();
    await deps.storage.remove(row.storage_path).catch((error: unknown) => {
      deps.log(`[storage] falha ao remover arquivo: ${error instanceof Error ? error.message : String(error)}`);
    });
    return { status: 204 };
  });

  /** Admin: ficha completa do profissional para análise, com links temporários dos documentos. */
  router.add('GET', '/v1/admin/caregivers/:id', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['admin']);
    let user: Record<string, unknown> | undefined;
    try {
      [user] = await deps.db.query(`SELECT * FROM users WHERE id = $1 AND role = 'caregiver'`, [ctx.params.id]);
    } catch (error) {
      throw translateDbError(error);
    }
    if (!user) throw errors.notFound();

    const [profile] = await deps.db.query(`SELECT * FROM caregiver_profiles WHERE user_id = $1`, [ctx.params.id]);
    const docs = await deps.db.query(
      `SELECT * FROM caregiver_documents WHERE caregiver_id = $1 AND status <> 'uploading' ORDER BY doc_type, created_at DESC`,
      [ctx.params.id],
    );
    const [missing] = await deps.db.query<{ missing: string[] }>(
      `SELECT caregiver_missing_documents($1) AS missing`,
      [ctx.params.id],
    );

    const documents = await Promise.all(
      docs.map(async (doc) => ({
        ...toCaregiverDocument(doc),
        downloadUrl: deps.storage.available
          ? await deps.storage.createDownloadUrl(String(doc.storage_path), DOWNLOAD_URL_TTL_SECONDS)
          : null,
      })),
    );

    // LGPD: registrar quem consultou documentos pessoais.
    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id) VALUES ($1, 'admin.caregiver_file_viewed', 'caregiver_profile', $2) RETURNING id`,
      [auth.userId, ctx.params.id],
    );

    return {
      status: 200,
      body: {
        user: toUser(user),
        caregiverProfile: profile ? { ...toCaregiverProfile(profile), missingDocuments: missing?.missing ?? [] } : null,
        documents,
      },
    };
  });
}
