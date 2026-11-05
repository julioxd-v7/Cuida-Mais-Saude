import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { GlassPanel } from './GlassPanel';

export type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Vidro mais opaco, para cards com bastante texto. */
  strong?: boolean;
};

/** Card padrão: um painel de vidro. */
export function Card({ children, style, strong }: CardProps) {
  return (
    <GlassPanel style={style} strong={strong}>
      {children}
    </GlassPanel>
  );
}
