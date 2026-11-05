import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, ErrorState, FeedbackMessage, GlassPanel, LoadingState, MenuItem, MenuSection } from '@/components/ui';
import { profileService } from '@/features/profile/profileService';
import { useMe } from '@/features/profile/useMe';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { reportError } from '@/services/errors';
import { spacing } from '@/theme';

import { AddressFields } from '../AddressFields';
import { addressSummary, EMPTY_ADDRESS, fromAddress, toAddressInput, validateAddress, type AddressValues } from '../addressForm';
import { recipientService } from '../recipientService';
import type { CareRecipient } from '../types';

/**
 * Endereços salvos: o endereço do cliente e o de cada beneficiário.
 * Nenhum endereço aparece para profissionais antes do aceite de um atendimento.
 */
export default function AddressesScreen() {
  const { data, setData, error, loading, reload } = useMe();
  const form = useFormSubmit();
  const [values, setValues] = useState<AddressValues>(EMPTY_ADDRESS);
  const [saved, setSaved] = useState(false);
  const [recipients, setRecipients] = useState<CareRecipient[]>([]);

  useEffect(() => {
    setValues(fromAddress(data?.clientProfile?.address));
  }, [data]);

  useFocusEffect(
    useCallback(() => {
      recipientService
        .list()
        .then(setRecipients)
        .catch((err) => reportError(err, { action: 'addresses.recipients' }));
    }, []),
  );

  if (loading && !data) return <Screen scroll={false}><LoadingState /></Screen>;
  if (error && !data) return <Screen scroll={false}><ErrorState message={error} onAction={reload} /></Screen>;

  async function save() {
    setSaved(false);
    const errors = validateAddress(values);
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const ok = await form.run(async () => {
      setData(await profileService.updateClientProfile({ address: toAddressInput(values) }));
    }, 'addresses.save');
    setSaved(ok);
  }

  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Endereços salvos
        </AppText>
        <AppText tone="muted">
          Por segurança, nenhum endereço é mostrado a profissionais antes de um atendimento ser aceito.
        </AppText>
      </View>

      {saved ? <FeedbackMessage kind="success" message="Endereço salvo." /> : null}
      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      <GlassPanel strong>
        <View style={styles.form}>
          <AppText variant="subtitle">Meu endereço</AppText>
          <AddressFields
            values={values}
            onChange={(field, value) => {
              setValues((current) => ({ ...current, [field]: value }));
              form.clearFieldError(field);
              setSaved(false);
            }}
            errors={form.fieldErrors}
          />
          <Button label="Salvar endereço" onPress={save} loading={form.isSubmitting} />
        </View>
      </GlassPanel>

      <MenuSection title="Endereços dos beneficiários">
        {recipients.length === 0 ? (
          <MenuItem icon="add-circle-outline" title="Cadastrar beneficiário" onPress={() => router.push('/client/recipients/new')} />
        ) : (
          recipients.map((item) => (
            <MenuItem
              key={item.id}
              icon="location-outline"
              title={item.fullName}
              subtitle={addressSummary(item.address) ?? 'Endereço não informado'}
              onPress={() => router.push({ pathname: '/client/recipients/[id]', params: { id: item.id } })}
            />
          ))
        )}
      </MenuSection>
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
