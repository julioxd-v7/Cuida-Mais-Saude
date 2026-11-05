import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, ChipGroup, ErrorState, FeedbackMessage, GlassPanel, LoadingState, TextField } from '@/components/ui';
import { ASSISTANCE_OPTIONS, RELATIONSHIP_OPTIONS, type AssistanceNeed, type Relationship } from '@/constants/labels';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { getUserMessage, reportError } from '@/services/errors';
import { spacing } from '@/theme';

import { AddressFields } from '../AddressFields';
import { EMPTY_ADDRESS, fromAddress, toAddressInput, validateAddress, type AddressValues } from '../addressForm';
import { recipientService } from '../recipientService';

/** Cadastrar (id = "new") ou editar um beneficiário. */
export default function RecipientFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const form = useFormSubmit();
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [needs, setNeeds] = useState<AssistanceNeed[]>([]);
  const [address, setAddress] = useState<AddressValues>(EMPTY_ADDRESS);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (isNew) return;
    void (async () => {
      try {
        const found = (await recipientService.list()).find((item) => item.id === id);
        if (!found) {
          setLoadError('Beneficiário não encontrado.');
          return;
        }
        setFullName(found.fullName);
        setRelationship(found.relationship);
        setNeeds(found.assistanceNeeds);
        setAddress(fromAddress(found.address));
      } catch (err) {
        setLoadError(getUserMessage(reportError(err, { action: 'recipients.load' })));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  if (loading) return <Screen scroll={false}><LoadingState /></Screen>;
  if (loadError) {
    return (
      <Screen scroll={false}>
        <ErrorState message={loadError} actionLabel="Voltar" onAction={() => router.back()} />
      </Screen>
    );
  }

  async function save() {
    const errors: Record<string, string> = { ...validateAddress(address) };
    if (fullName.trim().length < 2) errors.fullName = 'Informe o nome.';
    if (!relationship) errors.relationship = 'Escolha o parentesco.';
    form.setFieldErrors(errors);
    if (Object.keys(errors).length || !relationship) return;
    const input = { fullName: fullName.trim(), relationship, assistanceNeeds: needs, address: toAddressInput(address) };
    const ok = await form.run(async () => {
      if (isNew) await recipientService.create(input);
      else await recipientService.update(String(id), input);
    }, 'recipients.save');
    if (ok) router.back();
  }

  async function remove() {
    const ok = await form.run(() => recipientService.remove(String(id)), 'recipients.remove');
    if (ok) router.back();
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          {isNew ? 'Novo beneficiário' : 'Editar beneficiário'}
        </AppText>
        <AppText tone="muted">
          Não pedimos diagnóstico aqui. Informações de saúde ficarão numa ficha protegida, compartilhada só com o profissional
          que aceitar o atendimento.
        </AppText>
      </View>

      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      <GlassPanel strong>
        <View style={styles.form}>
          <TextField
            label="Nome"
            required
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              form.clearFieldError('fullName');
            }}
            error={form.fieldErrors.fullName}
            autoCapitalize="words"
          />
          <ChipGroup
            label="Parentesco"
            required
            mode="single"
            options={RELATIONSHIP_OPTIONS}
            selected={relationship ? [relationship] : []}
            onChange={(next) => {
              if (next[0]) setRelationship(next[0]);
              form.clearFieldError('relationship');
            }}
            error={form.fieldErrors.relationship}
          />
          <ChipGroup label="Precisa de apoio com" options={ASSISTANCE_OPTIONS} selected={needs} onChange={setNeeds} />

          <AppText variant="subtitle">Endereço do atendimento</AppText>
          <AppText variant="caption" tone="muted">
            Opcional agora. O endereço só é mostrado ao profissional depois que ele aceitar um atendimento.
          </AppText>
          <AddressFields
            values={address}
            onChange={(field, value) => {
              setAddress((current) => ({ ...current, [field]: value }));
              form.clearFieldError(field);
            }}
            errors={form.fieldErrors}
          />

          <Button label="Salvar" onPress={save} loading={form.isSubmitting} />
        </View>
      </GlassPanel>

      {!isNew ? (
        confirmRemove ? (
          <View style={styles.form}>
            <FeedbackMessage kind="warning" message={`Remover ${fullName}? Esta ação não pode ser desfeita.`} />
            <Button label="Sim, remover" variant="secondary" onPress={remove} loading={form.isSubmitting} />
            <Button label="Cancelar" variant="ghost" onPress={() => setConfirmRemove(false)} />
          </View>
        ) : (
          <Button label="Remover beneficiário" variant="ghost" onPress={() => setConfirmRemove(true)} />
        )
      ) : null}
      <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
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
