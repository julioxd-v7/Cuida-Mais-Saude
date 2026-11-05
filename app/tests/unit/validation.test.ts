import { hasErrors, isValidEmail, normalizeEmail, validateLoginForm } from '@/features/auth/validation';

describe('validação do login', () => {
  it('normaliza o e-mail', () => {
    expect(normalizeEmail('  Maria@Exemplo.COM ')).toBe('maria@exemplo.com');
  });

  it('aceita e rejeita e-mails', () => {
    expect(isValidEmail('maria@exemplo.com')).toBe(true);
    expect(isValidEmail(' maria@exemplo.com.br ')).toBe(true);
    expect(isValidEmail('maria@exemplo')).toBe(false);
    expect(isValidEmail('maria exemplo.com')).toBe(false);
  });

  it('exige e-mail e senha', () => {
    const errors = validateLoginForm({ email: '', password: '' });
    expect(errors).toEqual({ email: 'Informe seu e-mail.', password: 'Informe sua senha.' });
    expect(hasErrors(errors)).toBe(true);
  });

  it('aponta e-mail inválido', () => {
    const errors = validateLoginForm({ email: 'maria@', password: '123' });
    expect(Object.keys(errors)).toEqual(['email']);
  });

  it('não acusa erro com dados válidos', () => {
    expect(hasErrors(validateLoginForm({ email: 'maria@exemplo.com', password: 'x' }))).toBe(false);
  });
});
