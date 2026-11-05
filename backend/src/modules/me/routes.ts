import { z } from 'zod';

import { translateDbError } from '../../db/errors.ts';
import { hashPassword, verifyPassword } from '../../security/passwords.ts';
import { errors, HttpError, validationError } from '../../http/errors.ts';
import type { Router } from '../../http/router.ts';
import { CATEGORY_CODE, PROFESSIONS } from '../../catalog.ts';
import {
  addressSchema,
  CONTACT_PREFERENCES,
  councilNumberSchema,
  cpfSchema,
  enumList,
  fullNameSchema,
  passwordSchema,
  PERIODS,
  phoneSchema,
  SPECIALTIES,
  ufSchema,
  WEEKDAYS,
} from '../../validation.ts';
import type { Deps } from '../deps.ts';
import { authenticate } from '../guard.ts';
import { toCaregiverProfile, toClientProfile, toRate, toUser } from '../mappers.ts';

/**
 * "Minha conta". Cada rota só lê e altera os dados de quem está logado:
 * o id vem da sessão, nunca do corpo da requisição.
 *
 * Os schemas são .strict(): campos como role, status ou verificationStatus
 * são recusados com erro 400 — não são ignorados em silêncio.
 */

const updateMeSchema = z
  .object({ fullName: fullNameSchema.optional(), phone: phoneSchema.optional() })
  .strict();

const updateClientProfileSchema = z
  .object({
    contactPreference: z.enum(CONTACT_PREFERENCES).optional(),
    address: addressSchema.optional(),
  })
  .strict();

const updateCaregiverProfileSchema = z
  .object({
    profession: z.enum(PROFESSIONS, { errorMap: () => ({ message: 'Escolha sua profissão.' }) }).optional(),
    cpf: cpfSchema.optional(),
    councilNumber: councilNumberSchema.nullable().optional(),
    councilState: ufSchema.nullable().optional(),
    serviceDistrict: z.string().trim().max(80).nullable().optional(),
    bio: z.string().trim().max(1000, 'A apresentação pode ter até 1000 caracteres.').nullable().optional(),
    experienceYears: z.number().int().min(0, 'Informe os anos de experiência.').max(60).nullable().optional(),
    specialties: enumList(SPECIALTIES, 'Especialidade desconhecida.').optional(),
    serviceCity: z.string().trim().max(80).nullable().optional(),
    serviceState: ufSchema.nullable().optional(),
    serviceRadiusKm: z.number().int().min(1, 'O raio mínimo é 1 km.').max(100, 'O raio máximo é 100 km.').nullable().optional(),
    availabilityDays: enumList(WEEKDAYS, 'Dia da semana desconhecido.').optional(),
    availabilityPeriods: enumList(PERIODS, 'Período desconhecido.').optional(),
    /** Categorias que quer oferecer (substitui a lista). Cada uma é aprovada pela equipe. */
    categories: z
      .array(z.string().regex(CATEGORY_CODE, 'Categoria desconhecida.'))
      .max(20)
      .refine((items) => new Set(items).size === items.length, 'Categoria repetida.')
      .optional(),
  })
  .strict();

const ratesSchema = z
  .object({
    rates: z
      .array(
        z
          .object({
            serviceType: z.string().regex(CATEGORY_CODE, 'Serviço desconhecido.'),
            hourlyRateCents: z
              .number({ invalid_type_error: 'Informe o valor por hora.' })
              .int('Informe o valor em centavos.')
              .min(100, 'Informe o valor por hora.')
              .max(10_000_000),
          })
          .strict(),
      )
      .max(20)
      .refine((items) => new Set(items.map((item) => item.serviceType)).size === items.length, 'Serviço repetido.'),
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(128).optional(),
    newPassword: passwordSchema,
  })
  .strict();

const deletionSchema = z
  .object({
    confirm: z.literal('EXCLUIR', { errorMap: () => ({ message: 'Digite EXCLUIR para confirmar.' }) }),
    password: z.string().max(128).optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

const availabilitySchema = z.object({ availableNow: z.boolean() }).strict();

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw validationError(result.error);
  return result.data;
}

/** Monta "SET col = $n" só com os campos enviados (lista fechada de colunas). */
function buildSet(fields: Record<string, unknown>, columns: Record<string, string>, startAt = 2) {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(columns)) {
    if (fields[key] === undefined) continue;
    values.push(fields[key]);
    const cast = Array.isArray(fields[key]) ? '::text[]' : '';
    sets.push(`${column} = $${startAt + values.length - 1}${cast}`);
  }
  return { sets, values };
}

