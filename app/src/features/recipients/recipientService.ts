import { api } from '@/services/api';

import type { CareRecipient, CareRecipientInput } from './types';

/** Beneficiários do cliente logado (backend/src/modules/recipients/routes.ts). */
export const recipientService = {
  async list(): Promise<CareRecipient[]> {
    const response = await api.get<{ careRecipients: CareRecipient[] }>('/v1/me/care-recipients');
    return response.careRecipients;
  },
  async create(input: CareRecipientInput): Promise<CareRecipient> {
    const response = await api.post<{ careRecipient: CareRecipient }>('/v1/me/care-recipients', input);
    return response.careRecipient;
  },
  async update(id: string, input: Partial<CareRecipientInput>): Promise<CareRecipient> {
    const response = await api.patch<{ careRecipient: CareRecipient }>(`/v1/me/care-recipients/${encodeURIComponent(id)}`, input);
    return response.careRecipient;
  },
  remove: (id: string) => api.delete<void>(`/v1/me/care-recipients/${encodeURIComponent(id)}`),
};
