import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { quoteIdent } from './ident.ts';
import type { Db } from './types.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));

/**
 * Aplica, em ordem, as migrations ainda não aplicadas no schema informado.
 * Cada arquivo roda numa transação: ou entra inteiro, ou nada muda.
 */
export async function runMigrations(db: Db, schema: string, log: (message: string) => void = () => {}) {
  const s = quoteIdent(schema);
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS ${s};
    CREATE TABLE IF NOT EXISTS ${s}.schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE ${s}.schema_migrations ENABLE ROW LEVEL SECURITY;
  `);

  const applied = new Set(
    (await db.query<{ name: string }>(`SELECT name FROM ${s}.schema_migrations`)).map((row) => row.name),
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(`${MIGRATIONS_DIR}${file}`, 'utf8');
    const escapedName = file.replace(/'/g, "''");
    await db.exec(`
      BEGIN;
      SET LOCAL search_path TO ${s}, public;
      ${sql}
      INSERT INTO ${s}.schema_migrations (name) VALUES ('${escapedName}');
      COMMIT;
    `);
    log(`migration aplicada: ${file}`);
  }
}
