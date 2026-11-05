import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, ChipGroup, ErrorState, FeedbackMessage, GlassPanel, LoadingState, TextField } from '@/components/ui';
import {
  CATEGORY_STATUS_LABELS,
  PERIOD_OPTIONS,
  PROFESSION_INFO,
  professionOptionsFor,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_OPTIONS,
  SPECIALTY_OPTIONS,
  WEEKDAY_OPTIONS,
  isServiceType,
} from '@/constants/labels';
import { validateWith } from '@/features/auth/schemas';
import { formatCpf } from '@/features/auth/validation';
import { profileService } from '@/features/profile/profileService';
import { useMe } from '@/features/profile/useMe';
import { areasLabel, useServiceAreas } from '@/features/search/useServiceAreas';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { spacing } from '@/theme';

import { formatSchema, missingFields, toInput, type FormValues } from '../profileForm';
import { VERIFICATION_INFO } from '../verification';

/**
 * Perfil profissional do cuidador. Pode ser salvo pela metade e completado
 * depois. Salvar NÃO aprova nada: a situação é calculada e decidida no servidor.
 */
export default function ProfessionalProfileScreen() {
  const { data, setData, error, loading, reload } = useMe();
  const { areas } = useServiceAreas();
  const form = useFormSubmit();
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<FormValues>({
    profession: null,
    cpf: '',
    councilNumber: '',
    councilState: '',
    serviceDistrict: '',
    bio: '',
    experienceYears: '',
    specialties: [],
    serviceCity: '',
    serviceState: '',
    serviceRadiusKm: '',
    availabilityDays: [],
    availabilityPeriods: [],
    categories: [],
  });

  const profile = data?.caregiverProfile;

  useEffect(() => {
    if (!profile) return;
    setValues({
      profession: profile.profession,
      cpf: profile.cpf ? formatCpf(profile.cpf) : '',
      councilNumber: profile.councilNumber ?? '',
      councilState: profile.councilState ?? '',
      serviceDistrict: profile.serviceDistrict ?? '',
      bio: profile.bio ?? '',
      experienceYears: profile.experienceYears === null ? '' : String(profile.experienceYears),
      specialties: profile.specialties,
      serviceCity: profile.serviceCity ?? '',
      serviceState: profile.serviceState ?? '',
      serviceRadiusKm: profile.serviceRadiusKm === null ? '' : String(profile.serviceRadiusKm),
      availabilityDays: profile.availabilityDays,
      availabilityPeriods: profile.availabilityPeriods,
      categories: (profile.categories ?? []).map((c) => c.code).filter(isServiceType),
    });
  }, [profile]);

  if (loading && !data) return <Screen scroll={false}><LoadingState /></Screen>;
  if (error && !data) return <Screen scroll={false}><ErrorState message={error} onAction={reload} /></Screen>;
  if (!profile) return null;

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    form.clearFieldError(field);
    setSaved(false);
  }

  async function save() {
    setSaved(false);
    const errors = validateWith(formatSchema, values);
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const ok = await form.run(async () => {
      const updated = await profileService.updateCaregiverProfile(toInput(values));
      setData((current) => (current ? { ...current, caregiverProfile: updated } : current));
    }, 'caregiver.profile.save');
    setSaved(ok);
  }

  const missing = missingFields(values);
  const council = values.profession ? PROFESSION_INFO[values.profession].council : null;
  const status = VERIFICATION_INFO[profile.verificationStatus];
  const e = form.fieldErrors;

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Perfil profissional
        </AppText>
        <AppText tone="muted">
          É o que os clientes vão ver. Você pode salvar agora e completar depois. Campos com * são necessários para enviar
          para verificação.
        </AppText>
      </View>

      <FeedbackMessage kind={status.kind} title={`Situação: ${status.title}`} message={status.message} />
      {saved ? <FeedbackMessage kind="success" message="Perfil salvo." /> : null}
      {saved && profile.serviceCity && !profile.serviceAreaActive ? (
        <FeedbackMessage
          kind="warning"
          title="Cidade ainda não atendida"
          message={`Por enquanto o Cuidar+ atende só em ${areas?.length ? areasLabel(areas) : 'poucas cidades'}. Seu perfil fica salvo e você entra na lista de espera.`}
        />
      ) : null}
      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      <GlassPanel strong>
      <View style={styles.form}>
        <AppText variant="subtitle">Profissão e identificação</AppText>
        <ChipGroup
          label="Sua profissão"
          required
          mode="single"
          options={professionOptionsFor(profile.profession)}
          selected={values.profession ? [values.profession] : []}
          onChange={(next) => next[0] && setField('profession', next[0])}
          error={e.profession}
          hint="Trocar de profissão depois de aprovado exige nova análise."
        />
        {values.profession ? (
          <AppText variant="caption" tone="muted">
            {PROFESSION_INFO[values.profession].summary}
          </AppText>
        ) : null}
        <TextField
          label="CPF"
          required
          keyboardType="number-pad"
          placeholder="000.000.000-00"
          value={values.cpf}
          onChangeText={(text) => setField('cpf', formatCpf(text))}
          error={e.cpf}
          maxLength={14}
          hint="Usado só para verificação. Não é mostrado a clientes."
        />
        {council ? (
          <View style={styles.row}>
            <View style={styles.rowItemWide}>
              <TextField
                label={`Número do ${council}`}
                required
                value={values.councilNumber}
                onChangeText={(text) => setField('councilNumber', text)}
                error={e.councilNumber}
                autoCapitalize="characters"
                maxLength={20}
              />
            </View>
            <View style={styles.rowItem}>
              <TextField
                label="UF"
                required
                placeholder="PE"
                value={values.councilState}
                onChangeText={(text) => setField('councilState', text.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))}
                error={e.councilState}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
          </View>
        ) : null}

        <AppText variant="subtitle">Serviços que você oferece</AppText>
        <AppText variant="caption" tone="muted">
          No lançamento, o Cuidar+ oferece só serviços não clínicos: nada de medicação, curativos ou procedimentos. Cada
          serviço é aprovado pela equipe.
        </AppText>
        <ChipGroup
          label="Serviços"
          required
          options={SERVICE_TYPE_OPTIONS}
          selected={values.categories}
          onChange={(next) => setField('categories', next)}
          error={e.categories}
          hint="Tirar um serviço apaga o valor por hora dele."
        />
        {profile.categories?.length ? (
          <View style={styles.statusList}>
            {profile.categories.filter((c) => isServiceType(c.code)).map((c) => (
              <AppText key={c.code} variant="caption" tone={c.status === 'approved' ? 'default' : 'muted'}>
                {SERVICE_TYPE_LABELS[c.code]}: {CATEGORY_STATUS_LABELS[c.status] ?? c.status}
                {c.note ? ` — ${c.note}` : ''}
              </AppText>
            ))}
          </View>
        ) : null}

        <AppText variant="subtitle">Sobre você</AppText>
        <TextField
          label="Apresentação"
          required
          multiline
          placeholder="Conte sua formação, experiência e como você trabalha."
          hint={`${values.bio.trim().length}/1000 — mínimo 30 caracteres.`}
          value={values.bio}
          onChangeText={(text) => setField('bio', text)}
          error={e.bio}
          maxLength={1000}
        />
        <TextField
          label="Anos de experiência"
          required
          keyboardType="number-pad"
          value={values.experienceYears}
          onChangeText={(text) => setField('experienceYears', text.replace(/\D/g, '').slice(0, 2))}
          error={e.experienceYears}
          maxLength={2}
        />
        <ChipGroup
          label="Especialidades"
          required
          options={SPECIALTY_OPTIONS}
          selected={values.specialties}
          onChange={(next) => setField('specialties', next)}
          error={e.specialties}
        />

        <AppText variant="subtitle">Região de atendimento</AppText>
        <AppText variant="caption" tone="muted">
          Clientes veem só o bairro, a cidade e o raio, nunca o seu endereço.
          {areas?.length ? ` Hoje o Cuidar+ atende em ${areasLabel(areas)}.` : ''}
        </AppText>
        <TextField
          label="Cidade"
          required
          value={values.serviceCity}
          onChangeText={(text) => setField('serviceCity', text)}
          error={e.serviceCity}
          autoCapitalize="words"
        />
        <TextField
          label="Bairro (opcional)"
          value={values.serviceDistrict}
          onChangeText={(text) => setField('serviceDistrict', text)}
          error={e.serviceDistrict}
          autoCapitalize="words"
          hint="Ajuda clientes próximos a encontrar você."
        />
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextField
              label="Estado (UF)"
              required
              placeholder="PE"
              value={values.serviceState}
              onChangeText={(text) => setField('serviceState', text.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))}
              error={e.serviceState}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
          <View style={styles.rowItem}>
            <TextField
              label="Raio (km)"
              required
              keyboardType="number-pad"
              placeholder="15"
              value={values.serviceRadiusKm}
              onChangeText={(text) => setField('serviceRadiusKm', text.replace(/\D/g, '').slice(0, 3))}
              error={e.serviceRadiusKm}
              maxLength={3}
            />
          </View>
        </View>

        <AppText variant="subtitle">Disponibilidade inicial</AppText>
        <ChipGroup
          label="Dias"
          required
          options={WEEKDAY_OPTIONS}
          selected={values.availabilityDays}
          onChange={(next) => setField('availabilityDays', next)}
          error={e.availabilityDays}
        />
        <ChipGroup
          label="Períodos"
          required
          options={PERIOD_OPTIONS}
          selected={values.availabilityPeriods}
          onChange={(next) => setField('availabilityPeriods', next)}
          error={e.availabilityPeriods}
        />

        {missing.length ? (
          <AppText variant="caption" tone="muted">
            Falta para enviar: {missing.join(', ')}.
          </AppText>
        ) : null}

        <Button label="Salvar perfil" onPress={save} loading={form.isSubmitting} />
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  rowItemWide: {
    flex: 2,
  },
  statusList: {
    gap: spacing.xxs,
  },
});
