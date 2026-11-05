import { useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { layout, spacing, type AppColors, useStyles } from '@/theme';

import { Backdrop } from './Backdrop';

export type ScreenProps = {
  children: ReactNode;
  /** Rola o conteúdo (padrão). Desligue para telas com lista virtualizada própria. */
  scroll?: boolean;
  /** Bordas que respeitam a área segura. */
  edges?: Edge[];
  /** Conteúdo fixo no rodapé (ex.: campo de mensagem), acima do teclado, numa barra de vidro. */
  footer?: ReactNode;
  /** Centraliza o conteúdo na vertical (ex.: login). */
  centered?: boolean;
};

/**
 * Contêiner base de toda tela do app:
 * - fundo em degradê da marca com painéis de vidro (Backdrop);
 * - respeita notch, barra de status e barra de gestos;
 * - sobe o conteúdo quando o teclado abre;
 * - rola conteúdo longo e mantém toques em botões com o teclado aberto;
 * - limita a largura em tablets.
 */
/** Dentro das abas, a barra inferior já cuida da área segura de baixo. */
function useInTabs(): boolean {
  try {
    return (useSegments() as readonly string[]).includes('(tabs)');
  } catch {
    return false;
  }
}

export function Screen({ children, scroll = true, edges, footer, centered = false }: ScreenProps) {
  const styles = useStyles(createStyles);
  const inTabs = useInTabs();
  const safeEdges: Edge[] = edges ?? (inTabs ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']);
  const content = <View style={[styles.content, centered && styles.centered]}>{children}</View>;

  return (
    <Backdrop>
      <SafeAreaView edges={safeEdges} style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {scroll ? (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              {content}
            </ScrollView>
          ) : (
            content
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Backdrop>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  centered: {
    justifyContent: 'center',
  },
  footer: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
  },
});
