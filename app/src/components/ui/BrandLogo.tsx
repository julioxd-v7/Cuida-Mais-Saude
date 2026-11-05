import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

import { spacing, useTheme } from '@/theme';

/**
 * Logo horizontal do Cuidar+ na versão certa para o tema:
 * letras escuras no tema claro e letras claras no tema escuro.
 * O símbolo (verde e azul) é o mesmo nas duas.
 */
export function BrandLogo({ style }: { style?: StyleProp<ImageStyle> }) {
  const { scheme } = useTheme();
  const source =
    scheme === 'dark'
      ? require('@/assets/images/logo-horizontal-light.png')
      : require('@/assets/images/logo-horizontal-dark.png');

  return (
    <Image
      source={source}
      style={[styles.logo, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Cuidar+, cuidadores para cada momento"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    width: '78%',
    height: undefined,
    aspectRatio: 3.7,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
});
