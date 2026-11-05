import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText, Avatar, GlassPanel, IconBox, type IconName } from '@/components/ui';
import { EMERGENCY_NOTICE, SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS, type ServiceType } from '@/constants/labels';
import { initials } from '@/features/search/format';
import { areasLabel, useServiceAreas } from '@/features/search/useServiceAreas';
import { useSignedInUser } from '@/providers/AuthProvider';
import { iconSize, radius, spacing, touchTarget, type AppColors, useAccessibility, useStyles, useTheme } from '@/theme';

import { SimpleClientHome } from './SimpleClientHome';

const SERVICE_ICONS: Record<ServiceType, IconName> = {
  companionship: 'people',
  daily_support: 'home',
  appointment_escort: 'walk',
  family_support: 'heart-circle',
};

type QuickAction = { icon: IconName; label: string; onPress?: () => void };

/** Atalhos da tela inicial. Pagamentos ainda não existe: aparece como "Em breve", sem toque. */
const QUICK_ACTIONS: QuickAction[] = [
  { icon: 'search', label: 'Buscar cuidadores', onPress: () => router.push('/client/search') },
  {
    icon: 'flash',
    label: 'Disponível agora',
    onPress: () => router.push({ pathname: '/client/search', params: { availableNow: 'true' } }),
  },
  { icon: 'heart', label: 'Favoritos', onPress: () => router.push('/client/favorites') },
  { icon: 'chatbubbles', label: 'Mensagens', onPress: () => router.push('/client/messages') },
  { icon: 'card', label: 'Pagamentos' },
];

