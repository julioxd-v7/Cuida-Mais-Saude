import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, FeedbackMessage, GlassPanel, MenuItem, MenuSection, PasswordField } from '@/components/ui';
import { passwordProblem } from '@/features/auth/schemas';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { useSignedInUser } from '@/providers/AuthProvider';
import { getUserMessage, reportError } from '@/services/errors';
import { spacing } from '@/theme';

import { accountService, formatSessionDate, type ActiveSession } from '../accountService';

/** Senha, login com Google e aparelhos conectados. */
export default function SecurityScreen() {
  const user = useSignedInUser();
  const form = useFormSubmit();
  const revoke = useFormSubmit();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  // Quem entrou só com Google cria a senha sem informar a atual.
  const [hasPassword, setHasPassword] = useState(user?.hasPassword ?? true);

  const loadSessions = useCallback(async () => {
    setSessionsError(null);
    try {
      setSessions(await accountService.sessions());
    } catch (err) {
      setSessionsError(getUserMessage(reportError(err, { action: 'sessions.list' })));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions]),
  );

  async function changePassword() {
    setDone(null);
    const errors: Record<string, string> = {};
    if (hasPassword && !current) errors.currentPassword = 'Informe a senha atual.';
    const problem = passwordProblem(next);
    if (problem) errors.newPassword = problem;
    if (next !== confirm) errors.confirm = 'As senhas não são iguais.';
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const ok = await form.run(
      () => accountService.changePassword({ currentPassword: hasPassword ? current : undefined, newPassword: next }),
      'account.password',
    );
    if (ok) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setHasPassword(true);
      setDone('Senha salva. Por segurança, os outros aparelhos foram desconectados.');
      void loadSessions();
    }
  }

  async function revokeOthers() {
    setDone(null);
    const count = { value: 0 };
    const ok = await revoke.run(async () => {
      count.value = await accountService.revokeOtherSessions();
    }, 'sessions.revoke');
    if (ok) {
      setDone(count.value ? `${count.value} aparelho(s) desconectado(s).` : 'Nenhum outro aparelho estava conectado.');
      void loadSessions();
    }
  }

  const others = sessions?.filter((session) => !session.current).length ?? 0;

  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />
      <AppText variant="title" accessibilityRole="header">
        Senha e acesso
      </AppText>

      {done ? <FeedbackMessage kind="success" message={done} /> : null}

      <MenuSection title="Formas de entrar">
        <MenuItem icon="mail-outline" title="E-mail e senha" subtitle={hasPassword ? 'Ativo' : 'Sem senha criada'} />
        <MenuItem
          icon="logo-google"
          title="Google"
          subtitle={user?.googleLinked ? 'Conta Google vinculada' : 'Não vinculado. Entre uma vez com o Google para vincular.'}
        />
      </MenuSection>

      <GlassPanel strong>
        <View style={styles.form}>
          <AppText variant="subtitle">{hasPassword ? 'Alterar senha' : 'Criar senha'}</AppText>
          {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}
          {hasPassword ? (
            <PasswordField
              label="Senha atual"
              value={current}
              onChangeText={(text) => {
                setCurrent(text);
                form.clearFieldError('currentPassword');
              }}
              error={form.fieldErrors.currentPassword}
              autoComplete="current-password"
            />
          ) : null}
          <PasswordField
            label="Nova senha"
            value={next}
            onChangeText={(text) => {
              setNext(text);
              form.clearFieldError('newPassword');
            }}
            error={form.fieldErrors.newPassword}
            hint="Pelo menos 8 caracteres, com letras e números."
            autoComplete="new-password"
          />
          <PasswordField
            label="Repita a nova senha"
            value={confirm}
            onChangeText={(text) => {
              setConfirm(text);
              form.clearFieldError('confirm');
            }}
            error={form.fieldErrors.confirm}
            autoComplete="new-password"
          />
          <Button label="Salvar senha" onPress={changePassword} loading={form.isSubmitting} />
        </View>
      </GlassPanel>

      <Card>
        <AppText variant="subtitle">Aparelhos conectados</AppText>
        {sessionsError ? <FeedbackMessage kind="error" message={sessionsError} /> : null}
        {sessions?.map((session) => (
          <View key={session.id} style={styles.session}>
            <AppText variant="bodyStrong">{session.current ? 'Este aparelho' : 'Outro aparelho'}</AppText>
            <AppText variant="caption" tone="muted">
              Último uso {formatSessionDate(session.lastUsedAt)} · conectado desde {formatSessionDate(session.createdAt)}
            </AppText>
          </View>
        ))}
        {revoke.formError ? <FeedbackMessage kind="error" message={revoke.formError} /> : null}
        <Button
          label="Sair de todos os outros aparelhos"
          variant="secondary"
          onPress={revokeOthers}
          loading={revoke.isSubmitting}
          disabled={sessions !== null && others === 0}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  session: {
    gap: spacing.xxs,
  },
});
