import { AppError, codeFromStatus, getUserMessage, toAppError } from '@/services/errors';

describe('erros', () => {
  it('mapeia status HTTP', () => {
    expect(codeFromStatus(400)).toBe('VALIDATION');
    expect(codeFromStatus(401)).toBe('UNAUTHORIZED');
    expect(codeFromStatus(403)).toBe('FORBIDDEN');
    expect(codeFromStatus(409)).toBe('CONFLICT');
    expect(codeFromStatus(429)).toBe('RATE_LIMITED');
    expect(codeFromStatus(503)).toBe('SERVER');
    expect(codeFromStatus(418)).toBe('UNKNOWN');
  });

  it('converte qualquer valor em AppError', () => {
    expect(toAppError(new Error('x')).code).toBe('UNKNOWN');
    expect(toAppError('texto').code).toBe('UNKNOWN');
    const original = new AppError('NETWORK', 'falha');
    expect(toAppError(original)).toBe(original);
  });

  it('nunca mostra a mensagem técnica ao usuário', () => {
    const message = getUserMessage(new Error('TypeError: undefined is not a function'));
    expect(message).not.toContain('TypeError');
  });

  it('prefere a mensagem do backend quando existe', () => {
    const error = new AppError('CONFLICT', 'HTTP 409', { userMessage: 'E-mail já cadastrado.' });
    expect(getUserMessage(error)).toBe('E-mail já cadastrado.');
  });
});
