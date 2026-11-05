import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, MenuItem, MenuSection } from '@/components/ui';
import { spacing } from '@/theme';

/**
 * Privacidade e permissões. Descreve o que o app faz HOJE: ele não usa a
 * localização do aparelho; a busca é por cidade e bairro.
 */
export default function PrivacyScreen() {
  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Privacidade e localização
        </AppText>
        <AppText tone="muted">Como o Cuidar+ trata seus dados e quais permissões usa.</AppText>
      </View>

      <Card>
        <AppText variant="subtitle">Localização</AppText>
        <AppText>
          O app <AppText variant="bodyStrong">não usa a localização do seu celular</AppText> neste momento. A busca funciona
          por cidade e bairro.
        </AppText>
        <AppText variant="caption" tone="muted">
          Quando o acompanhamento do atendimento chegar, a localização será pedida só nessa hora, com explicação, e você
          poderá recusar.
        </AppText>
      </Card>

      <Card>
        <AppText variant="subtitle">O que cada pessoa vê</AppText>
        <AppText>• Profissionais aparecem só com bairro, cidade e raio. Nunca o endereço, CPF, telefone ou e-mail.</AppText>
        <AppText>• O seu endereço só é mostrado ao profissional depois que ele aceitar um atendimento.</AppText>
        <AppText>• Documentos de verificação ficam em armazenamento privado, vistos só pela equipe de análise.</AppText>
      </Card>

      <MenuSection title="Permissões e direitos">
        <MenuItem
          icon="settings-outline"
          title="Permissões do aparelho"
          subtitle="Abre os ajustes do Cuidar+ no seu celular"
          onPress={() => void Linking.openSettings()}
        />
        <MenuItem
          icon="shield-outline"
          title="Política de privacidade"
          onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}
        />
        <MenuItem
          icon="chatbox-ellipses-outline"
          title="Pedir cópia ou correção dos meus dados"
          subtitle="Pelo suporte (direitos da LGPD)"
          onPress={() => router.push({ pathname: '/messages/new', params: { topic: 'Meus dados (LGPD)' } })}
        />
        <MenuItem icon="trash-outline" title="Excluir minha conta" tone="danger" onPress={() => router.push('/settings/delete-account')} />
      </MenuSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
});
