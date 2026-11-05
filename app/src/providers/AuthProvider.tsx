import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authService } from '@/features/auth/authService';
import { SessionManager, type AuthState, type GoogleSignInResult } from '@/features/auth/sessionManager';
import type { AuthUser, GoogleSignupInput, LoginCredentials, RegisterInput } from '@/features/auth/types';
import { setSessionHandlers } from '@/services/api';
import { sessionStorage } from '@/services/storage/sessionStorage';

type AuthContextValue = {
  state: AuthState;
  signIn: (credentials: LoginCredentials) => Promise<AuthUser>;
  signUp: (input: RegisterInput) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  signInWithGoogle: (idToken: string, signup?: GoogleSignupInput) => Promise<GoogleSignInResult>;
  /** Encerra a sessão só no aparelho, com um aviso (ex.: conta excluída). */
  endLocalSession: (notice?: string) => Promise<void>;
  retryRestore: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
  /** Cuidador recém-cadastrado: abre o formulário profissional uma vez. */
  onboardingPending: boolean;
  finishOnboarding: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Uma instância por app. Exportada só para testes e para o cliente HTTP. */
const manager = new SessionManager(sessionStorage, authService);

setSessionHandlers({
  getAccessToken: () => manager.getAccessToken(),
  refreshSession: () => manager.refresh(),
  onSessionExpired: () => void manager.handleSessionExpired(),
  onAccountSuspended: (serverCode) => void manager.handleAccountSuspended(serverCode),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(manager.getState());
  const [onboardingPending, setOnboardingPending] = useState(false);

  useEffect(() => {
    const unsubscribe = manager.subscribe(setState);
    void manager.restore();
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signIn: (credentials) => manager.signIn(credentials),
      signUp: async (input) => {
        const user = await manager.signUp(input);
        setOnboardingPending(input.role === 'caregiver');
        return user;
      },
      signOut: async () => {
        setOnboardingPending(false);
        await manager.signOut();
      },
      signInWithGoogle: async (idToken, signup) => {
        const result = await manager.signInWithGoogle(idToken, signup);
        if (result.status === 'signedIn') setOnboardingPending(Boolean(signup && signup.role === 'caregiver'));
        return result;
      },
      endLocalSession: async (notice) => {
        setOnboardingPending(false);
        await manager.endLocalSession(notice);
      },
      retryRestore: () => manager.restore(),
      updateUser: (user) => manager.updateUser(user),
      onboardingPending,
      finishOnboarding: () => setOnboardingPending(false),
    }),
    [state, onboardingPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}

/**
 * Usuário logado, para telas protegidas. Pode ser null por um instante
 * quando a sessão termina e a navegação ainda está saindo da tela.
 */
export function useSignedInUser(): AuthUser | null {
  const { state } = useAuth();
  return state.status === 'signedIn' ? state.user : null;
}
