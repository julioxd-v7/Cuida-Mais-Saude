import { formatMessageTime, mergeMessages } from '@/features/messages/messageService';
import type { ChatMessage } from '@/features/messages/types';

const message = (id: string): ChatMessage => ({ id, body: id, createdAt: null, mine: false, fromSupport: false });

describe('mensagens', () => {
  it('junta novas mensagens sem repetir', () => {
    const merged = mergeMessages([message('1'), message('2')], [message('2'), message('3')]);
    expect(merged.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  it('sem novidades mantém a mesma lista', () => {
    const current = [message('1')];
    expect(mergeMessages(current, [])).toBe(current);
  });

  it('mostra só a hora para mensagens de hoje', () => {
    const now = new Date('2026-10-27T15:00:00');
    expect(formatMessageTime(new Date('2026-10-27T14:32:00').toISOString(), now)).toMatch(/14:32/);
    expect(formatMessageTime(new Date('2026-10-20T09:05:00').toISOString(), now)).toMatch(/20\/10/);
    expect(formatMessageTime(null, now)).toBe('');
  });
});
