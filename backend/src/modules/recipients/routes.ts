import { z } from 'zod';

import { translateDbError } from '../../db/errors.ts';
import { errors, validationError } from '../../http/errors.ts';
import type { Router } from '../../http/router.ts';
import { addressSchema, ASSISTANCE_NEEDS, enumList, RELATIONSHIPS } from '../../validation.ts';
import type { Deps } from '../deps.ts';
import { authenticate } from '../guard.ts';
import { toCareRecipient } from '../mappers.ts';

/**
 * Beneficiários (pessoas que recebem o cuidado) do cliente logado.
 * Toda consulta filtra por guardian_id = usuário da sessão: o recurso de outra
 * conta simplesmente "não existe" (404), sem revelar que existe.
 *
 * Dados de saúde não são coletados aqui nesta etapa.
 */

const recipientFields = {
  fullName: z.string().trim().min(2, 'Informe o nome.').max(120),
  relationship: z.enum(RELATIONSHIPS, { errorMap: () => ({ message: 'Escolha o parentesco.' }) }),
  assistanceNeeds: enumList(ASSISTANCE_NEEDS, 'Tipo de assistência desconhecido.'),
  address: addressSchema,
};

const createSchema = z
  .object({
    fullName: recipientFields.fullName,
    relationship: recipientFields.relationship,
    assistanceNeeds: recipientFields.assistanceNeeds.default([]),
    address: recipientFields.address.optional(),
  })
  .strict();

const updateSchema = z
  .object({
    fullName: recipientFields.fullName.optional(),
    relationship: recipientFields.relationship.optional(),
    assistanceNeeds: recipientFields.assistanceNeeds.optional(),
    address: recipientFields.address.optional(),
  })
  .strict();

const COLUMNS: Record<string, string> = {
  fullName: 'full_name',
  relationship: 'relationship',
  assistanceNeeds: 'assistance_needs',
  'address.street': 'address_street',
  'address.number': 'address_number',
  'address.complement': 'address_complement',
  'address.district': 'address_district',
  'address.city': 'address_city',
  'address.state': 'address_state',
  'address.postalCode': 'address_postal_code',
};

function flatten(input: Record<string, unknown>): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (key === 'address' && value && typeof value === 'object') {
      for (const [addressKey, addressValue] of Object.entries(value)) {
        if (addressValue !== undefined) entries.push([`address.${addressKey}`, addressValue]);
      }
    } else {
      entries.push([key, value]);
    }
  }
  return entries.filter(([key]) => key in COLUMNS);
}

function placeholder(index: number, value: unknown): string {
  return `$${index}${Array.isArray(value) ? '::text[]' : ''}`;
}

export function registerRecipientRoutes(router: Router, deps: Deps): void {
  router.add('GET', '/v1/me/care-recipients', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    const rows = await deps.db.query(
      `SELECT * FROM care_recipients WHERE guardian_id = $1 ORDER BY created_at`,
      [auth.userId],
    );
    return { status: 200, body: { careRecipients: rows.map(toCareRecipient) } };
  });

  router.add('POST', '/v1/me/care-recipients', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    const parsed = createSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);

    const entries = flatten(parsed.data);
    const columns = ['guardian_id', ...entries.map(([key]) => COLUMNS[key] as string)];
    const values = [auth.userId, ...entries.map(([, value]) => value)];
    const placeholders = values.map((value, index) => placeholder(index + 1, value));

    try {
      const [row] = await deps.db.query(
        `INSERT INTO care_recipients (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        values,
      );
      if (!row) throw new Error('Inserção não retornou o beneficiário');
      return { status: 201, body: { careRecipient: toCareRecipient(row) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  router.add('PATCH', '/v1/me/care-recipients/:id', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    const parsed = updateSchema.safeParse(ctx.body ?? {});
    if (!parsed.success) throw validationError(parsed.error);

    const entries = flatten(parsed.data);
    const sets = entries.map(([key, value], index) => `${COLUMNS[key]} = ${placeholder(index + 3, value)}`);
    const values = entries.map(([, value]) => value);

    try {
      const [row] = sets.length
        ? await deps.db.query(
            `UPDATE care_recipients SET ${sets.join(', ')} WHERE id = $1 AND guardian_id = $2 RETURNING *`,
            [ctx.params.id, auth.userId, ...values],
          )
        : await deps.db.query(`SELECT * FROM care_recipients WHERE id = $1 AND guardian_id = $2`, [
            ctx.params.id,
            auth.userId,
          ]);
      if (!row) throw errors.notFound();
      return { status: 200, body: { careRecipient: toCareRecipient(row) } };
    } catch (error) {
      throw translateDbError(error);
    }
  });

  router.add('DELETE', '/v1/me/care-recipients/:id', async (ctx) => {
    const auth = await authenticate(deps, ctx, ['client']);
    try {
      const [row] = await deps.db.query(
        `DELETE FROM care_recipients WHERE id = $1 AND guardian_id = $2 RETURNING id`,
        [ctx.params.id, auth.userId],
      );
      if (!row) throw errors.notFound();
      return { status: 204 };
    } catch (error) {
      throw translateDbError(error);
    }
  });
}
