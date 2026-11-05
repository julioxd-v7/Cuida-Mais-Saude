import { Platform } from 'react-native';

/**
 * Tokens de layout, tipografia, ícones, estados e elevação (iguais nos dois
 * temas; as cores ficam em colors.ts). Valores em pontos (dp), escala de 4.
 * Fonte: a do sistema, por enquanto. Uma fonte própria entra na etapa de
 * identidade visual (expo-font já está instalado).
 */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export { typography } from './typography';
export type { TypographyVariant } from './typography';

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/** Alvos de toque: 48 cumpre Android (48dp) e iOS (44pt). */
export const touchTarget = {
  min: 48,
} as const;

/** Opacidades e escalas dos estados de interação. */
export const interaction = {
  pressedOpacity: 0.85,
  disabledOpacity: 0.5,
} as const;

/** Elevação: iOS usa shadow*, Android usa elevation. */
export const elevation = {
  none: {},
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {},
    default: {},
  }),
} as const;

/** Vidro: intensidade do desfoque (1–100). */
export const glass = {
  blurIntensity: 40,
} as const;

/** Largura máxima do conteúdo em telas grandes (tablets). */
export const layout = {
  maxContentWidth: 560,
  screenPadding: spacing.xl,
} as const;
