import type { PreferenceStorage } from './preference';
import { typography, type TypographyVariant } from './typography';

/**
 * Preferências de acessibilidade, escolhidas pela pessoa e guardadas no aparelho.
 * Valem desde a tela de login (idosos e pessoas com baixa visão).
 */
export type TextSize = 'normal' | 'large' | 'xlarge';

export type AccessibilityPrefs = {
  /** Tamanho do texto do app (soma-se ao tamanho de fonte do sistema). */
  textSize: TextSize;
  /** Cores com mais contraste, superfícies opacas e bordas fortes. */
  highContrast: boolean;
  /** Telas com menos opções e botões grandes (pensado para o próprio idoso). */
  simpleMode: boolean;
  /** Mostra botões "Ouvir" que leem textos em voz alta. */
  readAloud: boolean;
};

export const DEFAULT_ACCESSIBILITY: AccessibilityPrefs = {
  textSize: 'normal',
  highContrast: false,
  simpleMode: false,
  readAloud: false,
};

export const ACCESSIBILITY_KEY = 'cuidarmais.a11y.v1';

export const TEXT_SCALE: Record<TextSize, number> = { normal: 1, large: 1.2, xlarge: 1.4 };

export const TEXT_SIZES: readonly TextSize[] = ['normal', 'large', 'xlarge'];

/** Lê o que foi salvo; qualquer valor estranho volta ao padrão, campo a campo. */
export function parseAccessibilityPrefs(raw: string | null | undefined): AccessibilityPrefs {
  if (!raw) return DEFAULT_ACCESSIBILITY;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_ACCESSIBILITY;
  }
  if (!data || typeof data !== 'object') return DEFAULT_ACCESSIBILITY;
  const value = data as Record<string, unknown>;
  const bool = (key: keyof AccessibilityPrefs) =>
    typeof value[key] === 'boolean' ? (value[key] as boolean) : (DEFAULT_ACCESSIBILITY[key] as boolean);
  return {
    textSize: TEXT_SIZES.includes(value.textSize as TextSize) ? (value.textSize as TextSize) : 'normal',
    highContrast: bool('highContrast'),
    simpleMode: bool('simpleMode'),
    readAloud: bool('readAloud'),
  };
}

export async function loadAccessibilityPrefs(storage: PreferenceStorage): Promise<AccessibilityPrefs> {
  try {
    return parseAccessibilityPrefs(await storage.getItem(ACCESSIBILITY_KEY));
  } catch {
    return DEFAULT_ACCESSIBILITY;
  }
}

export async function saveAccessibilityPrefs(storage: PreferenceStorage, prefs: AccessibilityPrefs): Promise<void> {
  try {
    await storage.setItem(ACCESSIBILITY_KEY, JSON.stringify(prefs));
  } catch {
    // Sem armazenamento: vale até fechar o app.
  }
}

export type Typography = Record<TypographyVariant, (typeof typography)[TypographyVariant]>;

/** Escala tipográfica aumentada (tamanho e altura de linha, para não cortar texto). */
export function scaleTypography(size: TextSize): Typography {
  const scale = TEXT_SCALE[size];
  if (scale === 1) return typography;
  const entries = (Object.keys(typography) as TypographyVariant[]).map((key) => {
    const base = typography[key];
    return [key, { ...base, fontSize: Math.round(base.fontSize * scale), lineHeight: Math.round(base.lineHeight * scale) }];
  });
  return Object.fromEntries(entries) as Typography;
}

/**
 * Limite para o aumento de fonte do SISTEMA, somado ao do app: o total fica
 * em até ~1,8x, o que ainda cabe nas telas sem cortar texto.
 */
export function systemFontLimit(size: TextSize): number {
  return Math.max(1.2, Math.round((1.8 / TEXT_SCALE[size]) * 10) / 10);
}
