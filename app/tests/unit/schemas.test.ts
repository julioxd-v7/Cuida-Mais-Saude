import { registerFormSchema, resetPasswordSchema, validateWith } from '@/features/auth/schemas';
import { formatPhone } from '@/features/auth/validation';
import { canAcceptRequests } from '@/features/caregiver/verification';

const valid = {
  fullName: 'Maria da Silva',
  email: 'maria@exemplo.com',
  phone: '(11) 91234-5678',
  password: 'senhaForte1',
  confirmPassword: 'senhaForte1',
  acceptTerms: true,
};

describe('cadastro', () => {
  it('aceita dados válidos', () => {
    expect(validateWith(registerFormSchema, valid)).toEqual({});
  });

  it('aponta todos os campos obrigatórios vazios', () => {
    const errors = validateWith(registerFormSchema, {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    });
    expect(errors.fullName).toBe('Informe o nome completo.');
    expect(errors.email).toBe('Informe seu e-mail.');
    expect(errors.phone).toBe('Informe o telefone.');
    expect(errors.password).toBe('Crie uma senha.');
    expect(errors.confirmPassword).toBe('Repita a senha.');
    expect(errors.acceptTerms).toContain('aceitar');
  });

  it('valida e-mail e telefone', () => {
    const errors = validateWith(registerFormSchema, { ...valid, email: 'maria@', phone: '1234' });
    expect(errors.email).toBe('Digite um e-mail válido, como nome@exemplo.com.');
    expect(errors.phone).toContain('DDD');
  });

  it('celular de 11 dígitos precisa do 9', () => {
    expect(validateWith(registerFormSchema, { ...valid, phone: '11812345678' }).phone).toContain('começa com 9');
    expect(validateWith(registerFormSchema, { ...valid, phone: '1134567890' }).phone).toBeUndefined();
  });

  it('acusa senhas diferentes', () => {
    expect(validateWith(registerFormSchema, { ...valid, confirmPassword: 'outraSenha1' }).confirmPassword).toBe(
      'As senhas não são iguais.',
    );
  });

  it('exige senha com letras e números', () => {
    expect(validateWith(registerFormSchema, { ...valid, password: 'somenteletras', confirmPassword: 'somenteletras' }).password).toBe(
      'Use letras e números na senha.',
    );
  });

  it('exige nome e sobrenome', () => {
    expect(validateWith(registerFormSchema, { ...valid, fullName: 'Maria' }).fullName).toBe('Informe nome e sobrenome.');
  });
});

describe('recuperação de senha', () => {
  it('exige código de 8 números', () => {
    const errors = validateWith(resetPasswordSchema, {
      email: 'maria@exemplo.com',
      code: '123',
      password: 'novaSenha1',
      confirmPassword: 'novaSenha1',
    });
    expect(errors.code).toBe('O código tem 8 números.');
  });
});

describe('máscara de telefone', () => {
  it('formata enquanto digita', () => {
    expect(formatPhone('1')).toBe('(1');
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('119')).toBe('(11) 9');
    expect(formatPhone('1134567890')).toBe('(11) 3456-7890');
    expect(formatPhone('11912345678')).toBe('(11) 91234-5678');
    expect(formatPhone('(11) 91234-56789')).toBe('(11) 91234-5678');
  });
});

describe('verificação do cuidador', () => {
  it('só aprovado pode aceitar atendimentos', () => {
    expect(canAcceptRequests('approved')).toBe(true);
    for (const status of ['incomplete', 'completed', 'pending_review', 'rejected', 'suspended'] as const) {
      expect(canAcceptRequests(status)).toBe(false);
    }
  });
});
