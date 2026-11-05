import type { IncomingMessage, ServerResponse } from 'node:http';

import { HttpError } from './errors.ts';

/**
 * Roteador mínimo sobre node:http. Suporta rotas com parâmetros (":id"),
 * corpo JSON com limite de tamanho e respostas JSON.
 */

export type RequestContext = {
  req: IncomingMessage;
  params: Record<string, string>;
  body: unknown;
  ip: string;
  bearerToken: string | null;
};

export type HandlerResult = { status: number; body?: unknown };
export type Handler = (ctx: RequestContext) => Promise<HandlerResult>;

type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler };

const MAX_BODY_BYTES = 64 * 1024;

export class Router {
  private routes: Route[] = [];

  add(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, handler: Handler): void {
    const keys: string[] = [];
    const source = path.replace(/:([a-zA-Z]+)/g, (_match, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.routes.push({ method, pattern: new RegExp(`^${source}$`), keys, handler });
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | 'method' | null {
    let pathMatched = false;
    for (const route of this.routes) {
      const found = route.pattern.exec(pathname);
      if (!found) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(found[index + 1] ?? '');
      });
      return { handler: route.handler, params };
    }
    return pathMatched ? 'method' : null;
  }
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'DELETE') return undefined;

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Os dados enviados são grandes demais.');
    }
    chunks.push(buffer);
  }
  if (size === 0) return undefined;

  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('application/json')) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envie os dados em JSON.');
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Os dados enviados não estão em um formato válido.');
  }
}

export function sendJson(res: ServerResponse, status: number, body?: unknown): void {
  res.statusCode = status;
  // Respostas com dados pessoais nunca devem ficar em cache.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (body === undefined || status === 204) {
    res.end();
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
}
