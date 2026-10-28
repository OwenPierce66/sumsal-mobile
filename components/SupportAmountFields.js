import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { CURRENCIES, formatMoney, parseAmount } from '../utils/subscriptions';

/**
 * Moneda + monto de un apoyo único a una petición (mínimo 10 MXN o 1 USD).
 * La usan la hoja de apoyo y el formulario de crear petición.
 */
const SupportAmountFields = ({ currency, amountText, onChangeCurrency, onChangeAmount, error }) => {
  const amount = parseAmount(amountText);
  return (
    <>
      <Text style={styles.label}>Moneda</Text>
      <View style={styles.chips}>
        {Object.values(CURRENCIES).map((option) => (
          <TouchableOpacity
            key={option.code}
            style={[styles.chip, currency === option.code && styles.chipActive]}
            onPress={() => onChangeCurrency(option.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: currency === option.code }}
          >
            <Text style={[styles.chipText, currency === option.code && styles.chipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Monto</Text>
      <View style={[styles.amountBox, error && styles.amountBoxError]}>
        <Text style={styles.amountPrefix}>$</Text>
        <TextInput
          value={amountText}
          onChangeText={onChangeAmount}
          keyboardType="decimal-pad"
          style={styles.amountInput}
          accessibilityLabel="Monto del apoyo"
          maxLength={9}
        />
        <Text style={styles.amountSuffix}>{CURRENCIES[currency].label}</Text>
      </View>
      <View style={styles.chips}>
        {CURRENCIES[currency].presets.map((preset) => (
          <TouchableOpacity
            key={preset}
            style={[styles.chip, amount === preset && styles.chipActive]}
            onPress={() => onChangeAmount(String(preset))}
          >
            <Text style={[styles.chipText, amount === preset && styles.chipTextActive]}>{formatMoney(preset, currency)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.hint}>Pago único. Mínimo {formatMoney(CURRENCIES[currency].min, currency)}.</Text>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '800', color: '#555', marginTop: 8, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: '#f1f3f5' },
  chipActive: { backgroundColor: '#333' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#666' },
  chipTextActive: { color: '#fff' },
  amountBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, marginBottom: 8,
    borderRadius: 12, backgroundColor: '#f1f3f5', borderWidth: 1, borderColor: '#f1f3f5',
  },
  amountBoxError: { borderColor: '#ff8787' },
  amountPrefix: { fontSize: 20, fontWeight: '800', color: '#333' },
  amountInput: { flex: 1, height: 48, fontSize: 20, fontWeight: '800', color: '#333' },
  amountSuffix: { fontSize: 14, fontWeight: '700', color: '#777' },
  hint: { fontSize: 12, color: '#868e96', marginBottom: 14 },
  error: { fontSize: 12, color: '#e03131', fontWeight: '600', marginBottom: 14 },
});

export default SupportAmountFields;
