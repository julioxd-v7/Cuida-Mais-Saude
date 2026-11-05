import { z } from 'zod';

/**
 * Regras de validação dos dados recebidos. O app tem regras equivalentes
 * (app/src/features/auth/schemas.ts) só para dar retorno rápido;
 * as que valem são estas.
 */

export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const SPECIALTIES = ['elderly', 'post_surgery', 'disability', 'dementia', 'palliative', 'special_needs_children'] as const;
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const PERIODS = ['morning', 'afternoon', 'night', 'overnight'] as const;
export const ASSISTANCE_NEEDS = ['mobility', 'hygiene', 'feeding', 'medication_reminder', 'companionship'] as const;
export const RELATIONSHIPS = ['self', 'parent', 'grandparent', 'spouse', 'child', 'sibling', 'other'] as const;
export const CONTACT_PREFERENCES = ['whatsapp', 'phone', 'email'] as const;

export const emailSchema = z
  .string({ required_error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .max(254, 'E-mail longo demais.')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Digite um e-mail válido, como nome@exemplo.com.');

/** Telefone brasileiro: DDD + número. Aceita com ou sem máscara; salva só dígitos. */
export const phoneSchema = z
  .string({ required_error: 'Informe o telefone.' })
  .transform((value) => value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''))
  .refine((digits) => /^[1-9][1-9]\d{8,9}$/.test(digits), 'Digite o DDD e o número, como (11) 91234-5678.')
  .refine((digits) => digits.length === 10 || digits[2] === '9', 'Celular com 11 dígitos começa com 9 depois do DDD.');

export const passwordSchema = z
  .string({ required_error: 'Crie uma senha.' })
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(128, 'A senha pode ter no máximo 128 caracteres.')
  .refine((value) => /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value), 'Use letras e números na senha.');

export const fullNameSchema = z
  .string({ required_error: 'Informe o nome completo.' })
  .trim()
  .min(3, 'Informe o nome completo.')
  .max(120, 'Nome longo demais.')
  .refine((value) => value.split(/\s+/).length >= 2, 'Informe nome e sobrenome.');

export const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => (UF_LIST as readonly string[]).includes(value), 'Escolha uma UF válida, como SP.');

export const postalCodeSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((digits) => digits.length === 8, 'O CEP tem 8 dígitos.');

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const addressSchema = z
  .object({
    street: optionalText(160),
    number: optionalText(20),
    complement: optionalText(80),
    district: optionalText(80),
    city: optionalText(80),
    state: ufSchema.nullable().optional(),
    postalCode: postalCodeSchema.nullable().optional(),
  })
  .strict();

/** Lista sem repetição, só com valores conhecidos. */
export function enumList<const T extends readonly [string, ...string[]]>(values: T, message: string) {
  return z
    .array(z.enum(values, { errorMap: () => ({ message }) }))
    .max(values.length)
    .transform((list) => [...new Set(list)]);
}

/** CPF com dígitos verificadores. Aceita com ou sem máscara; devolve só dígitos. */
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (length: number) => {
    let total = 0;
    for (let i = 0; i < length; i += 1) total += Number(digits[i]) * (length + 1 - i);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

export const cpfSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine(isValidCpf, 'CPF inválido. Confira os 11 números.');

export const councilNumberSchema = z
  .string()
  .trim()
  .regex(/^[0-9A-Za-z./-]{3,20}$/, 'Informe o número do registro, como 123456.');
