import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { radius, spacing, touchTarget, type AppColors, useAccessibility, useStyles } from '@/theme';

import { AppText } from './AppText';

/**
 * "Ouvir": lê o texto em voz alta (voz do próprio aparelho, em português).
 * Só aparece quando a pessoa liga "Leitura em voz alta" em Acessibilidade.
 * Não substitui o leitor de tela do sistema (TalkBack/VoiceOver), que segue funcionando.
 */
export function ReadAloudButton({ text, label = 'Ouvir' }: { text: string; label?: string }) {
  const styles = useStyles(createStyles);
  const { readAloud } = useAccessibility();
  const [speaking, setSpeaking] = useState(false);

  // Sair da tela interrompe a leitura.
  useEffect(() => {
    return () => {
      void Speech.stop();
    };
  }, []);

  if (!readAloud || !text.trim()) return null;

  async function toggle() {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    await Speech.stop();
    setSpeaking(true);
    Speech.speak(text.slice(0, Math.min(text.length, Speech.maxSpeechInputLength)), {
      language: 'pt-BR',
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={speaking ? 'Parar leitura' : `${label} em voz alta`}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      hitSlop={8}
    >
      <AppText variant="label" tone="primary">
        {speaking ? '■ Parar' : `🔊 ${label}`}
      </AppText>
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    button: {
      alignSelf: 'flex-start',
      minHeight: touchTarget.min - spacing.sm,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    pressed: {
      backgroundColor: colors.glassPressed,
    },
  });
