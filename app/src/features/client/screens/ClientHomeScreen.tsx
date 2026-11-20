import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, GlassPanel } from '@/components/ui';
import {
  EMERGENCY_NOTICE,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_OPTIONS,
  SERVICE_TYPE_SHORT_DESCRIPTIONS,
} from '@/constants/labels';
import { areasLabel, useServiceAreas } from '@/features/search/useServiceAreas';
import { useSignedInUser } from '@/providers/AuthProvider';
import { radius, spacing, type AppColors, useAccessibility, useStyles } from '@/theme';

import { SimpleClientHome } from './SimpleClientHome';

const SHORTCUTS = SERVICE_TYPE_OPTIONS.map((option) => ({
  type: option.value,
  description: SERVICE_TYPE_SHORT_DESCRIPTIONS[option.value],
}));

/** Início do cliente: o que você precisa hoje? */
export default function ClientHomeScreen() {
  const styles = useStyles(createStyles);
  const user = useSignedInUser();
  const { areas } = useServiceAreas();
  const { simpleMode } = useAccessibility();
  if (!user) return null;
  const firstName = user.fullName.split(' ')[0] ?? '';
  if (simpleMode) return <SimpleClientHome firstName={firstName} />;

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Olá, {firstName}
        </AppText>
        <AppText tone="muted">De que tipo de apoio você precisa?</AppText>
      </View>

      <View style={styles.grid}>
        {SHORTCUTS.map((item) => (
          <Pressable
            key={item.type}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            accessibilityRole="button"
            accessibilityLabel={`${SERVICE_TYPE_LABELS[item.type]}. ${item.description}`}
            onPress={() => router.push({ pathname: '/client/search', params: { serviceType: item.type } })}
          >
            <GlassPanel style={styles.tilePanel}>
              <AppText variant="bodyStrong">{SERVICE_TYPE_LABELS[item.type]}</AppText>
              <AppText variant="caption" tone="muted">
                {item.description}
              </AppText>
            </GlassPanel>
          </Pressable>
        ))}
      </View>

      <Card>
        <AppText variant="subtitle">Precisa de alguém agora?</AppText>
        <AppText tone="muted">Veja os profissionais verificados que estão disponíveis neste momento.</AppText>
        <Button
          label="Ver disponíveis agora"
          onPress={() => router.push({ pathname: '/client/search', params: { availableNow: 'true' } })}
        />
      </Card>

      <Button label="Meus favoritos" variant="secondary" onPress={() => router.push('/client/favorites')} />

      <AppText variant="caption" tone="muted" align="center">
        Serviços de apoio e companhia, sem atos de saúde. {EMERGENCY_NOTICE}
      </AppText>

      {areas?.length ? (
        <AppText variant="caption" tone="muted" align="center">
          Por enquanto o Cuidar+ atende em {areasLabel(areas)}. Estamos começando aos poucos para garantir a segurança de
          todos.
        </AppText>
      ) : null}
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    header: {
      gap: spacing.xs,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    tile: {
      flexGrow: 1,
      flexBasis: '45%',
      borderRadius: radius.xl,
    },
    tilePressed: {
      backgroundColor: colors.glassPressed,
    },
    tilePanel: {
      flex: 1,
      minHeight: 120,
    },
  });
