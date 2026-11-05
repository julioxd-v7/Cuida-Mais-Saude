import { StyleSheet, View } from 'react-native';

import { radius, spacing, type AppColors, useStyles, useTheme } from '@/theme';

import { AppText } from './AppText';
import { ReadAloudButton } from './ReadAloudButton';

type Kind = 'error' | 'success' | 'warning' | 'info';

function kindStyle(colors: AppColors, kind: Kind): { background: string; border: string; tone: 'danger' | 'success' | 'warning' | 'info' } {
  switch (kind) {
    case 'error':
      return { background: colors.dangerSoft, border: colors.dangerBorder, tone: 'danger' };
    case 'success':
      return { background: colors.successSoft, border: colors.primary, tone: 'success' };
    case 'warning':
      return { background: colors.warningSoft, border: colors.warning, tone: 'warning' };
    default:
      return { background: colors.infoSoft, border: colors.brand.blue, tone: 'info' };
  }
}

export type FeedbackMessageProps = {
  kind: Kind;
  title?: string;
  message: string;
};

/**
 * Mensagem de erro, sucesso, aviso ou informação.
 * Não depende só da cor: o tipo também aparece no texto e é anunciado
 * pelo leitor de tela.
 */
export function FeedbackMessage({ kind, title, message }: FeedbackMessageProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const style = kindStyle(colors, kind);

  return (
    <View
      accessibilityRole={kind === 'error' ? 'alert' : 'summary'}
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: style.background, borderLeftColor: style.border }]}
    >
      {title ? (
        <AppText variant="bodyStrong" tone={style.tone}>
          {title}
        </AppText>
      ) : null}
      <AppText variant="body">{message}</AppText>
      <ReadAloudButton text={title ? `${title}. ${message}` : message} />
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.xxs,
  },
});
