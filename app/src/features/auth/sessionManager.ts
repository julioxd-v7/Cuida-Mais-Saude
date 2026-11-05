import { isAppError, reportError } from '@/services/errors';

import type {
  AuthResponse,
  AuthUser,
  GoogleAuthResponse,
  GoogleSignupInput,
  LoginCredentials,
  RegisterInput,
  SessionTokens,
} from './types';

/**
 * Estado e regras da sessão, sem React (testável isoladamente).
 * O AuthProvider só conecta isto à interface.
 */

export type AuthState =
  | { status: 'restoring' }
  | { status: 'signedOut'; notice?: string }
  | { status: 'signedIn'; user: AuthUser }
  | { status: 'restoreFailed'; message: string };

export type SessionStorageLike = {
  load(): Promise<SessionTokens | null>;
  save(tokens: SessionTokens): Promise<void>;
  clear(): Promise<void>;
};

export type AuthApi = {
  signIn(credentials: LoginCredentials): Promise<AuthResponse>;
  signUp(input: RegisterInput): Promise<AuthResponse>;
  refresh(refreshToken: string): Promise<AuthResponse>;
  getSession(): Promise<AuthUser>;
  signOut(tokens: SessionTokens): Promise<void>;
  googleSignIn?(idToken: string, signup?: GoogleSignupInput): Promise<GoogleAuthResponse>;
};

export const SESSION_EXPIRED_NOTICE = 'Sua sessão expirou. Entre novamente.';
export const SUSPENDED_NOTICE = 'Sua conta está suspensa. Entre em contato com o suporte.';
export const DELETED_NOTICE = 'Esta conta foi encerrada. Se foi um engano, fale com o suporte.';

export type GoogleSignInResult =
  | { status: 'signedIn'; user: AuthUser }
  | { status: 'needsSignup'; profile: { email: string; fullName: string | null } };

export class SessionManager {
  private state: AuthState = { status: 'restoring' };
  private tokens: SessionTokens | null = null;
  private refreshing: Promise<boolean> | null = null;
  private listeners = new Set<(state: AuthState) => void>();

  constructor(
    private readonly storage: SessionStorageLike,
    private readonly api: AuthApi,
  ) {}

  getState(): AuthState {
    return this.state;
  }

  getAccessToken(): string | null {
    return this.tokens?.accessToken ?? null;
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(next: AuthState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener(next));
  }

