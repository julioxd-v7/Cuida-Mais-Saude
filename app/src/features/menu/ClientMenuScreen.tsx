import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, MenuItem, MenuSection } from '@/components/ui';
import { useAuth, useSignedInUser } from '@/providers/AuthProvider';
import { spacing } from '@/theme';

import { AccountHeader } from './AccountHeader';
import { useSignOut } from './useSignOut';

/**
 * Menu do cliente (aba Perfil). Cada item leva a um recurso que existe;
 * o que ainda não existe aparece como "Em breve", sem toque.
 */
export default function ClientMenuScreen() {
  const user = useSignedInUser();
  const { state } = useAuth();
  const signOut = useSignOut();
  if (!user || state.status !== 'signedIn') return null;

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Perfil
      </AppText>

      <AccountHeader
        name={user.fullName}
        email={user.email}
        roleLabel="Cliente"
        status={{ label: 'Conta ativa', tone: 'success' }}
        onPress={() => router.push('/settings/personal')}
      />

      {/* Contexto: próximo atendimento (ainda não há pedidos no app). */}
      <Card>
        <AppText variant="label" tone="muted">
          PRÓXIMO ATENDIMENTO
        </AppText>
        <AppText variant="bodyStrong">Nenhum atendimento agendado</AppText>
        <AppText variant="caption" tone="muted">
          Os pedidos de atendimento chegam na próxima atualização. Enquanto isso, conheça os profissionais verificados.
        </AppText>
        <Button label="Buscar profissionais" variant="secondary" onPress={() => router.push('/client/search')} />
      </Card>

      <MenuSection title="Cuidado">
        <MenuItem
          icon="calendar-outline"
          title="Meus atendimentos"
          subtitle="Próximos, em andamento e histórico"
          onPress={() => router.push('/client/agenda')}
        />
        <MenuItem
          icon="people-outline"
          title="Beneficiários"
          subtitle="Pessoas que recebem o cuidado"
          onPress={() => router.push('/client/recipients')}
        />
        <MenuItem icon="location-outline" title="Endereços salvos" onPress={() => router.push('/client/addresses')} />
        <MenuItem icon="heart-outline" title="Cuidadores favoritos" onPress={() => router.push('/client/favorites')} />
      </MenuSection>

      <MenuSection title="Pagamentos">
        <MenuItem icon="card-outline" title="Pagamentos e métodos de pagamento" soon />
        <MenuItem icon="receipt-outline" title="Recibos" soon />
      </MenuSection>

      <MenuSection title="Comunicação">
        <MenuItem icon="chatbubbles-outline" title="Mensagens" onPress={() => router.push('/client/messages')} />
        <MenuItem icon="notifications-outline" title="Notificações" soon />
      </MenuSection>

      <MenuSection title="Ajuda">
        <MenuItem
          icon="shield-checkmark-outline"
          title="Segurança e suporte"
          subtitle="Suporte, denúncias, incidentes e emergência"
          onPress={() => router.push('/support')}
        />
        <MenuItem icon="settings-outline" title="Configurações" onPress={() => router.push('/settings')} />
      </MenuSection>

      <View style={styles.signOut}>
        <MenuSection>
          <MenuItem icon="log-out-outline" title="Sair da conta" tone="danger" onPress={signOut.run} />
        </MenuSection>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  signOut: {
    marginBottom: spacing.lg,
  },
});
