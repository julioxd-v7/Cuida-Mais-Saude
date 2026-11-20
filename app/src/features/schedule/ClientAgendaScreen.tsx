import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, EmptyState, SegmentedControl } from '@/components/ui';
import { spacing } from '@/theme';

type Tab = 'upcoming' | 'active' | 'history';

const EMPTY: Record<Tab, { title: string; message: string }> = {
  upcoming: { title: 'Nenhum atendimento agendado', message: 'Quando você agendar um atendimento, ele aparece aqui.' },
  active: { title: 'Nenhum atendimento em andamento', message: 'Durante um atendimento, você acompanha tudo por aqui.' },
  history: { title: 'Sem histórico ainda', message: 'Os atendimentos concluídos ficam guardados aqui.' },
};

/**
 * Agenda do cliente. Os pedidos de atendimento ainda não existem no app, então
 * as três listas estão vazias de verdade (nada é simulado).
 */
export default function ClientAgendaScreen() {
  const [tab, setTab] = useState<Tab>('upcoming');
  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Agenda
        </AppText>
        <AppText tone="muted">Seus atendimentos: próximos, em andamento e histórico.</AppText>
      </View>
      <SegmentedControl
        label="Mostrar"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: 'Próximos' },
          { value: 'active', label: 'Agora' },
          { value: 'history', label: 'Histórico' },
        ]}
      />
      <EmptyState title={EMPTY[tab].title} message={`${EMPTY[tab].message} Os pedidos serão liberados na próxima atualização do app.`} />
      <Button label="Buscar profissionais" variant="secondary" onPress={() => router.push('/client/search')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
});
