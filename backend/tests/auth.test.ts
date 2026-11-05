import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import {
  caregiverPayload,
  clientPayload,
  register,
  startTestApp,
  uniqueEmail,
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

describe('cadastro', () => {
  test('cadastro válido de cliente cria conta, perfil e sessão', async () => {
    const payload = clientPayload();
    const response = await app.call('POST', '/v1/auth/register', { body: payload });

    assert.equal(response.status, 201);
    assert.ok(response.body.accessToken);
    assert.ok(response.body.refreshToken);
    assert.equal(response.body.user.role, 'client');
    assert.equal(response.body.user.email, payload.email);
    assert.equal(response.body.user.phone, '11912345678', 'telefone salvo só com dígitos');
    assert.equal(response.body.user.password_hash, undefined, 'hash da senha nunca sai na resposta');

    const me = await app.call('GET', '/v1/me', { token: response.body.accessToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.clientProfile.contactPreference, 'whatsapp');
  });

  test('cadastro válido de cuidador começa com perfil incompleto', async () => {
    const { accessToken, user } = await register(app, caregiverPayload());
    assert.equal(user.email.startsWith('cuidador.'), true);

    const me = await app.call('GET', '/v1/me', { token: accessToken });
    assert.equal(me.body.user.role, 'caregiver');
    assert.equal(me.body.caregiverProfile.verificationStatus, 'incomplete');
  });

  test('senha é guardada com hash, nunca em texto puro', async () => {
    const payload = clientPayload();
    const { user } = await register(app, payload);
    const [row] = await app.db.query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
    assert.ok(row);
    assert.notEqual(row.password_hash, VALID_PASSWORD);
    assert.match(row.password_hash, /^scrypt\$/);
  });

  test('campos obrigatórios ausentes retornam erro por campo', async () => {
    const response = await app.call('POST', '/v1/auth/register', { body: { role: 'client' } });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'VALIDATION');
    for (const field of ['fullName', 'email', 'phone', 'password', 'acceptTerms']) {
      assert.ok(response.body.fieldErrors[field], `deveria apontar erro em ${field}`);
    }
  });

  test('e-mail, telefone, senha fraca e nome incompleto são recusados', async () => {
    const response = await app.call('POST', '/v1/auth/register', {
      body: clientPayload({ email: 'maria@', phone: '123', password: 'abc', fullName: 'Maria' }),
    });
    assert.equal(response.status, 400);
    assert.match(response.body.fieldErrors.email, /e-mail válido/);
    assert.match(response.body.fieldErrors.phone, /DDD/);
    assert.match(response.body.fieldErrors.password, /8 caracteres/);
    assert.match(response.body.fieldErrors.fullName, /sobrenome/);
  });

  test('celular de 11 dígitos sem o 9 é recusado', async () => {
    const response = await app.call('POST', '/v1/auth/register', { body: clientPayload({ phone: '11812345678' }) });
    assert.equal(response.status, 400);
    assert.match(response.body.fieldErrors.phone, /começa com 9/);
  });

  test('é obrigatório aceitar os termos', async () => {
    const response = await app.call('POST', '/v1/auth/register', { body: clientPayload({ acceptTerms: false }) });
    assert.equal(response.status, 400);
    assert.ok(response.body.fieldErrors.acceptTerms);
  });

  test('e-mail já cadastrado (mesmo com maiúsculas) retorna 409', async () => {
    const payload = clientPayload();
    await register(app, payload);
    const duplicate = await app.call('POST', '/v1/auth/register', {
      body: caregiverPayload({ email: `  ${payload.email.toUpperCase()} ` }),
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'EMAIL_IN_USE');
    assert.ok(duplicate.body.fieldErrors.email);
  });

  test('não é possível se cadastrar como administrador', async () => {
    const response = await app.call('POST', '/v1/auth/register', { body: clientPayload({ role: 'admin' }) });
    assert.equal(response.status, 400);
    assert.ok(response.body.fieldErrors.role);
  });

  test('campos extras (ex.: status) são recusados no cadastro', async () => {
    const response = await app.call('POST', '/v1/auth/register', { body: { ...clientPayload(), status: 'active' } });
    assert.equal(response.status, 400);
  });
});

describe('login, sessão e logout', () => {
  test('login válido devolve tokens e usuário', async () => {
    const payload = clientPayload();
    await register(app, payload);
    const response = await app.call('POST', '/v1/auth/login', {
      body: { email: payload.email.toUpperCase(), password: VALID_PASSWORD },
    });
    assert.equal(response.status, 200);
    assert.ok(response.body.accessToken);
    assert.equal(response.body.user.email, payload.email);
  });

  test('senha errada e e-mail inexistente têm a mesma resposta', async () => {
    const payload = clientPayload();
    await register(app, payload);
    const wrong = await app.call('POST', '/v1/auth/login', { body: { email: payload.email, password: 'outraSenha1' } });
    const unknown = await app.call('POST', '/v1/auth/login', { body: { email: uniqueEmail(), password: 'outraSenha1' } });

    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
    assert.equal(wrong.body.code, 'INVALID_CREDENTIALS');
  });

  test('restauração de sessão: o token salvo continua válido em /v1/auth/session', async () => {
    const { accessToken, user } = await register(app, clientPayload());
    const restored = await app.call('GET', '/v1/auth/session', { token: accessToken });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.user.id, user.id);
  });

  test('refresh troca os tokens e invalida o refresh anterior', async () => {
    const { refreshToken } = await register(app, clientPayload());
    const first = await app.call('POST', '/v1/auth/refresh', { body: { refreshToken } });
    assert.equal(first.status, 200);
    assert.notEqual(first.body.refreshToken, refreshToken);

    const reused = await app.call('POST', '/v1/auth/refresh', { body: { refreshToken } });
    assert.equal(reused.status, 401);

    const me = await app.call('GET', '/v1/me', { token: first.body.accessToken });
    assert.equal(me.status, 200);
  });

  test('access token expirado retorna TOKEN_EXPIRED e o refresh recupera a sessão', async () => {
    const { accessToken, refreshToken, user } = await register(app, clientPayload());
    await app.db.query(
      `UPDATE sessions SET access_expires_at = now() - interval '1 minute' WHERE user_id = $1 RETURNING id`,
      [user.id],
    );

    const expired = await app.call('GET', '/v1/me', { token: accessToken });
    assert.equal(expired.status, 401);
    assert.equal(expired.body.code, 'TOKEN_EXPIRED');

    const refreshed = await app.call('POST', '/v1/auth/refresh', { body: { refreshToken } });
    assert.equal(refreshed.status, 200);
  });

  test('refresh token expirado encerra a sessão', async () => {
    const { refreshToken, user } = await register(app, clientPayload());
    await app.db.query(
      `UPDATE sessions SET refresh_expires_at = now() - interval '1 minute' WHERE user_id = $1 RETURNING id`,
      [user.id],
    );
    const response = await app.call('POST', '/v1/auth/refresh', { body: { refreshToken } });
    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'TOKEN_EXPIRED');
  });

  test('logout revoga a sessão no servidor', async () => {
    const { accessToken, refreshToken } = await register(app, clientPayload());
    const logout = await app.call('POST', '/v1/auth/logout', { token: accessToken, body: { refreshToken } });
    assert.equal(logout.status, 204);

    assert.equal((await app.call('GET', '/v1/me', { token: accessToken })).status, 401);
    assert.equal((await app.call('POST', '/v1/auth/refresh', { body: { refreshToken } })).status, 401);
  });

  test('token inventado é recusado', async () => {
    const response = await app.call('GET', '/v1/me', { token: 'token-inventado-que-nao-existe' });
    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'UNAUTHORIZED');
  });

  test('o banco guarda só o hash dos tokens', async () => {
    const { accessToken, user } = await register(app, clientPayload());
    const rows = await app.db.query<{ access_token_hash: string }>(
      `SELECT access_token_hash FROM sessions WHERE user_id = $1`,
      [user.id],
    );
    assert.ok(rows.length > 0);
    assert.ok(rows.every((row) => row.access_token_hash !== accessToken && /^[0-9a-f]{64}$/.test(row.access_token_hash)));
  });
});

