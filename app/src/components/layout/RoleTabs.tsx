import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { touchTarget, useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type RoleTab = { name: string; title: string; icon: IconName; iconActive: IconName };

/**
 * Barra de abas inferior do cliente e do profissional, nas cores do tema.
 * Telas de autenticação ficam fora dela (estão no grupo (auth)).
 */
export function RoleTabs({ tabs }: { tabs: readonly RoleTab[] }) {
  const { colors, typography } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: typography.caption.fontSize, fontWeight: '600' },
        tabBarItemStyle: { minHeight: touchTarget.min },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
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
          }}
        />
      ))}
    </Tabs>
  );
}
