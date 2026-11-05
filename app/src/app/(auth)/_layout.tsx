import { Stack } from 'expo-router';

/** Rotas públicas (sem sessão): login, cadastro, recuperação de senha, termos. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
