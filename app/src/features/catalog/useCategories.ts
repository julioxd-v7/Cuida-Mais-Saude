import { useCallback, useEffect, useState } from 'react';

import { getUserMessage, reportError } from '@/services/errors';

import { categoryService } from './categoryService';
import type { ServiceCategory } from './types';

let cache: ServiceCategory[] | null = null;

/** Catálogo de categorias ativas (guardado em memória enquanto o app está aberto). */
export function useCategories() {
  const [categories, setCategories] = useState<ServiceCategory[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      cache = await categoryService.list();
      setCategories(cache);
    } catch (err) {
      setError(getUserMessage(reportError(err, { action: 'catalog.categories' })));
    }
  }, []);

  useEffect(() => {
    if (!cache) void load();
  }, [load]);

  return { categories, error, reload: load };
}
