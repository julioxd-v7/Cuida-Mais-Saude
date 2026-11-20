import type { IncomingMessage, ServerResponse } from 'node:http';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createPgDb } from './db/pg.ts';
import { unavailableMailer } from './mail/mailer.ts';
import { createSupabaseStorage, unavailableStorage } from './storage/fileStorage.ts';

/**
 * Entrada para publicar o backend como função da Vercel. Mesmo app do
 * server.ts, sem listen(): a Vercel chama o handler a cada requisição.
 * A conexão com o banco é criada uma vez e reaproveitada enquanto a função
 * estiver "quente".
 */
let handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;

export default function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  if (!handler) {
    const config = loadConfig();
    const db = createPgDb(config.database);
    const storage = config.storage ? createSupabaseStorage(config.storage) : unavailableStorage;
    handler = createApp({ db, config, mailer: unavailableMailer, storage });
  }
  return handler(req, res);
}
