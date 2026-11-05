import { SESSION_EXPIRED_NOTICE, SessionManager, SUSPENDED_NOTICE, resolveHomeRoute, type AuthApi } from '@/features/auth/sessionManager';
import type { AuthResponse, AuthUser, SessionTokens } from '@/features/auth/types';
import { AppError } from '@/services/errors';

const client: AuthUser = {
  id: 'u1',
  fullName: 'Maria Silva',
  email: 'maria@exemplo.com',
  phone: '11912345678',
  role: 'client',
  status: 'active',
  createdAt: null,
};

function response(user: AuthUser = client, n = 1): AuthResponse {
  return { accessToken: `access-${n}`, refreshToken: `refresh-${n}`, accessExpiresAt: '2030-01-01T00:00:00Z', user };
}

function memoryStorage(initial: SessionTokens | null = null) {
  let value = initial;
  return {
    saves: 0,
    cleared: 0,
    async load() {
      return value;
    },
    async save(tokens: SessionTokens) {
      value = tokens;
      this.saves += 1;
    },
    async clear() {
      value = null;
      this.cleared += 1;
    },
    peek: () => value,
  };
}

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    signIn: async () => {
      calls.push('signIn');
      return response();
    },
    signUp: async () => {
      calls.push('signUp');
      return response();
    },
    refresh: async () => {
      calls.push('refresh');
      return response(client, 2);
    },
    getSession: async () => {
      calls.push('getSession');
      return client;
    },
    signOut: async () => {
      calls.push('signOut');
    },
    ...overrides,
  };
}

