import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Screen } from '@/components/layout/Screen';
import { ErrorState } from '@/components/ui';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { reportError } from '@/services/errors';
import { ThemeProvider, useTheme } from '@/theme';

// A splash nativa fica na tela até sabermos se há sessão.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Proteção de rotas por sessão e papel (camada de conforto: quem protege os
 * dados é o backend). Quando a sessão muda, o Expo Router tira a pessoa da
 * área que deixou de ser permitida e a leva para "index", que redireciona.
 */
function RootNavigator() {
  const { colors, ready: themeReady } = useTheme();
  const { state } = useAuth();
  const booting = state.status === 'restoring' || !themeReady;

  // A splash só sai quando a sessão foi restaurada E o tema salvo foi lido,
  // assim a primeira tela já aparece com as cores certas (sem "piscar").
  useEffect(() => {
    if (!booting) void SplashScreen.hideAsync();
  }, [booting]);

  // Na web, o preenchimento automático do navegador pintaria os campos de azul-claro.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = `input:-webkit-autofill { -webkit-text-fill-color: ${colors.text}; caret-color: ${colors.text}; transition: background-color 99999s; }`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [colors.text]);

  if (booting) return null;

  const signedOut = state.status === 'signedOut' || state.status === 'restoreFailed';
  const role = state.status === 'signedIn' ? state.user.role : null;

  return (
    <>
    <StatusBar style={colors.statusBar} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />

      <Stack.Protected guard={signedOut}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={role === 'client'}>
        <Stack.Screen name="client" />
      </Stack.Protected>

      <Stack.Protected guard={role === 'caregiver'}>
        <Stack.Screen name="caregiver" />
      </Stack.Protected>

      <Stack.Protected guard={role === 'client' || role === 'caregiver'}>
        <Stack.Screen name="messages" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="support" />
      </Stack.Protected>

      <Stack.Protected guard={role === 'admin'}>
        <Stack.Screen name="admin-notice" />
      </Stack.Protected>

      {/* Aberta para todos (inclusive antes do login): letras grandes, contraste, voz. */}
      <Stack.Screen name="accessibility" />
      {/* Termos e privacidade: abertos antes e depois do login. */}
      <Stack.Screen name="legal/[doc]" />

      <Stack.Screen name="+not-found" />
    </Stack>
    </>
  );
}

/** Captura erros de renderização em qualquer tela e oferece "tentar novamente". */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, { boundary: 'root' });
    void SplashScreen.hideAsync();
  }, [error]);

  return (
    <SafeAreaProvider>
      <Screen scroll={false}>
        <ErrorState
          title="Algo deu errado nesta tela"
          message="Tente novamente. Se o problema continuar, feche e abra o aplicativo."
          onAction={() => {
            void retry();
          }}
        />
      </Screen>
    </SafeAreaProvider>
  );
}
