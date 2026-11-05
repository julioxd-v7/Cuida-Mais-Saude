import { useState } from 'react';

import { useAuth } from '@/providers/AuthProvider';

/** Sair da conta (revoga no servidor e limpa o aparelho). */
export function useSignOut() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: () => {
      if (busy) return;
      setBusy(true);
      void signOut().finally(() => setBusy(false));
    },
  };
}
