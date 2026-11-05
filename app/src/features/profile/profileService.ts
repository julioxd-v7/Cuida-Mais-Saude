import { api } from '@/services/api';

import type { AddressInput } from '@/features/recipients/types';

import type { CaregiverProfile, CaregiverProfileInput, MeResponse, ServiceRate } from './types';

/** "Minha conta" (backend/src/modules/me/routes.ts). Sempre os dados de quem está logado. */
export const profileService = {
  getMe: () => api.get<MeResponse>('/v1/me'),

  updateBasics: (input: { fullName?: string; phone?: string }) =>
    api.patch<MeResponse>('/v1/me', {
      ...input,
      phone: input.phone === undefined ? undefined : input.phone.replace(/\D/g, ''),
    }),

  updateClientProfile: (input: { contactPreference?: string; address?: AddressInput }) =>
    api.patch<MeResponse>('/v1/me/client-profile', input),

  async updateCaregiverProfile(input: CaregiverProfileInput): Promise<CaregiverProfile> {
    const response = await api.patch<{ caregiverProfile: CaregiverProfile }>('/v1/me/caregiver-profile', input);
    return response.caregiverProfile;
  },

  /** Substitui a lista de valores por hora (o servidor confere a faixa da cidade). */
  async setCaregiverRates(rates: ServiceRate[]): Promise<CaregiverProfile> {
    const response = await api.post<{ caregiverProfile: CaregiverProfile }>('/v1/me/caregiver-profile/rates', { rates });
    return response.caregiverProfile;
  },

  /** Liga/desliga "disponível agora" (atendimento imediato). */
  async setAvailableNow(availableNow: boolean): Promise<CaregiverProfile> {
    const response = await api.post<{ caregiverProfile: CaregiverProfile }>('/v1/me/caregiver-profile/availability', {
      availableNow,
    });
    return response.caregiverProfile;
  },

  async submitCaregiverProfile(): Promise<CaregiverProfile> {
    const response = await api.post<{ caregiverProfile: CaregiverProfile }>('/v1/me/caregiver-profile/submit');
    return response.caregiverProfile;
  },
};
