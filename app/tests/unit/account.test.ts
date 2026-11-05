import { parseGoogleClientId } from '@/config/env';
import { formatSessionDate } from '@/features/account/accountService';
import { passwordProblem } from '@/features/auth/schemas';
import { DELETED_NOTICE, SessionManager, SUSPENDED_NOTICE, type AuthApi } from '@/features/auth/sessionManager';
import type { AuthResponse, AuthUser, SessionTokens } from '@/features/auth/types';
import {
  addressSummary,
  EMPTY_ADDRESS,
  formatPostalCode,
  fromAddress,
  toAddressInput,
  validateAddress,
} from '@/features/recipients/addressForm';

const user: AuthUser = {
  id: 'u1',
  fullName: 'Rosa Lima',
  email: 'rosa@gmail.com',
  phone: '11912345678',
  role: 'client',
  status: 'active',
  hasPassword: false,
  googleLinked: true,
  createdAt: null,
};

function storage() {
  let value: SessionTokens | null = null;
  return {
    load: async () => value,
    save: async (tokens: SessionTokens) => {
      value = tokens;
    },
    clear: async () => {
      value = null;
    },
    peek: () => value,
  };
}

function api(google: AuthApi['googleSignIn']): AuthApi {
  const fail = async (): Promise<never> => {
    throw new Error('não usado');
  };
  return { signIn: fail, signUp: fail, refresh: fail, getSession: fail, signOut: async () => {}, googleSignIn: google };
}

describe('endereço', () => {
  it('formata o CEP enquanto digita', () => {
    expect(formatPostalCode('0131')).toBe('0131');
    expect(formatPostalCode('01310100')).toBe('01310-100');
    expect(formatPostalCode('01310-1009999')).toBe('01310-100');
  });

  it('endereço vazio é permitido; preenchido precisa de rua, cidade e UF', () => {
    expect(validateAddress(EMPTY_ADDRESS)).toEqual({});
    const partial = validateAddress({ ...EMPTY_ADDRESS, number: '12' });
    expect(Object.keys(partial).sort()).toEqual(['city', 'state', 'street']);
    expect(validateAddress({ ...EMPTY_ADDRESS, street: 'Rua A', city: 'São Paulo', state: 'XX' }).state).toContain('sigla');
    expect(validateAddress({ ...EMPTY_ADDRESS, postalCode: '0131', street: 'Rua A', city: 'SP', state: 'SP' }).postalCode).toContain('8');
  });

  it('converte para a API e de volta', () => {
    const input = toAddressInput({ ...EMPTY_ADDRESS, postalCode: '01310-100', street: ' Av. Paulista ', number: '1000', city: 'São Paulo', state: 'sp' });
    expect(input).toEqual({
      street: 'Av. Paulista',
      number: '1000',
      complement: null,
      district: null,
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01310100',
    });
    expect(fromAddress(input).postalCode).toBe('01310-100');
    expect(addressSummary(input)).toBe('Av. Paulista, 1000 · São Paulo/SP');
    expect(addressSummary({ ...input, street: null, city: null })).toBeNull();
  });
});

describe('conta', () => {
  it('datas das sessões em linguagem simples', () => {
    const now = new Date(2026, 9, 27, 15, 0);
    expect(formatSessionDate(new Date(2026, 9, 27, 9, 5).toISOString(), now)).toBe('hoje às 09:05');
    expect(formatSessionDate(new Date(2026, 9, 26, 22, 30).toISOString(), now)).toBe('ontem às 22:30');
    expect(formatSessionDate(new Date(2026, 8, 3, 10, 0).toISOString(), now)).toBe('03/09/2026');
  });

  it('senha segue as regras do cadastro', () => {
    expect(passwordProblem('curta1')).toContain('8 caracteres');
    expect(passwordProblem('semnumeros')).toContain('letras e números');
    expect(passwordProblem('boaSenha123')).toBeNull();
  });

  it('aceita só client ID do Google no formato oficial', () => {
    expect(parseGoogleClientId('123456-abc123.apps.googleusercontent.com')).toBe('123456-abc123.apps.googleusercontent.com');
    expect(parseGoogleClientId('qualquer coisa')).toBeNull();
    expect(parseGoogleClientId(undefined)).toBeNull();
  });
});

describe('sessão: Google e conta encerrada', () => {
  it('conta nova pelo Google pede cadastro sem abrir sessão', async () => {
    const store = storage();
    const manager = new SessionManager(
      store,
      api(async () => ({ needsSignup: true, profile: { email: 'rosa@gmail.com', fullName: 'Rosa' } })),
    );
    const result = await manager.signInWithGoogle('token');
    expect(result.status).toBe('needsSignup');
    expect(store.peek()).toBeNull();
  });

  it('com cadastro completo, abre a sessão e guarda os tokens', async () => {
    const store = storage();
    const session: AuthResponse = { accessToken: 'a1', refreshToken: 'r1', accessExpiresAt: '2030-01-01T00:00:00Z', user };
    const manager = new SessionManager(store, api(async () => session));
    const result = await manager.signInWithGoogle('token', { role: 'client', fullName: 'Rosa Lima', phone: '11912345678', acceptTerms: true });
    expect(result.status).toBe('signedIn');
    expect(manager.getState()).toEqual({ status: 'signedIn', user });
    expect(store.peek()?.accessToken).toBe('a1');
  });

  it('conta encerrada mostra aviso próprio; suspensa mantém o aviso de suspensão', async () => {
    const manager = new SessionManager(storage(), api(undefined));
    await manager.handleAccountSuspended('ACCOUNT_DELETED');
    expect(manager.getState()).toEqual({ status: 'signedOut', notice: DELETED_NOTICE });
    await manager.handleAccountSuspended('ACCOUNT_SUSPENDED');
    expect(manager.getState()).toEqual({ status: 'signedOut', notice: SUSPENDED_NOTICE });
    await manager.endLocalSession('Pedido de exclusão registrado.');
    expect(manager.getState()).toEqual({ status: 'signedOut', notice: 'Pedido de exclusão registrado.' });
  });
});
