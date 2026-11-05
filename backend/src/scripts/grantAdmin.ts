import { loadConfig } from '../config.ts';
import { createPgDb } from '../db/pg.ts';

/**
 * Concede papel de administrador a uma conta JÁ cadastrada.
 * Uso: npm run admin:grant -- pessoa@exemplo.com
 *
 * Só funciona para quem tem o DATABASE_URL (acesso direto ao banco).
 * Não existe rota HTTP para isso, de propósito.
 */
const email = process.argv[2];
if (!email) {
  console.error('Uso: npm run admin:grant -- email@exemplo.com');
  process.exit(1);
}

const config = loadConfig();
const db = createPgDb(config.database);
try {
  const [user] = await db.query<{ email: string }>(`SELECT email FROM grant_admin_by_email($1)`, [email]);
  console.log(`Agora ${user?.email} é administrador. As sessões abertas dessa conta foram encerradas.`);
} catch (error) {
  console.error('Não foi possível conceder:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.close();
}
