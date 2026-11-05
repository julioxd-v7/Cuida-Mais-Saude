import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconSize, radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './MenuItem';

type Option<T extends string> = { value: T; label: string; hint?: string; icon?: IconName };

/** Escolha única em botões lado a lado (ex.: Automático / Claro / Escuro). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  description,
  hideLabel = false,
}: {
  label: string;
  /** Esconde o título visível (o leitor de tela continua lendo). */
  hideLabel?: boolean;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  description?: string;
}) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const id = `seg-${label.replace(/\W+/g, '-')}`;

  return (
    <View style={styles.container}>
      {hideLabel ? null : (
        <AppText variant="label" nativeID={id}>
          {label}
        </AppText>
      )}
      <View
        style={styles.track}
        accessibilityRole="radiogroup"
        accessibilityLabelledBy={hideLabel ? undefined : id}
        accessibilityLabel={hideLabel ? label : undefined}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
              style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && !active && styles.segmentPressed]}
            >
              {option.icon ? (
                <Ionicons name={option.icon} size={iconSize.md} color={active ? colors.selectedText : colors.text} />
              ) : null}
              <AppText variant="label" tone={active ? 'selected' : 'default'} align="center" numberOfLines={1}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {description ? (
        <AppText variant="caption" tone="muted">
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      gap: spacing.sm,
    },
    track: {
      flexDirection: 'row',
      padding: spacing.xs,
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: touchTarget.min,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: colors.selectedBackground,
      shadowColor: colors.brand.green,
      shadowOpacity: 0.45,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    segmentPressed: {
      backgroundColor: colors.glassPressed,
    },
  });
