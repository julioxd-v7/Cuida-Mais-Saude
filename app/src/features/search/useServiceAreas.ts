import { useCallback, useEffect, useState } from 'react';

import { getUserMessage, reportError } from '@/services/errors';

import { searchService } from './searchService';
import type { ServiceArea } from './types';

let cache: ServiceArea[] | null = null;

/** Cidades atendidas e faixas de preço (guardadas em memória enquanto o app está aberto). */
export function useServiceAreas() {
  const [areas, setAreas] = useState<ServiceArea[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      cache = await searchService.areas();
      setAreas(cache);
    } catch (err) {
      setError(getUserMessage(reportError(err, { action: 'areas.list' })));
    }
  }, []);

  useEffect(() => {
    if (!cache) void load();
  }, [load]);

  return { areas, error, reload: load };
}

/** "São Paulo - SP" ou "São Paulo - SP e Campinas - SP". */
export function areasLabel(areas: readonly ServiceArea[]): string {
  return areas.map((area) => `${area.city} - ${area.state}`).join(', ');
}
