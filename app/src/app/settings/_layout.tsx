import { Stack } from 'expo-router';

/** Configurações compartilhadas por cliente e profissional (protegidas no layout raiz). */
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
