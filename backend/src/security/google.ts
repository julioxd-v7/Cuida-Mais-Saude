import { createPublicKey, verify as verifySignature } from 'node:crypto';

/**
 * Verificação do "ID token" do Google (login com Google).
 *
 * O app recebe o token do Google e manda para cá; o backend confere a
 * assinatura com as chaves públicas do Google (JWKS), o emissor, o
 * destinatário (nossos client IDs), a validade e se o e-mail é verificado.
 * Nada disso é confiado ao app.
 */

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export interface GoogleVerifier {
  /** false quando GOOGLE_CLIENT_IDS não foi configurado. */
  available: boolean;
  verify(idToken: string): Promise<GoogleIdentity>;
}

export class InvalidGoogleToken extends Error {
  constructor(reason: string) {
    super(`Token do Google inválido: ${reason}`);
    this.name = 'InvalidGoogleToken';
  }
}

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const CLOCK_SKEW_S = 60;

type Jwk = { kid?: string; kty?: string; n?: string; e?: string; [key: string]: unknown };
type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown>; headers: { get(name: string): string | null } }>;

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

export const unavailableGoogle: GoogleVerifier = {
  available: false,
  async verify() {
    throw new InvalidGoogleToken('login com Google não configurado');
  },
};

export function createGoogleVerifier(
  clientIds: readonly string[],
  options: { fetch?: FetchLike; now?: () => number } = {},
): GoogleVerifier {
  if (!clientIds.length) return unavailableGoogle;
  const doFetch: FetchLike = options.fetch ?? ((url) => fetch(url));
  const now = options.now ?? (() => Date.now());
  let cache: { keys: Jwk[]; expiresAt: number } | null = null;

  async function keys(forceRefresh = false): Promise<Jwk[]> {
    if (!forceRefresh && cache && cache.expiresAt > now()) return cache.keys;
    const response = await doFetch(CERTS_URL);
    if (!response.ok) throw new Error('Não foi possível obter as chaves do Google');
    const body = (await response.json()) as { keys?: Jwk[] };
    const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 3600);
    cache = { keys: body.keys ?? [], expiresAt: now() + Math.min(maxAge, 86_400) * 1000 };
    return cache.keys;
  }

  return {
    available: true,
    async verify(idToken: string): Promise<GoogleIdentity> {
      const parts = idToken.split('.');
      if (parts.length !== 3) throw new InvalidGoogleToken('formato');
      const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

      let header: { alg?: string; kid?: string };
      let payload: Record<string, unknown>;
      try {
        header = decodeSegment(headerB64) as typeof header;
        payload = decodeSegment(payloadB64) as Record<string, unknown>;
      } catch {
        throw new InvalidGoogleToken('formato');
      }
      if (header.alg !== 'RS256' || !header.kid) throw new InvalidGoogleToken('algoritmo');

      let key = (await keys()).find((item) => item.kid === header.kid);
      if (!key) key = (await keys(true)).find((item) => item.kid === header.kid); // chaves giram
      if (!key) throw new InvalidGoogleToken('chave desconhecida');

      const valid = verifySignature(
        'RSA-SHA256',
        Buffer.from(`${headerB64}.${payloadB64}`),
        // A chave JWK do Google é aceita diretamente pelo Node.
        createPublicKey({ key, format: 'jwk' } as Parameters<typeof createPublicKey>[0]),
        Buffer.from(signatureB64, 'base64url'),
      );
      if (!valid) throw new InvalidGoogleToken('assinatura');

      const nowS = now() / 1000;
      if (!ISSUERS.includes(String(payload.iss))) throw new InvalidGoogleToken('emissor');
      const audiences = Array.isArray(payload.aud) ? payload.aud.map(String) : [String(payload.aud)];
      if (!audiences.some((aud) => clientIds.includes(aud))) throw new InvalidGoogleToken('destinatário');
      if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_S < nowS) throw new InvalidGoogleToken('expirado');
      if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW_S > nowS) throw new InvalidGoogleToken('emitido no futuro');
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new InvalidGoogleToken('dados');

      return {
        sub: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: typeof payload.name === 'string' ? payload.name : null,
      };
    },
  };
}
