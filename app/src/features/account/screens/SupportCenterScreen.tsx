import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, MenuItem, MenuSection } from '@/components/ui';
import { env } from '@/config/env';
import { useSignedInUser } from '@/providers/AuthProvider';
import { spacing } from '@/theme';

/** Segurança e suporte: falar com a equipe, denunciar, relatar incidente e emergência. */
export default function SupportCenterScreen() {
  const user = useSignedInUser();
  const messagesPath = user?.role === 'caregiver' ? '/caregiver/messages' : '/client/messages';

  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Segurança e suporte
        </AppText>
        <AppText tone="muted">Estamos aqui para ajudar. Em emergência, ligue primeiro para os serviços públicos.</AppText>
      </View>

      <MenuSection title="Emergência">
        <MenuItem icon="medkit-outline" title="SAMU — 192" subtitle="Emergência médica" tone="danger" onPress={() => void Linking.openURL('tel:192')} />
        <MenuItem icon="call-outline" title="Polícia — 190" subtitle="Risco à segurança" tone="danger" onPress={() => void Linking.openURL('tel:190')} />
      </MenuSection>

      <MenuSection title="Fale com o Cuidar+">
        <MenuItem
          icon="chatbubble-ellipses-outline"
          title="Falar com o suporte"
          onPress={() => router.push('/messages/new')}
        />
        <MenuItem
          icon="flag-outline"
          title="Fazer uma denúncia"
          subtitle="Comportamento inadequado, golpe ou abuso"
          onPress={() => router.push({ pathname: '/messages/new', params: { topic: 'Denúncia' } })}
        />
        <MenuItem
          icon="alert-circle-outline"
          title="Relatar um incidente"
          subtitle="Algo deu errado num atendimento ou no app"
          onPress={() => router.push({ pathname: '/messages/new', params: { topic: 'Incidente' } })}
        />
        <MenuItem icon="file-tray-full-outline" title="Meus chamados" onPress={() => router.push(messagesPath)} />
        {env.supportWhatsapp ? (
          <MenuItem
            icon="logo-whatsapp"
            title="WhatsApp do suporte"
            onPress={() =>
              void Linking.openURL(`https://wa.me/${env.supportWhatsapp}?text=${encodeURIComponent('Olá! Preciso de ajuda com o Cuidar+.')}`)
            }
          />
        ) : null}
      </MenuSection>

      <Card>
        <AppText variant="subtitle">Dicas de segurança</AppText>
        <AppText>• Combine tudo pelo app. Não pague nem passe dados fora dele.</AppText>
        <AppText>• Confira o selo “Verificado” antes de contratar.</AppText>
        <AppText>• Desconfie de pedidos de dinheiro adiantado ou de senhas.</AppText>
        <AppText>• Se algo parecer errado, denuncie. Sua identidade é preservada.</AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
});
