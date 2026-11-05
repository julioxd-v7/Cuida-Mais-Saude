import { z } from 'zod';

import { CATEGORY_CODE } from '../../catalog.ts';
import { translateDbError } from '../../db/errors.ts';
import { errors, HttpError, validationError } from '../../http/errors.ts';
import type { Router } from '../../http/router.ts';
import { SPECIALTIES, ufSchema } from '../../validation.ts';
import type { Deps } from '../deps.ts';
import { authenticate } from '../guard.ts';
import { toPublicCaregiver, toRate, type Rate } from '../mappers.ts';

/**
 * Busca de profissionais pelo cliente.
 *
 * Privacidade (estilo LinkedIn): o cliente vê só a região de atuação
 * (bairro, cidade e raio) — nunca o endereço, CPF, telefone ou e-mail.
 * Só aparecem perfis APROVADOS, de contas ativas, em cidades liberadas.
 */

const searchSchema = z
  .object({
    city: z.string().trim().min(2, 'Informe a cidade.').max(80),
    state: ufSchema,
    serviceType: z.string().regex(CATEGORY_CODE, 'Serviço desconhecido.').optional(),
    specialty: z.enum(SPECIALTIES).optional(),
    availableNow: z.enum(['true', 'false']).optional(),
    district: z.string().trim().max(80).optional(),
  })
  .strict();

const VISIBLE = `
  c.verification_status = 'approved'
  AND u.status = 'active'
  AND u.deletion_requested_at IS NULL
  AND service_area_is_active(c.service_city, c.service_state)
  AND cardinality(caregiver_offered_categories(c.user_id)) > 0`;

const SELECT_CAREGIVER = `
  SELECT c.*, u.full_name, caregiver_is_available_now(c) AS available_now_effective,
         caregiver_offered_categories(c.user_id) AS offered_categories,
         EXISTS (SELECT 1 FROM client_favorites f WHERE f.client_id = $1 AND f.caregiver_id = c.user_id) AS favorite
    FROM caregiver_profiles c
    JOIN users u ON u.id = c.user_id`;

async function ratesFor(deps: Deps, ids: string[]): Promise<Map<string, Rate[]>> {
  const map = new Map<string, Rate[]>();
  if (!ids.length) return map;
  const rows = await deps.db.query<Record<string, unknown>>(
    `SELECT r.caregiver_id, r.service_type, r.hourly_rate_cents
       FROM caregiver_service_rates r
       JOIN caregiver_profiles c ON c.user_id = r.caregiver_id
      WHERE r.caregiver_id::text = ANY ($1::text[])
        AND r.service_type = ANY (caregiver_offered_categories(c.user_id))
      ORDER BY r.service_type`,
    [ids],
  );
  for (const row of rows) {
    const id = String(row.caregiver_id);
    map.set(id, [...(map.get(id) ?? []), toRate(row)]);
  }
  return map;
}

async function toPublicList(deps: Deps, rows: Record<string, unknown>[]) {
  const rates = await ratesFor(deps, rows.map((row) => String(row.user_id)));
  return rows.map((row) => toPublicCaregiver(row, rates.get(String(row.user_id)) ?? [], Boolean(row.favorite)));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findVisible(deps: Deps, clientId: string, caregiverId: string) {
  if (!UUID.test(caregiverId)) return null;
  const [row] = await deps.db.query<Record<string, unknown>>(`${SELECT_CAREGIVER} WHERE c.user_id = $2 AND ${VISIBLE}`, [
    clientId,
    caregiverId,
  ]);
  return row ?? null;
}

export function registerCaregiverSearchRoutes(router: Router, deps: Deps): void {
  router.add('GET', '/v1/caregivers', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    const query = Object.fromEntries(new URL(ctx.req.url ?? '/', 'http://localhost').searchParams);
    const parsed = searchSchema.safeParse(query);
    if (!parsed.success) throw validationError(parsed.error);
    const input = parsed.data;

    const [area] = await deps.db.query<{ active: boolean }>(`SELECT service_area_is_active($1, $2) AS active`, [
      input.city,
      input.state,
    ]);
    if (!area?.active) {
      throw new HttpError(409, 'SERVICE_AREA_UNAVAILABLE', 'O Cuidar+ ainda não atende esta cidade. Estamos começando aos poucos, com segurança.');
    }

    try {
      const rows = await deps.db.query<Record<string, unknown>>(
        `${SELECT_CAREGIVER}
          WHERE ${VISIBLE}
            AND normalize_city(c.service_city) = normalize_city($2) AND c.service_state = $3
            AND ($4::text IS NULL OR $4::text = ANY (caregiver_offered_categories(c.user_id)))
            AND ($5::text IS NULL OR $5::text = ANY (c.specialties))
            AND (NOT $6::boolean OR caregiver_is_available_now(c))
          ORDER BY caregiver_is_available_now(c) DESC,
                   ($7::text <> '' AND normalize_city(c.service_district) = normalize_city($7::text)) DESC,
                   c.experience_years DESC NULLS LAST,
                   c.reviewed_at
          LIMIT 50`,
        [
          auth.userId,
          input.city,
          input.state,
          input.serviceType ?? null,
          input.specialty ?? null,
          input.availableNow === 'true',
          input.district ?? '',
        ],
      );
      return { status: 200, body: { caregivers: await toPublicList(deps, rows) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  router.add('GET', '/v1/caregivers/:id', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    const row = await findVisible(deps, auth.userId, ctx.params.id ?? '');
    if (!row) throw errors.notFound();
    const [caregiver] = await toPublicList(deps, [row]);
    return { status: 200, body: { caregiver } };
  });

  router.add('GET', '/v1/favorites', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    const rows = await deps.db.query<Record<string, unknown>>(
      `${SELECT_CAREGIVER}
         JOIN client_favorites fav ON fav.caregiver_id = c.user_id AND fav.client_id = $1
        WHERE ${VISIBLE}
        ORDER BY fav.created_at DESC`,
      [auth.userId],
    );
    return { status: 200, body: { caregivers: await toPublicList(deps, rows) } };
  });

  router.add('POST', '/v1/favorites/:id', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    const row = await findVisible(deps, auth.userId, ctx.params.id ?? '');
    if (!row) throw errors.notFound();
    try {
      await deps.db.query(
        `INSERT INTO client_favorites (client_id, caregiver_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING client_id`,
        [auth.userId, ctx.params.id],
      );
    } catch (error) {
      throw translateDbError(error);
    }
    return { status: 200, body: { favorite: true } };
  });

  router.add('DELETE', '/v1/favorites/:id', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    if (!UUID.test(ctx.params.id ?? '')) throw errors.notFound();
    await deps.db.query(`DELETE FROM client_favorites WHERE client_id = $1 AND caregiver_id = $2 RETURNING client_id`, [
      auth.userId,
      ctx.params.id,
    ]);
    return { status: 200, body: { favorite: false } };
  });
}
