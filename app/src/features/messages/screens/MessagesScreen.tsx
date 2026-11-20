import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { getUserMessage, reportError } from '@/services/errors';
import { radius, spacing, type AppColors, useStyles } from '@/theme';

import { formatMessageTime, messageService } from '../messageService';
import type { Conversation } from '../types';

/**
 * Mensagens: chamados com o suporte e, a partir das solicitações de
 * atendimento, as conversas entre cliente e profissional.
 */
export default function MessagesScreen() {
  const styles = useStyles(createStyles);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setConversations(await messageService.list());
    } catch (err) {
      setError(getUserMessage(reportError(err, { action: 'messages.list' })));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!conversations && error) return <Screen scroll={false}><ErrorState message={error} onAction={load} /></Screen>;
  if (!conversations) return <Screen scroll={false}><LoadingState /></Screen>;

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        Mensagens
      </AppText>

      <Card>
        <AppText variant="subtitle">Precisa de ajuda?</AppText>
        <AppText tone="muted">Fale com a equipe do Cuidar+. Respondemos por aqui mesmo.</AppText>
        <Button label="Falar com o suporte" onPress={() => router.push('/messages/new')} />
      </Card>

      {conversations.length === 0 ? (
        <EmptyState
          title="Nenhuma conversa ainda"
          message="As conversas com profissionais aparecem aqui quando você tiver uma solicitação de atendimento."
        />
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

      <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  rowPressed: {
    backgroundColor: colors.glassPressed,
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
