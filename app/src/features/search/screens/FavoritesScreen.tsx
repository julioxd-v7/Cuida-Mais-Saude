import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { getUserMessage, reportError } from '@/services/errors';
import { spacing } from '@/theme';

import { CaregiverCard } from '../components/CaregiverCard';
import { searchService } from '../searchService';
import type { PublicCaregiver } from '../types';

/** Profissionais salvos pelo cliente. Quem deixar de estar verificado some da lista. */
export default function FavoritesScreen() {
  const [items, setItems] = useState<PublicCaregiver[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await searchService.favorites());
    } catch (err) {
      setError(getUserMessage(reportError(err, { action: 'favorites.list' })));
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
      <AppText variant="title" accessibilityRole="header">
        Favoritos
      </AppText>
      {items.length === 0 ? (
        <EmptyState
          title="Nenhum favorito ainda"
          message="Abra o perfil de um profissional e toque em “Salvar nos favoritos” para encontrá-lo rápido aqui."
          actionLabel="Buscar profissionais"
          onAction={() => router.push('/client/search')}
        />
      ) : (
        <View style={styles.list}>
          {items.map((caregiver) => (
            <CaregiverCard
              key={caregiver.id}
              caregiver={caregiver}
              onPress={() => router.push({ pathname: '/client/caregivers/[id]', params: { id: caregiver.id } })}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
});
