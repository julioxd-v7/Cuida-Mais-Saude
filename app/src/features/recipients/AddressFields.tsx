import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/ui';
import { spacing } from '@/theme';

import { formatPostalCode, type AddressValues } from './addressForm';

/** Campos de endereço reutilizados (beneficiário e "meu endereço"). */
export function AddressFields({
  values,
  onChange,
  errors,
}: {
  values: AddressValues;
  onChange: (field: keyof AddressValues, value: string) => void;
  errors: Record<string, string | undefined>;
}) {
  return (
    <View style={styles.container}>
      <TextField
        label="CEP"
        keyboardType="number-pad"
        placeholder="00000-000"
        value={values.postalCode}
        onChangeText={(text) => onChange('postalCode', formatPostalCode(text))}
        error={errors.postalCode}
        maxLength={9}
        autoComplete="postal-code"
      />
      <TextField
        label="Rua"
        value={values.street}
        onChangeText={(text) => onChange('street', text)}
        error={errors.street}
        autoComplete="street-address"
      />
      <View style={styles.row}>
        <View style={styles.small}>
          <TextField label="Número" value={values.number} onChangeText={(text) => onChange('number', text)} maxLength={20} />
        </View>
        <View style={styles.wide}>
          <TextField
            label="Complemento"
            value={values.complement}
            onChangeText={(text) => onChange('complement', text)}
            maxLength={80}
          />
        </View>
      </View>
      <TextField label="Bairro" value={values.district} onChangeText={(text) => onChange('district', text)} maxLength={80} />
      <View style={styles.row}>
        <View style={styles.wide}>
          <TextField label="Cidade" value={values.city} onChangeText={(text) => onChange('city', text)} error={errors.city} />
        </View>
        <View style={styles.small}>
          <TextField
            label="UF"
            placeholder="SP"
            value={values.state}
            onChangeText={(text) => onChange('state', text.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))}
            error={errors.state}
            autoCapitalize="characters"
            maxLength={2}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  small: {
    flex: 1,
  },
  wide: {
    flex: 2,
  },
});