/** Início do cliente: saudação, busca, destaques, atalhos, agenda e serviços. */
export default function ClientHomeScreen() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const user = useSignedInUser();
  const { areas } = useServiceAreas();
  const { simpleMode } = useAccessibility();
  if (!user) return null;
  const firstName = user.fullName.split(' ')[0] ?? '';
  if (simpleMode) return <SimpleClientHome firstName={firstName} />;

  return (
    <Screen>
      <AppHeader
        actions={
          <Pressable
            onPress={() => router.push('/client/profile')}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            style={styles.avatarButton}
          >
            <Avatar initials={initials(user.fullName)} size={44} />
          </Pressable>
        }
      />

      <View style={styles.greeting}>
        <AppText variant="display" accessibilityRole="header">
          Olá, {firstName}!
        </AppText>
        <AppText variant="subtitle" style={styles.tagline}>
          Cuidar de quem você ama está em boas mãos.{' '}
          <Ionicons name="heart-outline" size={iconSize.md} color={colors.accent} />
        </AppText>
      </View>

      <Pressable
        onPress={() => router.push('/client/search')}
        accessibilityRole="search"
        accessibilityLabel="Buscar cuidadores e serviços"
        style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}
      >
        <Ionicons name="search-outline" size={iconSize.lg} color={colors.textMuted} />
        <AppText tone="muted" style={styles.searchText} numberOfLines={1}>
          Buscar cuidadores ou serviços…
        </AppText>
        <Ionicons name="options-outline" size={iconSize.lg} color={colors.textMuted} />
      </Pressable>

      {/* Destaque principal. As cores são fixas: o card é claro nos dois temas. */}
      <LinearGradient
        colors={['#F2FCF8', '#CDEFE2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.heroCircle} />
          <Ionicons name="people" size={72} color="#0E6B57" />
        </View>
        <View style={styles.heroBadge}>
          <AppText variant="caption" style={styles.heroBadgeText}>
            CUIDAR+
          </AppText>
        </View>
        <AppText variant="title" style={styles.heroTitle}>
          Cuidado de qualidade, quando você precisa.
        </AppText>
        <AppText style={styles.heroBody}>Profissionais verificados, com todo o suporte.</AppText>
        <Pressable
          onPress={() => router.push('/client/search')}
          accessibilityRole="button"
          accessibilityLabel="Encontrar cuidador"
          style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}
        >
          <AppText variant="bodyStrong" style={styles.heroButtonText}>
            Encontrar cuidador
          </AppText>
          <Ionicons name="arrow-forward" size={iconSize.md} color="#FFFFFF" />
        </Pressable>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions} style={styles.edgeScroll}>
        {QUICK_ACTIONS.map((action) => {
          const soon = !action.onPress;
          const body = (
            <>
              <Ionicons name={action.icon} size={iconSize.xl - 4} color={soon ? colors.textDisabled : colors.accent} />
              <AppText variant="caption" align="center" tone={soon ? 'muted' : 'default'} numberOfLines={2}>
                {action.label}
              </AppText>
              {soon ? (
                <AppText variant="caption" tone="muted" align="center" style={styles.soonText}>
                  Em breve
                </AppText>
              ) : null}
            </>
          );
          return soon ? (
            <View key={action.label} style={styles.action} accessible accessibilityLabel={`${action.label}. Em breve`}>
              {body}
            </View>
          ) : (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              {body}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Próximo atendimento: os pedidos ainda não existem, então mostra o estado vazio real. */}
      <GlassPanel padding={spacing.lg}>
        <View style={styles.sectionRow}>
          <Ionicons name="calendar-outline" size={iconSize.lg} color={colors.accent} />
          <AppText variant="bodyStrong" style={styles.flex}>
            Próximo atendimento
          </AppText>
          <Pressable onPress={() => router.push('/client/agenda')} accessibilityRole="link" hitSlop={8} style={styles.link}>
            <AppText variant="label" tone="primary">
              Ver agenda
            </AppText>
            <Ionicons name="arrow-forward" size={iconSize.sm} color={colors.accent} />
          </Pressable>
        </View>
        <View style={styles.nextRow}>
          <View style={styles.dateTile}>
            <Ionicons name="calendar-clear-outline" size={iconSize.xl} color="#073B3A" />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Nenhum atendimento agendado</AppText>
            <AppText variant="caption" tone="muted">
              Os pedidos de atendimento chegam na próxima atualização do app.
            </AppText>
          </View>
        </View>
      </GlassPanel>

      <View style={styles.sectionRow}>
        <Ionicons name="star" size={iconSize.lg} color={colors.accent} />
        <AppText variant="subtitle" accessibilityRole="header" style={styles.flex}>
          Nossos serviços
        </AppText>
        <Pressable onPress={() => router.push('/client/search')} accessibilityRole="link" hitSlop={8} style={styles.link}>
          <AppText variant="label" tone="primary">
            Ver todos
          </AppText>
          <Ionicons name="arrow-forward" size={iconSize.sm} color={colors.accent} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.services} style={styles.edgeScroll}>
        {SERVICE_TYPE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => router.push({ pathname: '/client/search', params: { serviceType: option.value } })}
            accessibilityRole="button"
            accessibilityLabel={SERVICE_TYPE_LABELS[option.value]}
            style={({ pressed }) => [styles.service, pressed && styles.pressed]}
          >
            <Ionicons
              name={SERVICE_ICONS[option.value]}
              size={iconSize.xl}
              color={option.value === 'family_support' ? colors.info : colors.accent}
            />
            <View style={styles.serviceFooter}>
              <AppText variant="label" style={styles.flex} numberOfLines={3}>
                {option.label}
              </AppText>
              <View style={styles.chevron}>
                <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.text} />
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/support')}
        accessibilityRole="button"
        accessibilityLabel="Segurança e suporte. Profissionais verificados e atendimento seguro."
        style={({ pressed }) => [styles.safety, pressed && styles.pressed]}
      >
        <IconBox icon="shield-checkmark-outline" size={48} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Sua segurança é nossa prioridade</AppText>
          <AppText variant="caption" tone="muted">
            Profissionais verificados e atendimento seguro.
          </AppText>
        </View>
        <View style={styles.chevronFilled}>
          <Ionicons name="chevron-forward" size={iconSize.md} color="#073B3A" />
        </View>
      </Pressable>

      <AppText variant="caption" tone="muted" align="center">
        Serviços de apoio e companhia, sem atos de saúde. {EMERGENCY_NOTICE}
      </AppText>

      {areas?.length ? (
        <AppText variant="caption" tone="muted" align="center">
          Por enquanto o Cuidar+ atende em {areasLabel(areas)}. Estamos começando aos poucos para garantir a segurança de
          todos.
        </AppText>
      ) : null}
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    pressed: {
      backgroundColor: colors.glassPressed,
    },
    avatarButton: {
      padding: 2,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    greeting: {
      gap: spacing.xs,
    },
    tagline: {
      fontWeight: '400',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: touchTarget.min + spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    searchText: {
      flex: 1,
    },
    hero: {
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.sm,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(52, 211, 153, 0.5)',
    },
    heroArt: {
      position: 'absolute',
      right: -24,
      bottom: -18,
      width: 170,
      height: 170,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.9,
    },
    heroCircle: {
      position: 'absolute',
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: 'rgba(16, 185, 129, 0.18)',
    },
    heroBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xxs,
      borderRadius: radius.pill,
      backgroundColor: '#34D399',
    },
    heroBadgeText: {
      color: '#073B3A',
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    heroTitle: {
      color: '#073B3A',
      maxWidth: '78%',
    },
    heroBody: {
      color: '#244A46',
      maxWidth: '68%',
    },
    heroButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: touchTarget.min,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      backgroundColor: '#073B3A',
    },
    heroButtonPressed: {
      backgroundColor: '#0B5250',
    },
    heroButtonText: {
      color: '#FFFFFF',
    },
    edgeScroll: {
      marginHorizontal: -spacing.xl,
      flexGrow: 0,
    },
    actions: {
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    action: {
      width: 92,
      minHeight: 100,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    soonText: {
      fontSize: 11,
      lineHeight: 14,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      minHeight: 32,
    },
    nextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginTop: spacing.sm,
    },
    dateTile: {
      width: 72,
      height: 72,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#C7F2E0',
    },
    services: {
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    service: {
      width: 168,
      minHeight: 124,
      justifyContent: 'space-between',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    serviceFooter: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    chevron: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.glassPressed,
    },
    safety: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glass,
    },
    chevronFilled: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
  });
