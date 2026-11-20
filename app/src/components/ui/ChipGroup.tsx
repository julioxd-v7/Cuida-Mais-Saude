import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, touchTarget, type AppColors, useStyles } from '@/theme';

import { AppText } from './AppText';

type Option<T extends string> = { value: T; label: string };

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
}: ChipGroupProps<T>) {
  const styles = useStyles(createStyles);
  function toggle(value: T) {
    if (mode === 'single') {
      onChange([value]);
      return;
    }
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <View style={styles.container} accessibilityRole={mode === 'single' ? 'radiogroup' : undefined}>
      <AppText variant="label">
        {label}
        {required ? <AppText variant="label" tone="primary"> *</AppText> : null}
      </AppText>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    minHeight: touchTarget.min - 4,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  chipActive: {
    backgroundColor: colors.selectedBackground,
    borderColor: colors.selectedBackground,
  },
  chipError: {
    borderColor: colors.dangerBorder,
  },
});
