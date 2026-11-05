import {
  PERIOD_OPTIONS,
  PROFESSION_OPTIONS,
  serviceTypeLabel,
  WEEKDAY_OPTIONS,
  type Period,
  type ServiceType,
  type Weekday,
} from '@/constants/labels';
import type { ServiceRate } from '@/features/profile/types';

import type { PriceRange, PublicCaregiver } from './types';

/** Regras de exibição da busca (sem React, testáveis). */

/** 4000 -> "R$ 40"; 4550 -> "R$ 45,50". */
export function formatMoney(cents: number): string {
  const reais = Math.floor(cents / 100);
  const rest = cents % 100;
  const integer = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rest === 0 ? `R$ ${integer}` : `R$ ${integer},${String(rest).padStart(2, '0')}`;
}

/** "40", "40,5", "R$ 1.200,50" -> centavos. Vazio ou inválido -> null. */
export function parseMoney(input: string): number | null {
  const clean = input.replace(/[R$\s]/g, '').replace(/\./g, '');
  if (!/^\d{1,6}(,\d{1,2})?$/.test(clean)) return null;
  const [reais, centavos = ''] = clean.split(',');
  return Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
}

/** Para preencher o campo de valor: 4550 -> "45,50"; 4000 -> "40". */
export function moneyInput(cents: number): string {
  return formatMoney(cents).replace('R$ ', '');
}

export function formatRange(range: PriceRange): string {
  return `${formatMoney(range.minHourlyCents)} a ${formatMoney(range.maxHourlyCents)} por hora`;
}

/** Mensagem de erro do valor, ou null se estiver ok. */
export function rateError(cents: number | null, range: PriceRange | undefined): string | null {
  if (cents === null) return 'Informe o valor por hora, como 45 ou 45,50.';
  if (!range) return 'Este serviço ainda não tem faixa de preço na sua cidade.';
  if (cents < range.minHourlyCents || cents > range.maxHourlyCents) {
    return `Use um valor entre ${formatMoney(range.minHourlyCents)} e ${formatMoney(range.maxHourlyCents)}.`;
  }
  return null;
}

/** "a partir de R$ 40/h" (menor valor entre os serviços). */
export function startingPrice(rates: readonly ServiceRate[]): string | null {
  if (!rates.length) return null;
  return `a partir de ${formatMoney(Math.min(...rates.map((rate) => rate.hourlyRateCents)))}/h`;
}

export function rateFor(rates: readonly ServiceRate[], serviceType: ServiceType): number | null {
  return rates.find((rate) => rate.serviceType === serviceType)?.hourlyRateCents ?? null;
}

export function professionLabel(profession: PublicCaregiver['profession']): string {
  return PROFESSION_OPTIONS.find((option) => option.value === profession)?.label ?? 'Profissional de cuidado';
}

export function serviceLabels(types: readonly ServiceType[]): string {
  return types.map((type) => serviceTypeLabel(type)).join(' · ');
}

/** "Vila Mariana e região · até 15 km" (nunca o endereço). */
export function regionLabel(region: PublicCaregiver['region']): string {
  const place = region.district ? `${region.district} e região` : (region.city ?? 'Região não informada');
  return region.radiusKm ? `${place} · até ${region.radiusKm} km` : place;
}

export function experienceLabel(years: number | null): string | null {
  if (years === null) return null;
  if (years === 0) return 'Menos de 1 ano de experiência';
  return years === 1 ? '1 ano de experiência' : `${years} anos de experiência`;
}

/** "Seg a Sex" quando contínuo; senão "Seg, Qua, Sex". */
export function daysLabel(days: readonly Weekday[]): string {
  const order = WEEKDAY_OPTIONS.map((option) => option.value);
  const sorted = order.filter((day) => days.includes(day));
  if (!sorted.length) return 'Dias não informados';
  if (sorted.length === 7) return 'Todos os dias';
  const label = (day: Weekday) => WEEKDAY_OPTIONS.find((option) => option.value === day)!.label;
  const indexes = sorted.map((day) => order.indexOf(day));
  const contiguous = indexes.every((value, i) => i === 0 || value === indexes[i - 1]! + 1);
  if (contiguous && sorted.length >= 3) return `${label(sorted[0]!)} a ${label(sorted[sorted.length - 1]!)}`;
  return sorted.map(label).join(', ');
}

export function periodsLabel(periods: readonly Period[]): string {
  const labels = PERIOD_OPTIONS.filter((option) => periods.includes(option.value)).map((option) => option.label);
  return labels.length ? labels.join(', ') : 'Períodos não informados';
}

/** Iniciais para o avatar: "Ana Paula S." -> "AP". */
export function initials(name: string): string {
  const words = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

/** Ano de entrada verificada: "Verificado desde 2026". */
export function verifiedSinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const year = new Date(iso).getFullYear();
  return Number.isFinite(year) ? `Verificado desde ${year}` : null;
}

/** Texto lido em voz alta no perfil do profissional (só informações públicas). */
export function caregiverSpeech(caregiver: PublicCaregiver): string {
  const parts = [
    `${caregiver.displayName}, ${professionLabel(caregiver.profession)}.`,
    caregiver.verified ? 'Profissional verificado pelo Cuidar mais.' : null,
    caregiver.availableNow ? 'Disponível agora.' : null,
    experienceLabel(caregiver.experienceYears) ? `${experienceLabel(caregiver.experienceYears)}.` : null,
    `Atende em ${regionLabel(caregiver.region).replace(' · até ', ', até ').replace(' km', ' quilômetros')}.`,
    ...caregiver.serviceTypes.map((type) => {
      const cents = rateFor(caregiver.rates, type);
      return `${serviceTypeLabel(type)}: ${cents === null ? 'valor sob consulta' : `${formatMoney(cents).replace('R$ ', '')} reais por hora`}.`;
    }),
    `${daysLabel(caregiver.availabilityDays)}, ${periodsLabel(caregiver.availabilityPeriods)}.`,
    caregiver.bio ?? null,
  ];
  return parts.filter(Boolean).join(' ');
}
