import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, FeedbackMessage, GlassPanel, PasswordField, TextField } from '@/components/ui';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { spacing } from '@/theme';

import { authService } from '../authService';
import { resetPasswordSchema, validateWith } from '../schemas';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [values, setValues] = useState({
    email: typeof params.email === 'string' ? params.email : '',
    code: '',
    password: '',
    confirmPassword: '',
  });
  const [done, setDone] = useState(false);
  const form = useFormSubmit();

  function setField(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    form.clearFieldError(field);
  }

  async function submit() {
    const errors = validateWith(resetPasswordSchema, values);
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const ok = await form.run(async () => {
      await authService.resetPassword(values);
    }, 'password.reset');
    if (ok) setDone(true);
  }

  if (done) {
    return (
      <Screen>
        <FeedbackMessage
          kind="success"
          title="Senha alterada"
          message="Por segurança, todas as sessões abertas da sua conta foram encerradas. Entre com a nova senha."
        />
        <Button label="Ir para o login" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Criar nova senha
        </AppText>
        <AppText tone="muted">Digite o código que você recebeu por e-mail. Ele vale por 15 minutos.</AppText>
      </View>

      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      <GlassPanel strong>
      <View style={styles.form}>
        <TextField
          label="E-mail"
          required
          value={values.email}
          onChangeText={(text) => setField('email', text)}
          error={form.fieldErrors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label="Código"
          required
          placeholder="12345678"
          value={values.code}
          onChangeText={(text) => setField('code', text.replace(/\D/g, '').slice(0, 8))}
          error={form.fieldErrors.code}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={8}
        />
        <PasswordField
          label="Nova senha"
          required
          hint="Pelo menos 8 caracteres, com letras e números."
          value={values.password}
          onChangeText={(text) => setField('password', text)}
          error={form.fieldErrors.password}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PasswordField
          label="Repita a nova senha"
          required
          value={values.confirmPassword}
          onChangeText={(text) => setField('confirmPassword', text)}
          error={form.fieldErrors.confirmPassword}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Button label="Salvar nova senha" onPress={submit} loading={form.isSubmitting} />
      </View>
      </GlassPanel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
});
