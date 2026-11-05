import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, ErrorState, FeedbackMessage, LoadingState, ReadAloudButton } from '@/components/ui';
import { getUserMessage, reportError } from '@/services/errors';
import { radius, spacing, touchTarget, type AppColors, useStyles, useTheme } from '@/theme';

import { formatMessageTime, mergeMessages, messageService } from '../messageService';
import type { ChatMessage, Conversation } from '../types';

const POLL_INTERVAL_MS = 4000;

/**
 * Chat de uma conversa. Enquanto a tela está aberta, busca mensagens novas a
 * cada 4 segundos (sem servidor de tempo real nesta etapa).
 */
export default function ConversationScreen() {
  const { colors, typography, maxFontSizeMultiplier } = useTheme();
  const styles = useStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const lastIdRef = useRef<string | undefined>(undefined);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const response = await messageService.get(id, lastIdRef.current);
      setConversation(response.conversation);
      if (response.messages.length) {
        setMessages((current) => mergeMessages(current, response.messages));
        lastIdRef.current = response.messages[response.messages.length - 1]?.id;
      }
      setLoadError(null);
    } catch (error) {
      setLoadError(getUserMessage(reportError(error, { action: 'messages.get' })));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void fetchMessages();
      const timer = setInterval(() => void fetchMessages(), POLL_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [fetchMessages]),
  );

  async function send() {
    const body = draft.trim();
    if (!id || !body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const message = await messageService.send(id, body);
      setMessages((current) => mergeMessages(current, [message]));
      lastIdRef.current = message.id;
      setDraft('');
    } catch (error) {
      setSendError(getUserMessage(reportError(error, { action: 'messages.send' })));
    } finally {
      setSending(false);
    }
  }

  if (!conversation && loadError) return <Screen scroll={false}><ErrorState message={loadError} onAction={fetchMessages} /></Screen>;
  if (!conversation) return <Screen scroll={false}><LoadingState /></Screen>;

  const closed = conversation.status === 'closed';
  const title = conversation.kind === 'support' ? 'Suporte Cuidar+' : 'Conversa';

  return (
    <Screen
      scroll={false}
      footer={
        closed ? (
          <AppText tone="muted" align="center">
            Conversa encerrada. Abra um novo chamado se precisar.
          </AppText>
        ) : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Escreva uma mensagem"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Mensagem"
              multiline
              maxLength={2000}
              style={[styles.input, { fontSize: typography.body.fontSize }]}
              maxFontSizeMultiplier={maxFontSizeMultiplier}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!draft.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Enviar mensagem"
              accessibilityState={{ disabled: !draft.trim() || sending, busy: sending }}
              style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}
            >
              <AppText variant="bodyStrong" tone="onPrimary">
                Enviar
              </AppText>
            </Pressable>
          </View>
        )
      }
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={8}>
          <AppText variant="bodyStrong" tone="primary">
            ← Voltar
          </AppText>
        </Pressable>
        <AppText variant="subtitle" accessibilityRole="header">
          {title}
        </AppText>
        {conversation.subject ? (
          <AppText variant="caption" tone="muted">
            {conversation.subject}
          </AppText>
        ) : null}
      </View>

      {sendError ? <FeedbackMessage kind="error" message={sendError} /> : null}

      <FlatList
        ref={listRef}
        style={styles.list}
        data={messages}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
            {!item.mine && item.fromSupport ? (
              <AppText variant="caption" tone="primary">
                Equipe Cuidar+
              </AppText>
            ) : null}
            <AppText tone={item.mine ? 'onPrimary' : 'default'}>{item.body}</AppText>
            {!item.mine ? <ReadAloudButton text={item.body} /> : null}
            <AppText variant="caption" tone={item.mine ? 'onPrimary' : 'muted'} align="right">
              {formatMessageTime(item.createdAt)}
            </AppText>
          </View>
        )}
      />
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  header: {
    gap: spacing.xxs,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  bubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xxs,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderBottomLeftRadius: radius.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: touchTarget.min,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
  },
  sendButton: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
});
