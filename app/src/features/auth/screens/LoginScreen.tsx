import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, BrandLogo, GoogleSignInButton, Button, FeedbackMessage, GlassPanel, PasswordField, TextField, TextLink } from '@/components/ui';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { useAuth } from '@/providers/AuthProvider';
import { spacing } from '@/theme';

import { loginFormSchema, validateWith } from '../schemas';

/**
 * Tela de login — criada pelo time (commit df1e904), evoluída na Parte 1 e
 * agora ligada à autenticação real. Ao entrar, a navegação leva cada papel
 * para a sua área (app/_layout.tsx).
 */
export default function LoginScreen() {
  const { signIn, state } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const form = useFormSubmit();
  const passwordRef = useRef<TextInput>(null);
  const notice = state.status === 'signedOut' ? state.notice : undefined;

  function setField(field: 'email' | 'password', value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    form.clearFieldError(field);
  }

  async function submit() {
    const errors = validateWith(loginFormSchema, values);
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    await form.run(async () => {
      await signIn(values);
    }, 'login');
  }

  return (
    <Screen centered>
      <GlassPanel strong padding={spacing.xl}>
        <BrandLogo />
        <TextLink label="Aa  Acessibilidade: letras grandes, contraste e voz" align="center" onPress={() => router.push('/accessibility')} />

        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            Entrar
          </AppText>
          <AppText tone="muted">Que bom ter você de volta.</AppText>
        </View>

        {notice && !form.formError ? <FeedbackMessage kind="info" message={notice} /> : null}
        {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

        <View style={styles.form}>
          <TextField
            label="E-mail"
            placeholder="nome@exemplo.com"
            value={values.email}
            onChangeText={(text) => setField('email', text)}
            error={form.fieldErrors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
          />

          <PasswordField
            ref={passwordRef}
            label="Senha"
            value={values.password}
            onChangeText={(text) => setField('password', text)}
            error={form.fieldErrors.password}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <TextLink label="Esqueci minha senha" align="right" onPress={() => router.push('/forgot-password')} />

          <Button label="Entrar" onPress={submit} loading={form.isSubmitting} />
          <GoogleSignInButton />
        </View>

        <View style={styles.footer}>
          <AppText tone="muted" align="center">
            Ainda não tem conta?
          </AppText>
          <TextLink label="Criar conta" align="center" onPress={() => router.push('/welcome')} />
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
  footer: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
});
