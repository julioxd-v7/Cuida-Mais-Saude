import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, ErrorState, FeedbackMessage, GlassPanel, LoadingState, TextField } from '@/components/ui';
import { SERVICE_TYPE_LABELS, isServiceType, type ServiceType } from '@/constants/labels';
import { profileService } from '@/features/profile/profileService';
import { useMe } from '@/features/profile/useMe';
import { formatRange, moneyInput, parseMoney, rateError } from '@/features/search/format';
import { useServiceAreas } from '@/features/search/useServiceAreas';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { spacing } from '@/theme';

/**
 * Valor por hora de cada serviço escolhido no perfil, dentro da faixa
 * definida pelo Cuidar+ para a cidade. O servidor confere tudo de novo.
 */
export default function RatesScreen() {
  const { data, setData, error, loading, reload } = useMe();
  const { areas, error: areasError, reload: reloadAreas } = useServiceAreas();
  const form = useFormSubmit();
  const [values, setValues] = useState<Partial<Record<ServiceType, string>>>({});
  const [saved, setSaved] = useState(false);
  const profile = data?.caregiverProfile;

  useEffect(() => {
    if (!profile) return;
    setValues(Object.fromEntries(profile.rates.map((rate) => [rate.serviceType, moneyInput(rate.hourlyRateCents)])));
  }, [profile]);

  if ((loading && !data) || (!areas && !areasError)) return <Screen scroll={false}><LoadingState /></Screen>;
  if (error && !data) return <Screen scroll={false}><ErrorState message={error} onAction={reload} /></Screen>;
  if (areasError && !areas) return <Screen scroll={false}><ErrorState message={areasError} onAction={reloadAreas} /></Screen>;
  if (!profile) return null;

  const area = areas?.find(
    (item) =>
      item.state === profile.serviceState &&
      item.city.localeCompare(profile.serviceCity ?? '', 'pt-BR', { sensitivity: 'base' }) === 0,
  );
  // Serviços pedidos (aguardando análise ou aprovados).
  const services = (profile.categories ?? [])
    .filter((c) => c.status === 'pending' || c.status === 'approved')
    .map((c) => c.code)
    .filter(isServiceType);

  async function save() {
    setSaved(false);
    const fieldErrors: Record<string, string> = {};
    const rates: { serviceType: ServiceType; hourlyRateCents: number }[] = [];
    for (const type of services) {
      const text = values[type]?.trim() ?? '';
      if (text === '') continue; // serviço não oferecido
      const cents = parseMoney(text);
      const problem = rateError(cents, area?.priceRanges.find((range) => range.serviceType === type));
      if (problem) fieldErrors[type] = problem;
      else rates.push({ serviceType: type, hourlyRateCents: cents! });
    }
    if (!rates.length && !Object.keys(fieldErrors).length) {
      form.setFieldErrors({ [services[0] ?? 'companionship']: 'Informe o valor de pelo menos um serviço.' });
      return;
    }
    form.setFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;
    const ok = await form.run(async () => {
      const updated = await profileService.setCaregiverRates(rates);
      setData((current) => (current ? { ...current, caregiverProfile: updated } : current));
    }, 'caregiver.rates.save');
    setSaved(ok);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Valor por hora
        </AppText>
        <AppText tone="muted">
          Você escolhe quanto cobrar, dentro da faixa do Cuidar+ para {profile.serviceCity ?? 'sua cidade'}. Deixe em branco
          um serviço para não oferecê-lo por enquanto.
        </AppText>
      </View>

      {!profile.serviceAreaActive || !area ? (
        <FeedbackMessage
          kind="warning"
          title="Cidade ainda não atendida"
          message="Por enquanto o Cuidar+ funciona em poucas cidades, para garantir a segurança de todos. Seu cadastro fica salvo e avisaremos quando chegarmos aí."
        />
      ) : null}
      {!services.length ? (
        <FeedbackMessage kind="info" message="Escolha os serviços que você oferece no perfil profissional." />
      ) : null}
      {saved ? <FeedbackMessage kind="success" message="Valores salvos." /> : null}
      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      {area && profile.serviceAreaActive && services.length ? (
        <GlassPanel strong>
          <View style={styles.form}>
            {services.map((type) => {
              const range = area.priceRanges.find((item) => item.serviceType === type);
              return (
                <TextField
                  key={type}
                  label={SERVICE_TYPE_LABELS[type]}
                  placeholder="Ex.: 45"
                  keyboardType="decimal-pad"
                  value={values[type] ?? ''}
                  onChangeText={(text) => {
                    setValues((current) => ({ ...current, [type]: text.replace(/[^\d,.]/g, '') }));
                    form.clearFieldError(type);
                    setSaved(false);
                  }}
                  error={form.fieldErrors[type]}
                  hint={range ? `Faixa: ${formatRange(range)}.` : 'Sem faixa definida nesta cidade.'}
                  maxLength={9}
                />
              );
            })}
            <AppText variant="caption" tone="muted">
              O cliente vê o valor por hora. Do valor de cada atendimento concluído, 80% é seu e 20% fica com o Cuidar+
              (comissão da plataforma).
            </AppText>
            <Button label="Salvar valores" onPress={save} loading={form.isSubmitting} />
          </View>
        </GlassPanel>
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
