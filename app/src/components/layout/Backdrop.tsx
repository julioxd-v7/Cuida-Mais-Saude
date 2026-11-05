import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { type AppColors, useStyles, useTheme } from '@/theme';

/**
 * Fundo de todas as telas: cor de fundo do tema com um degradê bem contido e
 * dois brilhos suaves (verde e azul) que aparecem desfocados atrás do vidro.
 * Funciona igual nos temas claro e escuro.
 *
 * No Android, o desfoque só funciona sobre o que está dentro de um
 * BlurTargetView. Por isso o fundo fica num BlurTargetView, e cada
 * GlassPanel recebe a referência dele por contexto.
 */
const GlassTargetContext = createContext<RefObject<View | null> | null>(null);

export function useGlassTarget(): RefObject<View | null> | null {
  return useContext(GlassTargetContext);
}

export function Backdrop({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles(createStyles);
  const targetRef = useRef<View | null>(null);

  return (
    <View style={styles.flex}>
      <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={colors.backgroundGradient}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.blob, styles.blobGreen]} />
        <View style={[styles.blob, styles.blobBlue]} />
        <View style={[styles.blob, styles.blobBlueSmall]} />
      </BlurTargetView>
      <GlassTargetContext.Provider value={targetRef}>{children}</GlassTargetContext.Provider>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  // Sem o corte, na web os brilhos passam da tela e criam uma faixa branca ao rolar.
  flex: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobGreen: {
    width: 420,
    height: 420,
    top: -230,
    left: -60,
    backgroundColor: colors.glowGreen,
  },
  blobBlue: {
    width: 340,
    height: 340,
    bottom: -170,
    left: -160,
    backgroundColor: colors.glowBlue,
  },
  blobBlueSmall: {
    width: 220,
    height: 220,
    top: '28%',
    right: -130,
    backgroundColor: colors.glowGreen,
  },
});
