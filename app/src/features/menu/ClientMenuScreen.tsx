import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader, HeaderIconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText, IconBox, MenuItem, MenuSection } from '@/components/ui';
import { useAuth, useSignedInUser } from '@/providers/AuthProvider';
import { iconSize, radius, spacing, type AppColors, useStyles, useTheme } from '@/theme';

import { AccountHeader } from './AccountHeader';
import { useSignOut } from './useSignOut';

/**
 * Menu do cliente (aba Perfil). Cada item leva a um recurso que existe;
 * o que ainda não existe aparece como "Em breve", sem toque.
 */
export default function ClientMenuScreen() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const user = useSignedInUser();
  const { state } = useAuth();
  const signOut = useSignOut();
  if (!user || state.status !== 'signedIn') return null;

  return (
    <Screen>
      <AppHeader
        actions={<HeaderIconButton icon="settings-outline" label="Configurações" onPress={() => router.push('/settings')} />}
      />
      <AppText variant="title" accessibilityRole="header" style={styles.srTitle}>
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
      <Pressable
        onPress={() => router.push('/client/agenda')}
        accessibilityRole="button"
        accessibilityLabel="Próximo atendimento: nenhum atendimento agendado. Abrir agenda"
        style={({ pressed }) => [styles.next, pressed && styles.pressed]}
      >
        <IconBox icon="calendar-outline" size={56} />
        <View style={styles.flex}>
          <AppText variant="caption" tone="info" style={styles.eyebrow}>
            PRÓXIMO ATENDIMENTO
          </AppText>
          <AppText variant="bodyStrong">Nenhum atendimento agendado</AppText>
          <AppText variant="caption" tone="muted">
            Agende um cuidado quando precisar.
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={iconSize.md} color={colors.textMuted} />
      </Pressable>

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
        <MenuItem
          icon="location-outline"
          title="Endereços salvos"
          subtitle="Casa, familiares e locais frequentes"
          onPress={() => router.push('/client/addresses')}
        />
        <MenuItem
          icon="heart-outline"
          title="Cuidadores favoritos"
          subtitle="Profissionais que você salvou"
          onPress={() => router.push('/client/favorites')}
        />
      </MenuSection>

      <MenuSection title="Pagamentos">
        <MenuItem icon="card-outline" title="Pagamentos e métodos" subtitle="Cartões, recibos e transações" soon />
        <MenuItem icon="receipt-outline" title="Recibos" subtitle="Comprovantes e histórico de pagamentos" soon />
      </MenuSection>

      <MenuSection title="Comunicação">
        <MenuItem
          icon="chatbubble-ellipses-outline"
          title="Mensagens"
          subtitle="Conversas com cuidadores"
          onPress={() => router.push('/client/messages')}
        />
        <MenuItem icon="notifications-outline" title="Notificações" subtitle="Atualizações dos atendimentos" soon />
      </MenuSection>

      <MenuSection title="Ajuda">
        <MenuItem
          icon="shield-checkmark-outline"
          title="Segurança e suporte"
          subtitle="Ajuda, denúncias e incidentes"
          onPress={() => router.push('/support')}
        />
        <MenuItem
          icon="settings-outline"
          title="Configurações"
          subtitle="Tema, privacidade e preferências"
          onPress={() => router.push('/settings')}
        />
      </MenuSection>

      <View style={styles.signOut}>
        <MenuSection>
          <MenuItem icon="log-out-outline" title="Sair da conta" tone="danger" onPress={signOut.run} />
        </MenuSection>
      </View>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    // O título "Perfil" fica para o leitor de tela; o visual segue a referência (sem título grande).
    srTitle: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },
    next: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    pressed: {
      backgroundColor: colors.glassPressed,
    },
    eyebrow: {
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    signOut: {
      marginBottom: spacing.lg,
    },
  });
