import { StyleSheet, View } from 'react-native';

import { radius, spacing, type AppColors, useStyles } from '@/theme';

import { AppText } from './AppText';

/**
 * Selo de segurança: aparece só para profissionais com perfil e documentos
 * verificados pela equipe (verificationStatus = approved no servidor).
 */
export function VerifiedBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const styles = useStyles(createStyles);
  return (
    <View
      style={[styles.badge, size === 'sm' && styles.small]}
      accessibilityRole="text"
      accessibilityLabel="Profissional verificado pelo Cuidar+"
    >
      <View style={styles.dot}>
        <AppText variant="caption" tone="onPrimary" style={styles.check}>
          ✓
        </AppText>
      </View>
      <AppText variant={size === 'sm' ? 'caption' : 'label'} tone="success">
        Verificado
      </AppText>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  small: {
    paddingVertical: spacing.xxs,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    lineHeight: 16,
  },
});
