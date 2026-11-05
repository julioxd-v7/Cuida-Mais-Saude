import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { SessionTokens } from '@/features/auth/types';

/**
 * Onde os tokens da sessão ficam guardados no aparelho.
 *
 * - Android/iOS: expo-secure-store (Keystore no Android, Keychain no iOS),
 *   só acessível depois do primeiro desbloqueio do aparelho.
 * - Web (Expo web, só para desenvolvimento): não há armazenamento seguro;
 *   a sessão fica só em memória e some ao recarregar a página.
 *
 * Senhas NUNCA são guardadas. Dados de perfil também não: vêm do servidor.
 */

export interface SessionStorage {
  load(): Promise<SessionTokens | null>;
  save(tokens: SessionTokens): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'cuidarmais.session.v1';

function parse(raw: string | null): SessionTokens | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SessionTokens>;
    if (typeof value.accessToken === 'string' && typeof value.refreshToken === 'string') {
      return { accessToken: value.accessToken, refreshToken: value.refreshToken };
    }
  } catch {
    // Conteúdo corrompido: trata como sem sessão.
  }
  return null;
}

function createSecureStorage(): SessionStorage {
  const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  };
  return {
    async load() {
      return parse(await SecureStore.getItemAsync(KEY, options));
    },
    async save(tokens) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(tokens), options);
    },
    async clear() {
      await SecureStore.deleteItemAsync(KEY, options);
    },
  };
}

export function createMemoryStorage(): SessionStorage {
  let current: SessionTokens | null = null;
  return {
    async load() {
      return current;
    },
    async save(tokens) {
      current = tokens;
    },
    async clear() {
      current = null;
    },
  };
}

export const sessionStorage: SessionStorage = Platform.OS === 'web' ? createMemoryStorage() : createSecureStorage();
