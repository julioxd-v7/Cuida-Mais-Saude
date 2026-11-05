import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText, Button, FeedbackMessage } from '@/components/ui';
import { spacing } from '@/theme';

import { LEGAL_DOCS, type LegalDocKey } from './content';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key: LegalDocKey = doc === 'privacy' ? 'privacy' : 'terms';
  const content = LEGAL_DOCS[key];

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        {content.title}
      </AppText>
      <FeedbackMessage
        kind="warning"
        title="Versão provisória"
        message="Texto em elaboração, ainda sem revisão jurídica."
      />
      {content.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <AppText variant="subtitle">{section.heading}</AppText>
          <AppText>{section.body}</AppText>
        </View>
      ))}
      <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
});
