import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  approvedCaregiver,
  caregiverPayload,
  clientPayload,
  completeCaregiverProfile,
  createAdmin,
  register,
  REQUIRED_DOCS,
  startTestApp,
  uploadDocument,
  type TestApp,
} from './helpers.ts';

/** Fase F0 da docs/ESPECIFICACAO_MVP.md: escopo não clínico, categorias, Recife e comissão. */

let app: TestApp;
let admin: { accessToken: string; user: { id: string } };
let client: { accessToken: string; user: { id: string } };

before(async () => {
  app = await startTestApp();
  admin = await createAdmin(app);
  client = await register(app, clientPayload());
});

after(async () => {
  await app?.stop();
});

describe('catálogo de categorias (CAT-01..03, CAT-05)', () => {
  test('rota pública mostra só as 4 categorias não clínicas, com o que inclui e o que não inclui', async () => {
    const response = await app.call('GET', '/v1/catalog/categories');
    assert.equal(response.status, 200);
    const codes = response.body.categories.map((c: { code: string }) => c.code);
    assert.deepEqual(codes, ['companionship', 'daily_support', 'appointment_escort', 'family_support']);
    for (const category of response.body.categories) {
      assert.equal(category.clinical, false);
      assert.ok(category.includes.length > 0, `${category.code}: inclui`);
      assert.ok(category.excludes.length > 0, `${category.code}: não inclui`);
      assert.ok(category.minHours && category.maxHours);
      assert.ok(category.cancellationPolicy);
      assert.match(category.emergencyNotice, /192/);
    }
  });

  test('categoria clínica não ativa sem parecer jurídico; com parecer registrado, ativa', async () => {
    const denied = await app.call('PATCH', '/v1/admin/categories/physiotherapy', {
      token: admin.accessToken,
      body: {
        enabled: true,
        includes: ['Sessões de fisioterapia domiciliar'],
        excludes: ['Atendimento de urgência'],
        minHours: 1,
        maxHours: 2,
        cancellationPolicy: 'Cancelamento grátis até 24 horas antes.',
        emergencyNotice: 'Em emergência ligue 192 (SAMU).',
      },
    });
    assert.equal(denied.status, 409);
    assert.equal(denied.body.code, 'CLINICAL_CLEARANCE_REQUIRED');

    // Nem por SQL direto.
    await assert.rejects(app.db.query(`UPDATE service_categories SET enabled = true WHERE code = 'physiotherapy' RETURNING code`));

    const clearance = await app.call('POST', '/v1/admin/legal-clearances', {
      token: admin.accessToken,
      body: {
        topic: 'clinical_services',
        documentRef: 'Parecer 01/2026 — escritório de teste',
        issuedOn: '2026-01-10',
        responsible: 'Dra. Teste',
      },
    });
    assert.equal(clearance.status, 201);

    const enabled = await app.call('PATCH', '/v1/admin/categories/physiotherapy', {
      token: admin.accessToken,
      body: {
        enabled: true,
        includes: ['Sessões de fisioterapia domiciliar'],
        excludes: ['Atendimento de urgência'],
        minHours: 1,
        maxHours: 2,
        cancellationPolicy: 'Cancelamento grátis até 24 horas antes.',
        emergencyNotice: 'Em emergência ligue 192 (SAMU).',
      },
    });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.category.enabled, true);

    // Desativa de novo para não afetar os outros testes.
    const off = await app.call('PATCH', '/v1/admin/categories/physiotherapy', { token: admin.accessToken, body: { enabled: false } });
    assert.equal(off.body.category.enabled, false);

    const [audit] = await app.db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM audit_log WHERE action IN ('category.updated', 'legal_clearance.added')`,
    );
    assert.equal(audit?.total, 3);
  });

  test('categoria sem ficha completa não ativa', async () => {
    const response = await app.call('PATCH', '/v1/admin/categories/care', { token: admin.accessToken, body: { enabled: true } });
    assert.equal(response.status, 400);
  });

  test('cliente e profissional não editam o catálogo', async () => {
    const denied = await app.call('PATCH', '/v1/admin/categories/companionship', {
      token: client.accessToken,
      body: { enabled: false },
    });
    assert.equal(denied.status, 403);
  });
});

describe('categorias do profissional (CAT-04)', () => {
  test('não escolhe categoria clínica nem inexistente', async () => {
    const caregiver = await register(app, caregiverPayload());
    for (const code of ['physiotherapy', 'nao_existe']) {
      const response = await app.call('PATCH', '/v1/me/caregiver-profile', {
        token: caregiver.accessToken,
        body: completeCaregiverProfile({ categories: [code] }),
      });
      assert.equal(response.status, 400, code);
      assert.equal(response.body.code, 'CATEGORY_NOT_AVAILABLE', code);
    }
  });

  test('sem categoria não envia para análise', async () => {
    const caregiver = await register(app, caregiverPayload());
    await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: completeCaregiverProfile({ categories: [] }),
    });
    for (const docType of REQUIRED_DOCS.caregiver) await uploadDocument(app, caregiver.accessToken, docType);
    const submitted = await app.call('POST', '/v1/me/caregiver-profile/submit', { token: caregiver.accessToken });
    assert.equal(submitted.status, 409);
    assert.equal(submitted.body.code, 'CATEGORIES_MISSING');
  });

  test('aprovar o perfil aprova as categorias pedidas; categoria nova depois fica pendente até o admin aprovar', async () => {
    const caregiver = await approvedCaregiver(app, admin);
    const me = await app.call('GET', '/v1/me', { token: caregiver.accessToken });
    assert.deepEqual(me.body.caregiverProfile.serviceTypes, ['companionship']);
    assert.equal(me.body.caregiverProfile.categories[0].status, 'approved');

    const more = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: { categories: ['companionship', 'appointment_escort'] },
    });
    assert.equal(more.status, 200);
    assert.equal(more.body.caregiverProfile.verified, true);
    assert.deepEqual(more.body.caregiverProfile.serviceTypes, ['companionship']);

    // Cliente ainda não encontra para acompanhamento a compromissos.
    const search = `/v1/caregivers?city=Recife&state=PE&serviceType=appointment_escort`;
    let found = await app.call('GET', search, { token: client.accessToken });
    assert.ok(!found.body.caregivers.some((c: { id: string }) => c.id === caregiver.user.id));

    const approved = await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/categories/appointment_escort`, {
      token: admin.accessToken,
      body: { status: 'approved' },
    });
    assert.equal(approved.status, 200);
    await app.call('POST', '/v1/me/caregiver-profile/rates', {
      token: caregiver.accessToken,
      body: {
        rates: [
          { serviceType: 'companionship', hourlyRateCents: 3000 },
          { serviceType: 'appointment_escort', hourlyRateCents: 4000 },
        ],
      },
    });
    found = await app.call('GET', search, { token: client.accessToken });
    assert.ok(found.body.caregivers.some((c: { id: string }) => c.id === caregiver.user.id));

    // Suspender a categoria tira o profissional só daquela busca.
    await app.call('POST', `/v1/admin/caregivers/${caregiver.user.id}/categories/appointment_escort`, {
      token: admin.accessToken,
      body: { status: 'suspended', note: 'teste' },
    });
    found = await app.call('GET', search, { token: client.accessToken });
    assert.ok(!found.body.caregivers.some((c: { id: string }) => c.id === caregiver.user.id));

    const [audit] = await app.db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM audit_log WHERE target_id = $1 AND action LIKE 'caregiver.category_%'`,
      [caregiver.user.id],
    );
    assert.equal(audit?.total, 2);
  });

  test('profissional não grava categorias direto no banco', async () => {
    const caregiver = await register(app, caregiverPayload());
    await assert.rejects(
      app.db.query(
        `INSERT INTO caregiver_categories (caregiver_id, category_code, status) VALUES ($1, 'companionship', 'approved') RETURNING caregiver_id`,
        [caregiver.user.id],
      ),
    );
  });
});

describe('configurações comerciais (P2, ADM-22)', () => {
  test('comissão padrão de 20%; só admin altera, dentro dos limites, com auditoria', async () => {
    const list = await app.call('GET', '/v1/admin/settings', { token: admin.accessToken });
    assert.equal(list.status, 200);
    const commission = list.body.settings.find((s: { key: string }) => s.key === 'commission_rate');
    assert.equal(commission.value, 0.2);
    assert.equal(commission.provisional, false);
    const payout = list.body.settings.find((s: { key: string }) => s.key === 'payout_delay_days');
    assert.equal(payout.provisional, true);

    assert.equal((await app.call('GET', '/v1/admin/settings', { token: client.accessToken })).status, 403);

    const outOfRange = await app.call('POST', '/v1/admin/settings/commission_rate', {
      token: admin.accessToken,
      body: { value: 0.9 },
    });
    assert.equal(outOfRange.status, 400);

    const changed = await app.call('POST', '/v1/admin/settings/payout_delay_days', {
      token: admin.accessToken,
      body: { value: 5 },
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.setting.value, 5);
    assert.equal(changed.body.setting.provisional, false);

    assert.equal(
      (await app.call('POST', '/v1/admin/settings/nao_existe', { token: admin.accessToken, body: { value: 1 } })).status,
      404,
    );

    const [audit] = await app.db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM audit_log WHERE action = 'setting.changed'`,
    );
    assert.equal(audit?.total, 1);
  });
});
