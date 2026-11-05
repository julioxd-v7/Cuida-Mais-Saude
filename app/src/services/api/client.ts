import { AppError, codeFromStatus, type FieldErrors } from '../errors';

/**
 * Cliente HTTP único para falar com o backend do CUIDAR+.
 *
 * - Telas e componentes NÃO chamam fetch diretamente: usam os serviços de
 *   cada feature (ex.: features/auth/authService.ts), que usam este cliente.
 * - Toda falha vira AppError com um código conhecido.
 * - O token de acesso é obtido por uma função injetada, para que o cliente
 *   não precise saber onde a sessão é guardada.
 *
 * Formato de erro esperado do backend (contrato proposto em docs/ARQUITETURA.md):
 *   { "code": "...", "message": "texto para o usuário", "fieldErrors": { "email": "..." } }
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  /** Envia o token de acesso. Padrão: true. Desligue em login/cadastro. */
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ApiClientConfig = {
  baseUrl: string | null;
  timeoutMs: number;
  getAccessToken?: () => string | null | Promise<string | null>;
  /**
   * Chamado quando uma requisição autenticada recebe 401 TOKEN_EXPIRED.
   * Deve renovar a sessão e devolver true se conseguiu. A requisição é
   * repetida uma única vez.
   */
  refreshSession?: () => Promise<boolean>;
  /** Chamado quando a sessão não pôde ser renovada (o usuário precisa entrar de novo). */
  onSessionExpired?: () => void;
  /** Chamado quando o servidor responde que a conta está suspensa. */
  /** Conta suspensa ou encerrada (ACCOUNT_SUSPENDED / ACCOUNT_DELETED). */
  onAccountSuspended?: (serverCode?: string) => void;
  /** Permite substituir o fetch em testes. */
  fetchImpl?: typeof fetch;
};

export type ApiClient = {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>;
};

type BackendErrorBody = {
  code?: unknown;
  message?: unknown;
  fieldErrors?: unknown;
};

type BackendError = { userMessage?: string; fieldErrors?: FieldErrors; serverCode?: string };

function readBackendError(body: unknown): BackendError {
  if (!body || typeof body !== 'object') return {};
  const { code, message, fieldErrors } = body as BackendErrorBody;

  const result: BackendError = {};
  if (typeof code === 'string' && code.trim()) result.serverCode = code;
  if (typeof message === 'string' && message.trim()) result.userMessage = message;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const entries = Object.entries(fieldErrors as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );
    if (entries.length) result.fieldErrors = Object.fromEntries(entries);
  }
  return result;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await send<T>(path, options);
    } catch (error) {
      const auth = options.auth ?? true;
      if (auth && error instanceof AppError && (error.serverCode === 'ACCOUNT_SUSPENDED' || error.serverCode === 'ACCOUNT_DELETED')) {
        config.onAccountSuspended?.(error.serverCode);
        throw error;
      }
      const expired = error instanceof AppError && error.status === 401 && error.serverCode === 'TOKEN_EXPIRED';
      if (!auth || !expired || !config.refreshSession) throw error;

      const refreshed = await config.refreshSession().catch(() => false);
      if (!refreshed) {
        config.onSessionExpired?.();
        throw new AppError('UNAUTHORIZED', 'Sessão expirada', {
          status: 401,
          serverCode: 'SESSION_EXPIRED',
          userMessage: 'Sua sessão expirou. Entre novamente.',
          cause: error,
        });
      }
      return send<T>(path, options);
    }
  }

  async function send<T>(path: string, options: RequestOptions): Promise<T> {
    const { method = 'GET', body, auth = true, headers = {}, signal } = options;

    if (!config.baseUrl) {
      throw new AppError('CONFIG_MISSING', 'EXPO_PUBLIC_API_URL não configurada');
    }

    const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const finalHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
    if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';

    if (auth && config.getAccessToken) {
      const token = await config.getAccessToken();
      if (token) finalHeaders.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, config.timeoutMs);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: finalHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) throw new AppError('TIMEOUT', `Tempo esgotado em ${method} ${path}`, { cause: error });
      throw new AppError('NETWORK', `Falha de rede em ${method} ${path}`, { cause: error });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }

    const data = await parseBody(response);

    if (!response.ok) {
      const { userMessage, fieldErrors, serverCode } = readBackendError(data);
      throw new AppError(codeFromStatus(response.status), `HTTP ${response.status} em ${method} ${path}`, {
        status: response.status,
        userMessage,
        fieldErrors,
        serverCode,
      });
    }

    return data as T;
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  };
}
