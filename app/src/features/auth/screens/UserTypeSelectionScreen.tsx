import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, BrandLogo, GoogleSignInButton, GlassPanel, TextLink } from '@/components/ui';
import { radius, spacing, type AppColors, useStyles } from '@/theme';

type Choice = {
  href: Href;
  title: string;
  description: string;
};

const CHOICES: Choice[] = [
  {
    href: '/register/client',
    title: 'Preciso de um cuidador',
    description: 'Para mim ou para alguém da família: cuidado, enfermagem ou fisioterapia com profissionais verificados.',
  },
  {
    href: '/register/caregiver',
    title: 'Sou profissional de cuidado',
    description:
      'Cuidador(a) de idosos, técnico(a) de enfermagem ou fisioterapeuta. Envie seus documentos, ganhe o selo de verificado e receba solicitações.',
  },
];

/** Primeiro passo do cadastro: escolher entre cliente e cuidador. */
export default function UserTypeSelectionScreen() {
  const styles = useStyles(createStyles);
  return (
    <Screen>
      <BrandLogo />
      <TextLink label="Aa  Acessibilidade: letras grandes, contraste e voz" align="center" onPress={() => router.push('/accessibility')} />

      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Como você quer usar o Cuidar+?
        </AppText>
        <AppText tone="muted">Você pode mudar de ideia antes de concluir o cadastro.</AppText>
      </View>

      <View style={styles.choices}>
        {CHOICES.map((choice) => (
          <Pressable
            key={choice.title}
            onPress={() => router.push(choice.href)}
            accessibilityRole="button"
            accessibilityLabel={choice.title}
            accessibilityHint={choice.description}
            style={({ pressed }) => [styles.pressable, pressed && styles.cardPressed]}
          >
            <GlassPanel>
              <AppText variant="subtitle">{choice.title}</AppText>
              <AppText tone="muted">{choice.description}</AppText>
              <AppText variant="label" tone="primary">
                Continuar →
              </AppText>
            </GlassPanel>
          </Pressable>
        ))}
      </View>

      <GoogleSignInButton />

      <View style={styles.footer}>
        <AppText tone="muted" align="center">
          Já tem conta?
        </AppText>
        <TextLink label="Entrar" align="center" onPress={() => router.replace('/login')} />
      </View>
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  choices: {
    gap: spacing.md,
  },
  pressable: {
    borderRadius: radius.xl,
  },
  cardPressed: {
    opacity: 0.85,
    backgroundColor: colors.glass,
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});
