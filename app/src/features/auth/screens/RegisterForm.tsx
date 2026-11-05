import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Checkbox, FeedbackMessage, GlassPanel, PasswordField, TextField, TextLink } from '@/components/ui';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { useAuth } from '@/providers/AuthProvider';
import { spacing } from '@/theme';

import { registerFormSchema, validateWith, type RegisterFormValues } from '../schemas';
import type { RegisterRole } from '../types';
import { formatPhone } from '../validation';

/**
 * Formulário de conta comum a cliente e cuidador (o "RegisterScreen" da
 * lista de telas). Pede só o essencial; o resto é completado depois.
 */
export function RegisterForm({ role, title, subtitle }: { role: RegisterRole; title: string; subtitle: string }) {
  const { signUp } = useAuth();
  const form = useFormSubmit();
  const [values, setValues] = useState<RegisterFormValues>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });

  function setField<K extends keyof RegisterFormValues>(field: K, value: RegisterFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    form.clearFieldError(field);
  }

  async function submit() {
    const errors = validateWith(registerFormSchema, values);
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) {
      form.setFormError('Revise os campos indicados.');
      return;
    }
    await form.run(async () => {
      await signUp({
        role,
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        acceptTerms: values.acceptTerms,
      });
      // A navegação muda sozinha quando a sessão é criada (app/_layout.tsx).
    }, `register.${role}`);
  }

  const e = form.fieldErrors;

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        <AppText tone="muted">{subtitle}</AppText>
        <AppText variant="caption" tone="muted">
          Campos com * são obrigatórios.
        </AppText>
      </View>

      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      <GlassPanel strong>
      <View style={styles.form}>
        <TextField
          label="Nome completo"
          required
          value={values.fullName}
          onChangeText={(text) => setField('fullName', text)}
          error={e.fullName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
        />
        <TextField
          label="E-mail"
          required
          placeholder="nome@exemplo.com"
          value={values.email}
          onChangeText={(text) => setField('email', text)}
          error={e.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          label="Celular ou telefone"
          required
          placeholder="(11) 91234-5678"
          value={values.phone}
          onChangeText={(text) => setField('phone', formatPhone(text))}
          error={e.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={15}
        />
        <PasswordField
          label="Senha"
          required
          hint="Pelo menos 8 caracteres, com letras e números."
          value={values.password}
          onChangeText={(text) => setField('password', text)}
          error={e.password}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PasswordField
          label="Repita a senha"
          required
          value={values.confirmPassword}
          onChangeText={(text) => setField('confirmPassword', text)}
          error={e.confirmPassword}
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Checkbox
          checked={values.acceptTerms}
          onChange={(checked) => setField('acceptTerms', checked)}
          accessibilityLabel="Li e aceito os Termos de Uso e a Política de Privacidade"
          error={e.acceptTerms}
        >
          <AppText>Li e aceito os Termos de Uso e a Política de Privacidade.</AppText>
          <View style={styles.legalLinks}>
            <TextLink label="Ler os Termos" onPress={() => router.push('/legal/terms')} />
            <TextLink label="Ler a Política" onPress={() => router.push('/legal/privacy')} />
          </View>
        </Checkbox>

        <Button label="Criar conta" onPress={submit} loading={form.isSubmitting} />
      </View>
      </GlassPanel>

      <View style={styles.footer}>
        <AppText tone="muted" align="center">
          Já tem conta?
        </AppText>
        <TextLink label="Entrar" align="center" onPress={() => router.replace('/login')} />
      </View>
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
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.lg,
  },
  footer: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
});
