import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { type AppColors, useStyles, useTheme } from '@/theme';

import type { IconName } from './MenuItem';

/** Ícone num quadrado arredondado (cards, menus e títulos). Decorativo. */
export function IconBox({
  icon,
  size = 44,
  tone = 'accent',
}: {
  icon: IconName;
  size?: number;
  tone?: 'accent' | 'info' | 'danger' | 'muted';
}) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const map = {
    accent: { bg: colors.successSoft, fg: colors.accent },
    info: { bg: colors.infoSoft, fg: colors.info },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    muted: { bg: colors.glassPressed, fg: colors.textDisabled },
  }[tone];
  return (
    <View
      style={[styles.box, { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: map.bg }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={icon} size={Math.round(size * 0.52)} color={map.fg} />
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    box: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
  });
