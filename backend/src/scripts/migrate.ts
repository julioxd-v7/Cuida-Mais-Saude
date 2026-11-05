import { loadConfig } from '../config.ts';
import { createPgDb } from '../db/pg.ts';
import { runMigrations } from '../db/migrate.ts';

const config = loadConfig();
const db = createPgDb(config.database);

try {
  await runMigrations(db, config.database.schema, (message) => console.log(message));
  console.log(`Banco atualizado (schema "${config.database.schema}").`);
} catch (error) {
  console.error('Falha ao aplicar migrations:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.close();
}
