import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, EmptyState, ErrorState, LoadingState, MenuItem, MenuSection } from '@/components/ui';
import { ASSISTANCE_OPTIONS, RELATIONSHIP_OPTIONS } from '@/constants/labels';
import { getUserMessage, reportError } from '@/services/errors';
import { spacing } from '@/theme';

import { recipientService } from '../recipientService';
import type { CareRecipient } from '../types';

export function relationshipLabel(value: CareRecipient['relationship']): string {
  return RELATIONSHIP_OPTIONS.find((option) => option.value === value)?.label ?? 'Outro';
}

export function needsLabel(values: CareRecipient['assistanceNeeds']): string {
  const labels = ASSISTANCE_OPTIONS.filter((option) => values.includes(option.value)).map((option) => option.label);
  return labels.length ? labels.join(', ') : 'Apoio não informado';
}

/** Pessoas que recebem o cuidado, cadastradas pelo cliente. */
export default function RecipientsScreen() {
  const [items, setItems] = useState<CareRecipient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await recipientService.list());
    } catch (err) {
      setError(getUserMessage(reportError(err, { action: 'recipients.list' })));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!items && error) return <Screen scroll={false}><ErrorState message={error} onAction={load} /></Screen>;
  if (!items) return <Screen scroll={false}><LoadingState /></Screen>;

  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Beneficiários
        </AppText>
        <AppText tone="muted">Quem vai receber o cuidado: você, seus pais, avós ou outra pessoa da família.</AppText>
      </View>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum beneficiário ainda"
          message="Cadastre a pessoa que vai receber o cuidado. Isso agiliza os pedidos de atendimento."
        />
      ) : (
        <MenuSection>
          {items.map((item) => (
            <MenuItem
              key={item.id}
              icon="person-circle-outline"
              title={item.fullName}
              subtitle={`${relationshipLabel(item.relationship)} · ${needsLabel(item.assistanceNeeds)}`}
              onPress={() => router.push({ pathname: '/client/recipients/[id]', params: { id: item.id } })}
            />
          ))}
        </MenuSection>
      )}

      <Button label="Cadastrar beneficiário" onPress={() => router.push('/client/recipients/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
});
