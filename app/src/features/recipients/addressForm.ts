import { UF_LIST } from '@/constants/labels';
import type { Address } from '@/features/profile/types';

import type { AddressInput } from './types';

/** Regras do formulário de endereço (sem React, testáveis). */

export type AddressValues = {
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

export const EMPTY_ADDRESS: AddressValues = {
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
};

/** "01310100" -> "01310-100" enquanto digita. */
export function formatPostalCode(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function fromAddress(address: Address | null | undefined): AddressValues {
  if (!address) return EMPTY_ADDRESS;
  return {
    postalCode: address.postalCode ? formatPostalCode(address.postalCode) : '',
    street: address.street ?? '',
    number: address.number ?? '',
    complement: address.complement ?? '',
    district: address.district ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
  };
}

/** Erros por campo. O endereço é opcional, mas o que for preenchido precisa estar certo. */
export function validateAddress(values: AddressValues): Record<string, string> {
  const errors: Record<string, string> = {};
  const cep = values.postalCode.replace(/\D/g, '');
  if (cep && cep.length !== 8) errors.postalCode = 'O CEP tem 8 números.';
  if (values.state && !(UF_LIST as readonly string[]).includes(values.state.toUpperCase())) {
    errors.state = 'Use a sigla do estado, como SP.';
  }
  const filled = Object.values(values).some((value) => value.trim() !== '');
  if (filled) {
    if (!values.street.trim()) errors.street = 'Informe a rua.';
    if (!values.city.trim()) errors.city = 'Informe a cidade.';
    if (!values.state.trim()) errors.state = errors.state ?? 'Informe o estado.';
  }
  return errors;
}

export function toAddressInput(values: AddressValues): AddressInput {
  const text = (value: string) => (value.trim() === '' ? null : value.trim());
  const cep = values.postalCode.replace(/\D/g, '');
  return {
    street: text(values.street),
    number: text(values.number),
    complement: text(values.complement),
    district: text(values.district),
    city: text(values.city),
    state: values.state.trim() ? values.state.trim().toUpperCase() : null,
    postalCode: cep === '' ? null : cep,
  };
}

/** "Rua das Flores, 120 · Moema · São Paulo/SP" ou null se vazio. */
export function addressSummary(address: Address | null | undefined): string | null {
  if (!address?.street && !address?.city) return null;
  const street = [address.street, address.number].filter(Boolean).join(', ');
  const city = [address.city, address.state].filter(Boolean).join('/');
  return [street, address.district, city].filter(Boolean).join(' · ');
}
