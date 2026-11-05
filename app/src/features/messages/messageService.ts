import { api } from '@/services/api';

import type { ChatMessage, Conversation } from './types';

/** Conversas e mensagens (backend/src/modules/messages/routes.ts). */
export const messageService = {
  async list(): Promise<Conversation[]> {
    return (await api.get<{ conversations: Conversation[] }>('/v1/conversations')).conversations;
  },

  async openSupport(subject: string, message: string): Promise<Conversation> {
    return (await api.post<{ conversation: Conversation }>('/v1/support/conversations', { subject, message })).conversation;
  },

  /** Sem "afterId": as últimas mensagens. Com "afterId": só as novas (atualização periódica). */
  get(conversationId: string, afterId?: string) {
    const query = afterId ? `?after=${encodeURIComponent(afterId)}` : '';
    return api.get<{ conversation: Conversation; messages: ChatMessage[] }>(`/v1/conversations/${conversationId}${query}`);
  },

  async send(conversationId: string, body: string): Promise<ChatMessage> {
    return (await api.post<{ message: ChatMessage }>(`/v1/conversations/${conversationId}/messages`, { body })).message;
  },

  async close(conversationId: string): Promise<Conversation> {
    return (await api.post<{ conversation: Conversation }>(`/v1/conversations/${conversationId}/status`, { status: 'closed' }))
      .conversation;
  },
};

/** Junta mensagens novas às já carregadas, sem repetir (a atualização pode trazer a que acabei de enviar). */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return current;
  const seen = new Set(current.map((message) => message.id));
  return [...current, ...incoming.filter((message) => !seen.has(message.id))];
}

/** "14:32" se for hoje, "12/10 14:32" se não. */
export function formatMessageTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const date = new Date(iso);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? time : `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`;
}
