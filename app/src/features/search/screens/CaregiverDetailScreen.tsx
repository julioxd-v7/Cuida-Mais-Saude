import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Avatar, Button, Card, ErrorState, FeedbackMessage, LoadingState, Pill, ReadAloudButton, VerifiedBadge } from '@/components/ui';
import { EMERGENCY_NOTICE, SPECIALTY_OPTIONS, serviceTypeLabel } from '@/constants/labels';
import { ServiceScopeCard } from '@/features/catalog/components/ServiceScopeCard';
import { categoriesFor } from '@/features/catalog/scope';
import { useCategories } from '@/features/catalog/useCategories';
import { getUserMessage, reportError } from '@/services/errors';
import { spacing } from '@/theme';

import {
  caregiverSpeech,
  daysLabel,
  experienceLabel,
  formatMoney,
  initials,
  periodsLabel,
  professionLabel,
  rateFor,
  regionLabel,
  verifiedSinceLabel,
} from '../format';
import { searchService } from '../searchService';
import type { PublicCaregiver } from '../types';

/** Perfil público do profissional, visto pelo cliente. */
export default function CaregiverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [caregiver, setCaregiver] = useState<PublicCaregiver | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const { categories } = useCategories();

  const load = useCallback(async () => {
    setError(null);
    try {
      setCaregiver(await searchService.detail(String(id)));
    } catch (err) {
      setError(getUserMessage(reportError(err, { action: 'caregivers.detail' })));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!caregiver && error) {
    return (
      <Screen scroll={false}>
        <ErrorState message={error} onAction={load} />
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!caregiver) return <Screen scroll={false}><LoadingState /></Screen>;

  const current = caregiver;
  const experience = experienceLabel(current.experienceYears);
  const since = verifiedSinceLabel(current.verifiedSince);
  const specialties = SPECIALTY_OPTIONS.filter((option) => current.specialties.includes(option.value)).map((option) => option.label);

  async function toggleFavorite() {
    setSavingFavorite(true);
    setFavoriteError(null);
    try {
      const next = !current.favorite;
      await searchService.setFavorite(current.id, next);
      setCaregiver({ ...current, favorite: next });
    } catch (err) {
      setFavoriteError(getUserMessage(reportError(err, { action: 'favorites.toggle' })));
    } finally {
      setSavingFavorite(false);
    }
  }

  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />

      <View style={styles.hero}>
        <Avatar initials={initials(current.displayName)} size={72} />
        <View style={styles.heroText}>
          <AppText variant="title" accessibilityRole="header">
            {current.displayName}
          </AppText>
          <AppText tone="muted">{professionLabel(current.profession)}</AppText>
        </View>
      </View>

      <View style={styles.badges}>
        {current.verified ? <VerifiedBadge /> : null}
        {current.availableNow ? <Pill label="Disponível agora" tone="success" /> : null}
      </View>
      <ReadAloudButton text={caregiverSpeech(current)} label="Ouvir o perfil" />

      <Card>
        <AppText variant="subtitle">Segurança</AppText>
        <AppText>
          Identidade, antecedentes criminais e comprovante de residência conferidos pela equipe do Cuidar+
          {current.council ? `, além do registro no ${current.council.name}${current.council.state ? `-${current.council.state}` : ''}` : ''}.
        </AppText>
        {since ? (
          <AppText variant="caption" tone="muted">
            {since}
          </AppText>
        ) : null}
      </Card>

      {current.bio ? (
        <Card>
          <AppText variant="subtitle">Sobre</AppText>
          <AppText>{current.bio}</AppText>
          {experience ? <AppText tone="muted">{experience}</AppText> : null}
        </Card>
      ) : null}

      <Card>
        <AppText variant="subtitle">Serviços e valores</AppText>
        {current.serviceTypes.map((type) => {
          const cents = rateFor(current.rates, type);
          return (
            <View key={type} style={styles.rateRow}>
              <AppText style={styles.rateLabel}>{serviceTypeLabel(type)}</AppText>
              <AppText variant="bodyStrong">{cents === null ? 'Sob consulta' : `${formatMoney(cents)}/h`}</AppText>
            </View>
          );
        })}
        <AppText variant="caption" tone="muted">
          Valores por hora definidos pelo profissional, dentro da faixa da cidade.
        </AppText>
      </Card>

      {categories
        ? categoriesFor(categories, current.serviceTypes).map((category) => (
            <ServiceScopeCard key={category.code} category={category} />
          ))
        : null}

      {specialties.length ? (
        <Card>
          <AppText variant="subtitle">Especialidades</AppText>
          <AppText>{specialties.join(' · ')}</AppText>
        </Card>
      ) : null}

      <Card>
        <AppText variant="subtitle">Onde e quando atende</AppText>
        <AppText>{regionLabel(current.region)}</AppText>
        <AppText tone="muted">
          {daysLabel(current.availabilityDays)} · {periodsLabel(current.availabilityPeriods)}
        </AppText>
        <AppText variant="caption" tone="muted">
          Por segurança, o endereço do profissional nunca é mostrado. O seu endereço só será compartilhado depois que um
          atendimento for aceito.
        </AppText>
      </Card>

      <FeedbackMessage kind="warning" message={EMERGENCY_NOTICE} />

      {favoriteError ? <FeedbackMessage kind="error" message={favoriteError} /> : null}

      <Button label="Solicitar atendimento" disabled onPress={() => {}} />
      <AppText variant="caption" tone="muted" align="center">
        Os pedidos de atendimento (agendado e imediato) serão liberados na próxima atualização do app.
      </AppText>
      <Button
        label={current.favorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        variant="secondary"
        loading={savingFavorite}
        onPress={toggleFavorite}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  heroText: {
    flex: 1,
    gap: spacing.xxs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  rateLabel: {
    flex: 1,
  },
});
