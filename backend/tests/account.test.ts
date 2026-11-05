import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  approvedCaregiver,
  caregiverPayload,
  clientPayload,
  createAdmin,
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

async function login(email: string, password = VALID_PASSWORD) {
  return app.call('POST', '/v1/auth/login', { body: { email, password } });
}

describe('senha e acesso', () => {
  test('alterar senha exige a atual e encerra as outras sessões', async () => {
    const payload = clientPayload();
    const first = await register(app, payload);
    const second = (await login(payload.email)).body;

    const wrong = await app.call('POST', '/v1/me/password', {
      token: first.accessToken,
      body: { currentPassword: 'errada123', newPassword: 'novaSenha456' },
    });
    assert.equal(wrong.status, 400);
    assert.ok(wrong.body.fieldErrors.currentPassword);

    const ok = await app.call('POST', '/v1/me/password', {
      token: first.accessToken,
      body: { currentPassword: VALID_PASSWORD, newPassword: 'novaSenha456' },
    });
    assert.equal(ok.status, 204);

    assert.equal((await app.call('GET', '/v1/me', { token: first.accessToken })).status, 200);
    assert.equal((await app.call('GET', '/v1/me', { token: second.accessToken })).status, 401);
    assert.equal((await login(payload.email)).status, 401);
    assert.equal((await login(payload.email, 'novaSenha456')).status, 200);
  });

  test('lista sessões e sai dos outros aparelhos', async () => {
    const payload = clientPayload();
    const first = await register(app, payload);
    await login(payload.email);
    await login(payload.email);

    const list = await app.call('GET', '/v1/me/sessions', { token: first.accessToken });
    assert.equal(list.body.sessions.length, 3);
    assert.equal(list.body.sessions.filter((s: { current: boolean }) => s.current).length, 1);

    const revoked = await app.call('POST', '/v1/me/sessions/revoke-others', { token: first.accessToken });
    assert.equal(revoked.body.revoked, 2);
    const after = await app.call('GET', '/v1/me/sessions', { token: first.accessToken });
    assert.equal(after.body.sessions.length, 1);
  });

  test('/v1/me informa as formas de entrar', async () => {
    const user = await register(app, clientPayload());
    const me = await app.call('GET', '/v1/me', { token: user.accessToken });
    assert.equal(me.body.user.hasPassword, true);
    assert.equal(me.body.user.googleLinked, false);
  });
});

