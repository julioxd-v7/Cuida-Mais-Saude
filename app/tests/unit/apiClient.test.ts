import { createApiClient } from '@/services/api/client';
import { AppError } from '@/services/errors';

/** Resposta mínima, sem depender do Response global do ambiente de teste. */
function jsonResponse(status: number, body: unknown): Response {
  const fake = {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    text: async () => JSON.stringify(body),
  };
  return fake as unknown as Response;
}

async function catchError(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Era esperado um erro');
}

describe('cliente da API', () => {
  it('falha com CONFIG_MISSING sem URL configurada', async () => {
    const client = createApiClient({ baseUrl: null, timeoutMs: 1000 });
    const error = await catchError(client.get('/saude'));
    expect(error.code).toBe('CONFIG_MISSING');
  });

  it('envia JSON e o token quando auth=true', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 1000,
      getAccessToken: () => 'token-123',
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse(200, { ok: true });
      },
    });

    const result = await client.post<{ ok: boolean }>('itens', { a: 1 });
    expect(result).toEqual({ ok: true });
    expect(calls[0].url).toBe('https://api.exemplo.com/itens');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(calls[0].init?.body).toBe('{"a":1}');
  });

  it('não envia token quando auth=false', async () => {
    let headers: Record<string, string> = {};
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 1000,
      getAccessToken: () => 'token-123',
      fetchImpl: async (_url, init) => {
        headers = init?.headers as Record<string, string>;
        return jsonResponse(200, {});
      },
    });
    await client.post('/auth/login', {}, { auth: false });
    expect(headers.Authorization).toBeUndefined();
  });

  it('converte erro HTTP com mensagem e erros por campo do backend', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 1000,
      fetchImpl: async () =>
        jsonResponse(422, { message: 'Revise os dados.', fieldErrors: { email: 'Inválido', x: 1 } }),
    });
    const error = await catchError(client.post('/auth/login', {}));
    expect(error.code).toBe('VALIDATION');
    expect(error.status).toBe(422);
    expect(error.userMessage).toBe('Revise os dados.');
    expect(error.fieldErrors).toEqual({ email: 'Inválido' });
  });

  it('converte falha de rede em NETWORK', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 1000,
      fetchImpl: async () => {
        throw new TypeError('Network request failed');
      },
    });
    const error = await catchError(client.get('/saude'));
    expect(error.code).toBe('NETWORK');
  });

  it('converte demora excessiva em TIMEOUT', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 20,
      fetchImpl: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    });
    const error = await catchError(client.get('/lento'));
    expect(error.code).toBe('TIMEOUT');
  });
});

describe('renovação automática de sessão', () => {
  it('em 401 TOKEN_EXPIRED renova uma vez e repete a requisição', async () => {
    let token = 'velho';
    let refreshes = 0;
    const seen: string[] = [];
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 1000,
      getAccessToken: () => token,
      refreshSession: async () => {
        refreshes += 1;
        token = 'novo';
        return true;
      },
      fetchImpl: async (_url, init) => {
        const auth = (init?.headers as Record<string, string>).Authorization;
        seen.push(auth);
        return auth === 'Bearer novo'
          ? jsonResponse(200, { ok: true })
          : jsonResponse(401, { code: 'TOKEN_EXPIRED', message: 'Sua sessão expirou.' });
      },
    });
    const result = await client.get<{ ok: boolean }>('/v1/me');
    expect(result).toEqual({ ok: true });
    expect(refreshes).toBe(1);
    expect(seen).toEqual(['Bearer velho', 'Bearer novo']);
  });

  it('se a renovação falha, avisa que a sessão expirou', async () => {
    let expiredCalls = 0;
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 1000,
      getAccessToken: () => 'velho',
      refreshSession: async () => false,
      onSessionExpired: () => {
        expiredCalls += 1;
      },
      fetchImpl: async () => jsonResponse(401, { code: 'TOKEN_EXPIRED' }),
    });
    const error = await catchError(client.get('/v1/me'));
    expect(error.serverCode).toBe('SESSION_EXPIRED');
    expect(expiredCalls).toBe(1);
  });

  it('401 de credenciais inválidas no login não tenta renovar', async () => {
    let refreshes = 0;
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 1000,
      refreshSession: async () => {
        refreshes += 1;
        return true;
      },
      fetchImpl: async () => jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' }),
    });
    const error = await catchError(client.post('/v1/auth/login', {}, { auth: false }));
    expect(error.serverCode).toBe('INVALID_CREDENTIALS');
    expect(error.userMessage).toBe('E-mail ou senha incorretos.');
    expect(refreshes).toBe(0);
  });

  it('conta suspensa avisa o app', async () => {
    let suspended = 0;
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 1000,
      getAccessToken: () => 't',
      onAccountSuspended: () => {
        suspended += 1;
      },
      fetchImpl: async () => jsonResponse(403, { code: 'ACCOUNT_SUSPENDED' }),
    });
    await catchError(client.get('/v1/me'));
    expect(suspended).toBe(1);
  });

  it('e-mail duplicado chega com código e erro no campo', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.exemplo.com',
      timeoutMs: 1000,
      fetchImpl: async () =>
        jsonResponse(409, { code: 'EMAIL_IN_USE', message: 'Já existe uma conta.', fieldErrors: { email: 'Este e-mail já está cadastrado.' } }),
    });
    const error = await catchError(client.post('/v1/auth/register', {}, { auth: false }));
    expect(error.code).toBe('CONFLICT');
    expect(error.serverCode).toBe('EMAIL_IN_USE');
    expect(error.fieldErrors).toEqual({ email: 'Este e-mail já está cadastrado.' });
  });
});
