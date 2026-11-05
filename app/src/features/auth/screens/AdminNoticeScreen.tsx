import { Screen } from '@/components/layout/Screen';
import { AppText, Button, FeedbackMessage } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';

/** Contas administrativas usam o painel web, não o app. */
export default function AdminNoticeScreen() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Conta administrativa
      </AppText>
      <FeedbackMessage
        kind="info"
        message="Contas de administrador são usadas no painel web do Cuidar+, que ainda está em desenvolvimento."
      />
      <Button label="Sair" onPress={() => void signOut()} />
    </Screen>
  );
}
