import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { translateDbError } from '../../db/errors.ts';
import { errors, HttpError, validationError } from '../../http/errors.ts';
import type { RequestContext, Router } from '../../http/router.ts';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../security/passwords.ts';
import { generateResetCode, generateToken, hashResetCode, hashToken } from '../../security/tokens.ts';
import { emailSchema, fullNameSchema, passwordSchema, phoneSchema } from '../../validation.ts';
import type { Deps } from '../deps.ts';
import { authenticate } from '../guard.ts';
import { toUser, type PublicUser } from '../mappers.ts';

const registerSchema = z
  .object({
    role: z.enum(['client', 'caregiver'], {
      errorMap: () => ({ message: 'Escolha se você é cliente ou cuidador.' }),
    }),
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade.' }),
    }),
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string({ required_error: 'Informe a senha.' }).min(1, 'Informe a senha.').max(128),
  })
  .strict();

const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) }).strict();
const logoutSchema = z.object({ refreshToken: z.string().max(200).optional() }).strict();
const forgotSchema = z.object({ email: emailSchema }).strict();
const resetSchema = z
  .object({
    email: emailSchema,
    code: z.string().trim().regex(/^\d{8}$/, 'O código tem 8 números.'),
    password: passwordSchema,
  })
  .strict();

const googleSchema = z
  .object({
    idToken: z.string({ required_error: 'Token do Google ausente.' }).min(100).max(4096),
    /** Só no primeiro acesso: dados que o Google não fornece. */
    signup: z
      .object({
        role: registerSchema.shape.role,
        fullName: fullNameSchema,
        phone: phoneSchema,
        acceptTerms: registerSchema.shape.acceptTerms,
      })
      .strict()
      .optional(),
  })
  .strict();

const RESET_TTL_MS = 15 * 60_000;
const RESET_MAX_ATTEMPTS = 5;

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw validationError(result.error);
  return result.data;
}

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
};

