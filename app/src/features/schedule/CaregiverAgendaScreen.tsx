import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, Pill } from '@/components/ui';
import { WEEKDAY_OPTIONS } from '@/constants/labels';
import { useMe } from '@/features/profile/useMe';
import { periodsLabel } from '@/features/search/format';
import { radius, spacing, type AppColors, useStyles } from '@/theme';

/**
 * Agenda do profissional: a disponibilidade semanal que os clientes veem
 * (dados reais do perfil) e, quando os pedidos forem liberados, os atendimentos.
 */
export default function CaregiverAgendaScreen() {
  const styles = useStyles(createStyles);
  const { data, error, loading, reload } = useMe();
  const first = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void reload();
    }, [reload]),
  );

  if (loading && !data) return <Screen scroll={false}><LoadingState /></Screen>;
  if (error && !data) return <Screen scroll={false}><ErrorState message={error} onAction={reload} /></Screen>;
  const profile = data?.caregiverProfile;
  if (!profile) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Minha agenda
        </AppText>
        <AppText tone="muted">Sua disponibilidade e seus atendimentos.</AppText>
      </View>

      <Card>
        <View style={styles.titleRow}>
          <AppText variant="subtitle">Disponibilidade semanal</AppText>
          {profile.availableNow ? <Pill label="Disponível agora" tone="success" /> : null}
        </View>
        <View style={styles.week} accessibilityLabel={`Dias: ${WEEKDAY_OPTIONS.filter((d) => profile.availabilityDays.includes(d.value)).map((d) => d.label).join(', ') || 'nenhum'}`}>
          {WEEKDAY_OPTIONS.map((day) => {
            const on = profile.availabilityDays.includes(day.value);
            return (
              <View key={day.value} style={[styles.day, on && styles.dayOn]}>
                <AppText variant="label" tone={on ? 'selected' : 'muted'}>
                  {day.label}
                </AppText>
              </View>
            );
          })}
        </View>
        <AppText tone="muted">Períodos: {periodsLabel(profile.availabilityPeriods)}</AppText>
        <Button
          label="Editar disponibilidade"
          variant="secondary"
          onPress={() => router.push('/caregiver/professional-profile')}
        />
      </Card>

      <AppText variant="subtitle">Próximos atendimentos</AppText>
      <EmptyState
        title="Nenhum atendimento agendado"
        message={
          profile.verified
            ? 'As solicitações de clientes serão liberadas na próxima atualização do app. Elas aparecerão aqui.'
            : 'Depois da aprovação do seu perfil, as solicitações aceitas aparecerão aqui.'
        }
      />
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    header: {
      gap: spacing.xs,
    },
    titleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    week: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    day: {
      minWidth: 40,
      minHeight: 40,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayOn: {
      backgroundColor: colors.selectedBackground,
      borderColor: colors.selectedBackground,
    },
  });
