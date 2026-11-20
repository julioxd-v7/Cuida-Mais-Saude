import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

type Tone = 'success' | 'info' | 'warning' | 'neutral';

/** Etiqueta curta de estado (ex.: "Disponível agora"). O texto sempre diz o estado; a cor só reforça. */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const map = {
    success: { bg: colors.successSoft, text: 'success' as const },
    info: { bg: colors.infoSoft, text: 'info' as const },
    warning: { bg: colors.warningSoft, text: 'warning' as const },
    neutral: { bg: colors.glassPressed, text: 'default' as const },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg }]}>
      <AppText variant="caption" tone={map.text} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  text: {
    fontWeight: '600',
  },
});
