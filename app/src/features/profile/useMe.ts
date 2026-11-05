import { useCallback, useEffect, useState } from 'react';

import { getUserMessage, reportError } from '@/services/errors';
import { useAuth } from '@/providers/AuthProvider';

import { profileService } from './profileService';
import type { MeResponse } from './types';

/**
 * Carrega "minha conta" do servidor. Os dados ficam só em memória e são
 * descartados quando a sessão muda (outra conta não vê dados da anterior).
 */
export function useMe() {
  const { state, updateUser } = useAuth();
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const me = await profileService.getMe();
      setData(me);
      updateUser(me.user);
    } catch (err) {
      setError(getUserMessage(reportError(err, { action: 'me.load' })));
    } finally {
      setLoading(false);
    }
    // updateUser é estável o bastante para este uso; recarrega só quando a conta muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);

  return { data, setData, error, loading, reload };
}
