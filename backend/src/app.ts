import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AppConfig } from './config.ts';
import type { Db } from './db/types.ts';
import { HttpError } from './http/errors.ts';
import { getBearerToken, readJsonBody, Router, sendJson } from './http/router.ts';
import type { Mailer } from './mail/mailer.ts';
import { registerAdminRoutes } from './modules/admin/routes.ts';
import { registerAuthRoutes } from './modules/auth/routes.ts';
import type { Deps } from './modules/deps.ts';
import { registerMeRoutes } from './modules/me/routes.ts';
import { registerRecipientRoutes } from './modules/recipients/routes.ts';
import { RateLimiter } from './security/rateLimit.ts';
import { unavailableStorage, type FileStorage } from './storage/fileStorage.ts';
import { createGoogleVerifier, type GoogleVerifier } from './security/google.ts';
import { registerCatalogRoutes } from './modules/catalog/routes.ts';
import { registerDocumentRoutes } from './modules/documents/routes.ts';
import { registerMessageRoutes } from './modules/messages/routes.ts';
import { registerAreaRoutes } from './modules/areas/routes.ts';
import { registerCaregiverSearchRoutes } from './modules/caregivers/routes.ts';

export type AppOptions = {
  db: Db;
  config: AppConfig;
  mailer: Mailer;
  /** Armazenamento dos documentos. Sem ele, o upload responde indisponível. */
  storage?: FileStorage;
  /** Verificador do login com Google (os testes usam um falso). */
  google?: GoogleVerifier;
  log?: (message: string) => void;
  /** Permite aos testes trocar os limites de tentativas. */
  limits?: Partial<Deps['limits']>;
};

/** Monta o handler HTTP. Separado do server.ts para poder ser testado. */
export function createApp(options: AppOptions) {
  const log = options.log ?? ((message: string) => console.log(message));
  const deps: Deps = {
    db: options.db,
    config: options.config,
    mailer: options.mailer,
    storage: options.storage ?? unavailableStorage,
    google: options.google ?? createGoogleVerifier(options.config.googleClientIds),
    log,
    limits: {
      login: new RateLimiter(10, 15 * 60_000),
      register: new RateLimiter(10, 60 * 60_000),
      forgot: new RateLimiter(5, 60 * 60_000),
      reset: new RateLimiter(10, 15 * 60_000),
      messages: new RateLimiter(30, 60_000),
      account: new RateLimiter(10, 15 * 60_000),
      ...options.limits,
    },
  };

  const router = new Router();
  router.add('GET', '/v1/health', async () => {
    await deps.db.query('SELECT 1 AS ok');
    return { status: 200, body: { status: 'ok' } };
  });
  registerCatalogRoutes(router, deps);
  registerAreaRoutes(router, deps);
  registerAuthRoutes(router, deps);
  registerMeRoutes(router, deps);
  registerRecipientRoutes(router, deps);
  registerDocumentRoutes(router, deps);
  registerMessageRoutes(router, deps);
  registerCaregiverSearchRoutes(router, deps);
  registerAdminRoutes(router, deps);

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = Date.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    applyCors(req, res, options.config.corsOrigins);

    try {
      if (req.method === 'OPTIONS') {
        sendJson(res, 204);
        return;
      }

      const found = router.match(req.method ?? 'GET', url.pathname);
      if (found === null) throw new HttpError(404, 'NOT_FOUND', 'Endereço não encontrado.');
      if (found === 'method') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');

      const result = await found.handler({
        req,
        params: found.params,
        body: await readJsonBody(req),
        ip: req.socket.remoteAddress ?? 'desconhecido',
        bearerToken: getBearerToken(req),
      });
      sendJson(res, result.status, result.body);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { code: error.code, message: error.message, fieldErrors: error.fieldErrors });
      } else {
        // Detalhes só no log do servidor; o cliente recebe mensagem genérica.
        console.error(`[erro] ${req.method} ${url.pathname}:`, error);
        sendJson(res, 500, { code: 'SERVER_ERROR', message: 'Tivemos um problema no servidor. Tente novamente em instantes.' });
      }
    } finally {
      // Nunca registrar corpo, cabeçalhos ou query string (podem ter dados pessoais).
      if (options.config.env !== 'test') {
        log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
      }
    }
  };
}

function applyCors(req: IncomingMessage, res: ServerResponse, allowed: string[]): void {
  const origin = req.headers.origin;
  if (!origin || !allowed.includes(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}
