import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Avatar, GlassPanel, Pill, VerifiedBadge } from '@/components/ui';
import { radius, spacing, type AppColors, useStyles } from '@/theme';

import { experienceLabel, initials, professionLabel, regionLabel, startingPrice } from '../format';
import type { PublicCaregiver } from '../types';

/** Cartão do profissional na busca e nos favoritos. Toque abre os detalhes. */
export function CaregiverCard({ caregiver, onPress }: { caregiver: PublicCaregiver; onPress: () => void }) {
  const styles = useStyles(createStyles);
  const price = startingPrice(caregiver.rates);
  const experience = experienceLabel(caregiver.experienceYears);
  const summary = [
    caregiver.displayName,
    professionLabel(caregiver.profession),
    caregiver.verified ? 'verificado' : null,
    caregiver.availableNow ? 'disponível agora' : null,
    regionLabel(caregiver.region),
    price,
    caregiver.favorite ? 'nos seus favoritos' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={summary}
      accessibilityHint="Abre o perfil do profissional"
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <GlassPanel>
        <View style={styles.row}>
          <Avatar initials={initials(caregiver.displayName)} />
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <AppText variant="bodyStrong" style={styles.name} numberOfLines={1}>
                {caregiver.displayName}
              </AppText>
              {caregiver.favorite ? (
                <AppText variant="caption" tone="primary" accessibilityElementsHidden>
                  ★ Favorito
                </AppText>
              ) : null}
            </View>
            <AppText variant="caption" tone="muted">
              {professionLabel(caregiver.profession)}
              {experience ? ` · ${experience}` : ''}
            </AppText>
          </View>
        </View>

        <View style={styles.badges}>
          {caregiver.verified ? <VerifiedBadge size="sm" /> : null}
          {caregiver.availableNow ? <Pill label="Disponível agora" tone="success" /> : null}
        </View>

        <AppText variant="caption" tone="muted">
          {regionLabel(caregiver.region)}
        </AppText>
        {price ? <AppText variant="label">{price}</AppText> : null}
      </GlassPanel>
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    pressable: {
      borderRadius: radius.xl,
    },
    pressed: {
      opacity: 0.85,
      backgroundColor: colors.glassPressed,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    info: {
      flex: 1,
      gap: spacing.xxs,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    name: {
      flexShrink: 1,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
  });
