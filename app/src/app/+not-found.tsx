import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui';
import { spacing, touchTarget, type AppColors, useStyles } from '@/theme';

export default function NotFoundScreen() {
  const styles = useStyles(createStyles);
  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Página não encontrada
      </AppText>
      <AppText tone="muted">O endereço que você abriu não existe no aplicativo.</AppText>
      <Link href="/" style={styles.link}>
        Voltar ao início
      </Link>
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  link: {
    minHeight: touchTarget.min,
    paddingVertical: spacing.md,
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
});
