import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Hash de senha com scrypt (nativo do Node, sem dependência extra).
 * Parâmetros: N=2^14, r=8, p=5 — uma das combinações recomendadas pela OWASP
 * (Password Storage Cheat Sheet) com custo equivalente a N=2^17, p=1,
 * usando ~16 MB por cálculo.
 *
 * Formato salvo: scrypt$N$r$p$salt(base64)$hash(base64)
 * Os parâmetros ficam no próprio hash, então dá para aumentá-los no futuro
 * sem invalidar senhas antigas.
 */

const PARAMS = { N: 2 ** 14, r: 8, p: 5 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, saltB64, hashB64] = stored.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;

  const expected = Buffer.from(hashB64, 'base64');
  const actual = await derive(password, Buffer.from(saltB64, 'base64'), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Hash fixo usado quando o e-mail não existe: o login gasta o mesmo tempo
 * nos dois casos, para não revelar quais e-mails têm conta.
 */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('senha-inexistente-para-equalizar-tempo');
  await verifyPassword(password, await dummyHash);
}
