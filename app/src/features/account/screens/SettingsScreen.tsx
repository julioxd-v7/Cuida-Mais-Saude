import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, MenuItem, MenuSection, ThemeToggle } from '@/components/ui';
import { env } from '@/config/env';
import { spacing } from '@/theme';

/** Configurações compartilhadas por cliente e profissional. */
export default function SettingsScreen() {
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <Screen>
      <Button label="← Voltar" variant="ghost" fullWidth={false} onPress={() => router.back()} />
      <AppText variant="title" accessibilityRole="header">
        Configurações
      </AppText>

      <Card>
        <ThemeToggle />
      </Card>

      <MenuSection title="Conta">
        <MenuItem icon="person-outline" title="Dados pessoais" subtitle="Nome, telefone e contato" onPress={() => router.push('/settings/personal')} />
        <MenuItem
          icon="key-outline"
          title="Senha e acesso"
          subtitle="Alterar senha, aparelhos conectados, Google"
          onPress={() => router.push('/settings/security')}
        />
      </MenuSection>

      <MenuSection title="Preferências">
        <MenuItem
          icon="lock-closed-outline"
          title="Privacidade e localização"
          subtitle="Seus dados e permissões do aparelho"
          onPress={() => router.push('/settings/privacy')}
        />
        <MenuItem icon="notifications-outline" title="Preferências de notificações" soon />
        <MenuItem
          icon="accessibility-outline"
          title="Acessibilidade"
          subtitle="Letras grandes, contraste, voz e modo simplificado"
          onPress={() => router.push('/accessibility')}
        />
      </MenuSection>

      <MenuSection title="Sobre">
        <MenuItem icon="document-text-outline" title="Termos de uso" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
        <MenuItem
          icon="shield-outline"
          title="Política de privacidade"
          onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}
        />
        <MenuItem icon="information-circle-outline" title="Versão do aplicativo" subtitle={`${version} · ${env.appEnvironment}`} />
      </MenuSection>

      <View style={styles.danger}>
        <MenuSection>
          <MenuItem
            icon="trash-outline"
            title="Excluir minha conta"
            tone="danger"
            onPress={() => router.push('/settings/delete-account')}
          />
        </MenuSection>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: {
    marginBottom: spacing.lg,
  },
});
