import { api } from '@/services/api';

export type ActiveSession = { id: string; createdAt: string; lastUsedAt: string; current: boolean };

/** Senha, aparelhos conectados e exclusão de conta (backend/src/modules/me/routes.ts). */
export const accountService = {
  changePassword: (input: { currentPassword?: string; newPassword: string }) => api.post<void>('/v1/me/password', input),

  async sessions(): Promise<ActiveSession[]> {
    const response = await api.get<{ sessions: ActiveSession[] }>('/v1/me/sessions');
    return response.sessions;
  },

  async revokeOtherSessions(): Promise<number> {
    const response = await api.post<{ revoked: number }>('/v1/me/sessions/revoke-others');
    return response.revoked;
  },

  async requestDeletion(input: { password?: string; reason?: string }): Promise<string> {
    const response = await api.post<{ message: string }>('/v1/me/deletion', { confirm: 'EXCLUIR', ...input });
    return response.message;
  },
};

/** "hoje às 14:05", "ontem às 09:10" ou "12/10/2026". */
export function formatSessionDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return `hoje às ${time}`;
  if (days === 1) return `ontem às ${time}`;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}
