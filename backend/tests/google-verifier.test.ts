import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, test } from 'node:test';

import { createGoogleVerifier } from '../src/security/google.ts';

/** Testa a verificação REAL (assinatura RSA, emissor, destinatário, validade) com chaves geradas aqui. */
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'chave-1', alg: 'RS256', use: 'sig' };
const CLIENT_ID = '1234-web.apps.googleusercontent.com';
const NOW = 1_800_000_000_000;

function b64(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeToken(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: 'chave-1' }, key = privateKey) {
  const data = `${b64(header)}.${b64(payload)}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), key).toString('base64url')}`;
}

const valid = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '109876543210987654321',
  email: 'Maria@Gmail.com',
  email_verified: true,
  name: 'Maria Souza',
  iat: NOW / 1000 - 10,
  exp: NOW / 1000 + 3600,
};

let fetches = 0;
const verifier = createGoogleVerifier([CLIENT_ID], {
  now: () => NOW,
  fetch: async () => {
    fetches += 1;
    return { ok: true, json: async () => ({ keys: [jwk] }), headers: { get: () => 'public, max-age=3600' } };
  },
});

describe('verificação do ID token do Google', () => {
  test('token válido devolve a identidade (e-mail em minúsculas)', async () => {
    const identity = await verifier.verify(makeToken(valid));
    assert.deepEqual(identity, { sub: valid.sub, email: 'maria@gmail.com', emailVerified: true, name: 'Maria Souza' });
  });

  test('chaves do Google ficam em cache', async () => {
    const before = fetches;
    await verifier.verify(makeToken(valid));
    assert.equal(fetches, before);
  });

  test('recusa assinatura de outra chave, emissor, destinatário, expiração e algoritmo errados', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    const cases = [
      makeToken(valid, undefined, other),
      makeToken({ ...valid, iss: 'https://evil.example' }),
      makeToken({ ...valid, aud: 'outro-app.apps.googleusercontent.com' }),
      makeToken({ ...valid, exp: NOW / 1000 - 3600 }),
      makeToken(valid, { alg: 'none', kid: 'chave-1' }),
      makeToken(valid, { alg: 'RS256', kid: 'desconhecida' }),
      'nao.e.token',
    ];
    for (const token of cases) await assert.rejects(verifier.verify(token));
  });

  test('payload adulterado invalida a assinatura', async () => {
    const [h, , sig] = makeToken(valid).split('.');
    await assert.rejects(verifier.verify(`${h}.${b64({ ...valid, email: 'atacante@gmail.com' })}.${sig}`));
  });

  test('sem client IDs configurados, o login Google fica indisponível', () => {
    assert.equal(createGoogleVerifier([]).available, false);
  });
});
