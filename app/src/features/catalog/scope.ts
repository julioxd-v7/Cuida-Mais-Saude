import type { ServiceCategory } from './types';

/** Regras de exibição do catálogo (sem React, testáveis). */

/** Fichas das categorias pedidas, na ordem do catálogo; ignora códigos que o servidor não listou. */
export function categoriesFor(catalog: readonly ServiceCategory[], codes: readonly string[]): ServiceCategory[] {
  return catalog.filter((category) => codes.includes(category.code));
}

/** "2 a 12 horas por atendimento", "mínimo de 2 horas" ou null. */
export function durationLabel(category: Pick<ServiceCategory, 'minHours' | 'maxHours'>): string | null {
  const { minHours, maxHours } = category;
  if (minHours && maxHours) return `${minHours} a ${maxHours} horas por atendimento`;
  if (minHours) return `mínimo de ${minHours} ${minHours === 1 ? 'hora' : 'horas'}`;
  if (maxHours) return `até ${maxHours} ${maxHours === 1 ? 'hora' : 'horas'}`;
  return null;
}

/** Texto único para ler em voz alta o que está e o que não está incluído. */
export function scopeSpeech(category: ServiceCategory): string {
  const parts = [`${category.name}.`];
  if (category.includes.length) parts.push(`Inclui: ${category.includes.join('; ')}.`);
  if (category.excludes.length) parts.push(`Não inclui: ${category.excludes.join('; ')}.`);
  return parts.join(' ');
}
