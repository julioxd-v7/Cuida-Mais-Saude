import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { AppText, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { getUserMessage, reportError } from '@/services/errors';
import { iconSize, radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

import { formatMessageTime, messageService } from '../messageService';
import type { Conversation } from '../types';

/**
 * Mensagens: chamados com o suporte e, a partir das solicitações de
 * atendimento, as conversas entre cliente e profissional.
 */
export default function MessagesScreen() {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const inTabs = (useSegments() as readonly string[]).includes('(tabs)');
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setConversations(await messageService.list());
    } catch (err) {
      setError(getUserMessage(reportError(err, { action: 'messages.list' })));
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!conversations && error) return <Screen scroll={false}><ErrorState message={error} onAction={load} /></Screen>;
  if (!conversations) return <Screen scroll={false}><LoadingState /></Screen>;

  return (
    <Screen>
      <AppHeader />

      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header">
          Mensagens
        </AppText>
        <AppText tone="muted">Converse com cuidadores, responsáveis e nossa equipe de suporte.</AppText>
      </View>

      <View style={styles.support}>
        <View style={styles.supportIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="headset-outline" size={iconSize.xl - 4} color={colors.accent} />
        </View>
        <View style={styles.supportText}>
          <AppText variant="bodyStrong">Precisa de ajuda?</AppText>
          <AppText variant="caption" tone="muted">
            Fale com a equipe do Cuidar+.
          </AppText>
        </View>
        <Pressable
          onPress={() => router.push('/messages/new')}
          accessibilityRole="button"
          accessibilityLabel="Falar com o suporte"
          style={({ pressed }) => [styles.supportButton, pressed && styles.supportButtonPressed]}
        >
          <AppText variant="label" tone="onPrimary">
            Falar com o suporte
          </AppText>
          <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      {conversations.length === 0 ? (
        <>
          <EmptyState
            icon="chatbubbles"
            title="Nenhuma conversa ainda"
            message="As conversas com profissionais aparecem aqui quando você tiver uma solicitação de atendimento."
          />
          <Button label="Atualizar" variant="secondary" icon="refresh" loading={refreshing} onPress={refresh} />
        </>
      ) : (
        conversations.map((conversation) => (
          <Pressable
            key={conversation.id}
            onPress={() => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${conversation.kind === 'support' ? 'Suporte' : 'Conversa'}: ${conversation.subject ?? ''}. ${
              conversation.unreadCount ? `${conversation.unreadCount} mensagens novas` : ''
            }`}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons
                name={conversation.kind === 'support' ? 'headset-outline' : 'chatbubble-ellipses-outline'}
                size={iconSize.md}
                color={colors.accent}
              />
            </View>
            <View style={styles.rowText}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {conversation.kind === 'support' ? 'Suporte · ' : ''}
                {conversation.subject ?? 'Conversa'}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {conversation.status === 'closed' ? 'Encerrada · ' : ''}
                {conversation.lastMessage ?? ''}
              </AppText>
            </View>
            <View style={styles.meta}>
              <AppText variant="caption" tone="muted">
                {formatMessageTime(conversation.lastMessageAt)}
              </AppText>
              {conversation.unreadCount > 0 ? (
                <View style={styles.unread}>
                  <AppText variant="caption" tone="onPrimary">
                    {String(conversation.unreadCount)}
                  </AppText>
                </View>
              ) : null}
            </View>
          </Pressable>
        ))
      )}

      {inTabs ? null : <Button label="Voltar" variant="ghost" onPress={() => router.back()} />}
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  support: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  supportIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    backgroundColor: colors.successSoft,
  },
  supportText: {
    flex: 1,
    minWidth: 140,
    gap: spacing.xxs,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  supportButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  rowPressed: {
    backgroundColor: colors.glassPressed,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successSoft,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  meta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  unread: {
    minWidth: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
});
