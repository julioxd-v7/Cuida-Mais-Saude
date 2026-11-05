import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Card, ErrorState, FeedbackMessage, LoadingState, MenuItem, MenuSection } from '@/components/ui';
import { PROFESSION_OPTIONS } from '@/constants/labels';
import { VERIFICATION_INFO } from '@/features/caregiver/verification';
import { profileService } from '@/features/profile/profileService';
import { useMe } from '@/features/profile/useMe';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { spacing, useTheme } from '@/theme';

import { AccountHeader } from './AccountHeader';
import { useSignOut } from './useSignOut';

const STATUS_TONE = {
  incomplete: 'warning',
  completed: 'info',
  pending_review: 'info',
  approved: 'success',
  rejected: 'warning',
  suspended: 'warning',
} as const;

/** Menu do profissional (aba Perfil): verificação, disponibilidade e recursos profissionais. */
export default function CaregiverMenuScreen() {
  const { colors } = useTheme();
  const { data, setData, error, loading, reload } = useMe();
  const availability = useFormSubmit();
  const signOut = useSignOut();

  if (loading && !data) return <Screen scroll={false}><LoadingState /></Screen>;
  if (error && !data) return <Screen scroll={false}><ErrorState message={error} onAction={reload} /></Screen>;
  const profile = data?.caregiverProfile;
  if (!data || !profile) return null;

  const status = VERIFICATION_INFO[profile.verificationStatus];
  const profession = PROFESSION_OPTIONS.find((option) => option.value === profile.profession)?.label ?? 'Profissional de cuidado';

  async function toggleAvailable(next: boolean) {
    await availability.run(async () => {
      const updated = await profileService.setAvailableNow(next);
      setData((current) => (current ? { ...current, caregiverProfile: updated } : current));
    }, 'menu.availability');
  }

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Perfil
      </AppText>

      <AccountHeader
        name={data.user.fullName}
        email={data.user.email}
        roleLabel={profession}
        status={{ label: profile.verified ? 'Verificado' : status.title, tone: STATUS_TONE[profile.verificationStatus] }}
        onPress={() => router.push('/caregiver/professional-profile')}
      />

      {/* Contexto: disponibilidade e verificação. */}
      <Card>
        <AppText variant="label" tone="muted">
          {profile.verified ? 'DISPONIBILIDADE' : 'VERIFICAÇÃO'}
        </AppText>
        {profile.verified ? (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{profile.availableNow ? 'Disponível agora' : 'Indisponível no momento'}</AppText>
              <AppText variant="caption" tone="muted">
                {profile.availableNow
                  ? 'Clientes que buscam atendimento imediato veem você primeiro. Desliga sozinho em 8 horas.'
                  : 'Ligue para aparecer em “Disponível agora”.'}
              </AppText>
            </View>
            <Switch
              value={profile.availableNow}
              onValueChange={toggleAvailable}
              disabled={availability.isSubmitting}
              accessibilityLabel="Disponível agora para receber solicitações"
              trackColor={{ false: colors.borderStrong, true: colors.primary }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.borderStrong}
            />
          </View>
        ) : (
          <>
            <AppText variant="bodyStrong">{status.title}</AppText>
            <AppText variant="caption" tone="muted">
              {status.message}
            </AppText>
          </>
        )}
        {availability.formError ? <FeedbackMessage kind="error" message={availability.formError} /> : null}
      </Card>

      <MenuSection title="Trabalho">
        <MenuItem icon="calendar-outline" title="Minha agenda" onPress={() => router.push('/caregiver/agenda')} />
        <MenuItem
          icon="wallet-outline"
          title="Ganhos, extrato e repasses"
          onPress={() => router.push('/caregiver/earnings')}
        />
        <MenuItem
          icon="pricetag-outline"
          title="Valor por hora"
          subtitle="Dentro da faixa da sua cidade"
          onPress={() => router.push('/caregiver/rates')}
        />
      </MenuSection>

      <MenuSection title="Perfil profissional">
        <MenuItem
          icon="briefcase-outline"
          title="Perfil profissional"
          subtitle="Apresentação, experiência e especialidades"
          onPress={() => router.push('/caregiver/professional-profile')}
        />
        <MenuItem
          icon="document-text-outline"
          title="Documentos e qualificações"
          subtitle={profile.missingDocuments.length ? `${profile.missingDocuments.length} pendente(s)` : 'Tudo enviado'}
          onPress={() => router.push('/caregiver/documents')}
        />
        <MenuItem
          icon="map-outline"
          title="Região de atendimento"
          subtitle={profile.serviceCity ? `${profile.serviceDistrict ? `${profile.serviceDistrict}, ` : ''}${profile.serviceCity}` : 'Não informada'}
          onPress={() => router.push('/caregiver/professional-profile')}
        />
        <MenuItem icon="star-outline" title="Minhas avaliações" soon />
      </MenuSection>

      <MenuSection title="Comunicação">
        <MenuItem icon="chatbubbles-outline" title="Mensagens" onPress={() => router.push('/caregiver/messages')} />
        <MenuItem icon="notifications-outline" title="Notificações" soon />
      </MenuSection>

      <MenuSection title="Ajuda">
        <MenuItem
          icon="shield-checkmark-outline"
          title="Segurança e suporte"
          subtitle="Suporte, denúncias, incidentes e emergência"
          onPress={() => router.push('/support')}
        />
        <MenuItem icon="settings-outline" title="Configurações" onPress={() => router.push('/settings')} />
      </MenuSection>

      <View style={styles.signOut}>
        <MenuSection>
          <MenuItem icon="log-out-outline" title="Sair da conta" tone="danger" onPress={signOut.run} />
        </MenuSection>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    gap: spacing.xxs,
  },
  signOut: {
    marginBottom: spacing.lg,
  },
});
