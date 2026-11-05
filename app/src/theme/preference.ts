import type { ColorScheme } from './colors';

/** Preferência de tema escolhida pela pessoa. "system" segue o aparelho. */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export const THEME_PREFERENCE_KEY = 'cuidarmais.theme.v1';

/** Tema de quem nunca escolheu: o escuro, que é o visual principal do app. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME_PREFERENCE;
}

/** Tema efetivo: a escolha da pessoa, ou o do aparelho quando "automático". */
export function resolveScheme(preference: ThemePreference, systemScheme: string | null | undefined): ColorScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

/** Onde a preferência fica guardada (injeção para testes). */
export interface PreferenceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export async function loadThemePreference(storage: PreferenceStorage): Promise<ThemePreference> {
  try {
    return parseThemePreference(await storage.getItem(THEME_PREFERENCE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export async function saveThemePreference(storage: PreferenceStorage, preference: ThemePreference): Promise<void> {
  try {
    await storage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch {
    // Sem armazenamento: a escolha vale até fechar o app.
  }
}