describe('recuperação de senha', () => {
  test('fluxo completo: código por e-mail, nova senha, sessões antigas encerradas', async () => {
    const payload = clientPayload();
    const { accessToken } = await register(app, payload);

    const forgot = await app.call('POST', '/v1/auth/password/forgot', { body: { email: payload.email } });
    assert.equal(forgot.status, 202);
    const mail = app.mails.findLast((message) => message.to === payload.email);
    const code = mail?.text.match(/\d{8}/)?.[0];
    assert.ok(code, 'o e-mail deve conter o código');

    const reset = await app.call('POST', '/v1/auth/password/reset', {
      body: { email: payload.email, code, password: 'novaSenha456' },
    });
    assert.equal(reset.status, 204);

    assert.equal((await app.call('GET', '/v1/me', { token: accessToken })).status, 401, 'sessão antiga encerrada');
    const oldLogin = await app.call('POST', '/v1/auth/login', { body: { email: payload.email, password: VALID_PASSWORD } });
    assert.equal(oldLogin.status, 401);
    const newLogin = await app.call('POST', '/v1/auth/login', { body: { email: payload.email, password: 'novaSenha456' } });
    assert.equal(newLogin.status, 200);

    const reused = await app.call('POST', '/v1/auth/password/reset', {
      body: { email: payload.email, code, password: 'outraSenha789' },
    });
    assert.equal(reused.status, 400, 'código só vale uma vez');
  });

  test('e-mail inexistente recebe a mesma resposta e nenhum e-mail é enviado', async () => {
    const before = app.mails.length;
    const response = await app.call('POST', '/v1/auth/password/forgot', { body: { email: uniqueEmail() } });
    assert.equal(response.status, 202);
    assert.equal(app.mails.length, before);
  });

  test('código errado bloqueia após 5 tentativas', async () => {
    const payload = clientPayload();
    await register(app, payload);
    await app.call('POST', '/v1/auth/password/forgot', { body: { email: payload.email } });
    const code = app.mails.findLast((message) => message.to === payload.email)?.text.match(/\d{8}/)?.[0];
    assert.ok(code);
    const wrong = code === '00000000' ? '11111111' : '00000000';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await app.call('POST', '/v1/auth/password/reset', {
        body: { email: payload.email, code: wrong, password: 'novaSenha456' },
      });
      assert.equal(response.status, 400);
    }
    const right = await app.call('POST', '/v1/auth/password/reset', {
      body: { email: payload.email, code, password: 'novaSenha456' },
    });
    assert.equal(right.status, 400, 'depois de 5 erros nem o código certo vale');
  });
});

describe('limites e erros', () => {
  test('excesso de tentativas de login é bloqueado (429)', async () => {
    const strict = await startTestApp({ strictLimits: true });
    try {
      const email = uniqueEmail();
      let last = 0;
      for (let attempt = 0; attempt < 11; attempt += 1) {
        last = (await strict.call('POST', '/v1/auth/login', { body: { email, password: 'qualquer1' } })).status;
      }
      assert.equal(last, 429);
    } finally {
      await strict.stop();
    }
  });

  test('JSON inválido retorna 400 sem detalhes internos', async () => {
    const response = await fetch(`${app.baseUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":',
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, 'INVALID_JSON');
  });
});
