import { createServer } from 'node:http';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createPgDb } from './db/pg.ts';
import { createConsoleMailer, unavailableMailer } from './mail/mailer.ts';
import { createSupabaseStorage, unavailableStorage } from './storage/fileStorage.ts';

const config = loadConfig();
const db = createPgDb(config.database);
const mailer = config.mailTransport === 'console' ? createConsoleMailer() : unavailableMailer;

const storage = config.storage ? createSupabaseStorage(config.storage) : unavailableStorage;

const server = createServer(createApp({ db, config, mailer, storage }));

server.listen(config.port, config.host, () => {
  console.log(`CUIDAR MAIS backend em http://${config.host}:${config.port} (${config.env})`);
  if (!config.storage) {
    console.log('Upload de documentos INDISPONÍVEL: configure SUPABASE_URL e SUPABASE_SECRET_KEY no .env.');
  }
  if (config.mailTransport === 'console') {
    console.log('Recuperação de senha: os códigos aparecem NESTE terminal (modo de desenvolvimento).');
  }
});

async function shutdown(signal: string) {
  console.log(`Recebido ${signal}, encerrando…`);
  server.close();
  await db.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
