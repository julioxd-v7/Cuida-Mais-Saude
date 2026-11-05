import type { ZodError } from 'zod';

export type FieldErrors = Record<string, string>;

/**
 * Erro com resposta pronta para o cliente. Formato do corpo (contrato com o app):
 *   { "code": "EMAIL_IN_USE", "message": "texto para o usuário", "fieldErrors": { ... } }
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function validationError(error: ZodError): HttpError {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return new HttpError(400, 'VALIDATION', 'Alguns dados estão inválidos. Revise os campos indicados.', fieldErrors);
}

export const errors = {
  unauthorized: () => new HttpError(401, 'UNAUTHORIZED', 'Você precisa entrar para continuar.'),
  tokenExpired: () => new HttpError(401, 'TOKEN_EXPIRED', 'Sua sessão expirou. Entre novamente.'),
  forbidden: () => new HttpError(403, 'FORBIDDEN', 'Você não tem permissão para realizar esta ação.'),
  suspended: () =>
    new HttpError(403, 'ACCOUNT_SUSPENDED', 'Sua conta está suspensa. Entre em contato com o suporte.'),
  accountDeleted: () =>
    new HttpError(403, 'ACCOUNT_DELETED', 'Esta conta foi encerrada a pedido do titular. Fale com o suporte se foi um engano.'),
  notFound: () => new HttpError(404, 'NOT_FOUND', 'Não encontramos o que você procurou.'),
  rateLimited: () =>
    new HttpError(429, 'RATE_LIMITED', 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.'),
};
