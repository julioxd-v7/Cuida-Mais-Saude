import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, FeedbackMessage, GlassPanel, PasswordField, TextField } from '@/components/ui';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { useAuth, useSignedInUser } from '@/providers/AuthProvider';
import { spacing } from '@/theme';

import { accountService } from '../accountService';

/**
 * Exclusão de conta pelo próprio titular (LGPD e regras das lojas).
 * Pede a palavra EXCLUIR e a senha (se a conta tiver senha).
 */
export default function DeleteAccountScreen() {
  const user = useSignedInUser();
  const { endLocalSession } = useAuth();
  const form = useFormSubmit();
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const hasPassword = user?.hasPassword ?? true;

  async function submit() {
    const errors: Record<string, string> = {};
    if (confirm.trim().toUpperCase() !== 'EXCLUIR') errors.confirm = 'Digite EXCLUIR para confirmar.';
    if (hasPassword && !password) errors.password = 'Informe sua senha.';
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const result = { message: '' };
    const ok = await form.run(async () => {
      result.message = await accountService.requestDeletion({
        password: hasPassword ? password : undefined,
        reason: reason.trim() || undefined,
      });
    }, 'account.delete');
    // O servidor já encerrou as sessões: só limpamos o aparelho e mostramos o aviso no login.
    if (ok) await endLocalSession(result.message);
  }

  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Excluir minha conta
        </AppText>
      </View>

      <FeedbackMessage
        kind="warning"
        title="O que acontece"
        message="Sua conta é encerrada na hora: você sai de todos os aparelhos e deixa de aparecer para outras pessoas. Seus dados são eliminados em até 30 dias, exceto registros que a lei obriga a guardar. Não é possível desfazer."
      />
      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      <GlassPanel strong>
        <View style={styles.form}>
          <TextField
            label="Por que você está saindo? (opcional)"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={300}
          />
          <TextField
            label="Digite EXCLUIR para confirmar"
            value={confirm}
            onChangeText={(text) => {
              setConfirm(text);
              form.clearFieldError('confirm');
            }}
            error={form.fieldErrors.confirm}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {hasPassword ? (
            <PasswordField
              label="Sua senha"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                form.clearFieldError('password');
              }}
              error={form.fieldErrors.password}
              autoComplete="current-password"
            />
          ) : null}
          <Button label="Excluir conta definitivamente" variant="secondary" onPress={submit} loading={form.isSubmitting} />
          <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
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
