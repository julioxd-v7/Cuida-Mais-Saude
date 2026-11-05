import { z } from 'zod';

import {
  PROFESSION_INFO,
  UF_LIST,
  type Period,
  type Profession,
  type ServiceType,
  type Specialty,
  type Weekday,
} from '@/constants/labels';
import { isValidCpf } from '@/features/auth/validation';
import type { CaregiverProfileInput } from '@/features/profile/types';

/** Regras do formulário de perfil profissional (sem React, testáveis). */

export type FormValues = {
  profession: Profession | null;
  cpf: string;
  councilNumber: string;
  councilState: string;
  serviceDistrict: string;
  bio: string;
  experienceYears: string;
  specialties: Specialty[];
  serviceCity: string;
  serviceState: string;
  serviceRadiusKm: string;
  availabilityDays: Weekday[];
  availabilityPeriods: Period[];
  /** Categorias de serviço que quer oferecer (cada uma passa pela análise). */
  categories: ServiceType[];
};

/** Formato dos campos (o que for preenchido precisa estar certo). Campos vazios são permitidos. */
export const formatSchema = z.object({
  cpf: z.string().refine((v) => v.replace(/\D/g, '') === '' || isValidCpf(v), 'CPF inválido. Confira os 11 números.'),
  councilNumber: z.string().refine((v) => v.trim() === '' || /^[0-9A-Za-z./-]{3,20}$/.test(v.trim()), 'Informe o número do registro, como 123456.'),
  councilState: z
    .string()
    .refine((v) => v === '' || (UF_LIST as readonly string[]).includes(v.toUpperCase()), 'Use a sigla do estado, como SP.'),
  bio: z.string().max(1000, 'A apresentação pode ter até 1000 caracteres.'),
  experienceYears: z
    .string()
    .refine((v) => v === '' || (/^\d{1,2}$/.test(v) && Number(v) <= 60), 'Informe um número de 0 a 60.'),
  serviceState: z
    .string()
    .refine((v) => v === '' || (UF_LIST as readonly string[]).includes(v.toUpperCase()), 'Use a sigla do estado, como SP.'),
  serviceRadiusKm: z
    .string()
    .refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) >= 1 && Number(v) <= 100), 'Informe de 1 a 100 km.'),
});

/** O que falta para o perfil ficar completo (mesma regra do banco). */
export function missingFields(values: FormValues): string[] {
  const missing: string[] = [];
  if (!values.profession) missing.push('profissão');
  if (!isValidCpf(values.cpf)) missing.push('CPF');
  if (values.profession && PROFESSION_INFO[values.profession].council) {
    if (!values.councilNumber.trim() || !values.councilState) missing.push(`registro no ${PROFESSION_INFO[values.profession].council}`);
  }
  if (values.bio.trim().length < 30) missing.push('apresentação (mínimo 30 caracteres)');
  if (values.experienceYears === '') missing.push('anos de experiência');
  if (!values.specialties.length) missing.push('especialidades');
  if (values.serviceCity.trim().length < 2) missing.push('cidade');
  if (!values.serviceState) missing.push('estado');
  if (!values.serviceRadiusKm) missing.push('raio de atendimento');
  if (!values.availabilityDays.length) missing.push('dias disponíveis');
  if (!values.availabilityPeriods.length) missing.push('períodos');
  if (!values.categories.length) missing.push('serviços que você oferece');
  return missing;
}

export function toInput(values: FormValues): CaregiverProfileInput {
  const orNull = (text: string) => (text.trim() === '' ? null : text.trim());
  const digits = values.cpf.replace(/\D/g, '');
  const needsCouncil = values.profession ? PROFESSION_INFO[values.profession].council !== null : false;
  return {
    profession: values.profession ?? undefined,
    cpf: digits === '' ? undefined : digits,
    councilNumber: needsCouncil ? orNull(values.councilNumber) : null,
    councilState: needsCouncil && values.councilState !== '' ? values.councilState.toUpperCase() : null,
    serviceDistrict: orNull(values.serviceDistrict),
    bio: orNull(values.bio),
    experienceYears: values.experienceYears === '' ? null : Number(values.experienceYears),
    specialties: values.specialties,
    serviceCity: orNull(values.serviceCity),
    serviceState: values.serviceState === '' ? null : values.serviceState.toUpperCase(),
    serviceRadiusKm: values.serviceRadiusKm === '' ? null : Number(values.serviceRadiusKm),
    availabilityDays: values.availabilityDays,
    availabilityPeriods: values.availabilityPeriods,
    categories: values.categories,
  };
}