async function createSession(deps: Deps, userId: string): Promise<SessionTokens> {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const accessExpiresAt = new Date(Date.now() + deps.config.accessTokenTtlMs);
  const refreshExpiresAt = new Date(Date.now() + deps.config.refreshTokenTtlMs);

  await deps.db.query(
    `INSERT INTO sessions (user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, hashToken(accessToken), hashToken(refreshToken), accessExpiresAt.toISOString(), refreshExpiresAt.toISOString()],
  );

  return { accessToken, refreshToken, accessExpiresAt: accessExpiresAt.toISOString() };
}

function authResponse(status: number, tokens: SessionTokens, user: PublicUser) {
  return { status, body: { ...tokens, user } };
}

function limitOrThrow(allowed: boolean): void {
  if (!allowed) throw errors.rateLimited();
}

export function registerAuthRoutes(router: Router, deps: Deps): void {
  /** Cadastro de cliente ou cuidador. Nunca cria administrador. */
  router.add('POST', '/v1/auth/register', async (ctx) => {
    limitOrThrow(deps.limits.register.consume(`ip:${ctx.ip}`));
    const input = parse(registerSchema, ctx.body);
    const passwordHash = await hashPassword(input.password);

    let row: Record<string, unknown> | undefined;
    try {
      [row] = await deps.db.query(`SELECT * FROM register_user($1, $2, $3, $4, $5, $6)`, [
        input.email,
        passwordHash,
        input.fullName,
        input.phone,
        input.role,
        deps.config.termsVersion,
      ]);
    } catch (error) {
      throw translateDbError(error);
    }
    if (!row) throw new Error('register_user não retornou o usuário');

    const user = toUser(row);
    return authResponse(201, await createSession(deps, user.id), user);
  });

  /** Login com e-mail e senha. Mesma resposta para e-mail inexistente ou senha errada. */
  router.add('POST', '/v1/auth/login', async (ctx) => {
    const input = parse(loginSchema, ctx.body);
    limitOrThrow(deps.limits.login.consume(`login:${ctx.ip}:${input.email}`));

    const [row] = await deps.db.query(`SELECT * FROM users WHERE email = $1`, [input.email]);
    if (!row) {
      await verifyAgainstDummy(input.password);
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    }
    // Conta só com Google (sem senha): mesma resposta, mesmo tempo.
    if (!row.password_hash) {
      await verifyAgainstDummy(input.password);
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    }
    if (!(await verifyPassword(input.password, String(row.password_hash)))) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
    }
    if (row.deletion_requested_at) throw errors.accountDeleted();
    if (row.status !== 'active') throw errors.suspended();

    deps.limits.login.reset(`login:${ctx.ip}:${input.email}`);
    const user = toUser(row);
    return authResponse(200, await createSession(deps, user.id), user);
  });

  /**
   * Entrar com Google. O app manda o ID token; o servidor confere a assinatura
   * com as chaves do Google. Conta existente (mesmo Google ou mesmo e-mail
   * verificado) entra direto; conta nova precisa completar papel, telefone e
   * aceite dos termos (resposta needsSignup).
   */
  router.add('POST', '/v1/auth/google', async (ctx) => {
    limitOrThrow(deps.limits.login.consume(`google:${ctx.ip}`));
    if (!deps.google.available) {
      throw new HttpError(503, 'GOOGLE_UNAVAILABLE', 'O login com Google ainda não está disponível. Entre com e-mail e senha.');
    }
    const input = parse(googleSchema, ctx.body);

    let identity;
    try {
      identity = await deps.google.verify(input.idToken);
    } catch {
      throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Não foi possível confirmar sua conta Google. Tente novamente.');
    }
    if (!identity.emailVerified) {
      throw new HttpError(401, 'GOOGLE_EMAIL_NOT_VERIFIED', 'Seu e-mail do Google não está verificado.');
    }

    const [bySub] = await deps.db.query(`SELECT * FROM users WHERE google_sub = $1`, [identity.sub]);
    const [byEmail] = bySub ? [bySub] : await deps.db.query(`SELECT * FROM users WHERE email = $1`, [identity.email]);
    const existing = bySub ?? byEmail;

    if (existing) {
      if (existing.deletion_requested_at) throw errors.accountDeleted();
      if (existing.status !== 'active') throw errors.suspended();
      if (existing.google_sub && existing.google_sub !== identity.sub) {
        throw new HttpError(409, 'GOOGLE_ACCOUNT_MISMATCH', 'Este e-mail já está ligado a outra conta Google. Entre com e-mail e senha.');
      }
      if (!existing.google_sub) {
        await deps.db.query(`UPDATE users SET google_sub = $2 WHERE id = $1 RETURNING id`, [existing.id, identity.sub]);
        await deps.db.query(
          `INSERT INTO audit_log (actor_id, action, target_type, target_id) VALUES ($1, 'user.google_linked', 'user', $1) RETURNING id`,
          [existing.id],
        );
      }
      const [row] = await deps.db.query(`SELECT * FROM users WHERE id = $1`, [existing.id]);
      const user = toUser(row!);
      return authResponse(200, await createSession(deps, user.id), user);
    }

    if (!input.signup) {
      return {
        status: 200,
        body: { needsSignup: true, profile: { email: identity.email, fullName: identity.name } },
      };
    }

    limitOrThrow(deps.limits.register.consume(`ip:${ctx.ip}`));
    let row: Record<string, unknown> | undefined;
    try {
      [row] = await deps.db.query(`SELECT * FROM register_google_user($1, $2, $3, $4, $5, $6)`, [
        identity.email,
        identity.sub,
        input.signup.fullName,
        input.signup.phone,
        input.signup.role,
        deps.config.termsVersion,
      ]);
    } catch (error) {
      throw translateDbError(error);
    }
    if (!row) throw new Error('register_google_user não retornou o usuário');
    const user = toUser(row);
    return authResponse(201, await createSession(deps, user.id), user);
  });

  /** Troca o refresh token por um par novo (rotação). O refresh antigo deixa de valer. */
  router.add('POST', '/v1/auth/refresh', async (ctx) => {
    const input = parse(refreshSchema, ctx.body);
    const accessToken = generateToken();
    const refreshToken = generateToken();
    const accessExpiresAt = new Date(Date.now() + deps.config.accessTokenTtlMs);
    const refreshExpiresAt = new Date(Date.now() + deps.config.refreshTokenTtlMs);

    const [session] = await deps.db.query<{ user_id: string }>(
      `UPDATE sessions
          SET access_token_hash = $2, refresh_token_hash = $3,
              access_expires_at = $4, refresh_expires_at = $5, last_used_at = now()
        WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND refresh_expires_at > now()
      RETURNING user_id`,
      [
        hashToken(input.refreshToken),
        hashToken(accessToken),
        hashToken(refreshToken),
        accessExpiresAt.toISOString(),
        refreshExpiresAt.toISOString(),
      ],
    );
    if (!session) throw errors.tokenExpired();

    const [row] = await deps.db.query(`SELECT * FROM users WHERE id = $1`, [session.user_id]);
    if (!row) throw errors.unauthorized();
    if (row.deletion_requested_at) throw errors.accountDeleted();
    if (row.status !== 'active') throw errors.suspended();

    return authResponse(200, { accessToken, refreshToken, accessExpiresAt: accessExpiresAt.toISOString() }, toUser(row));
  });

  /** Encerra a sessão. Aceita o access token (cabeçalho) e/ou o refresh token (corpo). */
  router.add('POST', '/v1/auth/logout', async (ctx) => {
    const input = parse(logoutSchema, ctx.body);
    const hashes = [ctx.bearerToken, input.refreshToken].filter((t): t is string => Boolean(t)).map(hashToken);
    if (hashes.length) {
      await deps.db.query(
        `UPDATE sessions SET revoked_at = now()
          WHERE revoked_at IS NULL AND (access_token_hash = ANY($1::text[]) OR refresh_token_hash = ANY($1::text[]))
        RETURNING id`,
        [hashes],
      );
    }
    return { status: 204 };
  });

  /**
   * Pede um código de recuperação. Responde igual exista ou não a conta,
   * para não revelar quais e-mails estão cadastrados.
   */
  router.add('POST', '/v1/auth/password/forgot', async (ctx) => {
    const input = parse(forgotSchema, ctx.body);
    limitOrThrow(deps.limits.forgot.consume(`forgot-ip:${ctx.ip}`));
    limitOrThrow(deps.limits.forgot.consume(`forgot-email:${input.email}`));

    if (!deps.mailer.available) {
      throw new HttpError(
        503,
        'PASSWORD_RESET_UNAVAILABLE',
        'A recuperação de senha ainda não está disponível. Fale com o suporte.',
      );
    }

    const [user] = await deps.db.query<{ id: string; status: string }>(`SELECT id, status FROM users WHERE email = $1`, [
      input.email,
    ]);

    if (user && user.status === 'active') {
      await deps.db.query(
        `UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL RETURNING id`,
        [user.id],
      );
      const resetId = randomUUID();
      const code = generateResetCode();
      await deps.db.query(
        `INSERT INTO password_resets (id, user_id, code_hash, expires_at) VALUES ($1, $2, $3, $4) RETURNING id`,
        [resetId, user.id, hashResetCode(resetId, code), new Date(Date.now() + RESET_TTL_MS).toISOString()],
      );

      await deps.mailer.send({
        to: input.email,
        subject: 'CUIDAR+ — código para redefinir sua senha',
        text: `Seu código é ${code}. Ele vale por 15 minutos.\nSe você não pediu, ignore este e-mail.`,
      });
    }

    return {
      status: 202,
      body: { message: 'Se houver uma conta com este e-mail, enviaremos um código para redefinir a senha.' },
    };
  });

  /** Redefine a senha com o código. Encerra todas as sessões da conta. */
  router.add('POST', '/v1/auth/password/reset', async (ctx) => {
    limitOrThrow(deps.limits.reset.consume(`reset:${ctx.ip}`));
    const input = parse(resetSchema, ctx.body);
    const invalid = () =>
      new HttpError(400, 'INVALID_RESET_CODE', 'Código inválido ou expirado. Peça um novo código.', {
        code: 'Código inválido ou expirado.',
      });

    const [reset] = await deps.db.query<{ id: string; user_id: string; code_hash: string; attempts: number }>(
      `SELECT r.id, r.user_id, r.code_hash, r.attempts
         FROM password_resets r
         JOIN users u ON u.id = r.user_id
        WHERE u.email = $1 AND u.status = 'active'
          AND r.used_at IS NULL AND r.expires_at > now()
        ORDER BY r.created_at DESC
        LIMIT 1`,
      [input.email],
    );
    if (!reset || reset.attempts >= RESET_MAX_ATTEMPTS) throw invalid();

    if (hashResetCode(reset.id, input.code) !== reset.code_hash) {
      await deps.db.query(`UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1 RETURNING id`, [reset.id]);
      throw invalid();
    }

    const passwordHash = await hashPassword(input.password);
    // Um único comando: marca o código como usado, troca a senha e encerra as sessões.
    const [done] = await deps.db.query(
      `WITH used AS (
         UPDATE password_resets SET used_at = now()
          WHERE id = $1 AND used_at IS NULL
         RETURNING user_id
       ), changed AS (
         UPDATE users SET password_hash = $2 WHERE id = (SELECT user_id FROM used) RETURNING id
       ), revoked AS (
         UPDATE sessions SET revoked_at = now()
          WHERE user_id = (SELECT id FROM changed) AND revoked_at IS NULL
         RETURNING id
       )
       SELECT id FROM changed`,
      [reset.id, passwordHash],
    );
    if (!done) throw invalid();

    await deps.db.query(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id) VALUES ($1, 'user.password_reset', 'user', $1) RETURNING id`,
      [reset.user_id],
    );
    return { status: 204 };
  });

  /** Dados da conta logada. Usado pelo app para restaurar a sessão. */
  router.add('GET', '/v1/auth/session', async (ctx: RequestContext) => {
    const auth = await authenticate(deps, ctx);
    const [row] = await deps.db.query(`SELECT * FROM users WHERE id = $1`, [auth.userId]);
    if (!row) throw errors.unauthorized();
    return { status: 200, body: { user: toUser(row) } };
  });
}
