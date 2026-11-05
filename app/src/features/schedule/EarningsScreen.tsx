import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, MenuItem, MenuSection } from '@/components/ui';
import { serviceTypeLabel } from '@/constants/labels';
import { useMe } from '@/features/profile/useMe';
import { formatMoney } from '@/features/search/format';
import { spacing } from '@/theme';

/**
 * Ganhos do profissional. Sem pagamentos no app ainda, não há extrato nem
 * repasses: a tela mostra só o que é real (seus valores por hora).
 */
export default function EarningsScreen() {
  const { data, error, loading, reload } = useMe();
  if (loading && !data) return <Screen scroll={false}><LoadingState /></Screen>;
  if (error && !data) return <Screen scroll={false}><ErrorState message={error} onAction={reload} /></Screen>;
  const profile = data?.caregiverProfile;
  if (!profile) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Ganhos
        </AppText>
        <AppText tone="muted">Extrato, repasses e seus valores.</AppText>
      </View>

      <Card>
        <AppText variant="subtitle">Seus valores por hora</AppText>
        {profile.rates.length ? (
          profile.rates.map((rate) => (
            <View key={rate.serviceType} style={styles.row}>
              <AppText style={styles.flex}>{serviceTypeLabel(rate.serviceType)}</AppText>
              <AppText variant="bodyStrong">{formatMoney(rate.hourlyRateCents)}/h</AppText>
            </View>
          ))
        ) : (
          <AppText tone="muted">Você ainda não definiu seus valores.</AppText>
        )}
        <Button label="Ajustar valores" variant="secondary" onPress={() => router.push('/caregiver/rates')} />
      </Card>

      <EmptyState
        title="Nenhum ganho ainda"
        message="O extrato começa com os primeiros atendimentos pagos pelo app. Pagamentos e repasses serão liberados nas próximas atualizações."
      />

      <MenuSection title="Financeiro">
        <MenuItem icon="list-outline" title="Extrato" soon />
        <MenuItem icon="swap-horizontal-outline" title="Repasses e conta bancária" soon />
      </MenuSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
});
