import { api } from '@/services/api';

import type { PublicCaregiver, SearchFilters, ServiceArea } from './types';

/** Busca de profissionais (backend/src/modules/caregivers e areas). */
export const searchService = {
  async areas(): Promise<ServiceArea[]> {
    const response = await api.get<{ areas: ServiceArea[] }>('/v1/service-areas', { auth: false });
    return response.areas;
  },

  async search(area: Pick<ServiceArea, 'city' | 'state'>, filters: SearchFilters = {}): Promise<PublicCaregiver[]> {
    const response = await api.get<{ caregivers: PublicCaregiver[] }>(`/v1/caregivers?${buildSearchQuery(area, filters)}`);
    return response.caregivers;
  },

  async detail(id: string): Promise<PublicCaregiver> {
    const response = await api.get<{ caregiver: PublicCaregiver }>(`/v1/caregivers/${encodeURIComponent(id)}`);
    return response.caregiver;
  },

  async favorites(): Promise<PublicCaregiver[]> {
    const response = await api.get<{ caregivers: PublicCaregiver[] }>('/v1/favorites');
    return response.caregivers;
  },

  setFavorite: (id: string, favorite: boolean) =>
    favorite
      ? api.post<{ favorite: boolean }>(`/v1/favorites/${encodeURIComponent(id)}`)
      : api.delete<{ favorite: boolean }>(`/v1/favorites/${encodeURIComponent(id)}`),
};

/**
 * Monta a query da busca só com os filtros escolhidos.
 * (Sem URLSearchParams: no React Native ele não é completo em todas as versões.)
 */
export function buildSearchQuery(area: Pick<ServiceArea, 'city' | 'state'>, filters: SearchFilters): string {
  const pairs: [string, string][] = [
    ['city', area.city],
    ['state', area.state],
  ];
  if (filters.serviceType) pairs.push(['serviceType', filters.serviceType]);
  if (filters.specialty) pairs.push(['specialty', filters.specialty]);
  if (filters.availableNow) pairs.push(['availableNow', 'true']);
  if (filters.district?.trim()) pairs.push(['district', filters.district.trim()]);
  return pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
}
