import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { spacing, touchTarget, useStyles, type AppColors } from '@/theme';

import { AppText } from './AppText';
import { TextField, type TextFieldProps } from './TextField';

/** Campo de senha com botão "Mostrar/Ocultar" — ajuda quem tem dificuldade para digitar. */
export function PasswordField(props: Omit<TextFieldProps, 'secureTextEntry' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  const styles = useStyles(createStyles);

  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable
          onPress={() => setVisible((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
          hitSlop={8}
          style={styles.toggle}
        >
          <AppText variant="label" tone="primary">
            {visible ? 'Ocultar' : 'Mostrar'}
          </AppText>
        </Pressable>
      }
    />
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  toggle: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.inputBorder,
  },
});
