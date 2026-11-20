import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, touchTarget, type AppColors, useStyles } from '@/theme';

import { AppText } from './AppText';

type Option<T extends string> = { value: T; label: string; hint?: string };

/** Escolha única em botões lado a lado (ex.: Automático / Claro / Escuro). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  description,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  description?: string;
}) {
  const styles = useStyles(createStyles);
  const id = `seg-${label.replace(/\W+/g, '-')}`;

  return (
    <View style={styles.container}>
      <AppText variant="label" nativeID={id}>
        {label}
      </AppText>
      <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabelledBy={id}>
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
              <AppText variant="label" tone={active ? 'selected' : 'default'} align="center">
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
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBackground,
    },
    segment: {
      flex: 1,
      minHeight: touchTarget.min - spacing.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentActive: {
      backgroundColor: colors.selectedBackground,
    },
    segmentPressed: {
      backgroundColor: colors.glassPressed,
    },
  });
