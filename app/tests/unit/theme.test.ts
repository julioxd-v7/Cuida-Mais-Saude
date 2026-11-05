import { darkColors, lightColors, type AppColors } from '@/theme/colors';
import {
  loadThemePreference,
  parseThemePreference,
  resolveScheme,
  saveThemePreference,
  THEME_PREFERENCE_KEY,
  type PreferenceStorage,
} from '@/theme/preference';

function memoryStorage(initial: Record<string, string> = {}): PreferenceStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (key) => data[key] ?? null,
    setItem: async (key, value) => {
      data[key] = value;
    },
  };
}

const brokenStorage: PreferenceStorage = {
  getItem: async () => {
    throw new Error('indisponível');
  },
  setItem: async () => {
    throw new Error('indisponível');
  },
};

describe('preferência de tema', () => {
  it('aceita só valores conhecidos e cai no tema escuro', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('roxo')).toBe('dark');
    expect(parseThemePreference(null)).toBe('dark');
  });

  it('automático segue o aparelho; escolha manual vence o aparelho', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('salva e restaura a escolha', async () => {
    const storage = memoryStorage();
    expect(await loadThemePreference(storage)).toBe('dark');
    await saveThemePreference(storage, 'light');
    expect(storage.data[THEME_PREFERENCE_KEY]).toBe('light');
    expect(await loadThemePreference(storage)).toBe('light');
  });

  it('valor salvo corrompido volta para o tema escuro', async () => {
    expect(await loadThemePreference(memoryStorage({ [THEME_PREFERENCE_KEY]: '{}' }))).toBe('dark');
  });

  it('sem armazenamento não quebra o app', async () => {
    expect(await loadThemePreference(brokenStorage)).toBe('dark');
    await saveThemePreference(brokenStorage, 'light');
  });
});

/** Contraste WCAG 2.x entre duas cores hex opacas. */
function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  ['claro', lightColors],
  ['escuro', darkColors],
] as [string, AppColors][])('contraste do tema %s (WCAG AA)', (_name, c) => {
  it('texto, secundário e links legíveis no fundo e na superfície', () => {
    for (const bg of [c.background, c.surface]) {
      expect(contrast(c.text, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.textMuted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accent, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.danger, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.warning, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.info, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.success, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('botão principal, seleção e campos legíveis', () => {
    expect(contrast(c.textOnPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.selectedText, c.selectedBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.inputText, c.inputBackground)).toBeGreaterThanOrEqual(7);
    expect(contrast(c.placeholder, c.inputBackground)).toBeGreaterThanOrEqual(4.5);
  });
});