/**
 * Perfil do cuidador + documentos que faltam, valores por hora, se a cidade
 * já é atendida e se o "disponível agora" está valendo.
 */
export async function withMissingDocuments(deps: Deps, userId: string, row: Record<string, unknown>) {
  const [extra] = await deps.db.query<{ missing: string[]; area_active: boolean; available: boolean }>(
    `SELECT caregiver_missing_documents(p.user_id) AS missing,
            service_area_is_active(p.service_city, p.service_state) AS area_active,
            caregiver_is_available_now(p) AS available
       FROM caregiver_profiles p WHERE p.user_id = $1`,
    [userId],
  );
  const rates = await deps.db.query(
    `SELECT service_type, hourly_rate_cents FROM caregiver_service_rates WHERE caregiver_id = $1 ORDER BY service_type`,
    [userId],
  );
  const categories = await deps.db.query<Record<string, unknown>>(
    `SELECT c.category_code, c.status, c.note, s.enabled
       FROM caregiver_categories c JOIN service_categories s ON s.code = c.category_code
      WHERE c.caregiver_id = $1 ORDER BY s.sort_order`,
    [userId],
  );
  const offered = categories
    .filter((c) => c.status === 'approved' && c.enabled)
    .map((c) => String(c.category_code));
  return {
    ...toCaregiverProfile({ ...row, available_now_effective: extra?.available ?? false, offered_categories: offered }),
    missingDocuments: extra?.missing ?? [],
    serviceAreaActive: extra?.area_active ?? false,
    rates: rates.map(toRate),
    /** Situação de cada categoria pedida (pendente, aprovada, recusada, suspensa). */
    categories: categories.map((c) => ({
      code: String(c.category_code),
      status: String(c.status),
      note: c.note === null || c.note === undefined ? null : String(c.note),
    })),
  };
}

export async function loadMe(deps: Deps, userId: string) {
  const [userRow] = await deps.db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  if (!userRow) throw errors.notFound();
  const user = toUser(userRow);

  if (user.role === 'client') {
    const [profile] = await deps.db.query(`SELECT * FROM client_profiles WHERE user_id = $1`, [userId]);
    return { user, clientProfile: profile ? toClientProfile(profile) : null };
  }
  if (user.role === 'caregiver') {
    const [profile] = await deps.db.query(`SELECT * FROM caregiver_profiles WHERE user_id = $1`, [userId]);
    return { user, caregiverProfile: profile ? await withMissingDocuments(deps, userId, profile) : null };
  }
  return { user };
}

