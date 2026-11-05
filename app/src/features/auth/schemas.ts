import { z } from 'zod';

import type { FieldErrors } from '@/services/errors';

/**
 * Validação dos formulários no app — só para dar retorno rápido.
 * O backend valida tudo de novo (backend/src/validation.ts) e é ele que vale.
 * Mantenha as mensagens iguais às do backend.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Informe seu e-mail.')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Digite um e-mail válido, como nome@exemplo.com.');

export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits.length > 0, 'Informe o telefone.')
  .refine((digits) => digits.length === 0 || /^[1-9][1-9]\d{8,9}$/.test(digits), 'Digite o DDD e o número, como (11) 91234-5678.')
  .refine(
    (digits) => !/^[1-9][1-9]\d{9}$/.test(digits) || digits[2] === '9',
    'Celular com 11 dígitos começa com 9 depois do DDD.',
  );

export const passwordSchema = z
  .string()
  .min(1, 'Crie uma senha.')
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(128, 'A senha pode ter no máximo 128 caracteres.')
  .refine((value) => /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value), 'Use letras e números na senha.');

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome completo.')
  .min(3, 'Informe o nome completo.')
  .max(120, 'Nome longo demais.')
  .refine((value) => value.split(/\s+/).length >= 2, 'Informe nome e sobrenome.');

export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.'),
});

export const registerFormSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Repita a senha.'),
    acceptTerms: z.boolean().refine((value) => value, 'É preciso aceitar os Termos de Uso e a Política de Privacidade.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  });

export type RegisterFormValues = z.input<typeof registerFormSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: z.string().trim().regex(/^\d{8}$/, 'O código tem 8 números.'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Repita a senha.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não são iguais.',
  });

export const profileBasicsSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
});

/** Roda um schema e devolve os erros por campo (primeira mensagem de cada campo). */
export function validateWith(schema: z.ZodTypeAny, values: unknown): FieldErrors {
  const result = schema.safeParse(values);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/** Primeiro problema da senha (mesmas regras do cadastro), ou null se estiver boa. */
export function passwordProblem(value: string): string | null {
  const result = passwordSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? 'Senha inválida.');
}
