import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, touchTarget, type AppColors, useStyles } from '@/theme';

import { AppText } from './AppText';

export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texto do item. Pode conter links (ReactNode). */
  children: ReactNode;
  accessibilityLabel: string;
  error?: string;
};

export function Checkbox({ checked, onChange, children, accessibilityLabel, error }: CheckboxProps) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(!checked)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={accessibilityLabel}
          hitSlop={8}
          style={styles.hit}
        >
          <View style={[styles.box, checked && styles.boxChecked, Boolean(error) && styles.boxError]}>
            {checked ? (
              <AppText variant="label" tone="onPrimary">
                ✓
              </AppText>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.label}>{children}</View>
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
  wrapper: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  hit: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  boxError: {
    borderColor: colors.dangerBorder,
  },
  label: {
    flex: 1,
    paddingTop: spacing.sm,
  },
});
