import { Redirect } from 'expo-router';

import { Screen } from '@/components/layout/Screen';
import { ErrorState } from '@/components/ui';
import { resolveHomeRoute } from '@/features/auth/sessionManager';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Rota inicial: decide para onde cada pessoa vai (login, área do cliente,
 * área do cuidador). Se não deu para confirmar a sessão por falta de
 * conexão, oferece tentar de novo em vez de deslogar.
 */
export default function Index() {
  const { state, retryRestore } = useAuth();

  if (state.status === 'restoreFailed') {
    return (
      <Screen scroll={false}>
        <ErrorState title="Sem conexão" message={state.message} onAction={() => void retryRestore()} />
      </Screen>
    );
  }

  const target = resolveHomeRoute(state);
  return target ? <Redirect href={target} /> : null;
}
