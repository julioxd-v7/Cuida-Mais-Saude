import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, ChipGroup, FeedbackMessage, GlassPanel, TextField } from '@/components/ui';
import { validateWith } from '@/features/auth/schemas';
import { useFormSubmit } from '@/hooks/useFormSubmit';
import { spacing } from '@/theme';

import { messageService } from '../messageService';

const TOPICS = [
  { value: 'Cadastro e documentos', label: 'Cadastro e documentos' },
  { value: 'Segurança', label: 'Segurança' },
  { value: 'Denúncia', label: 'Denúncia' },
  { value: 'Incidente', label: 'Incidente' },
  { value: 'Meus dados (LGPD)', label: 'Meus dados (LGPD)' },
  { value: 'Problema no aplicativo', label: 'Problema no app' },
  { value: 'Outro assunto', label: 'Outro' },
] as const;

type Topic = (typeof TOPICS)[number]['value'];

const schema = z.object({
  subject: z.string().trim().min(3, 'Escolha um assunto.'),
  message: z.string().trim().min(1, 'Escreva sua mensagem.').max(2000, 'A mensagem pode ter até 2000 caracteres.'),
});

/** Abre um chamado com o suporte. A conversa continua na tela de chat. */
export default function NewSupportScreen() {
  const params = useLocalSearchParams<{ topic?: string }>();
  const initialTopic = TOPICS.find((item) => item.value === params.topic)?.value ?? null;
  const [topic, setTopic] = useState<Topic | null>(initialTopic);
  const [message, setMessage] = useState('');
  const form = useFormSubmit();

  async function submit() {
    const values = { subject: topic ?? '', message };
    const errors = validateWith(schema, values);
    form.setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const created = { id: '' };
    const ok = await form.run(async () => {
      created.id = (await messageService.openSupport(values.subject, values.message)).id;
    }, 'support.open');
    if (ok && created.id) router.replace({ pathname: '/messages/[id]', params: { id: created.id } });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Falar com o suporte
        </AppText>
        <AppText tone="muted">
          Em caso de emergência médica, ligue 192 (SAMU). Para risco à segurança, ligue 190.
        </AppText>
      </View>

      {form.formError ? <FeedbackMessage kind="error" message={form.formError} /> : null}

      <GlassPanel strong>
      <ChipGroup
        label="Assunto"
        required
        mode="single"
        options={TOPICS}
        selected={topic ? [topic] : []}
        onChange={(next) => {
          setTopic(next[0] ?? null);
          form.clearFieldError('subject');
        }}
        error={form.fieldErrors.subject}
      />
      <TextField
        label="Mensagem"
        required
        multiline
        placeholder="Conte o que aconteceu ou qual é a sua dúvida."
        value={message}
        onChangeText={(text) => {
          setMessage(text);
          form.clearFieldError('message');
        }}
        error={form.fieldErrors.message}
        maxLength={2000}
      />
      <Button label="Enviar" onPress={submit} loading={form.isSubmitting} />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
      </GlassPanel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
});
