/**
 * Identidade visual do CUIDAR+ — "Cuidadores para cada momento".
 * Temas claro e escuro com os MESMOS nomes de token: os componentes nunca
 * usam cores fixas, só `useTheme().colors`.
 *
 * Paleta da marca: verde #10B981 · azul #1685E8 · verde profundo #073B3A.
 *
 * Contrastes conferidos (WCAG AA ≥ 4,5:1 para texto comum):
 *   CLARO  texto #153330 / fundo 12,7 · secundário #526563 5,8 · link #047857 5,1
 *          erro #B42318 6,6 · placeholder #5F716E ≥ 4,5
 *   ESCURO texto #F0F7F5 / fundo 16,8 · secundário #B3C5C2 8,8 · link #34D399 8,3
 *          erro #FF8A80 7,0 · aviso #FBBF24 9,5 · info #6CB6FF 7,4
 *   Botão principal: verde #10B981 com texto escuro (4,9 claro / 7,2 escuro).
 *   Branco sobre o verde NÃO passa (2,5) — por isso o texto do botão é escuro.
 */

export const brand = {
  green: '#10B981',
  blue: '#1685E8',
  deep: '#073B3A',
} as const;

export type ColorScheme = 'light' | 'dark';

export type AppColors = {
  scheme: ColorScheme;
  brand: typeof brand;

  background: string;
  /** Fundo decorativo (degradê bem contido) e brilhos atrás do vidro. */
  backgroundGradient: readonly [string, string];
  glowGreen: string;
  glowBlue: string;

  surface: string;
  /** Vidro: camada translúcida + borda sobre o desfoque. */
  glass: string;
  glassStrong: string;
  glassBorder: string;
  glassPressed: string;
  blurTint: 'light' | 'dark';

  text: string;
  textMuted: string;
  textDisabled: string;
  textOnPrimary: string;

  primary: string;
  primaryPressed: string;
  /** Links e destaques em texto. */
  accent: string;

  inputBackground: string;
  inputBorder: string;
  inputText: string;
  placeholder: string;
  focus: string;

  /** Chip/opção selecionada. */
  selectedBackground: string;
  selectedText: string;

  border: string;
  borderStrong: string;

  success: string;
  successSoft: string;
  danger: string;
  dangerBorder: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;

  statusBar: 'light' | 'dark';
};

export const lightColors: AppColors = {
  scheme: 'light',
  brand,
  background: '#F5F8F7',
  backgroundGradient: ['#F5F8F7', '#EAF3F0'],
  glowGreen: 'rgba(16, 185, 129, 0.22)',
  glowBlue: 'rgba(22, 133, 232, 0.16)',
  surface: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.72)',
  glassStrong: 'rgba(255, 255, 255, 0.86)',
  glassBorder: 'rgba(21, 51, 48, 0.10)',
  glassPressed: 'rgba(16, 185, 129, 0.10)',
  blurTint: 'light',
  text: '#153330',
  textMuted: '#526563',
  textDisabled: '#8A9B98',
  textOnPrimary: '#073B3A',
  primary: brand.green,
  primaryPressed: '#0EA371',
  accent: '#047857',
  inputBackground: '#FFFFFF',
  inputBorder: '#C9D6D3',
  inputText: '#153330',
  placeholder: '#5F716E',
  focus: brand.green,
  selectedBackground: '#073B3A',
  selectedText: '#FFFFFF',
  border: '#DCE6E3',
  borderStrong: '#A9BAB6',
  success: '#047857',
  successSoft: '#E7F7F1',
  danger: '#B42318',
  dangerBorder: '#D92D20',
  dangerSoft: '#FDECEA',
  warning: '#8A5A00',
  warningSoft: '#FEF4E6',
  info: '#0B63C4',
  infoSoft: '#EAF3FD',
  statusBar: 'dark',
};

