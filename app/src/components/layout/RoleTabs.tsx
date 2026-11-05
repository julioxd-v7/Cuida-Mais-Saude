import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, touchTarget, useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type RoleTab = { name: string; title: string; icon: IconName; iconActive: IconName };

/**
 * Barra de abas inferior do cliente e do profissional, nas cores do tema:
 * cantos de cima arredondados e um traço verde sob a aba ativa (a cor e o
 * ícone preenchido também indicam a aba, não só o traço).
 * Telas de autenticação ficam fora dela (estão no grupo (auth)).
 */
export function RoleTabs({ tabs }: { tabs: readonly RoleTab[] }) {
  const { colors, typography, maxFontSizeMultiplier } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: { minHeight: touchTarget.min, paddingTop: spacing.xs },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.glassBorder,
          borderTopWidth: 1,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          height: 68 + insets.bottom,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xs,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={size} color={color} />
            ),
            tabBarLabel: ({ color, focused }) => (
              <View style={styles.label}>
                <Text
                  maxFontSizeMultiplier={maxFontSizeMultiplier}
                  numberOfLines={1}
                  style={{ color, fontSize: typography.caption.fontSize, fontWeight: focused ? '700' : '500' }}
                >
                  {tab.title}
                </Text>
                <View style={[styles.indicator, { backgroundColor: focused ? colors.accent : 'transparent' }]} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    alignItems: 'center',
    gap: 3,
  },
  indicator: {
    width: 36,
    height: 3,
    borderRadius: radius.pill,
  },
});
