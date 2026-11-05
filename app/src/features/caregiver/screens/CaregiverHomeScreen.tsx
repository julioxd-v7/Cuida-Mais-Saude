import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, ErrorState, FeedbackMessage, LoadingState, VerifiedBadge } from '@/components/ui';
import { PROFESSION_OPTIONS, serviceTypeLabel } from '@/constants/labels';
import { profileService } from '@/features/profile/profileService';
import { useMe } from '@/features/profile/useMe';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { formatMoney } from '@/features/search/format';
import { useAuth } from '@/providers/AuthProvider';
import { radius, spacing, type AppColors, useStyles, useTheme } from '@/theme';

import { canAcceptRequests, verificationSteps, VERIFICATION_INFO } from '../verification';

/** Início do profissional: selo, etapas da verificação e próximos passos. */
export default function CaregiverHomeScreen() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const availability = useFormSubmit();
  const { onboardingPending, finishOnboarding } = useAuth();
  const { data, setData, error, loading, reload } = useMe();
  const submit = useFormSubmit();
  const firstFocus = useRef(true);

  // Ao voltar do perfil ou dos documentos, recarrega a situação.
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void reload();
    }, [reload]),
  );

  // Recém-cadastrado: abre o perfil profissional uma vez.
  useEffect(() => {
    if (onboardingPending) {
      finishOnboarding();
      router.push('/caregiver/professional-profile');
    }
  }, [onboardingPending, finishOnboarding]);

  if (loading && !data) return <Screen scroll={false}><LoadingState /></Screen>;
  if (error && !data) return <Screen scroll={false}><ErrorState message={error} onAction={reload} /></Screen>;
  if (!data?.caregiverProfile) return null;

  const profile = data.caregiverProfile;
  const info = VERIFICATION_INFO[profile.verificationStatus];
  const firstName = data.user.fullName.split(' ')[0];
  const professionLabel = PROFESSION_OPTIONS.find((option) => option.value === profile.profession)?.label;
  const steps = verificationSteps(profile);

  async function toggleAvailable(next: boolean) {
    await availability.run(async () => {
      const updated = await profileService.setAvailableNow(next);
      setData((current) => (current ? { ...current, caregiverProfile: updated } : current));
    }, 'caregiver.availability');
  }

  const outsideArea = profile.serviceCity !== null && !profile.serviceAreaActive;

  async function sendForReview() {
    await submit.run(async () => {
      const updated = await profileService.submitCaregiverProfile();
      setData((current) => (current ? { ...current, caregiverProfile: updated } : current));
    }, 'caregiver.submit');
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Olá, {firstName}
        </AppText>
        {professionLabel ? <AppText tone="muted">{professionLabel}</AppText> : null}
        {profile.verified ? <VerifiedBadge /> : null}
      </View>

      <FeedbackMessage kind={info.kind} title={info.title} message={info.message} />

      {outsideArea ? (
        <FeedbackMessage
          kind="warning"
          title="Lista de espera"
          message={`O Cuidar+ ainda não atende ${profile.serviceCity}. Estamos começando por poucas cidades para garantir a segurança. Seu cadastro fica salvo e avisaremos quando chegarmos aí.`}
        />
      ) : null}

      {profile.verified ? (
        <Card>
          <View style={styles.switchRow}>
            <View style={styles.stepText}>
              <AppText variant="bodyStrong" nativeID="available-label">
                Disponível agora
              </AppText>
              <AppText variant="caption" tone="muted">
                {profile.availableNow
                  ? 'Você aparece primeiro para quem precisa de atendimento imediato. Desliga sozinho em 8 horas.'
                  : 'Ligue quando puder atender ainda hoje. Clientes buscando "disponível agora" vão ver você.'}
              </AppText>
            </View>
            <Switch
              value={profile.availableNow}
              onValueChange={toggleAvailable}
              disabled={availability.isSubmitting}
              accessibilityLabelledBy="available-label"
              accessibilityLabel="Disponível agora"
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.borderStrong}
            />
          </View>
          {availability.formError ? <FeedbackMessage kind="error" message={availability.formError} /> : null}
        </Card>
      ) : null}

      {profile.verificationStatus === 'rejected' && profile.verificationNote ? (
        <Card>
          <AppText variant="label">Motivo informado pela equipe</AppText>
          <AppText>{profile.verificationNote}</AppText>
        </Card>
      ) : null}

      {!profile.verified ? (
        <Card>
          <AppText variant="subtitle">Como conseguir o selo de verificado</AppText>
          {steps.map((step, index) => (
            <Pressable
              key={step.key}
              disabled={!step.href}
              onPress={() => step.href && router.push(step.href as Href)}
              accessibilityRole={step.href ? 'button' : 'text'}
              accessibilityLabel={`Etapa ${index + 1}: ${step.title}. ${step.done ? 'Concluída' : 'Pendente'}`}
              style={({ pressed }) => [styles.step, pressed && styles.stepPressed]}
            >
              <View style={[styles.stepNumber, step.done && styles.stepDone]}>
                <AppText variant="label" tone={step.done ? 'onPrimary' : 'default'}>
                  {step.done ? '✓' : String(index + 1)}
                </AppText>
              </View>
              <View style={styles.stepText}>
                <AppText variant="bodyStrong">{step.title}</AppText>
                <AppText variant="caption" tone="muted">
                  {step.description}
                </AppText>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {submit.formError ? <FeedbackMessage kind="error" message={submit.formError} /> : null}

      {profile.verificationStatus === 'completed' || profile.verificationStatus === 'rejected' ? (
        <Button
          label="Enviar para verificação"
          onPress={sendForReview}
          loading={submit.isSubmitting}
          disabled={profile.missingDocuments.length > 0 || profile.rates.length === 0 || !profile.serviceAreaActive}
        />
      ) : null}

      {profile.serviceTypes.length ? (
        <Card>
          <AppText variant="label">Serviços que você poderá atender</AppText>
          <AppText tone="muted">{profile.serviceTypes.map((type) => serviceTypeLabel(type)).join(' · ')}</AppText>
          {!canAcceptRequests(profile.verificationStatus) ? (
            <AppText variant="caption" tone="muted">
              Você só poderá aceitar atendimentos depois que seu perfil for aprovado.
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button label="Perfil profissional" variant="secondary" onPress={() => router.push('/caregiver/professional-profile')} />
        <Button label="Valor por hora" variant="secondary" onPress={() => router.push('/caregiver/rates')} />
        <Button label="Documentos" variant="secondary" onPress={() => router.push('/caregiver/documents')} />
      </View>
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  stepPressed: {
    backgroundColor: colors.glassPressed,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepText: {
    flex: 1,
    gap: spacing.xxs,
  },
  actions: {
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
