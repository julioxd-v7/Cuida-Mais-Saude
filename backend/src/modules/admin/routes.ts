import { z } from 'zod';

import { translateDbError } from '../../db/errors.ts';
import { errors, validationError } from '../../http/errors.ts';
import type { Router } from '../../http/router.ts';
import type { Deps } from '../deps.ts';
import { authenticate } from '../guard.ts';
import { toCaregiverProfile, toCategory, toUser } from '../mappers.ts';
import { CATEGORY_CODE } from '../../catalog.ts';
import { listCategories } from '../catalog/routes.ts';
import { ufSchema } from '../../validation.ts';
import { listServiceAreas } from '../areas/routes.ts';

/**
 * Rotas administrativas (base para o futuro painel web).
 * Dupla checagem: o backend exige papel admin, e as funções SQL conferem de
 * novo se quem age é um admin ativo antes de mudar qualquer coisa.
 */

const verificationSchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'suspended', 'pending_review']),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

const areaSchema = z
  .object({ city: z.string().trim().min(2, 'Informe a cidade.').max(80), state: ufSchema, active: z.boolean() })
  .strict();

const rangeSchema = z
  .object({
    serviceType: z.string().regex(CATEGORY_CODE, 'Serviço desconhecido.'),
    minHourlyCents: z.number().int().min(100).max(10_000_000),
    maxHourlyCents: z.number().int().min(100).max(10_000_000),
  })
  .strict()
  .refine((range) => range.maxHourlyCents >= range.minHourlyCents, {
    message: 'O máximo precisa ser maior ou igual ao mínimo.',
    path: ['maxHourlyCents'],
  });

const caregiverCategorySchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'suspended', 'pending']),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

const lines = z.array(z.string().trim().min(2).max(200)).max(20);

