import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText, Button, EmptyState, IconBox, SegmentedControl, type IconName } from '@/components/ui';
import { spacing } from '@/theme';

type Tab = 'upcoming' | 'active' | 'history';

const EMPTY: Record<Tab, { title: string; message: string; icon: IconName }> = {
  upcoming: {
    title: 'Nenhum atendimento agendado',
    message: 'Quando você agendar um atendimento, ele aparecerá aqui.',
    icon: 'calendar',
  },
  active: {
    title: 'Nenhum atendimento em andamento',
    message: 'Durante um atendimento, você acompanha tudo por aqui.',
    icon: 'play-circle',
  },
  history: { title: 'Sem histórico ainda', message: 'Os atendimentos concluídos ficam guardados aqui.', icon: 'time' },
};

/**
 * Agenda do cliente. Os pedidos de atendimento ainda não existem no app, então
 * as três listas estão vazias de verdade (nada é simulado).
 */
export default function ClientAgendaScreen() {
  const [tab, setTab] = useState<Tab>('upcoming');
  return (
    <Screen>
      <AppHeader variant="centered" />
      <View style={styles.titleRow}>
        <IconBox icon="calendar-outline" size={64} />
        <AppText variant="display" accessibilityRole="header">
          Agenda
        </AppText>
      </View>
      <AppText tone="muted">Seus atendimentos: próximos, em andamento e histórico.</AppText>
      <SegmentedControl
        label="Mostrar atendimentos"
        hideLabel
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: 'Próximos', icon: 'calendar-outline' },
          { value: 'active', label: 'Agora', icon: 'play-outline' },
          { value: 'history', label: 'Histórico', icon: 'time-outline' },
        ]}
      />
      <EmptyState
        icon={EMPTY[tab].icon}
        title={EMPTY[tab].title}
        message={`${EMPTY[tab].message} Os pedidos serão liberados na próxima atualização do app.`}
      />
      <Button
        label="Buscar profissionais"
        variant="secondary"
        icon="search-outline"
        onPress={() => router.push('/client/search')}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  cta: {
    marginBottom: spacing.lg,
  },
});
