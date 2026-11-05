import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import type { Db } from '../src/db/types.ts';
import { unavailableMailer } from '../src/mail/mailer.ts';
import {
  caregiverPayload,
  clientPayload,
  completeCaregiverProfile,
  register,
  startTestApp,
  VALID_PASSWORD,
  type TestApp,
} from './helpers.ts';

let app: TestApp;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await app?.stop();
});

describe('persistência dos dados', () => {
  test('dados do cadastro continuam lá após novo login (outra sessão)', async () => {
    const payload = clientPayload({ fullName: 'Ana Paula Souza', phone: '21 3456-7890' });
    await register(app, payload);

    const login = await app.call('POST', '/v1/auth/login', { body: { email: payload.email, password: VALID_PASSWORD } });
    const me = await app.call('GET', '/v1/me', { token: login.body.accessToken });
    assert.equal(me.body.user.fullName, 'Ana Paula Souza');
    assert.equal(me.body.user.phone, '2134567890');
  });

  test('cliente atualiza nome, telefone, preferência de contato e endereço', async () => {
    const client = await register(app, clientPayload());
    const basic = await app.call('PATCH', '/v1/me', {
      token: client.accessToken,
      body: { fullName: 'Maria Souza Lima', phone: '(31) 98888-7777' },
    });
    assert.equal(basic.status, 200);
    assert.equal(basic.body.user.phone, '31988887777');

    const profile = await app.call('PATCH', '/v1/me/client-profile', {
      token: client.accessToken,
      body: {
        contactPreference: 'email',
        address: { street: 'Rua das Flores', number: '100', city: 'Belo Horizonte', state: 'mg', postalCode: '30110-000' },
      },
    });
    assert.equal(profile.status, 200);
    assert.equal(profile.body.clientProfile.contactPreference, 'email');
    assert.equal(profile.body.clientProfile.address.state, 'MG');
    assert.equal(profile.body.clientProfile.address.postalCode, '30110000');

    const me = await app.call('GET', '/v1/me', { token: client.accessToken });
    assert.equal(me.body.clientProfile.address.street, 'Rua das Flores');
  });

  test('dados inválidos no perfil são recusados com erro por campo', async () => {
    const client = await register(app, clientPayload());
    const response = await app.call('PATCH', '/v1/me/client-profile', {
      token: client.accessToken,
      body: { address: { state: 'XX', postalCode: '123' } },
    });
    assert.equal(response.status, 400);
    assert.ok(response.body.fieldErrors['address.state']);
    assert.ok(response.body.fieldErrors['address.postalCode']);
  });

  test('cuidador salva o perfil profissional e ele persiste', async () => {
    const caregiver = await register(app, caregiverPayload());
    const saved = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: completeCaregiverProfile({ specialties: ['elderly', 'elderly', 'dementia'] }),
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.caregiverProfile.specialties, ['elderly', 'dementia'], 'remove repetidos');

    const me = await app.call('GET', '/v1/me', { token: caregiver.accessToken });
    assert.equal(me.body.caregiverProfile.serviceCity, 'Recife');
    assert.equal(me.body.caregiverProfile.experienceYears, 6);
  });

  test('cuidador pode salvar parte do perfil e completar depois', async () => {
    const caregiver = await register(app, caregiverPayload());
    const partial = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: { serviceCity: 'Recife', serviceState: 'PE' },
    });
    assert.equal(partial.body.caregiverProfile.verificationStatus, 'incomplete');
    assert.equal(partial.body.caregiverProfile.serviceCity, 'Recife');
  });

  test('valores fora da lista são recusados', async () => {
    const caregiver = await register(app, caregiverPayload());
    const response = await app.call('PATCH', '/v1/me/caregiver-profile', {
      token: caregiver.accessToken,
      body: { specialties: ['cirurgia'], serviceRadiusKm: 500 },
    });
    assert.equal(response.status, 400);
    assert.ok(response.body.fieldErrors['specialties.0']);
    assert.ok(response.body.fieldErrors.serviceRadiusKm);
  });

  test('beneficiário: criar, listar, editar e remover', async () => {
    const client = await register(app, clientPayload());
    const created = await app.call('POST', '/v1/me/care-recipients', {
      token: client.accessToken,
      body: { fullName: 'José Pereira', relationship: 'parent', assistanceNeeds: ['mobility', 'companionship'] },
    });
    assert.equal(created.status, 201);
    const id = created.body.careRecipient.id;

    const edited = await app.call('PATCH', `/v1/me/care-recipients/${id}`, {
      token: client.accessToken,
      body: { address: { city: 'Curitiba', state: 'PR' } },
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.careRecipient.address.city, 'Curitiba');

    const list = await app.call('GET', '/v1/me/care-recipients', { token: client.accessToken });
    assert.equal(list.body.careRecipients.length, 1);

    const removed = await app.call('DELETE', `/v1/me/care-recipients/${id}`, { token: client.accessToken });
    assert.equal(removed.status, 204);
  });
});

describe('tratamento de erros do servidor', () => {
  test('falha inesperada (ex.: banco fora do ar) vira 500 genérico, sem detalhes', async () => {
    const brokenDb: Db = {
      query: async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.1:5432 senha=segredo');
      },
      exec: async () => {},
      close: async () => {},
    };
    const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/x', MAIL_TRANSPORT: 'none' });
    const server = createServer(createApp({ db: brokenDb, config, mailer: unavailableMailer, log: () => {} }));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    const originalError = console.error;
    console.error = () => {};
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'maria@exemplo.com', password: 'qualquer1' }),
      });
      const body = (await response.json()) as { code: string; message: string };
      assert.equal(response.status, 500);
      assert.equal(body.code, 'SERVER_ERROR');
      assert.doesNotMatch(JSON.stringify(body), /ECONNREFUSED|segredo|5432/);
    } finally {
      console.error = originalError;
      server.close();
    }
  });

  test('recuperação de senha sem provedor de e-mail responde indisponível', async () => {
    const config = loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/x', MAIL_TRANSPORT: 'none' });
    const server = createServer(createApp({ db: app.db, config, mailer: unavailableMailer, log: () => {} }));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/v1/auth/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'maria@exemplo.com' }),
      });
      assert.equal(response.status, 503);
    } finally {
      server.close();
    }
  });

  test('rota inexistente responde 404 e método errado 405', async () => {
    assert.equal((await app.call('GET', '/v1/nao-existe')).status, 404);
    assert.equal((await app.call('DELETE', '/v1/auth/login')).status, 405);
  });

  test('configuração recusa modo console de e-mail em produção', () => {
    assert.throws(
      () => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://h/db', MAIL_TRANSPORT: 'console' }),
      /MAIL_TRANSPORT/,
    );
  });
});
