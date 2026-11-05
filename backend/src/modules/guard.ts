import { errors } from '../http/errors.ts';
import type { RequestContext } from '../http/router.ts';
import { hashToken } from '../security/tokens.ts';
import type { Deps } from './deps.ts';
import type { Role } from './mappers.ts';

export type AuthContext = {
  userId: string;
  role: Role;
  sessionId: string;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  role: Role;
  status: 'active' | 'suspended';
  access_expires_at: Date | string;
  deletion_requested_at: Date | string | null;
};

/**
 * Confere o token da requisição no banco e, opcionalmente, o papel.
 * É ESTA checagem que protege os dados — a navegação do app é só conforto.
 */
export async function authenticate(deps: Deps, ctx: RequestContext, roles?: readonly Role[]): Promise<AuthContext> {
  if (!ctx.bearerToken) throw errors.unauthorized();

  const [row] = await deps.db.query<SessionRow>(
    `SELECT s.id AS session_id, s.user_id, s.access_expires_at, u.role, u.status, u.deletion_requested_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.access_token_hash = $1 AND s.revoked_at IS NULL`,
    [hashToken(ctx.bearerToken)],
  );

  if (!row) throw errors.unauthorized();
  if (new Date(row.access_expires_at).getTime() <= Date.now()) throw errors.tokenExpired();
  if (row.deletion_requested_at) throw errors.accountDeleted();
  if (row.status !== 'active') throw errors.suspended();
  if (roles && !roles.includes(row.role)) throw errors.forbidden();

  return { userId: row.user_id, role: row.role, sessionId: row.session_id };
}
