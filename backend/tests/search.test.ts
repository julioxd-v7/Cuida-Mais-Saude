import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  approvedCaregiver,
  caregiverInReview,
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

const RECIFE = '/v1/caregivers?city=Recife&state=PE';

describe('área de atendimento (lançamento em uma cidade)', () => {
  test('rota pública lista só Recife, com faixas das categorias não clínicas', async () => {
    const response = await app.call('GET', '/v1/service-areas');
    assert.equal(response.status, 200);
    assert.equal(response.body.areas.length, 1);
    const [area] = response.body.areas;
    assert.equal(area.city, 'Recife');
    assert.equal(area.state, 'PE');
    assert.deepEqual(
      area.priceRanges.map((range: { serviceType: string }) => range.serviceType).sort(),
      ['appointment_escort', 'companionship', 'daily_support', 'family_support'],
    );
  });

  test('demais cidades da Região Metropolitana e São Paulo ficam cadastradas, mas inativas', async () => {
    const all = await app.call('GET', '/v1/admin/service-areas', { token: admin.accessToken });
    const byCity = new Map(all.body.areas.map((a: { city: string; active: boolean }) => [a.city, a.active]));
    assert.equal(byCity.get('Olinda'), false);
    assert.equal(byCity.get('Jaboatão dos Guararapes'), false);
    assert.equal(byCity.get('São Paulo'), false);
    assert.equal(byCity.get('Recife'), true);
  });

  test('profissional de cidade não atendida salva o perfil, mas não envia para análise', async () => {
    const caregiver = await register(app, caregiverPayload());
    const saved = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: completeCaregiverProfile({ serviceCity: 'Olinda', serviceState: 'PE' }),
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.caregiverProfile.serviceAreaActive, false);

    const rates = await app.call('POST', '/v1/me/caregiver-profile/rates', {
      token: caregiver.accessToken,
      body: { rates: [{ serviceType: 'companionship', hourlyRateCents: 3000 }] },
    });
    assert.equal(rates.status, 409);
    assert.equal(rates.body.code, 'SERVICE_AREA_UNAVAILABLE');

    for (const docType of REQUIRED_DOCS.caregiver) await uploadDocument(app, caregiver.accessToken, docType);
    const submitted = await app.call('POST', '/v1/me/caregiver-profile/submit', { token: caregiver.accessToken });
    assert.equal(submitted.status, 409);
    assert.equal(submitted.body.code, 'SERVICE_AREA_UNAVAILABLE');
  });

  test('cidade é comparada sem acento e sem maiúsculas', async () => {
    const caregiver = await register(app, caregiverPayload());
    const saved = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: completeCaregiverProfile({ serviceCity: '  reCIFE ' }),
    });
    assert.equal(saved.body.caregiverProfile.serviceAreaActive, true);
  });

  test('cliente buscando em cidade não atendida recebe aviso claro', async () => {
    const response = await app.call('GET', '/v1/caregivers?city=S%C3%A3o%20Paulo&state=SP', { token: client.accessToken });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'SERVICE_AREA_UNAVAILABLE');
  });

  test('só admin libera cidades e muda faixas; tudo fica na auditoria', async () => {
    const denied = await app.call('POST', '/v1/admin/service-areas', {
      token: client.accessToken,
      body: { city: 'Campinas', state: 'SP', active: true },
    });
    assert.equal(denied.status, 403);
    await assert.rejects(app.db.query(`INSERT INTO service_areas (city, state) VALUES ('Campinas', 'SP') RETURNING id`));

    const created = await app.call('POST', '/v1/admin/service-areas', {
      token: admin.accessToken,
      body: { city: 'Campinas', state: 'SP', active: true },
    });
    assert.equal(created.status, 200);
    const campinas = created.body.areas.find((area: { city: string }) => area.city === 'Campinas');
    assert.ok(campinas);

    const badRange = await app.call('POST', `/v1/admin/service-areas/${campinas.id}/price-ranges`, {
      token: admin.accessToken,
      body: { serviceType: 'companionship', minHourlyCents: 5000, maxHourlyCents: 3000 },
    });
    assert.equal(badRange.status, 400);

    const range = await app.call('POST', `/v1/admin/service-areas/${campinas.id}/price-ranges`, {
      token: admin.accessToken,
      body: { serviceType: 'companionship', minHourlyCents: 2000, maxHourlyCents: 5000 },
    });
    assert.equal(range.status, 200);

    // Pausa de novo: a cidade sai da lista pública.
    await app.call('POST', '/v1/admin/service-areas', {
      token: admin.accessToken,
      body: { city: 'Campinas', state: 'SP', active: false },
    });
    const publicList = await app.call('GET', '/v1/service-areas');
    assert.equal(publicList.body.areas.length, 1);

    const [audit] = await app.db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM audit_log WHERE action IN ('service_area.upserted', 'price_range.set')`,
    );
    assert.equal(audit?.total, 3);
  });
});

describe('valor por hora do profissional', () => {
  test('fora da faixa, categoria não escolhida ou categoria clínica são recusadas', async () => {
    const caregiver = await register(app, caregiverPayload());
    await app.call('PATCH', '/v1/me/caregiver-profile', { token: caregiver.accessToken, body: completeCaregiverProfile() });

    const tooHigh = await app.call('POST', '/v1/me/caregiver-profile/rates', {
      token: caregiver.accessToken,
      body: { rates: [{ serviceType: 'companionship', hourlyRateCents: 99000 }] },
    });
    assert.equal(tooHigh.status, 400);
    assert.equal(tooHigh.body.code, 'RATE_OUT_OF_RANGE');

    const notChosen = await app.call('POST', '/v1/me/caregiver-profile/rates', {
      token: caregiver.accessToken,
      body: { rates: [{ serviceType: 'daily_support', hourlyRateCents: 3000 }] },
    });
    assert.equal(notChosen.status, 400);
    assert.equal(notChosen.body.code, 'SERVICE_NOT_ALLOWED');

    const clinical = await app.call('POST', '/v1/me/caregiver-profile/rates', {
      token: caregiver.accessToken,
      body: { rates: [{ serviceType: 'physiotherapy', hourlyRateCents: 10000 }] },
    });
    assert.equal(clinical.status, 400);
    assert.equal(clinical.body.code, 'SERVICE_NOT_ALLOWED');

    const ok = await app.call('POST', '/v1/me/caregiver-profile/rates', {
      token: caregiver.accessToken,
      body: { rates: [{ serviceType: 'companionship', hourlyRateCents: 3500 }] },
    });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.caregiverProfile.rates, [{ serviceType: 'companionship', hourlyRateCents: 3500 }]);
  });

  test('sem valor não envia para análise', async () => {
    const caregiver = await register(app, caregiverPayload());
    await app.call('PATCH', '/v1/me/caregiver-profile', { token: caregiver.accessToken, body: completeCaregiverProfile() });
    for (const docType of REQUIRED_DOCS.caregiver) await uploadDocument(app, caregiver.accessToken, docType);
    const submitted = await app.call('POST', '/v1/me/caregiver-profile/submit', { token: caregiver.accessToken });
    assert.equal(submitted.status, 409);
    assert.equal(submitted.body.code, 'RATES_MISSING');
  });

  test('valores para mais de uma categoria; lista enviada substitui a anterior', async () => {
    const nurse = await register(app, caregiverPayload());
    await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: nurse.accessToken,
      body: completeCaregiverProfile({
        profession: 'nurse',
        councilNumber: '123456',
        councilState: 'PE',
        categories: ['companionship', 'appointment_escort'],
      }),
    });
    const both = await app.call('POST', '/v1/me/caregiver-profile/rates', {
      token: nurse.accessToken,
      body: {
        rates: [
          { serviceType: 'companionship', hourlyRateCents: 4000 },
          { serviceType: 'appointment_escort', hourlyRateCents: 4500 },
        ],
      },
    });
    assert.equal(both.body.caregiverProfile.rates.length, 2);
    const one = await app.call('POST', '/v1/me/caregiver-profile/rates', {
      token: nurse.accessToken,
      body: { rates: [{ serviceType: 'appointment_escort', hourlyRateCents: 4800 }] },
    });
    assert.deepEqual(one.body.caregiverProfile.rates, [{ serviceType: 'appointment_escort', hourlyRateCents: 4800 }]);

    // Tirar a categoria do perfil apaga o valor dela.
    const fewer = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: nurse.accessToken,
      body: { categories: ['companionship'] },
    });
    assert.deepEqual(fewer.body.caregiverProfile.rates, []);
  });
});

describe('disponível agora', () => {
  test('só perfil aprovado pode ficar disponível; perder a aprovação desliga', async () => {
    const inReview = await caregiverInReview(app);
    const denied = await app.call('POST', '/v1/me/caregiver-profile/availability', {
      token: inReview.accessToken,
      body: { availableNow: true },
    });
    assert.equal(denied.status, 409);
    assert.equal(denied.body.code, 'NOT_APPROVED');

    const approved = await approvedCaregiver(app, admin);
    const on = await app.call('POST', '/v1/me/caregiver-profile/availability', {
      token: approved.accessToken,
      body: { availableNow: true },
    });
    assert.equal(on.status, 200);
    assert.equal(on.body.caregiverProfile.availableNow, true);

    await app.call('POST', `/v1/admin/caregivers/${approved.user.id}/verification`, {
      token: admin.accessToken,
      body: { status: 'suspended', note: 'teste' },
    });
    const me = await app.call('GET', '/v1/me', { token: approved.accessToken });
    assert.equal(me.body.caregiverProfile.availableNow, false);
  });

  test('expira sozinho depois de 8 horas', async () => {
    const caregiver = await approvedCaregiver(app, admin);
    await app.call('POST', '/v1/me/caregiver-profile/availability', { token: caregiver.accessToken, body: { availableNow: true } });
    await app.db.exec(
      `SET search_path TO "${app.schema}"; SELECT enable_privileged();
       UPDATE caregiver_profiles SET available_now_at = now() - interval '9 hours' WHERE user_id = '${caregiver.user.id}';`,
    );
    const me = await app.call('GET', '/v1/me', { token: caregiver.accessToken });
    assert.equal(me.body.caregiverProfile.availableNow, false);
  });
});

describe('busca de profissionais pelo cliente', () => {
  test('mostra só aprovados, sem dados pessoais', async () => {
    const approved = await approvedCaregiver(app, admin, 'nurse');
    const pending = await caregiverInReview(app);

    const response = await app.call('GET', RECIFE, { token: client.accessToken });
    assert.equal(response.status, 200);
    const ids = response.body.caregivers.map((caregiver: { id: string }) => caregiver.id);
    assert.ok(ids.includes(approved.user.id));
    assert.ok(!ids.includes(pending.user.id));

    const found = response.body.caregivers.find((caregiver: { id: string }) => caregiver.id === approved.user.id);
    assert.equal(found.verified, true);
    assert.equal(found.displayName, 'Maria da S.');
    assert.deepEqual(found.council, { name: 'COREN', state: 'PE' });
    assert.equal(found.region.district, 'Boa Viagem');
    assert.deepEqual(found.serviceTypes, ['companionship']);
    assert.deepEqual(found.rates, [{ serviceType: 'companionship', hourlyRateCents: 3500 }]);

    const raw = JSON.stringify(found);
    for (const secret of ['cpf', 'councilNumber', 'email', 'phone', '123456', 'Maria da Silva']) {
      assert.ok(!raw.includes(secret), `não deveria expor ${secret}`);
    }
  });

  test('filtros: categoria e disponível agora', async () => {
    const physio = await approvedCaregiver(app, admin, 'physiotherapist');
    await app.call('POST', '/v1/me/caregiver-profile/availability', { token: physio.accessToken, body: { availableNow: true } });

    const companions = await app.call('GET', `${RECIFE}&serviceType=companionship`, { token: client.accessToken });
    assert.ok(companions.body.caregivers.length >= 1);
    assert.ok(companions.body.caregivers.every((c: { serviceTypes: string[] }) => c.serviceTypes.includes('companionship')));

    // Categoria clínica (desativada no MVP) não traz ninguém.
    const clinical = await app.call('GET', `${RECIFE}&serviceType=physiotherapy`, { token: client.accessToken });
    assert.deepEqual(clinical.body.caregivers, []);

    const now = await app.call('GET', `${RECIFE}&availableNow=true`, { token: client.accessToken });
    assert.ok(now.body.caregivers.length >= 1);
    assert.ok(now.body.caregivers.every((c: { availableNow: boolean }) => c.availableNow));
    assert.equal(now.body.caregivers[0].id, physio.user.id);
  });

  test('profissional e visitante não acessam a busca', async () => {
    const caregiver = await register(app, caregiverPayload());
    assert.equal((await app.call('GET', RECIFE, { token: caregiver.accessToken })).status, 403);
    assert.equal((await app.call('GET', RECIFE)).status, 401);
  });

  test('detalhe: aprovado aparece; pendente ou id inválido dá 404', async () => {
    const approved = await approvedCaregiver(app, admin);
    const pending = await caregiverInReview(app);
    const ok = await app.call('GET', `/v1/caregivers/${approved.user.id}`, { token: client.accessToken });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.caregiver.id, approved.user.id);
    assert.equal((await app.call('GET', `/v1/caregivers/${pending.user.id}`, { token: client.accessToken })).status, 404);
    assert.equal((await app.call('GET', '/v1/caregivers/nao-e-id', { token: client.accessToken })).status, 404);
  });
});

describe('favoritos', () => {
  test('adicionar, listar e remover; não favorita perfil não aprovado', async () => {
    const approved = await approvedCaregiver(app, admin);
    const pending = await caregiverInReview(app);
    const other = await register(app, clientPayload());

    assert.equal((await app.call('POST', `/v1/favorites/${approved.user.id}`, { token: client.accessToken })).status, 200);
    assert.equal((await app.call('POST', `/v1/favorites/${approved.user.id}`, { token: client.accessToken })).status, 200);
    assert.equal((await app.call('POST', `/v1/favorites/${pending.user.id}`, { token: client.accessToken })).status, 404);

    const list = await app.call('GET', '/v1/favorites', { token: client.accessToken });
    assert.deepEqual(list.body.caregivers.map((c: { id: string }) => c.id), [approved.user.id]);
    assert.equal(list.body.caregivers[0].favorite, true);

    // Favoritos de um cliente não aparecem para outro.
    const otherList = await app.call('GET', '/v1/favorites', { token: other.accessToken });
    assert.deepEqual(otherList.body.caregivers, []);

    await app.call('DELETE', `/v1/favorites/${approved.user.id}`, { token: client.accessToken });
    const empty = await app.call('GET', '/v1/favorites', { token: client.accessToken });
    assert.deepEqual(empty.body.caregivers, []);
  });

  test('suspenso some dos favoritos e da busca', async () => {
    const caregiver = await approvedCaregiver(app, admin);
    await app.call('POST', `/v1/favorites/${caregiver.user.id}`, { token: client.accessToken });
    await app.call('POST', `/v1/admin/users/${caregiver.user.id}/status`, { token: admin.accessToken, body: { status: 'suspended' } });
    const list = await app.call('GET', '/v1/favorites', { token: client.accessToken });
    assert.ok(!list.body.caregivers.some((c: { id: string }) => c.id === caregiver.user.id));
    const search = await app.call('GET', RECIFE, { token: client.accessToken });
    assert.ok(!search.body.caregivers.some((c: { id: string }) => c.id === caregiver.user.id));
  });
});
