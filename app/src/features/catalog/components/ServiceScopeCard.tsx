import { StyleSheet, View } from 'react-native';

import { AppText, Card, ReadAloudButton } from '@/components/ui';
import { spacing } from '@/theme';

import { durationLabel, scopeSpeech } from '../scope';
import type { ServiceCategory } from '../types';

/**
 * CAT-05: o que o serviço inclui e o que NÃO inclui, mostrado antes de
 * contratar, junto com a política de cancelamento.
 */
export function ServiceScopeCard({ category }: { category: ServiceCategory }) {
  const duration = durationLabel(category);
  return (
    <Card>
      <AppText variant="subtitle">{category.name}</AppText>
      {category.description ? <AppText tone="muted">{category.description}</AppText> : null}

      <View style={styles.block}>
        <AppText variant="bodyStrong">Inclui</AppText>
        {category.includes.map((item) => (
          <AppText key={item}>✓ {item}</AppText>
        ))}
      </View>

      <View style={styles.block}>
        <AppText variant="bodyStrong">Não inclui</AppText>
        {category.excludes.map((item) => (
          <AppText key={item}>✕ {item}</AppText>
        ))}
      </View>

      {duration ? (
        <AppText variant="caption" tone="muted">
          Duração: {duration}.
        </AppText>
      ) : null}
      {category.cancellationPolicy ? (
        <AppText variant="caption" tone="muted">
          {category.cancellationPolicy}
        </AppText>
      ) : null}
      <ReadAloudButton text={scopeSpeech(category)} label="Ouvir o que está incluído" />
    </Card>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.xxs,
  },
});
