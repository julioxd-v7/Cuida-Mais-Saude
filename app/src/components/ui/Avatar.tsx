import { StyleSheet, View } from 'react-native';

import { type AppColors, useStyles } from '@/theme';

import { AppText } from './AppText';

/**
 * Avatar com iniciais. Fotos de perfil entram quando houver envio e
 * moderação de imagem (não usamos foto de documento para isso).
 */
export function Avatar({ initials, size = 48 }: { initials: string; size?: number }) {
  const styles = useStyles(createStyles);
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppText variant={size >= 64 ? 'title' : 'bodyStrong'} tone="selected">
        {initials || '?'}
      </AppText>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.selectedBackground,
    },
  });
