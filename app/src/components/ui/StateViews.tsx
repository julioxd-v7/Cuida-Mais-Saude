import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Illustration } from './Illustration';
import type { IconName } from './MenuItem';

/** Estado de carregamento de uma tela ou seção. */
export function LoadingState({ message = 'Carregando…' }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.text} />
      <AppText tone="muted" align="center">
        {message}
      </AppText>
    </View>
  );
}

type EmptyOrErrorProps = {
  title: string;
  /** Ilustração acima do título (só no estado vazio). */
  icon?: IconName;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Lista ou seção sem conteúdo (ex.: "Você ainda não tem agendamentos"). */
export function EmptyState({ title, icon, message, actionLabel, onAction }: EmptyOrErrorProps) {
  return (
    <View style={styles.center}>
      {icon ? <Illustration icon={icon} /> : null}
      <AppText variant="subtitle" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText tone="muted" align="center">
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" fullWidth={false} onPress={onAction} />
      ) : null}
    </View>
  );
}

/** Falha ao carregar algo, com opção de tentar novamente. */
export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  actionLabel = 'Tentar novamente',
  onAction,
}: Partial<EmptyOrErrorProps>) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <AppText variant="subtitle" tone="danger" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText tone="muted" align="center">
          {message}
        </AppText>
      ) : null}
      {onAction ? <Button label={actionLabel} fullWidth={false} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
});
