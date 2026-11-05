import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, SegmentedControl, SwitchRow, ThemeToggle } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, TEXT_SIZES, type TextSize, useAccessibility } from '@/theme';

const SIZE_LABELS: Record<TextSize, string> = { normal: 'Normal', large: 'Grande', xlarge: 'Muito grande' };

/**
 * Acessibilidade: tamanho do texto, contraste, modo simplificado e leitura em
 * voz alta. Abre também antes do login. Tudo vale na hora e fica salvo no aparelho.
 */
export default function AccessibilityScreen() {
  const a11y = useAccessibility();
  const { state } = useAuth();
  const isClient = state.status === 'signedIn' && state.user.role === 'client';
  const signedOut = state.status !== 'signedIn';

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Acessibilidade
        </AppText>
        <AppText tone="muted">Deixe o Cuidar+ do jeito mais confortável para você. As mudanças valem na hora.</AppText>
      </View>

      <Card>
        <SegmentedControl
          label="Tamanho do texto"
          value={a11y.textSize}
          onChange={(textSize) => a11y.set({ textSize })}
          options={TEXT_SIZES.map((value) => ({ value, label: SIZE_LABELS[value] }))}
        />
        <AppText>Exemplo: “Profissionais verificados perto de você.”</AppText>
        <AppText variant="caption" tone="muted">
          O tamanho de letra do próprio celular também é respeitado.
        </AppText>
      </Card>

      <Card>
        <SwitchRow
          title="Alto contraste"
          description="Cores mais fortes, fundo sólido e bordas bem marcadas. Ajuda quem enxerga pouco ou usa o celular no sol."
          value={a11y.highContrast}
          onChange={(highContrast) => a11y.set({ highContrast })}
        />
        <ThemeToggle />
      </Card>

      <Card>
        <SwitchRow
          title="Leitura em voz alta"
          description="Mostra o botão “Ouvir” em avisos, mensagens e perfis de profissionais. Usa a voz do próprio celular."
          value={a11y.readAloud}
          onChange={(readAloud) => a11y.set({ readAloud })}
        />
        {a11y.readAloud ? (
          <Button
            label="Testar a voz"
            variant="secondary"
            onPress={() => {
              void Speech.stop();
              Speech.speak('Olá! Esta é a voz que vai ler os textos do Cuidar mais.', { language: 'pt-BR', rate: 0.9 });
            }}
          />
        ) : null}
        <AppText variant="caption" tone="muted">
          No iPhone, desligue o modo silencioso para ouvir. O leitor de tela do celular (TalkBack ou VoiceOver) também
          funciona no app.
        </AppText>
      </Card>

      {isClient || signedOut ? (
        <Card>
          <SwitchRow
            title="Modo simplificado"
            description="Tela inicial com poucos botões grandes: encontrar cuidador, ajuda agora, falar com o suporte e emergência. Ideal para o próprio idoso usar."
            value={a11y.simpleMode}
            onChange={(simpleMode) => a11y.set({ simpleMode })}
          />
        </Card>
      ) : null}

      <Button label="Pronto" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
});
