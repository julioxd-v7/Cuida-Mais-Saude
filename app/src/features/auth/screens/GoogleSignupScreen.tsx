import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Checkbox, ChipGroup, FeedbackMessage, GlassPanel, TextField, TextLink } from '@/components/ui';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { useAuth } from '@/providers/AuthProvider';
import { spacing } from '@/theme';

import { getPendingGoogleSignup, setPendingGoogleSignup } from '../google';
import { fullNameSchema, phoneSchema, validateWith } from '../schemas';
import type { RegisterRole } from '../types';
import { formatPhone } from '../validation';

const ROLE_OPTIONS = [
  { value: 'client', label: 'Preciso de um cuidador' },
  { value: 'caregiver', label: 'Sou profissional de cuidado' },
] as const;

const schema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'É preciso aceitar os Termos e a Política.' }) }),
});

/** Primeiro acesso com Google: completa o que o Google não informa. */
export default function GoogleSignupScreen() {
  const pending = getPendingGoogleSignup();
  const { signInWithGoogle } = useAuth();
  const form = useFormSubmit();
  const [role, setRole] = useState<RegisterRole | null>(null);
  const [fullName, setFullName] = useState(pending?.fullName ?? '');
  const [phone, setPhone] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  if (!pending) {
    return (
      <Screen centered>
        <FeedbackMessage kind="info" message="Toque em “Continuar com Google” na tela de entrada para começar." />
        <Button label="Ir para a entrada" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  async function submit() {
    const errors = validateWith(schema, { fullName, phone, acceptTerms });
    if (!role) errors.role = 'Escolha como você vai usar o Cuidar+.';
    form.setFieldErrors(errors);
    if (Object.keys(errors).length || !role || !pending) return;
    const ok = await form.run(async () => {
      await signInWithGoogle(pending.idToken, { role, fullName, phone, acceptTerms });
    }, 'google.signup');
    if (ok) setPendingGoogleSignup(null); // a navegação raiz leva para a área certa
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Falta pouco
        </AppText>
        <AppText tone="muted">Entrando como {pending.email}. Complete os dados abaixo para criar sua conta.</AppText>
      </View>

      {form.formError ? (
        <FeedbackMessage
          kind="error"
          message={`${form.formError} Se demorar muito, volte e toque em “Continuar com Google” de novo.`}
        />
      ) : null}

      <GlassPanel strong>
        <View style={styles.form}>
          <ChipGroup
            label="Como você vai usar o Cuidar+?"
            required
            mode="single"
            options={ROLE_OPTIONS}
            selected={role ? [role] : []}
            onChange={(next) => {
              if (next[0]) setRole(next[0]);
              form.clearFieldError('role');
            }}
            error={form.fieldErrors.role}
          />
          <TextField
            label="Nome completo"
            required
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              form.clearFieldError('fullName');
            }}
            error={form.fieldErrors.fullName}
            autoCapitalize="words"
          />
          <TextField
            label="Celular"
            required
            placeholder="(11) 91234-5678"
            value={phone}
            onChangeText={(text) => {
              setPhone(formatPhone(text));
              form.clearFieldError('phone');
            }}
            error={form.fieldErrors.phone}
            keyboardType="phone-pad"
            maxLength={15}
          />
          <Checkbox
            checked={acceptTerms}
            onChange={(checked) => {
              setAcceptTerms(checked);
              form.clearFieldError('acceptTerms');
            }}
            accessibilityLabel="Li e aceito os Termos de Uso e a Política de Privacidade"
            error={form.fieldErrors.acceptTerms}
          >
            <AppText>Li e aceito os Termos de Uso e a Política de Privacidade.</AppText>
            <View style={styles.links}>
              <TextLink label="Ler os Termos" onPress={() => router.push('/legal/terms')} />
              <TextLink label="Ler a Política" onPress={() => router.push('/legal/privacy')} />
            </View>
          </Checkbox>
          <Button label="Criar conta" onPress={submit} loading={form.isSubmitting} />
          <Button
            label="Cancelar"
            variant="ghost"
            onPress={() => {
              setPendingGoogleSignup(null);
              router.replace('/login');
            }}
          />
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
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
