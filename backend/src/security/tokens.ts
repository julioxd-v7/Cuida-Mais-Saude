import { createHash, randomBytes, randomInt } from 'node:crypto';

/**
 * Tokens de sessão opacos: 32 bytes aleatórios (256 bits). O cliente guarda
 * o token; o banco guarda só o SHA-256 dele. Se o banco vazar, os tokens não
 * podem ser usados.
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Código numérico de 8 dígitos para recuperação de senha. */
export function generateResetCode(): string {
  return randomInt(0, 100_000_000).toString().padStart(8, '0');
}

/** O hash do código inclui o id da solicitação: o mesmo código em outra solicitação gera outro hash. */
export function hashResetCode(resetId: string, code: string): string {
  return createHash('sha256').update(`${resetId}:${code}`).digest('hex');
}
