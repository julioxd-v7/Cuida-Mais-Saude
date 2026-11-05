import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, ChipGroup, ErrorState, FeedbackMessage, LoadingState, TextField } from '@/components/ui';
import { CONTACT_PREFERENCE_OPTIONS, type ContactPreference } from '@/constants/labels';
import { profileBasicsSchema, validateWith } from '@/features/auth/schemas';
import { formatPhone } from '@/features/auth/validation';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { useAuth } from '@/providers/AuthProvider';
import { spacing } from '@/theme';

import { profileService } from '../profileService';
import { useMe } from '../useMe';

const ROLE_LABEL = { client: 'Cliente', caregiver: 'Cuidador(a)', admin: 'Administrador' } as const;

/** Dados pessoais (cliente e cuidador): nome, telefone e preferência de contato. */
export default function ProfileScreen() {
  const { updateUser } = useAuth();
  const { data, setData, error, loading, reload } = useMe();
  const form = useFormSubmit();
  const [values, setValues] = useState({ fullName: '', phone: '' });
  const [contact, setContact] = useState<ContactPreference>('whatsapp');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setValues({ fullName: data.user.fullName, phone: formatPhone(data.user.phone) });
    if (data.clientProfile) setContact(data.clientProfile.contactPreference);
  }, [data]);

  if (loading && !data) return <Screen scroll={false}><LoadingState message="Carregando seu perfil…" /></Screen>;
  if (error && !data) return <Screen scroll={false}><ErrorState message={error} onAction={reload} /></Screen>;
  if (!data) return null;

  const isClient = data.user.role === 'client';

  async function save() {
    setSaved(false);
    const errors = validateWith(profileBasicsSchema, values);
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const ok = await form.run(async () => {
      let me = await profileService.updateBasics(values);
      if (isClient && me.clientProfile?.contactPreference !== contact) {
        me = await profileService.updateClientProfile({ contactPreference: contact });
      }
      setData(me);
      updateUser(me.user);
    }, 'profile.save');
    setSaved(ok);
  }

  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Dados pessoais
        </AppText>
        <AppText tone="muted">
          {ROLE_LABEL[data.user.role]} · {data.user.email}
        </AppText>
      </View>

      {saved ? <FeedbackMessage kind="success" message="Dados salvos." /> : null}
      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      <Card>
        <TextField
          label="Nome completo"
          required
          value={values.fullName}
          onChangeText={(text) => {
            setValues((v) => ({ ...v, fullName: text }));
            form.clearFieldError('fullName');
          }}
          error={form.fieldErrors.fullName}
          autoCapitalize="words"
        />
        <TextField
          label="Celular ou telefone"
          required
          value={values.phone}
          onChangeText={(text) => {
            setValues((v) => ({ ...v, phone: formatPhone(text) }));
            form.clearFieldError('phone');
          }}
          error={form.fieldErrors.phone}
          keyboardType="phone-pad"
          maxLength={15}
        />
        <TextField label="E-mail" value={data.user.email} editable={false} hint="Para trocar o e-mail, fale com o suporte." />
        {isClient ? (
          <ChipGroup
            label="Como prefere ser contatado(a)?"
            mode="single"
            options={CONTACT_PREFERENCE_OPTIONS}
            selected={[contact]}
            onChange={(next) => next[0] && setContact(next[0])}
          />
        ) : null}
        <Button label="Salvar alterações" onPress={save} loading={form.isSubmitting} />
      </Card>

      {data.user.role === 'caregiver' ? (
        <Button
          label="Editar perfil profissional"
          variant="secondary"
          onPress={() => router.push('/caregiver/professional-profile')}
        />
      ) : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
});
