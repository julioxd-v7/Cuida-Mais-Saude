import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { iconSize, radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './MenuItem';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Mostra o asterisco e informa "obrigatório" ao leitor de tela. */
  required?: boolean;
  /** Elemento à direita dentro do campo (ex.: botão de mostrar senha). */
  trailing?: ReactNode;
  /** Ícone decorativo à esquerda, dentro do campo. */
  leadingIcon?: IconName;
  /** Ícone ao lado do rótulo. */
  labelIcon?: IconName;
  ref?: Ref<TextInput>;
};

/**
 * Campo de texto com rótulo visível, indicação de obrigatório, dica e erro
 * logo abaixo do campo. O rótulo fica sempre visível (placeholder sozinho
 * some ao digitar e prejudica a acessibilidade).
 */
export function TextField({ label, error, hint, required, trailing, leadingIcon, labelIcon, onFocus, onBlur, style, ref, multiline, ...rest }: TextFieldProps) {
  const { colors, typography, maxFontSizeMultiplier } = useTheme();
  const styles = useStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.dangerBorder : focused ? colors.focus : colors.inputBorder;
  const a11yLabel = required ? `${label}, obrigatório` : label;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {labelIcon ? <Ionicons name={labelIcon} size={iconSize.lg} color={colors.accent} /> : null}
        <AppText variant={labelIcon ? 'subtitle' : 'label'}>
          {label}
          {required ? <AppText variant="label" tone="primary"> *</AppText> : null}
        </AppText>
      </View>

      <View style={[styles.box, { borderColor }, multiline && styles.boxMultiline]}>
        {leadingIcon ? (
          <Ionicons name={leadingIcon} size={iconSize.md} color={colors.textMuted} style={styles.leadingIcon} />
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={a11yLabel}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.placeholder}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { fontSize: typography.body.fontSize }, multiline && styles.inputMultiline, style]}
          {...rest}
        />
        {trailing}
      </View>

      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leadingIcon: {
    marginLeft: spacing.lg,
  },
  box: {
    minHeight: touchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    backgroundColor: colors.inputBackground,
  },
  boxMultiline: {
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.md,
    color: colors.inputText,
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
});
