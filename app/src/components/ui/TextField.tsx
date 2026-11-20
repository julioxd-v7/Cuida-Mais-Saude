import { useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

import { AppText } from './AppText';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Mostra o asterisco e informa "obrigatório" ao leitor de tela. */
  required?: boolean;
  /** Elemento à direita dentro do campo (ex.: botão de mostrar senha). */
  trailing?: ReactNode;
  ref?: Ref<TextInput>;
};

/**
 * Campo de texto com rótulo visível, indicação de obrigatório, dica e erro
 * logo abaixo do campo. O rótulo fica sempre visível (placeholder sozinho
 * some ao digitar e prejudica a acessibilidade).
 */
export function TextField({ label, error, hint, required, trailing, onFocus, onBlur, style, ref, multiline, ...rest }: TextFieldProps) {
  const { colors, typography, maxFontSizeMultiplier } = useTheme();
  const styles = useStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.dangerBorder : focused ? colors.focus : colors.inputBorder;
  const a11yLabel = required ? `${label}, obrigatório` : label;

  return (
    <View style={styles.container}>
      <AppText variant="label" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
        {required ? <AppText variant="label" tone="primary"> *</AppText> : null}
      </AppText>

      <View style={[styles.box, { borderColor }, multiline && styles.boxMultiline]}>
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
  box: {
    minHeight: touchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
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
