import { api } from '@/services/api';

import type {
  AuthResponse,
  AuthUser,
  GoogleAuthResponse,
  GoogleSignupInput,
  LoginCredentials,
  RegisterInput,
  SessionTokens,
} from './types';
import { normalizeEmail } from './validation';

/**
 * Chamadas à API de autenticação (backend/src/modules/auth/routes.ts).
 * Nenhuma regra de acesso é decidida aqui: o backend valida tudo.
 */
export const authService = {
  signIn(credentials: LoginCredentials): Promise<AuthResponse> {
    return api.post<AuthResponse>(
      '/v1/auth/login',
      { email: normalizeEmail(credentials.email), password: credentials.password },
      { auth: false },
    );
  },

  signUp(input: RegisterInput): Promise<AuthResponse> {
    return api.post<AuthResponse>(
      '/v1/auth/register',
      {
        role: input.role,
        fullName: input.fullName.trim(),
        email: normalizeEmail(input.email),
        phone: input.phone.replace(/\D/g, ''),
        password: input.password,
        acceptTerms: input.acceptTerms,
      },
      { auth: false },
    );
  },

  /** Entrar com Google: o servidor confere o token com as chaves do Google. */
  googleSignIn(idToken: string, signup?: GoogleSignupInput): Promise<GoogleAuthResponse> {
    return api.post<GoogleAuthResponse>(
      '/v1/auth/google',
      {
        idToken,
        signup: signup
          ? { ...signup, fullName: signup.fullName.trim(), phone: signup.phone.replace(/\D/g, '') }
          : undefined,
      },
      { auth: false },
    );
  },

  /** Sem retry automático: é a própria renovação. */
  refresh(refreshToken: string): Promise<AuthResponse> {
    return api.post<AuthResponse>('/v1/auth/refresh', { refreshToken }, { auth: false });
  },

  async getSession(): Promise<AuthUser> {
    const response = await api.get<{ user: AuthUser }>('/v1/auth/session');
    return response.user;
  },

  /** Revoga a sessão no servidor. O token vai no cabeçalho e o refresh no corpo. */
  async signOut(tokens: SessionTokens): Promise<void> {
    await api.post<void>(
      '/v1/auth/logout',
      { refreshToken: tokens.refreshToken },
      { auth: false, headers: { Authorization: `Bearer ${tokens.accessToken}` } },
    );
  },

  requestPasswordReset(email: string): Promise<{ message: string }> {
    return api.post<{ message: string }>('/v1/auth/password/forgot', { email: normalizeEmail(email) }, { auth: false });
  },

  async resetPassword(input: { email: string; code: string; password: string }): Promise<void> {
    await api.post<void>(
      '/v1/auth/password/reset',
      { email: normalizeEmail(input.email), code: input.code.trim(), password: input.password },
      { auth: false },
    );
  },
};

export type AuthService = typeof authService;
