import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import {
  AppText,
  Button,
  ChipGroup,
  EmptyState,
  ErrorState,
  FeedbackMessage,
  GlassPanel,
  IconBox,
  LoadingState,
  TextField,
} from '@/components/ui';
import { SERVICE_TYPE_LABELS, type ServiceType } from '@/constants/labels';
import { getUserMessage, reportError } from '@/services/errors';
import { radius, spacing, type AppColors, useAccessibility, useStyles, useTheme } from '@/theme';

import { CaregiverCard } from '../components/CaregiverCard';
import { searchService } from '../searchService';
import type { PublicCaregiver, ServiceArea } from '../types';
import { useServiceAreas } from '../useServiceAreas';

type ServiceFilter = ServiceType | 'all';

const SERVICE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  ...(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((value) => ({ value, label: SERVICE_TYPE_LABELS[value] })),
] as { value: ServiceFilter; label: string }[];

const WHEN_OPTIONS = [
  { value: 'any', label: 'Qualquer horário', icon: 'time-outline' },
  { value: 'now', label: 'Disponível agora', icon: 'flash-outline' },
] as const;

function isServiceType(value: unknown): value is ServiceType {
  return typeof value === 'string' && value in SERVICE_TYPE_LABELS;
}

/**
 * Busca de profissionais verificados na cidade atendida.
 * Privacidade: mostra só a região de atuação de cada profissional.
 */
export default function SearchScreen() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ serviceType?: string; availableNow?: string }>();
  const { areas, error: areasError, reload: reloadAreas } = useServiceAreas();
  const { simpleMode } = useAccessibility();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [service, setService] = useState<ServiceFilter>(isServiceType(params.serviceType) ? params.serviceType : 'all');
  const [when, setWhen] = useState<'any' | 'now'>(params.availableNow === 'true' ? 'now' : 'any');
  const [district, setDistrict] = useState('');
  const [appliedDistrict, setAppliedDistrict] = useState('');
  const [results, setResults] = useState<PublicCaregiver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Atalhos da tela inicial chegam como parâmetros.
  useEffect(() => {
    if (isServiceType(params.serviceType)) setService(params.serviceType);
    if (params.availableNow === 'true') setWhen('now');
  }, [params.serviceType, params.availableNow]);

  const area: ServiceArea | null = areas?.find((item) => item.id === areaId) ?? areas?.[0] ?? null;

  const search = useCallback(async () => {
    if (!area) return;
    setLoading(true);
    setError(null);
    try {
      setResults(
        await searchService.search(area, {
          serviceType: service === 'all' ? undefined : service,
          availableNow: when === 'now',
          district: appliedDistrict,
        }),
      );
    } catch (err) {
      setError(getUserMessage(reportError(err, { action: 'caregivers.search' })));
    } finally {
      setLoading(false);
    }
  }, [area, service, when, appliedDistrict]);

  useEffect(() => {
    void search();
  }, [search]);

  if (!areas && areasError) return <Screen scroll={false}><ErrorState message={areasError} onAction={reloadAreas} /></Screen>;
  if (!areas) return <Screen scroll={false}><LoadingState message="Carregando cidades atendidas…" /></Screen>;
  if (!area) {
    return (
      <Screen scroll={false}>
        <EmptyState
          icon="location-outline"
          title="Ainda não estamos atendendo"
          message="O Cuidar+ está se preparando para começar. Volte em breve."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader variant="centered" />

      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Buscar profissionais
        </AppText>
        <AppText tone="muted">
          <AppText style={styles.strong}>Só profissionais verificados</AppText> pela equipe do Cuidar+ em {area.city} -{' '}
          {area.state}.
        </AppText>
      </View>

      <GlassPanel padding={spacing.lg}>
        {areas.length > 1 ? (
          <ChipGroup
            label="Cidade"
            icon="business-outline"
            mode="single"
            options={areas.map((item) => ({ value: item.id, label: `${item.city} - ${item.state}` }))}
            selected={[area.id]}
            onChange={(next) => next[0] && setAreaId(next[0])}
          />
        ) : null}
        <ChipGroup
          label="Tipo de atendimento"
          icon="options-outline"
          mode="single"
          options={SERVICE_OPTIONS}
          selected={[service]}
          onChange={(next) => next[0] && setService(next[0])}
        />
      </GlassPanel>

      <ChipGroup
        label="Quando"
        icon="calendar-outline"
        mode="single"
        options={WHEN_OPTIONS}
        selected={[when]}
        onChange={(next) => next[0] && setWhen(next[0])}
        hint={when === 'now' ? 'Profissionais que se marcaram como disponíveis nas últimas horas.' : undefined}
      />

      {simpleMode ? null : (
        <TextField
          label="Bairro (opcional)"
          labelIcon="home-outline"
          leadingIcon="location-outline"
          placeholder="Ex.: Boa Viagem"
          value={district}
          onChangeText={setDistrict}
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={() => setAppliedDistrict(district)}
          hint="Quem atende no seu bairro aparece primeiro."
        />
      )}
      {!simpleMode && district.trim() !== appliedDistrict.trim() ? (
        <Button label="Aplicar bairro" variant="secondary" icon="checkmark" onPress={() => setAppliedDistrict(district)} />
      ) : null}

      {error ? <FeedbackMessage kind="error" message={error} /> : null}

      {loading && !results ? <LoadingState message="Buscando profissionais…" /> : null}

      {results && results.length === 0 && !loading ? (
        <View style={styles.emptyCard} accessibilityLiveRegion="polite">
          <IconBox icon="shield-checkmark-outline" size={52} />
          <View style={styles.emptyText}>
            <AppText variant="bodyStrong">Nenhum profissional encontrado</AppText>
            <AppText variant="caption" tone="muted">
              {when === 'now'
                ? 'Ninguém está disponível agora com esses filtros. Tente "Qualquer horário" para ver quem atende com agendamento.'
                : 'Ainda não há profissionais verificados com esses filtros. Tente outro tipo de atendimento.'}
            </AppText>
            {when === 'now' ? (
              <Button label="Ver qualquer horário" variant="secondary" fullWidth={false} onPress={() => setWhen('any')} />
            ) : null}
          </View>
          <View style={styles.emptyArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="search" size={40} color={colors.accent} />
          </View>
        </View>
      ) : null}

      {results && results.length > 0 ? (
        <View style={styles.list} accessibilityLiveRegion="polite">
          <AppText variant="label" tone="muted">
            {results.length === 1 ? '1 profissional' : `${results.length} profissionais`}
            {loading ? ' · atualizando…' : ''}
          </AppText>
          {results.map((caregiver) => (
            <CaregiverCard
              key={caregiver.id}
              caregiver={caregiver}
              onPress={() => router.push({ pathname: '/client/caregivers/[id]', params: { id: caregiver.id } })}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    header: {
      gap: spacing.xs,
    },
    strong: {
      fontWeight: '700',
      color: colors.text,
    },
    emptyCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    emptyText: {
      flex: 1,
      gap: spacing.xs,
    },
    emptyArt: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.glassPressed,
      alignSelf: 'center',
    },
    list: {
      gap: spacing.md,
    },
  });
