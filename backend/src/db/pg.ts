import { readFileSync } from 'node:fs';

import pg from 'pg';

import { quoteIdent } from './ident.ts';
import type { Db, DbOptions } from './types.ts';

/**
 * Implementação real com node-postgres.
 *
 * O search_path é fixado em cada conexão nova. Por isso, no Supabase, use o
 * "Session pooler" (porta 5432): no "Transaction pooler" (6543) o SET não
 * permanece entre comandos.
 */
export function createPgDb(options: DbOptions): Db {
  const ssl =
    options.ssl === 'disable'
      ? false
      : options.ssl === 'verify'
        ? { rejectUnauthorized: true, ca: readFileSync(options.caCertPath ?? '', 'utf8') }
        : { rejectUnauthorized: false };

  const pool = new pg.Pool({
    connectionString: stripSslParams(options.url),
    ssl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  const schema = quoteIdent(options.schema);
  pool.on('connect', (client) => {
    client.query(`SET search_path TO ${schema}, public`).catch(() => {
      // Se falhar, a primeira query da conexão falha com erro claro.
    });
  });

  // Erro em conexão ociosa não pode derrubar o servidor.
  pool.on('error', (error) => {
    console.error('[db] erro em conexão ociosa:', error.message);
  });

  return {
    async query<T>(sql: string, params: readonly unknown[] = []) {
      const result = await pool.query(sql, params as unknown[]);
      return result.rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    close: () => pool.end(),
  };
}

/** sslmode na URL sobrescreveria a opção "ssl"; a configuração fica só em DATABASE_SSL. */
function stripSslParams(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('sslmode');
  parsed.searchParams.delete('sslrootcert');
  return parsed.toString();
}
