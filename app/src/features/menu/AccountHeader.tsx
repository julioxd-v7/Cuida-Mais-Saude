import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Pill } from '@/components/ui';
import { initials } from '@/features/search/format';
import { iconSize, radius, spacing, type AppColors, useStyles, useTheme } from '@/theme';

/** Cabeçalho do menu: avatar, nome, papel, e-mail e situação da conta. Toque abre os dados pessoais. */
export function AccountHeader({
  name,
  email,
  roleLabel,
  status,
  onPress,
}: {
  name: string;
  email: string;
  roleLabel: string;
  status: { label: string; tone: 'success' | 'info' | 'warning' | 'neutral' };
  onPress: () => void;
}) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${roleLabel}. ${status.label}. Abrir dados pessoais`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.avatarRing}>
        <Avatar initials={initials(name)} size={76} />
      </View>
      <View style={styles.text}>
        <AppText variant="subtitle" numberOfLines={2}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted">
          {roleLabel}
        </AppText>
        <View style={styles.emailRow}>
          <Ionicons name="mail-outline" size={iconSize.sm} color={colors.textMuted} />
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {email}
          </AppText>
        </View>
        <View style={styles.footer}>
          <Pill label={status.label} tone={status.tone} icon="checkmark-circle-outline" />
          <View style={styles.cta} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <AppText variant="label" tone="primary">
              Ver perfil
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassStrong,
    },
    pressed: {
      backgroundColor: colors.glassPressed,
    },
    avatarRing: {
      padding: 3,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    text: {
      flex: 1,
      gap: spacing.xxs,
    },
    emailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    cta: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
  });
