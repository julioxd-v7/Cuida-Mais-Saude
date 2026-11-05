import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, FeedbackMessage, GlassPanel, TextField, TextLink } from '@/components/ui';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { spacing } from '@/theme';

import { authService } from '../authService';
import { forgotPasswordSchema, validateWith } from '../schemas';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const form = useFormSubmit();

  async function submit() {
    const errors = validateWith(forgotPasswordSchema, { email });
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const ok = await form.run(async () => {
      await authService.requestPasswordReset(email);
    }, 'password.forgot');
    if (ok) router.push({ pathname: '/reset-password', params: { email: email.trim() } });
  }

  return (
    <Screen centered>
      <GlassPanel strong padding={spacing.xl}>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Recuperar senha
        </AppText>
        <AppText tone="muted">
          Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um código de 8 números.
        </AppText>
      </View>

      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      <TextField
        label="E-mail"
        required
        placeholder="nome@exemplo.com"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          form.clearFieldError('email');
        }}
        error={form.fieldErrors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={submit}
      />

      <Button label="Enviar código" onPress={submit} loading={form.isSubmitting} />
      <TextLink label="Já tenho um código" onPress={() => router.push({ pathname: '/reset-password', params: { email } })} />
      <TextLink label="Voltar para o login" onPress={() => router.back()} />
      </GlassPanel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
});
