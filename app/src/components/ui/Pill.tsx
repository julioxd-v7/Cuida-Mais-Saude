import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './MenuItem';

type Tone = 'success' | 'info' | 'warning' | 'neutral';

/** Etiqueta curta de estado (ex.: "Disponível agora"). O texto sempre diz o estado; a cor só reforça. */
export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const { colors } = useTheme();
  const map = {
    success: { bg: colors.successSoft, text: 'success' as const, fg: colors.success },
    info: { bg: colors.infoSoft, text: 'info' as const, fg: colors.info },
    warning: { bg: colors.warningSoft, text: 'warning' as const, fg: colors.warning },
    neutral: { bg: colors.glassPressed, text: 'default' as const, fg: colors.text },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg }]}>
      {icon ? <Ionicons name={icon} size={14} color={map.fg} /> : null}
      <AppText variant="caption" tone={map.text} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  text: {
    fontWeight: '600',
  },
});