describe('exclusão de conta', () => {
  test('exige EXCLUIR e a senha; depois a conta não entra e some da busca', async () => {
    const admin = await createAdmin(app);
    const caregiver = await approvedCaregiver(app, admin);
    const client = await register(app, clientPayload());
    await app.call('POST', `/v1/favorites/${caregiver.user.id}`, { token: client.accessToken });

    const noConfirm = await app.call('POST', '/v1/me/deletion', { token: caregiver.accessToken, body: { password: VALID_PASSWORD } });
    assert.equal(noConfirm.status, 400);
    const wrongPass = await app.call('POST', '/v1/me/deletion', {
      token: caregiver.accessToken,
      body: { confirm: 'EXCLUIR', password: 'errada123' },
    });
    assert.equal(wrongPass.status, 400);

    const done = await app.call('POST', '/v1/me/deletion', {
      token: caregiver.accessToken,
      body: { confirm: 'EXCLUIR', password: VALID_PASSWORD, reason: 'teste' },
    });
    assert.equal(done.status, 200);

    // Sessão encerrada e login bloqueado.
    assert.equal((await app.call('GET', '/v1/me', { token: caregiver.accessToken })).status, 401);
    const [row] = await app.db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [caregiver.user.id]);
    const relogin = await login(row!.email);
    assert.equal(relogin.status, 403);
    assert.equal(relogin.body.code, 'ACCOUNT_DELETED');

    // Some da busca e dos favoritos.
    const search = await app.call('GET', '/v1/caregivers?city=Recife&state=PE', { token: client.accessToken });
    assert.ok(!search.body.caregivers.some((c: { id: string }) => c.id === caregiver.user.id));
    const favorites = await app.call('GET', '/v1/favorites', { token: client.accessToken });
    assert.deepEqual(favorites.body.caregivers, []);

    const [audit] = await app.db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM audit_log WHERE action = 'user.deletion_requested' AND target_id = $1`,
      [caregiver.user.id],
    );
    assert.equal(audit?.total, 1);
  });

  test('a marca de exclusão não pode ser mexida direto no banco', async () => {
    const user = await register(app, clientPayload());
    await assert.rejects(app.db.query(`UPDATE users SET deletion_requested_at = now() WHERE id = $1 RETURNING id`, [user.user.id]));
  });

  test('admin não se exclui pelo app', async () => {
    const admin = await createAdmin(app);
    const response = await app.call('POST', '/v1/me/deletion', { token: admin.accessToken, body: { confirm: 'EXCLUIR', password: VALID_PASSWORD } });
    assert.equal(response.status, 403);
  });
});

describe('entrar com Google', () => {
  test('conta nova: pede os dados que faltam e cria a conta sem senha', async () => {
    const token = app.google.issue({ sub: '100000000000000000001', email: 'nova.google@gmail.com', name: 'Rosa' });
    const first = await app.call('POST', '/v1/auth/google', { body: { idToken: token } });
    assert.equal(first.status, 200);
    assert.equal(first.body.needsSignup, true);
    assert.equal(first.body.profile.email, 'nova.google@gmail.com');

    const created = await app.call('POST', '/v1/auth/google', {
      body: { idToken: token, signup: { role: 'client', fullName: 'Rosa Lima', phone: '11912345678', acceptTerms: true } },
    });
    assert.equal(created.status, 201);
    assert.ok(created.body.accessToken);
    assert.equal(created.body.user.hasPassword, false);
    assert.equal(created.body.user.googleLinked, true);

    // Sem senha, o login por senha falha com a resposta genérica.
    assert.equal((await login('nova.google@gmail.com', 'qualquer123')).status, 401);

    // Entra de novo pelo Google sem pedir dados.
    const again = await app.call('POST', '/v1/auth/google', { body: { idToken: token } });
    assert.equal(again.status, 200);
    assert.ok(again.body.accessToken);

    // Pode criar uma senha depois, sem informar senha atual.
    const setPassword = await app.call('POST', '/v1/me/password', {
      token: again.body.accessToken,
      body: { newPassword: 'minhaSenha789' },
    });
    assert.equal(setPassword.status, 204);
    assert.equal((await login('nova.google@gmail.com', 'minhaSenha789')).status, 200);
  });

  test('conta existente com o mesmo e-mail é vinculada e entra', async () => {
    const payload = caregiverPayload();
    await register(app, payload);
    const token = app.google.issue({ sub: '100000000000000000002', email: payload.email as string });
    const response = await app.call('POST', '/v1/auth/google', { body: { idToken: token } });
    assert.equal(response.status, 200);
    assert.equal(response.body.user.role, 'caregiver');
    assert.equal(response.body.user.googleLinked, true);
  });

  test('não cadastra admin, recusa token inválido e e-mail não verificado', async () => {
    const token = app.google.issue({ sub: '100000000000000000003', email: 'x.google@gmail.com' });
    const admin = await app.call('POST', '/v1/auth/google', {
      body: { idToken: token, signup: { role: 'admin', fullName: 'X Y', phone: '11912345678', acceptTerms: true } },
    });
    assert.equal(admin.status, 400);

    const invalid = await app.call('POST', '/v1/auth/google', { body: { idToken: 'y'.repeat(200) } });
    assert.equal(invalid.status, 401);

    const unverified = app.google.issue({ sub: '100000000000000000004', email: 'nv@gmail.com', emailVerified: false });
    assert.equal((await app.call('POST', '/v1/auth/google', { body: { idToken: unverified } })).status, 401);
  });

  test('e-mail já ligado a outro Google é recusado', async () => {
    const first = app.google.issue({ sub: '100000000000000000005', email: 'dupla@gmail.com' });
    await app.call('POST', '/v1/auth/google', {
      body: { idToken: first, signup: { role: 'client', fullName: 'Ana Dupla', phone: '11912345678', acceptTerms: true } },
    });
    const other = app.google.issue({ sub: '100000000000000000006', email: 'dupla@gmail.com' });
    const response = await app.call('POST', '/v1/auth/google', { body: { idToken: other } });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'GOOGLE_ACCOUNT_MISMATCH');
  });
});
