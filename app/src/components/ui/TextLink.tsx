import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { spacing, touchTarget } from '@/theme';

import { AppText } from './AppText';

export type TextLinkProps = Omit<PressableProps, 'children'> & {
  label: string;
  align?: 'left' | 'center' | 'right';
};

/** Ação secundária em forma de link ("Esqueci minha senha", "Criar conta"). */
export function TextLink({ label, align = 'left', style, ...rest }: TextLinkProps) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={4}
      style={(state) => [
        styles.base,
        { alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' },
        state.pressed && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <AppText variant="bodyStrong" tone="primary" style={styles.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    textDecorationLine: 'underline',
  },
});
