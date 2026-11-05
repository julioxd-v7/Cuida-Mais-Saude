import { env } from '@/config/env';

/**
 * Login com Google (biblioteca @react-native-google-signin/google-signin).
 *
 * Precisa de um "development build": no Expo Go o módulo nativo não existe e
 * o botão simplesmente não aparece. Também só aparece com o client ID Web
 * configurado (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
 */

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let cached: GoogleModule | null | undefined;
let configured = false;

function loadModule(): GoogleModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-google-signin/google-signin') as GoogleModule;
    // Sem o módulo nativo (Expo Go), qualquer acesso falha: testamos aqui.
    if (!mod?.GoogleSignin || typeof mod.GoogleSignin.configure !== 'function') throw new Error('sem módulo nativo');
    cached = mod;
  } catch {
    cached = null;
  }
  return cached;
}

export function isGoogleSignInAvailable(): boolean {
  return Boolean(env.googleWebClientId) && loadModule() !== null;
}

export class GoogleSignInCancelled extends Error {
  constructor() {
    super('Login com Google cancelado');
    this.name = 'GoogleSignInCancelled';
  }
}

/** Abre a escolha de conta Google e devolve o ID token (verificado depois pelo backend). */
export async function getGoogleIdToken(): Promise<string> {
  const mod = loadModule();
  if (!mod || !env.googleWebClientId) throw new Error('Login com Google indisponível');
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = mod;
  if (!configured) {
    GoogleSignin.configure({ webClientId: env.googleWebClientId, iosClientId: env.googleIosClientId ?? undefined });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Sempre pergunta a conta (útil em aparelhos compartilhados pela família).
    await GoogleSignin.signOut().catch(() => null);
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new GoogleSignInCancelled();
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('O Google não devolveu o token de identificação');
    return idToken;
  } catch (error) {
    if (error instanceof GoogleSignInCancelled) throw error;
    if (isErrorWithCode(error) && (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)) {
      throw new GoogleSignInCancelled();
    }
    throw error;
  }
}

/** Primeiro acesso: guarda em memória (nunca na URL nem no disco) o token até completar o cadastro. */
let pendingSignup: { idToken: string; email: string; fullName: string | null } | null = null;

export function setPendingGoogleSignup(value: typeof pendingSignup): void {
  pendingSignup = value;
}

export function getPendingGoogleSignup(): typeof pendingSignup {
  return pendingSignup;
}
