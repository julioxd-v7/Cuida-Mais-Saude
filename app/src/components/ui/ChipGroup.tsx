import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { iconSize, radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './MenuItem';

type Option<T extends string> = { value: T; label: string; icon?: IconName };

export type ChipGroupProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
  /** single = escolhe um; multiple = vários. */
  mode?: 'single' | 'multiple';
  required?: boolean;
  error?: string;
  hint?: string;
  /** Ícone ao lado do título do grupo. */
  icon?: IconName;
};

/** Opções em "pílulas" para escolha única ou múltipla. */
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  mode = 'multiple',
  required,
  error,
  hint,
  icon,
}: ChipGroupProps<T>) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  function toggle(value: T) {
    if (mode === 'single') {
      onChange([value]);
      return;
    }
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <View style={styles.container} accessibilityRole={mode === 'single' ? 'radiogroup' : undefined}>
      <View style={styles.titleRow}>
        {icon ? <Ionicons name={icon} size={iconSize.lg} color={colors.accent} /> : null}
        <AppText variant={icon ? 'subtitle' : 'label'}>
          {label}
          {required ? <AppText variant="label" tone="primary"> *</AppText> : null}
        </AppText>
      </View>
      {hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
      <View style={styles.chips}>
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggle(option.value)}
              accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
              accessibilityState={mode === 'single' ? { selected: active } : { checked: active }}
              accessibilityLabel={option.label}
              style={[styles.chip, active && styles.chipActive, Boolean(error) && !active && styles.chipError]}
            >
              {option.icon ? (
                <Ionicons name={option.icon} size={iconSize.md} color={active ? colors.selectedText : colors.accent} />
              ) : null}
              <AppText variant="label" tone={active ? 'selected' : 'default'}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    minHeight: touchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  chipActive: {
    backgroundColor: colors.selectedBackground,
    borderColor: colors.selectedBackground,
    shadowColor: colors.brand.green,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  chipError: {
    borderColor: colors.dangerBorder,
  },
});
