import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import type { IconName } from '@/components/ui/MenuItem';
import { iconSize, radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

/** Logo horizontal pequeno, na versão certa para o tema. */
function HeaderLogo() {
  const { scheme } = useTheme();
  const styles = useStyles(createStyles);
  const source =
    scheme === 'dark'
      ? require('@/assets/images/logo-horizontal-light.png')
      : require('@/assets/images/logo-horizontal-dark.png');
  return (
    <Image source={source} style={styles.logo} resizeMode="contain" accessibilityRole="image" accessibilityLabel="Cuidar+" />
  );
}

/** Botão redondo do cabeçalho (voltar, notificações, configurações). */
export function HeaderIconButton({
  icon,
  label,
  onPress,
  bordered = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  bordered?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, bordered && styles.iconButtonBordered, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={iconSize.lg} color={colors.text} />
    </Pressable>
  );
}

/**
 * Cabeçalho das telas principais, como nas telas de referência:
 * - "brand": logo à esquerda e ações à direita;
 * - "centered": botão de voltar (só quando há para onde voltar) e logo no meio.
 */
export function AppHeader({ variant = 'brand', actions }: { variant?: 'brand' | 'centered'; actions?: ReactNode }) {
  const styles = useStyles(createStyles);

  if (variant === 'centered') {
    const canGoBack = router.canGoBack();
    return (
      <View style={styles.row}>
        <View style={styles.side}>
          {canGoBack ? <HeaderIconButton icon="chevron-back" label="Voltar" onPress={() => router.back()} bordered /> : null}
        </View>
        <HeaderLogo />
        <View style={[styles.side, styles.sideEnd]}>{actions}</View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <HeaderLogo />
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      minHeight: touchTarget.min,
    },
    logo: {
      height: 36,
      width: 136,
    },
    side: {
      width: touchTarget.min,
    },
    sideEnd: {
      alignItems: 'flex-end',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconButton: {
      width: touchTarget.min,
      height: touchTarget.min,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconButtonBordered: {
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    pressed: {
      backgroundColor: colors.glassPressed,
    },
  });