export const darkColors: AppColors = {
  scheme: 'dark',
  brand,
  // Verde-petróleo profundo das telas de referência (não é preto puro).
  background: '#05211F',
  backgroundGradient: ['#041B1A', '#07302C'],
  glowGreen: 'rgba(16, 185, 129, 0.24)',
  glowBlue: 'rgba(22, 133, 232, 0.20)',
  surface: '#0A302D',
  glass: 'rgba(12, 58, 54, 0.62)',
  glassStrong: 'rgba(12, 58, 54, 0.86)',
  glassBorder: 'rgba(110, 231, 183, 0.16)',
  glassPressed: 'rgba(16, 185, 129, 0.18)',
  blurTint: 'dark',
  text: '#F0F7F5',
  textMuted: '#B3C5C2',
  textDisabled: '#6E8A86',
  textOnPrimary: '#05211F',
  primary: brand.green,
  primaryPressed: '#34D399',
  accent: '#34D399',
  inputBackground: '#072724',
  inputBorder: '#245450',
  inputText: '#F0F7F5',
  placeholder: '#93ABA7',
  focus: brand.green,
  selectedBackground: '#D3F6E8',
  selectedText: '#073B3A',
  border: '#1C4743',
  borderStrong: '#2F6A64',
  success: '#34D399',
  successSoft: 'rgba(16, 185, 129, 0.16)',
  danger: '#FF8A80',
  dangerBorder: '#FF8A80',
  dangerSoft: 'rgba(255, 138, 128, 0.12)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.12)',
  info: '#6CB6FF',
  infoSoft: 'rgba(108, 182, 255, 0.12)',
  statusBar: 'light',
};

export const themes: Record<ColorScheme, AppColors> = { light: lightColors, dark: darkColors };

/**
 * Alto contraste: mesmas cores da marca, mas texto secundário quase igual ao
 * principal, superfícies opacas (sem transparência do vidro) e bordas fortes.
 * Contrastes (teste em tests/unit/accessibility.test.ts): texto secundário ≥ 7:1.
 */
export const highContrastOverrides: Record<ColorScheme, Partial<AppColors>> = {
  light: {
    background: '#FFFFFF',
    backgroundGradient: ['#FFFFFF', '#FFFFFF'],
    glowGreen: 'rgba(16, 185, 129, 0)',
    glowBlue: 'rgba(22, 133, 232, 0)',
    glass: '#FFFFFF',
    glassStrong: '#FFFFFF',
    glassBorder: '#153330',
    text: '#0A1F1D',
    textMuted: '#243F3C',
    accent: '#035E44',
    success: '#035E44',
    danger: '#8E1B12',
    dangerBorder: '#8E1B12',
    warning: '#6B4500',
    info: '#084C97',
    inputBorder: '#243F3C',
    placeholder: '#3D5552',
    border: '#526563',
    borderStrong: '#153330',
  },
  dark: {
    background: '#000000',
    backgroundGradient: ['#000000', '#000000'],
    glowGreen: 'rgba(16, 185, 129, 0)',
    glowBlue: 'rgba(22, 133, 232, 0)',
    surface: '#0B1718',
    glass: '#0B1718',
    glassStrong: '#0B1718',
    glassBorder: '#F0F7F5',
    text: '#FFFFFF',
    textMuted: '#DCE8E5',
    accent: '#6EE7B7',
    success: '#6EE7B7',
    danger: '#FFB4AB',
    dangerBorder: '#FFB4AB',
    warning: '#FCD34D',
    info: '#9CCBFF',
    inputBackground: '#000000',
    inputBorder: '#DCE8E5',
    placeholder: '#B3C5C2',
    border: '#B3C5C2',
    borderStrong: '#F0F7F5',
  },
};

export function resolveColors(scheme: ColorScheme, highContrast: boolean): AppColors {
  return highContrast ? { ...themes[scheme], ...highContrastOverrides[scheme] } : themes[scheme];
}
