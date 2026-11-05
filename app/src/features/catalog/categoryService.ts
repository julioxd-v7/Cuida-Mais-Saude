import { api } from '@/services/api';

import type { ServiceCategory } from './types';

export const categoryService = {
  async list(): Promise<ServiceCategory[]> {
    const response = await api.get<{ categories: ServiceCategory[] }>('/v1/catalog/categories', { auth: false });
    return response.categories;
  },
};
