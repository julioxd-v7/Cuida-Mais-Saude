import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { radius, type AppColors, useStyles } from '@/theme';

import type { IconName } from './MenuItem';

/**
 * Ilustração dos estados vazios: um ícone grande num bloco verde-claro,
 * sobre uma mancha suave, com três "brilhos". Feita só com formas (sem
 * imagem), funciona nos dois temas. É decorativa: o texto ao lado diz tudo.
 */
export function Illustration({ icon, size = 160 }: { icon: IconName; size?: number }) {
  const styles = useStyles(createStyles);
  const tile = Math.round(size * 0.52);

  return (
    <View
      style={[styles.wrap, { width: size * 1.3, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.blob, { width: size * 1.2, height: size * 0.8, borderRadius: size }]} />
      <View style={[styles.ring, { width: size * 0.9, height: size * 0.2, borderRadius: size, bottom: size * 0.04 }]} />
      <View style={[styles.tile, { width: tile, height: tile, borderRadius: tile * 0.28 }]}>
        <Ionicons name={icon} size={Math.round(tile * 0.58)} color="#073B3A" />
      </View>
      <View style={[styles.spark, { top: size * 0.08, right: size * 0.3, transform: [{ rotate: '20deg' }] }]} />
      <View style={[styles.spark, { top: size * 0.17, right: size * 0.18, transform: [{ rotate: '55deg' }] }]} />
      <View style={[styles.spark, { top: size * 0.31, right: size * 0.14, transform: [{ rotate: '90deg' }] }]} />
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    wrap: {
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blob: {
      position: 'absolute',
      backgroundColor: colors.glassPressed,
    },
    ring: {
      position: 'absolute',
      borderWidth: 1.5,
      borderColor: colors.glassBorder,
    },
    tile: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#C7F2E0',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.6)',
      shadowColor: colors.brand.green,
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
      transform: [{ rotate: '-6deg' }],
    },
    spark: {
      position: 'absolute',
      width: 4,
      height: 16,
      borderRadius: radius.pill,
      backgroundColor: '#FBBF24',
    },
  });