describe('SessionManager', () => {
  it('sem tokens guardados, abre deslogado', async () => {
    const manager = new SessionManager(memoryStorage(), fakeApi());
    await manager.restore();
    expect(manager.getState().status).toBe('signedOut');
  });

  it('restaura a sessão guardada confirmando no servidor', async () => {
    const api = fakeApi();
    const manager = new SessionManager(memoryStorage({ accessToken: 'a', refreshToken: 'r' }), api);
    await manager.restore();
    const state = manager.getState();
    expect(state.status).toBe('signedIn');
    expect(state.status === 'signedIn' ? state.user.id : null).toBe('u1');
    expect(manager.getAccessToken()).toBe('a');
  });

  it('login guarda os tokens e muda para logado', async () => {
    const storage = memoryStorage();
    const manager = new SessionManager(storage, fakeApi());
    await manager.signIn({ email: 'maria@exemplo.com', password: 'x' });
    expect(manager.getState().status).toBe('signedIn');
    expect(storage.peek()).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('cadastro também abre a sessão', async () => {
    const manager = new SessionManager(memoryStorage(), fakeApi());
    await manager.signUp({ role: 'client', fullName: 'Maria Silva', email: 'm@e.com', phone: '11912345678', password: 'a1234567', acceptTerms: true });
    expect(manager.getState().status).toBe('signedIn');
  });

  it('login com credenciais inválidas não muda o estado nem guarda nada', async () => {
    const storage = memoryStorage();
    const invalid = new AppError('UNAUTHORIZED', 'HTTP 401', { status: 401, serverCode: 'INVALID_CREDENTIALS' });
    const manager = new SessionManager(storage, fakeApi({ signIn: async () => Promise.reject(invalid) }));
    await manager.restore();
    let caught: unknown = null;
    try {
      await manager.signIn({ email: 'maria@exemplo.com', password: 'errada' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(invalid);
    expect(manager.getState().status).toBe('signedOut');
    expect(storage.peek()).toBeNull();
  });

  it('logout limpa o aparelho e revoga no servidor', async () => {
    const storage = memoryStorage();
    const api = fakeApi();
    const manager = new SessionManager(storage, api);
    await manager.signIn({ email: 'm@e.com', password: 'x' });
    await manager.signOut();
    expect(manager.getState().status).toBe('signedOut');
    expect(storage.peek()).toBeNull();
    expect(manager.getAccessToken()).toBeNull();
    expect(api.calls.includes('signOut')).toBe(true);
  });

  it('logout sem internet ainda limpa o aparelho', async () => {
    const storage = memoryStorage();
    const manager = new SessionManager(
      storage,
      fakeApi({ signOut: async () => Promise.reject(new AppError('NETWORK', 'falha')) }),
    );
    await manager.signIn({ email: 'm@e.com', password: 'x' });
    await manager.signOut();
    expect(storage.peek()).toBeNull();
    expect(manager.getState().status).toBe('signedOut');
  });

  it('renovação troca e guarda os tokens novos', async () => {
    const storage = memoryStorage();
    const manager = new SessionManager(storage, fakeApi());
    await manager.signIn({ email: 'm@e.com', password: 'x' });
    expect(await manager.refresh()).toBe(true);
    expect(manager.getAccessToken()).toBe('access-2');
    expect(storage.peek()).toEqual({ accessToken: 'access-2', refreshToken: 'refresh-2' });
  });

  it('várias renovações simultâneas viram uma só chamada', async () => {
    const api = fakeApi();
    const manager = new SessionManager(memoryStorage(), api);
    await manager.signIn({ email: 'm@e.com', password: 'x' });
    const results = await Promise.all([manager.refresh(), manager.refresh(), manager.refresh()]);
    expect(results).toEqual([true, true, true]);
    expect(api.calls.filter((call) => call === 'refresh').length).toBe(1);
  });

  it('sessão expirada: volta ao login com aviso e apaga os tokens', async () => {
    const storage = memoryStorage();
    const manager = new SessionManager(storage, fakeApi());
    await manager.signIn({ email: 'm@e.com', password: 'x' });
    await manager.handleSessionExpired();
    const state = manager.getState();
    expect(state.status).toBe('signedOut');
    expect(state.status === 'signedOut' ? state.notice : null).toBe(SESSION_EXPIRED_NOTICE);
    expect(storage.peek()).toBeNull();
  });

  it('restauração com sessão inválida no servidor desloga', async () => {
    const storage = memoryStorage({ accessToken: 'a', refreshToken: 'r' });
    const manager = new SessionManager(
      storage,
      fakeApi({
        getSession: async () =>
          Promise.reject(new AppError('UNAUTHORIZED', 'x', { status: 401, serverCode: 'SESSION_EXPIRED' })),
      }),
    );
    await manager.restore();
    const state = manager.getState();
    expect(state.status).toBe('signedOut');
    expect(state.status === 'signedOut' ? state.notice : null).toBe(SESSION_EXPIRED_NOTICE);
    expect(storage.peek()).toBeNull();
  });

  it('restauração de conta suspensa desloga com aviso', async () => {
    const manager = new SessionManager(
      memoryStorage({ accessToken: 'a', refreshToken: 'r' }),
      fakeApi({
        getSession: async () =>
          Promise.reject(new AppError('FORBIDDEN', 'x', { status: 403, serverCode: 'ACCOUNT_SUSPENDED' })),
      }),
    );
    await manager.restore();
    const state = manager.getState();
    expect(state.status === 'signedOut' ? state.notice : null).toBe(SUSPENDED_NOTICE);
  });

  it('sem conexão ao restaurar: mantém os tokens e permite tentar de novo', async () => {
    const storage = memoryStorage({ accessToken: 'a', refreshToken: 'r' });
    let online = false;
    const manager = new SessionManager(
      storage,
      fakeApi({
        getSession: async () => {
          if (!online) throw new AppError('NETWORK', 'Network request failed');
          return client;
        },
      }),
    );
    await manager.restore();
    expect(manager.getState().status).toBe('restoreFailed');
    expect(storage.peek()).toEqual({ accessToken: 'a', refreshToken: 'r' });

    online = true;
    await manager.restore();
    expect(manager.getState().status).toBe('signedIn');
  });

  it('avisa quem assina sobre cada mudança de estado', async () => {
    const manager = new SessionManager(memoryStorage(), fakeApi());
    const seen: string[] = [];
    manager.subscribe((state) => seen.push(state.status));
    await manager.restore();
    await manager.signIn({ email: 'm@e.com', password: 'x' });
    expect(seen).toEqual(['restoring', 'signedOut', 'signedIn']);
  });
});

describe('resolveHomeRoute', () => {
  it('leva cada papel para a sua área', () => {
    expect(resolveHomeRoute({ status: 'signedOut' })).toBe('/login');
    expect(resolveHomeRoute({ status: 'signedIn', user: client })).toBe('/client');
    expect(resolveHomeRoute({ status: 'signedIn', user: { ...client, role: 'caregiver' } })).toBe('/caregiver');
    expect(resolveHomeRoute({ status: 'signedIn', user: { ...client, role: 'admin' } })).toBe('/admin-notice');
    expect(resolveHomeRoute({ status: 'restoring' })).toBeNull();
  });
});
