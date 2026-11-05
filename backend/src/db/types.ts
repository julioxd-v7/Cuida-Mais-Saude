/**
 * Acesso ao banco usado por todo o backend. Uma interface pequena de propósito:
 * os módulos só fazem "query" (um comando SQL com parâmetros) e o executor de
 * migrations usa "exec" (vários comandos, sem parâmetros).
 *
 * Operações que precisam ser atômicas ficam em funções SQL (ver migrations),
 * então nenhum módulo precisa abrir transação manualmente.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export type DbOptions = {
  url: string;
  schema: string;
  ssl: 'disable' | 'require' | 'verify';
  caCertPath?: string;
};

/** Erro do PostgreSQL com os campos que o backend usa. */
export type DbError = Error & {
  code?: string;
  constraint?: string;
};

export function isDbError(error: unknown): error is DbError {
  return error instanceof Error && typeof (error as DbError).code === 'string';
}
