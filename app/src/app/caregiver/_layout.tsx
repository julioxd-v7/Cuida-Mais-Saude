import { Stack } from 'expo-router';

/** Área do cuidador. Protegida no layout raiz; o backend confere o papel em cada requisição. */
export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
