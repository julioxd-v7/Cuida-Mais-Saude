import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconSize, radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

import { AppText } from './AppText';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type BaseProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Conteúdo à direita (ex.: interruptor, contador). */
  trailing?: ReactNode;
  tone?: 'default' | 'danger';
};

/**
 * Linha do menu. Duas formas, e nenhuma "finge" funcionar:
 * - com onPress: botão que abre um recurso real;
 * - com soon: item informativo "Em breve", sem toque (não é botão).
 */
export type MenuItemProps = BaseProps & ({ onPress: () => void; soon?: never } | { soon: true; onPress?: never } | { onPress?: never; soon?: never });

export function MenuItem({ icon, title, subtitle, trailing, tone = 'default', onPress, soon }: MenuItemProps) {
  const styles = useStyles(createStyles);
  const { colors, typography } = useTheme();
  const iconColor = tone === 'danger' ? colors.danger : soon ? colors.textDisabled : colors.accent;

  const content = (
    <>
      <View style={[styles.iconBox, soon && styles.iconBoxSoon]}>
        <Ionicons name={icon} size={Math.round(iconSize.md * (typography.body.fontSize / 16))} color={iconColor} />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" tone={tone === 'danger' ? 'danger' : soon ? 'muted' : 'default'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {soon ? (
        <View style={styles.soon}>
          <AppText variant="caption" tone="muted">
            Em breve
          </AppText>
        </View>
      ) : null}
      {trailing}
      {onPress && !trailing ? <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ''}${soon ? '. Em breve, ainda indisponível' : ''}`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** Grupo de itens com título, num card discreto. */
export function MenuSection({ title, children }: { title?: string; children: ReactNode }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.section}>
      {title ? (
        <AppText variant="label" tone="muted" accessibilityRole="header" style={styles.sectionTitle}>
          {title.toUpperCase()}
        </AppText>
      ) : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      letterSpacing: 0.6,
      paddingHorizontal: spacing.xs,
    },
    card: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassStrong,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: touchTarget.min + spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    pressed: {
      backgroundColor: colors.glassPressed,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successSoft,
    },
    iconBoxSoon: {
      backgroundColor: colors.glassPressed,
    },
    text: {
      flex: 1,
      gap: spacing.xxs,
    },
    soon: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
