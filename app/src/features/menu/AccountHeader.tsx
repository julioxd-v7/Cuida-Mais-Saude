import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, Pill } from '@/components/ui';
import { initials } from '@/features/search/format';
import { radius, spacing, type AppColors, useStyles } from '@/theme';

/** Cabeçalho do menu: avatar, nome, e-mail e situação da conta. Toque abre os dados pessoais. */
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${roleLabel}. ${status.label}. Abrir dados pessoais`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Avatar initials={initials(name)} size={64} />
      <View style={styles.text}>
        <AppText variant="subtitle" numberOfLines={2}>
          {name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {roleLabel} · {email}
        </AppText>
        <Pill label={status.label} tone={status.tone} />
      </View>
      <AppText variant="label" tone="primary" accessibilityElementsHidden>
        Ver perfil
      </AppText>
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassStrong,
    },
    pressed: {
      backgroundColor: colors.glassPressed,
    },
    text: {
      flex: 1,
      gap: spacing.xs,
    },
  });
