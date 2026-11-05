import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, ReadAloudButton } from '@/components/ui';
import { env } from '@/config/env';
import { radius, spacing, type AppColors, useStyles } from '@/theme';

type BigAction = { key: string; title: string; description: string; onPress: () => void; tone?: 'primary' | 'danger' };

/**
 * Início no modo simplificado (Acessibilidade): poucos botões grandes, um por
 * linha, com frases curtas. Pensado para o próprio idoso usar.
 */
export function SimpleClientHome({ firstName }: { firstName: string }) {
  const styles = useStyles(createStyles);

  const actions: BigAction[] = [
    {
      key: 'search',
      title: 'Encontrar um cuidador',
      description: 'Ver profissionais verificados.',
      onPress: () => router.push({ pathname: '/client/search', params: { serviceType: 'companionship' } }),
      tone: 'primary',
    },
    {
      key: 'now',
      title: 'Preciso de alguém agora',
      description: 'Quem está disponível neste momento.',
      onPress: () => router.push({ pathname: '/client/search', params: { availableNow: 'true' } }),
    },
    {
      key: 'favorites',
      title: 'Meus profissionais favoritos',
      description: 'Quem você já salvou.',
      onPress: () => router.push('/client/favorites'),
    },
    {
      key: 'support',
      title: 'Falar com o suporte',
      description: 'Escreva sua dúvida para a equipe do Cuidar+.',
      onPress: () => router.push('/messages/new'),
    },
  ];

  if (env.supportWhatsapp) {
    const number = env.supportWhatsapp;
    actions.push({
      key: 'whatsapp',
      title: 'Falar pelo WhatsApp',
      description: 'Abre uma conversa com o suporte no WhatsApp.',
      onPress: () => void Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Cuidar+.')}`),
    });
  }

  actions.push({
    key: 'emergency',
    title: 'Emergência: ligar 192',
    description: 'SAMU. Abre o telefone com o número pronto.',
    onPress: () => void Linking.openURL('tel:192'),
    tone: 'danger',
  });

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Olá, {firstName}
        </AppText>
        <AppText variant="subtitle" tone="muted">
          O que você precisa?
        </AppText>
        <ReadAloudButton
          text={`Olá, ${firstName}. O que você precisa? Opções: ${actions.map((action) => action.title).join('. ')}.`}
          label="Ouvir as opções"
        />
      </View>

      {actions.map((action) => (
        <Pressable
          key={action.key}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${action.title}. ${action.description}`}
          style={({ pressed }) => [
            styles.action,
            action.tone === 'primary' && styles.actionPrimary,
            action.tone === 'danger' && styles.actionDanger,
            pressed && styles.pressed,
          ]}
        >
          <AppText variant="title" tone={action.tone === 'primary' ? 'onPrimary' : action.tone === 'danger' ? 'danger' : 'default'}>
            {action.title}
          </AppText>
          <AppText tone={action.tone === 'primary' ? 'onPrimary' : 'muted'}>{action.description}</AppText>
        </Pressable>
      ))}

      <AppText variant="caption" tone="muted" align="center">
        Para voltar à tela completa: Perfil → Acessibilidade → Modo simplificado.
      </AppText>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    header: {
      gap: spacing.sm,
    },
    action: {
      minHeight: 96,
      justifyContent: 'center',
      gap: spacing.xs,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      backgroundColor: colors.glassStrong,
    },
    actionPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionDanger: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSoft,
    },
    pressed: {
      opacity: 0.85,
    },
  });