export function registerMeRoutes(router: Router, deps: Deps): void {
  router.add('GET', '/v1/me', async (ctx) => {
    const auth = await authenticate(deps, ctx);
    return { status: 200, body: await loadMe(deps, auth.userId) };
  });

  router.add('PATCH', '/v1/me', async (ctx) => {
    const auth = await authenticate(deps, ctx);
    const input = parse(updateMeSchema, ctx.body);
    const { sets, values } = buildSet(input, { fullName: 'full_name', phone: 'phone' });
    if (sets.length) {
      try {
        await deps.db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING id`, [auth.userId, ...values]);
      } catch (error) {
        throw translateDbError(error);
      }
    }
    return { status: 200, body: await loadMe(deps, auth.userId) };
  });

  router.add('PATCH', '/v1/me/client-profile', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    const input = parse(updateClientProfileSchema, ctx.body);
    const flat: Record<string, unknown> = { contactPreference: input.contactPreference };
    if (input.address) {
      for (const [key, value] of Object.entries(input.address)) flat[`address.${key}`] = value;
    }
    const { sets, values } = buildSet(flat, {
      contactPreference: 'contact_preference',
      'address.street': 'address_street',
      'address.number': 'address_number',
      'address.complement': 'address_complement',
      'address.district': 'address_district',
      'address.city': 'address_city',
      'address.state': 'address_state',
      'address.postalCode': 'address_postal_code',
    });
    if (sets.length) {
      try {
        await deps.db.query(`UPDATE client_profiles SET ${sets.join(', ')} WHERE user_id = $1 RETURNING user_id`, [
          auth.userId,
          ...values,
        ]);
      } catch (error) {
        throw translateDbError(error);
      }
    }
    return { status: 200, body: await loadMe(deps, auth.userId) };
  });

  router.add('PATCH', '/v1/me/caregiver-profile', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['caregiver']);
    const input = parse(updateCaregiverProfileSchema, ctx.body);
    const { sets, values } = buildSet(input, {
      profession: 'profession',
      cpf: 'cpf',
      councilNumber: 'council_number',
      councilState: 'council_state',
      serviceDistrict: 'service_district',
      bio: 'bio',
      experienceYears: 'experience_years',
      specialties: 'specialties',
      serviceCity: 'service_city',
      serviceState: 'service_state',
      serviceRadiusKm: 'service_radius_km',
      availabilityDays: 'availability_days',
      availabilityPeriods: 'availability_periods',
    });
    try {
      if (sets.length) {
        await deps.db.query(`UPDATE caregiver_profiles SET ${sets.join(', ')} WHERE user_id = $1 RETURNING user_id`, [
          auth.userId,
          ...values,
        ]);
      }
      if (input.categories) {
        await deps.db.query(`SELECT caregiver_set_categories($1, $2::text[])`, [auth.userId, input.categories]);
      }
      // Recalcula "incompleto" x "completo" no banco.
      const [profile] = await deps.db.query(`SELECT * FROM sync_caregiver_completion($1)`, [auth.userId]);
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: await withMissingDocuments(deps, auth.userId, profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /** O cuidador envia o perfil para análise. Aprovar é exclusivo do administrador. */
  router.add('POST', '/v1/me/caregiver-profile/submit', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['caregiver']);
    try {
      const [profile] = await deps.db.query(`SELECT * FROM caregiver_submit_for_review($1)`, [auth.userId]);
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: await withMissingDocuments(deps, auth.userId, profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /**
   * Valores por hora (substitui a lista inteira). O banco confere se a
   * categoria foi escolhida, se a cidade é atendida e se o valor está na faixa.
   */
  router.add('POST', '/v1/me/caregiver-profile/rates', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['caregiver']);
    const input = parse(ratesSchema, ctx.body);
    const types = input.rates.map((rate) => rate.serviceType);
    const cents = input.rates.map((rate) => rate.hourlyRateCents);
    try {
      if (types.length) {
        await deps.db.query(
          `INSERT INTO caregiver_service_rates (caregiver_id, service_type, hourly_rate_cents)
           SELECT $1, t.service_type, t.cents
             FROM unnest($2::text[], $3::text[]::int[]) AS t(service_type, cents)
           ON CONFLICT (caregiver_id, service_type) DO UPDATE SET hourly_rate_cents = EXCLUDED.hourly_rate_cents
           RETURNING caregiver_id`,
          [auth.userId, types, cents],
        );
      }
      await deps.db.query(
        `DELETE FROM caregiver_service_rates WHERE caregiver_id = $1 AND NOT (service_type = ANY ($2::text[])) RETURNING caregiver_id`,
        [auth.userId, types],
      );
      const [profile] = await deps.db.query(`SELECT * FROM caregiver_profiles WHERE user_id = $1`, [auth.userId]);
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: await withMissingDocuments(deps, auth.userId, profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /** Liga/desliga "disponível agora" (atendimento imediato). Só para perfis aprovados. */
  router.add('POST', '/v1/me/caregiver-profile/availability', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['caregiver']);
    const input = parse(availabilitySchema, ctx.body);
    const [current] = await deps.db.query<{ verification_status: string }>(
      `SELECT verification_status FROM caregiver_profiles WHERE user_id = $1`,
      [auth.userId],
    );
    if (!current) throw errors.notFound();
    if (input.availableNow && current.verification_status !== 'approved') {
      throw new HttpError(409, 'NOT_APPROVED', 'Você poderá ficar disponível depois que seu perfil for aprovado.');
    }
    try {
      const [profile] = await deps.db.query(
        `UPDATE caregiver_profiles SET available_now = $2 WHERE user_id = $1 RETURNING *`,
        [auth.userId, input.availableNow],
      );
      if (!profile) throw errors.notFound();
      return { status: 200, body: { caregiverProfile: await withMissingDocuments(deps, auth.userId, profile) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  /** Alterar (ou criar, para quem entrou só com Google) a senha. Encerra as outras sessões. */
  router.add('POST', '/v1/me/password', async (ctx) => {
    const auth = await authenticate(deps, ctx);
    if (!deps.limits.account.consume(`password:${auth.userId}`)) throw errors.rateLimited();
    const input = parse(changePasswordSchema, ctx.body);
    const [user] = await deps.db.query<{ password_hash: string | null }>(`SELECT password_hash FROM users WHERE id = $1`, [
      auth.userId,
    ]);
    if (!user) throw errors.notFound();
    if (user.password_hash && !(input.currentPassword && (await verifyPassword(input.currentPassword, user.password_hash)))) {
      throw new HttpError(400, 'INVALID_CURRENT_PASSWORD', 'A senha atual está incorreta.', {
        currentPassword: 'Senha atual incorreta.',
      });
    }
    const hash = await hashPassword(input.newPassword);
    await deps.db.query(`UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id`, [auth.userId, hash]);
    await deps.db.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL RETURNING id`,
      [auth.userId, auth.sessionId],
    );
    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id) VALUES ($1, 'user.password_changed', 'user', $1) RETURNING id`,
      [auth.userId],
    );
    return { status: 204 };
  });

  /** Aparelhos com sessão aberta (sem dados do aparelho: só datas). */
  router.add('GET', '/v1/me/sessions', async (ctx) => {
    const auth = await authenticate(deps, ctx);
    const rows = await deps.db.query<{ id: string; created_at: string; last_used_at: string }>(
      `SELECT id, created_at, last_used_at FROM sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND refresh_expires_at > now()
        ORDER BY last_used_at DESC`,
      [auth.userId],
    );
    return {
      status: 200,
      body: {
        sessions: rows.map((row) => ({
          id: String(row.id),
          createdAt: new Date(row.created_at).toISOString(),
          lastUsedAt: new Date(row.last_used_at).toISOString(),
          current: String(row.id) === auth.sessionId,
        })),
      },
    };
  });

  /** Sai de todos os outros aparelhos (mantém este). */
  router.add('POST', '/v1/me/sessions/revoke-others', async (ctx) => {
    const auth = await authenticate(deps, ctx);
    const revoked = await deps.db.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL RETURNING id`,
      [auth.userId, auth.sessionId],
    );
    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'user.sessions_revoked', 'user', $1, jsonb_build_object('count', $2::int)) RETURNING id`,
      [auth.userId, revoked.length],
    );
    return { status: 200, body: { revoked: revoked.length } };
  });

  /**
   * Exclusão da conta pelo próprio titular. Efeito imediato: não entra mais,
   * some da busca, sessões encerradas. A eliminação definitiva dos dados é
   * concluída pela equipe no prazo informado (docs/CONTA_E_ACESSO.md).
   */
  router.add('POST', '/v1/me/deletion', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client', 'caregiver']);
    if (!deps.limits.account.consume(`deletion:${auth.userId}`)) throw errors.rateLimited();
    const input = parse(deletionSchema, ctx.body);
    const [user] = await deps.db.query<{ password_hash: string | null }>(`SELECT password_hash FROM users WHERE id = $1`, [
      auth.userId,
    ]);
    if (!user) throw errors.notFound();
    if (user.password_hash && !(input.password && (await verifyPassword(input.password, user.password_hash)))) {
      throw new HttpError(400, 'INVALID_CURRENT_PASSWORD', 'Senha incorreta.', { password: 'Senha incorreta.' });
    }
    try {
      await deps.db.query(`SELECT id FROM request_account_deletion($1, $2)`, [auth.userId, input.reason ?? null]);
    } catch (error) {
      throw translateDbError(error);
    }
    return {
      status: 200,
      body: {
        message:
          'Pedido de exclusão registrado. Sua conta foi encerrada e seus dados serão eliminados em até 30 dias, exceto o que a lei obriga a guardar.',
      },
    };
  });
}