const categoryUpdateSchema = z
  .object({
    name: z.string().trim().min(3).max(80).optional(),
    description: z.string().trim().max(500).optional(),
    includes: lines.optional(),
    excludes: lines.optional(),
    minHours: z.number().int().min(1).max(24).optional(),
    maxHours: z.number().int().min(1).max(24).optional(),
    cancellationPolicy: z.string().trim().min(10).max(500).optional(),
    emergencyNotice: z.string().trim().min(10).max(500).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

const clearanceSchema = z
  .object({
    topic: z.enum(['clinical_services', 'payments_live', 'other']),
    documentRef: z.string().trim().min(3).max(300),
    issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.'),
    responsible: z.string().trim().min(3).max(160),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.').optional(),
  })
  .strict();

const settingSchema = z.object({ value: z.number().finite() }).strict();

type SettingRow = {
  key: string;
  value: string;
  unit: string;
  min_value: string;
  max_value: string;
  provisional: boolean;
  description: string;
  updated_at: Date | string;
};

function toSetting(row: SettingRow) {
  return {
    key: row.key,
    value: Number(row.value),
    unit: row.unit,
    min: Number(row.min_value),
    max: Number(row.max_value),
    provisional: Boolean(row.provisional),
    description: row.description,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const userStatusSchema = z.object({ status: z.enum(['active', 'suspended']) }).strict();

export function registerAdminRoutes(router: Router, deps: Deps): void {
  router.add('GET', '/v1/admin/caregivers', async (ctx) => {
    await authenticate(deps, ctx, ['admin']);
    const rows = await deps.db.query(
      `SELECT u.*, c.verification_status, c.submitted_at
         FROM users u JOIN caregiver_profiles c ON c.user_id = u.id
        WHERE c.verification_status = 'pending_review'
        ORDER BY c.submitted_at`,
    );
    return {
      status: 200,
      body: {
        caregivers: rows.map((row) => ({
          user: toUser(row),
          verificationStatus: String(row.verification_status),
        })),
      },
    };
  });

  router.add('POST', '/v1/admin/caregivers/:id/verification', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['admin']);
    const parsed = verificationSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);

    try {
      const [profile] = await deps.db.query(`SELECT * FROM admin_set_caregiver_status($1, $2, $3, $4)`, [
        auth.userId,
        ctx.params.id,
        parsed.data.status,
        parsed.data.note ?? null,
      ]);
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: toCaregiverProfile(profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  router.add('POST', '/v1/admin/users/:id/status', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['admin']);
    const parsed = userStatusSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);

    try {
      const [user] = await deps.db.query(`SELECT * FROM admin_set_user_status($1, $2, $3)`, [
        auth.userId,
        ctx.params.id,
        parsed.data.status,
      ]);
      if (!user) throw errors.notFound();
      return { status: 200, body: { user: toUser(user) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /** Áreas de atendimento (inclui inativas) e faixas de preço. */
  router.add('GET', '/v1/admin/service-areas', async (ctx) => {
    await authenticate(deps, ctx, ['admin']);
    return { status: 200, body: { areas: await listServiceAreas(deps, true) } };
  });

  /** Libera (ou pausa) uma cidade. Abrir o Brasil todo = cadastrar as cidades aqui. */
  router.add('POST', '/v1/admin/service-areas', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['admin']);
    const parsed = areaSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      await deps.db.query(`SELECT id FROM admin_upsert_service_area($1, $2, $3, $4)`, [
        auth.userId,
        parsed.data.city,
        parsed.data.state,
        parsed.data.active,
      ]);
      return { status: 200, body: { areas: await listServiceAreas(deps, true) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  router.add('POST', '/v1/admin/service-areas/:id/price-ranges', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['admin']);
    const parsed = rangeSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      await deps.db.query(`SELECT service_type FROM admin_set_price_range($1, $2, $3, $4, $5)`, [
        auth.userId,
        ctx.params.id,
        parsed.data.serviceType,
        parsed.data.minHourlyCents,
        parsed.data.maxHourlyCents,
      ]);
      return { status: 200, body: { areas: await listServiceAreas(deps, true) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /** CAT-04: aprova, recusa ou suspende uma categoria de um profissional. */
  router.add('POST', '/v1/admin/caregivers/:id/categories/:code', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['admin']);
    const parsed = caregiverCategorySchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      const [row] = await deps.db.query(`SELECT * FROM admin_set_caregiver_category($1, $2, $3, $4, $5)`, [
        auth.userId,
        ctx.params.id,
        ctx.params.code,
        parsed.data.status,
        parsed.data.note ?? null,
      ]);
      if (!row) throw errors.notFound();
      return { status: 200, body: { category: { code: String(row.category_code), status: String(row.status) } } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /** Catálogo completo (inclui desativadas e clínicas). */
  router.add('GET', '/v1/admin/categories', async (ctx) => {
    await authenticate(deps, ctx, ['admin']);
    return { status: 200, body: { categories: await listCategories(deps, true) } };
  });

  /** CAT-02/03: edita a ficha e ativa/desativa. Clínica exige parecer registrado. */
  router.add('PATCH', '/v1/admin/categories/:code', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['admin']);
    const parsed = categoryUpdateSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    const d = parsed.data;
    try {
      const [row] = await deps.db.query(
        `SELECT * FROM admin_update_category($1, $2, $3, $4, $5::text[], $6::text[], $7, $8, $9, $10, $11)`,
        [
          auth.userId,
          ctx.params.code,
          d.name ?? null,
          d.description ?? null,
          d.includes ?? null,
          d.excludes ?? null,
          d.minHours ?? null,
          d.maxHours ?? null,
          d.cancellationPolicy ?? null,
          d.emergencyNotice ?? null,
          d.enabled ?? null,
        ],
      );
      if (!row) throw errors.notFound();
      return { status: 200, body: { category: toCategory(row) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /** ADM-21: pareceres jurídicos e regulatórios. */
  router.add('GET', '/v1/admin/legal-clearances', async (ctx) => {
    await authenticate(deps, ctx, ['admin']);
    const rows = await deps.db.query<Record<string, unknown>>(
      `SELECT id, topic, document_ref, issued_on::text AS issued_on, responsible, valid_until::text AS valid_until, created_at
         FROM legal_clearances ORDER BY created_at DESC`,
    );
    return {
      status: 200,
      body: {
        clearances: rows.map((r) => ({
          id: String(r.id),
          topic: String(r.topic),
          documentRef: String(r.document_ref),
          issuedOn: String(r.issued_on),
          responsible: String(r.responsible),
          validUntil: r.valid_until === null ? null : String(r.valid_until),
        })),
      },
    };
  });

  router.add('POST', '/v1/admin/legal-clearances', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['admin']);
    const parsed = clearanceSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    const d = parsed.data;
    try {
      const [row] = await deps.db.query<{ id: string }>(
        `SELECT id FROM admin_add_legal_clearance($1, $2, $3, $4::date, $5, $6::date)`,
        [auth.userId, d.topic, d.documentRef, d.issuedOn, d.responsible, d.validUntil ?? null],
      );
      return { status: 201, body: { id: String(row?.id) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /** ADM-22: configurações comerciais (comissão, prazos, limites). */
  router.add('GET', '/v1/admin/settings', async (ctx) => {
    await authenticate(deps, ctx, ['admin']);
    const rows = await deps.db.query<SettingRow>(`SELECT * FROM platform_settings ORDER BY key`);
    return { status: 200, body: { settings: rows.map(toSetting) } };
  });

  router.add('POST', '/v1/admin/settings/:key', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['admin']);
    const parsed = settingSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);
    try {
      const [row] = await deps.db.query<SettingRow>(`SELECT * FROM admin_set_setting($1, $2, $3)`, [
        auth.userId,
        ctx.params.key,
        parsed.data.value,
      ]);
      if (!row) throw errors.notFound();
      return { status: 200, body: { setting: toSetting(row) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });
}
