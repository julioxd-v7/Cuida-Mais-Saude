/**
 * Tratamento centralizado de erros.
 *
 * Toda falha que chega à interface deve ser um AppError. As telas nunca
 * mostram mensagens técnicas: usam getUserMessage(), que traduz o código
 * para um texto claro em português.
 */

export type AppErrorCode =
  | 'CONFIG_MISSING' // app sem configuração necessária (ex.: URL da API)
  | 'NETWORK' // sem conexão ou servidor inacessível
  | 'TIMEOUT'
  | 'UNAUTHORIZED' // sessão ausente ou expirada (401)
  | 'FORBIDDEN' // sem permissão para a ação (403)
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409 (ex.: e-mail já cadastrado)
  | 'VALIDATION' // dados inválidos (400/422)
  | 'RATE_LIMITED' // 429
  | 'SERVER' // 5xx
  | 'UNKNOWN';

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status?: number;
  /** Erros por campo devolvidos pelo backend, para exibir nos formulários. */
  readonly fieldErrors?: FieldErrors;
  /** Mensagem já pensada para o usuário, quando o backend envia uma. */
  readonly userMessage?: string;
  /** Código específico do backend (ex.: EMAIL_IN_USE, TOKEN_EXPIRED, ACCOUNT_SUSPENDED). */
  readonly serverCode?: string;

  constructor(
    code: AppErrorCode,
    message: string,
    options: {
      status?: number;
      fieldErrors?: FieldErrors;
      userMessage?: string;
      serverCode?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = options.status;
    this.fieldErrors = options.fieldErrors;
    this.userMessage = options.userMessage;
    this.serverCode = options.serverCode;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Converte qualquer valor lançado em AppError. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof Error) {
    return new AppError('UNKNOWN', error.message, { cause: error });
  }
  return new AppError('UNKNOWN', 'Erro desconhecido', { cause: error });
}

/** Mapeia status HTTP para o código interno. */
export function codeFromStatus(status: number): AppErrorCode {
  if (status === 400 || status === 422) return 'VALIDATION';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER';
  return 'UNKNOWN';
}

const defaultMessages: Record<AppErrorCode, string> = {
  CONFIG_MISSING:
    'O aplicativo ainda não está conectado ao servidor. Esta função estará disponível em breve.',
  NETWORK: 'Não foi possível conectar. Verifique sua internet e tente novamente.',
  TIMEOUT: 'O servidor demorou para responder. Tente novamente em instantes.',
  UNAUTHORIZED: 'Sua sessão expirou ou os dados de acesso estão incorretos.',
  FORBIDDEN: 'Você não tem permissão para realizar esta ação.',
  NOT_FOUND: 'Não encontramos o que você procurou.',
  CONFLICT: 'Esta informação já está em uso.',
  VALIDATION: 'Alguns dados estão inválidos. Revise os campos e tente novamente.',
  RATE_LIMITED: 'Muitas tentativas seguidas. Aguarde um pouco e tente novamente.',
  SERVER: 'Tivemos um problema no servidor. Tente novamente em instantes.',
  UNKNOWN: 'Algo deu errado. Tente novamente.',
};

/** Texto seguro para mostrar ao usuário. Nunca expõe detalhes técnicos. */
export function getUserMessage(error: unknown): string {
  const appError = toAppError(error);
  return appError.userMessage ?? defaultMessages[appError.code];
}

type ErrorReporter = (error: AppError, context?: Record<string, unknown>) => void;

/**
 * Ponto único de registro de erros. Hoje escreve no console em desenvolvimento;
 * o serviço de monitoramento (ex.: Sentry) será plugado aqui via setErrorReporter,
 * sem precisar mexer nas telas. Nunca envie dados de saúde ou senhas no contexto.
 */
let reporter: ErrorReporter = (error, context) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[${error.code}] ${error.message}`, context ?? '');
  }
};

export function setErrorReporter(next: ErrorReporter): void {
  reporter = next;
}

export function reportError(error: unknown, context?: Record<string, unknown>): AppError {
  const appError = toAppError(error);
  reporter(appError, context);
  return appError;
}
