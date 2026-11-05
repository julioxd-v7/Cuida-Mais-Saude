import type { Period, Profession, ServiceType, Specialty, Weekday } from '@/constants/labels';
import type { ServiceRate } from '@/features/profile/types';

export type PriceRange = { serviceType: ServiceType; minHourlyCents: number; maxHourlyCents: number };

/** Cidade em que o Cuidar+ já atende (GET /v1/service-areas). */
export type ServiceArea = {
  id: string;
  city: string;
  state: string;
  active: boolean;
  priceRanges: PriceRange[];
};

/**
 * O que o cliente vê de um profissional aprovado. Não há CPF, número do
 * conselho, telefone, e-mail, nome completo nem endereço — o servidor nem envia.
 */
export type PublicCaregiver = {
  id: string;
  displayName: string;
  profession: Profession | null;
  verified: boolean;
  council: { name: 'COREN' | 'CREFITO'; state: string | null } | null;
  bio: string | null;
  experienceYears: number | null;
  specialties: Specialty[];
  serviceTypes: ServiceType[];
  rates: ServiceRate[];
  region: { district: string | null; city: string | null; state: string | null; radiusKm: number | null };
  availabilityDays: Weekday[];
  availabilityPeriods: Period[];
  availableNow: boolean;
  favorite: boolean;
  verifiedSince: string | null;
};

export type SearchFilters = {
  serviceType?: ServiceType;
  specialty?: Specialty;
  availableNow?: boolean;
  district?: string;
};
