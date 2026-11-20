import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { interaction, radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Botão padrão. Evoluído a partir do Button original da tela de login:
 * agora tem variantes, estado de carregamento, estado desabilitado,
 * alvo de toque mínimo de 48 e rótulos de acessibilidade.
 */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const variantStyles = useStyles(createVariantStyles);
  const pressedStyles = useStyles(createPressedStyles);
  const isDisabled = Boolean(disabled) || loading;
  const textTone = variant === 'primary' ? 'onPrimary' : 'default';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && pressedStyles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.textOnPrimary : colors.text}
          accessibilityLabel="Carregando"
        />
      ) : (
        <AppText variant="bodyStrong" tone={textTone} numberOfLines={2} align="center">
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: interaction.disabledOpacity,
  },
});

const createVariantStyles = (colors: AppColors) => StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  // Botão de vidro com borda clara.
  secondary: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});

const createPressedStyles = (colors: AppColors) => StyleSheet.create({
  primary: {
    backgroundColor: colors.primaryPressed,
  },
  secondary: {
    backgroundColor: colors.glassPressed,
  },
  ghost: {
    backgroundColor: colors.glass,
  },
});
