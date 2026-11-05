import { StyleSheet, Text, type TextProps } from 'react-native';

import { useTheme, type AppColors, type TypographyVariant } from '@/theme';

/**
 * Tons de texto, resolvidos pelo tema ativo (claro ou escuro).
 * "onPrimary" é o texto sobre o botão verde; "selected" sobre chips selecionados.
 */
type Tone = 'default' | 'muted' | 'primary' | 'danger' | 'success' | 'warning' | 'info' | 'onPrimary' | 'selected';

function toneColor(colors: AppColors, tone: Tone): string {
  switch (tone) {
    case 'muted':
      return colors.textMuted;
    case 'primary':
      return colors.accent;
    case 'danger':
      return colors.danger;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'info':
      return colors.info;
    case 'onPrimary':
      return colors.textOnPrimary;
    case 'selected':
      return colors.selectedText;
    default:
      return colors.text;
  }
}

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: 'auto' | 'left' | 'center' | 'right';
};

/**
 * Texto padrão do app. Respeita o tamanho de fonte do sistema e o tamanho de
 * texto escolhido em Acessibilidade (Normal, Grande, Muito grande).
 */
export function AppText({ variant = 'body', tone = 'default', align = 'auto', style, ...rest }: AppTextProps) {
  const { colors, typography, maxFontSizeMultiplier } = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[styles.base, typography[variant], { color: toneColor(colors, tone), textAlign: align }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    flexShrink: 1,
  },
});
