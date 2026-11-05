import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { getGoogleIdToken, GoogleSignInCancelled, isGoogleSignInAvailable, setPendingGoogleSignup } from '@/features/auth/google';
import { useAuth } from '@/providers/AuthProvider';
import { getUserMessage, reportError } from '@/services/errors';
import { radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

import { AppText } from './AppText';
import { FeedbackMessage } from './FeedbackMessage';

/**
 * "Continuar com Google". Só aparece quando o login Google está configurado
 * e o app roda num build com o módulo nativo (não no Expo Go).
 */
export function GoogleSignInButton() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isGoogleSignInAvailable()) return null;

  async function press() {
    setBusy(true);
    setError(null);
    try {
      const idToken = await getGoogleIdToken();
      const result = await signInWithGoogle(idToken);
      if (result.status === 'needsSignup') {
        setPendingGoogleSignup({ idToken, ...result.profile });
        router.push('/register/google');
      }
      // signedIn: a navegação raiz leva para a área certa.
    } catch (err) {
      if (!(err instanceof GoogleSignInCancelled)) setError(getUserMessage(reportError(err, { action: 'google.signIn' })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.line} />
        <AppText variant="caption" tone="muted">
          ou
        </AppText>
        <View style={styles.line} />
      </View>
      <Pressable
        onPress={press}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Continuar com Google"
        accessibilityState={{ busy, disabled: busy }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        {busy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color={colors.text} />
            <AppText variant="bodyStrong">Continuar com Google</AppText>
          </>
        )}
      </Pressable>
      {error ? <FeedbackMessage kind="error" message={error} /> : null}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    line: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderStrong,
    },
    button: {
      minHeight: touchTarget.min,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    pressed: {
      backgroundColor: colors.glassPressed,
    },
  });
