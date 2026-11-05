import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_ACCESSIBILITY,
  loadAccessibilityPrefs,
  saveAccessibilityPrefs,
  scaleTypography,
  systemFontLimit,
  type AccessibilityPrefs,
  type Typography,
} from './accessibility';
import { resolveColors, type AppColors, type ColorScheme } from './colors';
import {
  DEFAULT_THEME_PREFERENCE,
  loadThemePreference,
  resolveScheme,
  saveThemePreference,
  type ThemePreference,
} from './preference';

type ThemeContextValue = {
  colors: AppColors;
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Preferências de acessibilidade (texto grande, contraste, modo simples, voz). */
  accessibility: AccessibilityPrefs;
  setAccessibility: (change: Partial<AccessibilityPrefs>) => void;
  /** Escala tipográfica já ajustada ao tamanho de texto escolhido. */
  typography: Typography;
  /** Limite do aumento de fonte do sistema, somado ao do app. */
  maxFontSizeMultiplier: number;
  /** As preferências salvas já foram lidas (a splash espera por isso). */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Tema global: claro, escuro ou automático, mais as preferências de
 * acessibilidade. Tudo fica guardado no aparelho e é restaurado ao abrir o
 * app; qualquer troca atualiza todas as telas na hora, sem recarregar.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [accessibility, setAccessibilityState] = useState<AccessibilityPrefs>(DEFAULT_ACCESSIBILITY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([loadThemePreference(AsyncStorage), loadAccessibilityPrefs(AsyncStorage)]).then(([theme, a11y]) => {
      if (!active) return;
      setPreferenceState(theme);
      setAccessibilityState(a11y);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void saveThemePreference(AsyncStorage, next);
  }, []);

  const setAccessibility = useCallback((change: Partial<AccessibilityPrefs>) => {
    setAccessibilityState((current) => {
      const next = { ...current, ...change };
      void saveAccessibilityPrefs(AsyncStorage, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = resolveScheme(preference, systemScheme);
    return {
      colors: resolveColors(scheme, accessibility.highContrast),
      scheme,
      preference,
      setPreference,
      accessibility,
      setAccessibility,
      typography: scaleTypography(accessibility.textSize),
      maxFontSizeMultiplier: systemFontLimit(accessibility.textSize),
      ready,
    };
  }, [preference, systemScheme, setPreference, accessibility, setAccessibility, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Usado fora do provedor (ex.: tela de erro do Expo Router): tema claro padrão, sem troca. */
const FALLBACK: ThemeContextValue = {
  colors: resolveColors('light', false),
  scheme: 'light',
  preference: 'system',
  setPreference: () => {},
  accessibility: DEFAULT_ACCESSIBILITY,
  setAccessibility: () => {},
  typography: scaleTypography('normal'),
  maxFontSizeMultiplier: systemFontLimit('normal'),
  ready: true,
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}

/** Atalho para as preferências de acessibilidade. */
export function useAccessibility() {
  const { accessibility, setAccessibility } = useTheme();
  return { ...accessibility, set: setAccessibility };
}

/**
 * Estilos que dependem do tema. Use com uma função criada FORA do componente:
 *   const createStyles = (colors: AppColors) => StyleSheet.create({ ... });
 *   const styles = useStyles(createStyles);
 */
export function useStyles<T>(factory: (colors: AppColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
