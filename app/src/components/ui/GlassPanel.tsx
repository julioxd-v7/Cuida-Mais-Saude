import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useGlassTarget } from '@/components/layout/Backdrop';
import { glass, radius, spacing, type AppColors, useStyles, useTheme } from '@/theme';

export type GlassPanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Mais opaco (para painéis com muito texto). */
  strong?: boolean;
  padding?: number;
};

/**
 * Painel de vidro (glassmorphism): desfoque do fundo + camada translúcida
 * + borda clara. É a superfície padrão do app (cards, formulários, barras).
 *
 * Android 12+ desfoca de verdade; versões anteriores mostram a camada
 * translúcida sem desfoque (continua legível).
 */
export function GlassPanel({ children, style, strong = false, padding = spacing.lg }: GlassPanelProps) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const target = useGlassTarget();

  return (
    <View style={[styles.panel, style]}>
      <BlurView
        blurTarget={target ?? undefined}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={glass.blurIntensity}
        tint={colors.blurTint}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: strong ? colors.glassStrong : colors.glass }]} />
      <View style={[styles.content, { padding }]}>{children}</View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  panel: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  content: {
    gap: spacing.sm,
  },
});
