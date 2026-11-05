import { env } from '@/config/env';

import { createApiClient } from './client';

export type { ApiClient, RequestOptions } from './client';

type TokenProvider = () => string | null | Promise<string | null>;

type SessionHandlers = {
  getAccessToken: TokenProvider;
  refreshSession: () => Promise<boolean>;
  onSessionExpired: () => void;
  onAccountSuspended: (serverCode?: string) => void;
};

let handlers: SessionHandlers = {
  getAccessToken: () => null,
  refreshSession: async () => false,
  onSessionExpired: () => {},
  onAccountSuspended: () => {},
};

/**
 * Registrado pelo AuthProvider. Assim o cliente HTTP não depende de onde a
 * sessão é guardada nem de como ela é renovada.
 */
export function setSessionHandlers(next: SessionHandlers): void {
  handlers = next;
}

/** Instância usada pelos serviços do app. */
export const api = createApiClient({
  baseUrl: env.apiUrl,
  timeoutMs: env.apiTimeoutMs,
  getAccessToken: () => handlers.getAccessToken(),
  refreshSession: () => handlers.refreshSession(),
  onSessionExpired: () => handlers.onSessionExpired(),
  onAccountSuspended: (serverCode) => handlers.onAccountSuspended(serverCode),
});