  /** Ao abrir o app: lê os tokens guardados e confirma no servidor. */
  async restore(): Promise<void> {
    this.setState({ status: 'restoring' });
    let stored: SessionTokens | null = null;
    try {
      stored = await this.storage.load();
    } catch (error) {
      reportError(error, { action: 'session.load' });
    }
    if (!stored) {
      this.setState({ status: 'signedOut' });
      return;
    }

    this.tokens = stored;
    try {
      // getSession passa pelo cliente HTTP, que renova o token sozinho se expirou.
      const user = await this.api.getSession();
      this.setState({ status: 'signedIn', user });
    } catch (error) {
      if (isAppError(error) && (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN')) {
        const notice =
          error.serverCode === 'ACCOUNT_SUSPENDED'
            ? SUSPENDED_NOTICE
            : error.serverCode === 'ACCOUNT_DELETED'
              ? DELETED_NOTICE
            : error.serverCode === 'SESSION_EXPIRED'
              ? SESSION_EXPIRED_NOTICE
              : undefined;
        await this.clearLocal();
        this.setState({ status: 'signedOut', notice });
        return;
      }
      // Sem conexão ou servidor fora: mantém os tokens e deixa tentar de novo.
      reportError(error, { action: 'session.restore' });
      this.setState({
        status: 'restoreFailed',
        message: 'Não foi possível conectar ao servidor para confirmar sua sessão.',
      });
    }
  }

  async signIn(credentials: LoginCredentials): Promise<AuthUser> {
    return this.establish(await this.api.signIn(credentials));
  }

  async signUp(input: RegisterInput): Promise<AuthUser> {
    return this.establish(await this.api.signUp(input));
  }

  /** Entrar com Google. Conta nova volta "needsSignup" com os dados do Google para completar. */
  async signInWithGoogle(idToken: string, signup?: GoogleSignupInput): Promise<GoogleSignInResult> {
    if (!this.api.googleSignIn) throw new Error('Login com Google indisponível');
    const response = await this.api.googleSignIn(idToken, signup);
    if ('needsSignup' in response) return { status: 'needsSignup', profile: response.profile };
    return { status: 'signedIn', user: await this.establish(response) };
  }

  private async establish(response: AuthResponse): Promise<AuthUser> {
    const tokens = { accessToken: response.accessToken, refreshToken: response.refreshToken };
    this.tokens = tokens;
    await this.storage.save(tokens);
    this.setState({ status: 'signedIn', user: response.user });
    return response.user;
  }

  /**
   * Renova a sessão com o refresh token. Várias requisições que expiram ao
   * mesmo tempo compartilham uma única renovação.
   */
  refresh(): Promise<boolean> {
    if (!this.tokens) return Promise.resolve(false);
    this.refreshing ??= (async () => {
      try {
        const response = await this.api.refresh((this.tokens as SessionTokens).refreshToken);
        this.tokens = { accessToken: response.accessToken, refreshToken: response.refreshToken };
        await this.storage.save(this.tokens);
        if (this.state.status === 'signedIn') this.setState({ status: 'signedIn', user: response.user });
        return true;
      } catch (error) {
        reportError(error, { action: 'session.refresh' });
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** O cliente HTTP avisa que não deu para renovar: volta para o login com aviso. */
  async handleSessionExpired(): Promise<void> {
    await this.clearLocal();
    this.setState({ status: 'signedOut', notice: SESSION_EXPIRED_NOTICE });
  }

  /** O servidor informou que a conta foi suspensa ou encerrada: encerra a sessão local. */
  async handleAccountSuspended(serverCode?: string): Promise<void> {
    await this.clearLocal();
    this.setState({ status: 'signedOut', notice: serverCode === 'ACCOUNT_DELETED' ? DELETED_NOTICE : SUSPENDED_NOTICE });
  }

  /** Encerra só no aparelho (o servidor já encerrou, ex.: depois de excluir a conta). */
  async endLocalSession(notice?: string): Promise<void> {
    await this.clearLocal();
    this.setState({ status: 'signedOut', notice });
  }

  /** Atualiza os dados do usuário em memória (ex.: depois de editar o perfil). */
  updateUser(user: AuthUser): void {
    if (this.state.status === 'signedIn') this.setState({ status: 'signedIn', user });
  }

  /** Sai: revoga no servidor (se der) e sempre limpa o aparelho. */
  async signOut(): Promise<void> {
    const tokens = this.tokens;
    await this.clearLocal();
    this.setState({ status: 'signedOut' });
    if (tokens) {
      try {
        await this.api.signOut(tokens);
      } catch (error) {
        // Sem conexão: a sessão local já foi apagada; no servidor ela expira sozinha.
        reportError(error, { action: 'session.signOut' });
      }
    }
  }

  private async clearLocal(): Promise<void> {
    this.tokens = null;
    try {
      await this.storage.clear();
    } catch (error) {
      reportError(error, { action: 'session.clear' });
    }
  }
}

/** Para qual área a pessoa vai, de acordo com a sessão. */
export function resolveHomeRoute(state: AuthState): '/login' | '/client' | '/caregiver' | '/admin-notice' | null {
  if (state.status === 'restoring' || state.status === 'restoreFailed') return null;
  if (state.status === 'signedOut') return '/login';
  switch (state.user.role) {
    case 'client':
      return '/client';
    case 'caregiver':
      return '/caregiver';
    default:
      return '/admin-notice';
  }
}
