import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Switch,
  ActivityIndicator, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptionCheckout } from '@hooks/useSubscriptionCheckout';
import {
  CURRENCIES,
  amountError,
  formatMoney,
  parseAmount,
  subscriptionErrorMessage,
} from '../utils/subscriptions';

/**
 * Hoja para suscribirse: monto libre (mínimo 10 MXN o 1 USD), moneda y si se
 * renueva sola cada mes. `recipient` es el perfil al que se le regala; sin
 * él, la suscripción es para mí. El pago se hace en Stripe Checkout.
 */
const SubscribeSheet = ({ visible, onClose, recipient = null }) => {
  const { startCheckout, isStarting } = useSubscriptionCheckout();
  const [currency, setCurrency] = useState('mxn');
  const [amountText, setAmountText] = useState(String(CURRENCIES.mxn.recommended));
  const [autoRenew, setAutoRenew] = useState(true);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setCurrency('mxn');
    setAmountText(String(CURRENCIES.mxn.recommended));
    setAutoRenew(true);
    setServerError(null);
  }, [visible]);

  const chooseCurrency = (code) => {
    setCurrency(code);
    setAmountText(String(CURRENCIES[code].recommended));
    setServerError(null);
  };

  const error = amountError(amountText, currency);
  const amount = parseAmount(amountText);
  const isGift = Boolean(recipient);

  const handlePay = async () => {
    if (error || isStarting) return;
    setServerError(null);
    try {
      await startCheckout({
        amount: amountText.trim().replace(',', '.'),
        currency,
        auto_renew: autoRenew,
        ...(isGift ? { recipient_id: recipient.id } : {}),
      });
      onClose?.();
    } catch (err) {
      const message = subscriptionErrorMessage(err);
      if (err?.response?.status === 400) setServerError(message);
      else Alert.alert('No se pudo iniciar el pago', message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Cerrar"
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Ionicons name={isGift ? 'gift' : 'star'} size={26} color="#51cf66" />
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {isGift ? `Suscribir a @${recipient.username}` : 'Suscribirme'}
              </Text>
              <Text style={styles.subtitle}>
                {isGift
                  ? 'Tú pagas y la suscripción aparece en su perfil.'
                  : 'Tu suscripción aparece en tu perfil.'}
                {' '}Tú eliges cuánto aportar al mes.
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Moneda</Text>
          <View style={styles.chips}>
            {Object.values(CURRENCIES).map((option) => (
              <TouchableOpacity
                key={option.code}
                style={[styles.chip, currency === option.code && styles.chipActive]}
                onPress={() => chooseCurrency(option.code)}
                accessibilityRole="button"
                accessibilityState={{ selected: currency === option.code }}
              >
                <Text style={[styles.chipText, currency === option.code && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Monto al mes</Text>
          <View style={[styles.amountBox, error && styles.amountBoxError]}>
            <Text style={styles.amountPrefix}>$</Text>
            <TextInput
              value={amountText}
              onChangeText={(text) => { setAmountText(text); setServerError(null); }}
              keyboardType="decimal-pad"
              style={styles.amountInput}
              accessibilityLabel="Monto al mes"
              maxLength={9}
            />
            <Text style={styles.amountSuffix}>{CURRENCIES[currency].label}</Text>
          </View>
          <View style={styles.chips}>
            {CURRENCIES[currency].presets.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[styles.chip, amount === preset && styles.chipActive]}
                onPress={() => { setAmountText(String(preset)); setServerError(null); }}
              >
                <Text style={[styles.chipText, amount === preset && styles.chipTextActive]}>
                  {formatMoney(preset, currency)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {error || serverError ? (
            <Text style={styles.error}>{error || serverError}</Text>
          ) : (
            <Text style={styles.hint}>
              Mínimo {formatMoney(CURRENCIES[currency].min, currency)} al mes.
            </Text>
          )}

          <View style={styles.renewRow}>
            <View style={styles.renewText}>
              <Text style={styles.renewTitle}>Renovar automáticamente</Text>
              <Text style={styles.hint}>
                {autoRenew
                  ? 'Se cobra cada mes hasta que lo apagues.'
                  : 'Se cobra solo este mes y termina sola.'}
              </Text>
            </View>
            <Switch
              value={autoRenew}
              onValueChange={setAutoRenew}
              accessibilityLabel="Renovar automáticamente"
            />
          </View>

          <TouchableOpacity
            style={[styles.payButton, (error || isStarting) && styles.payButtonDisabled]}
            onPress={handlePay}
            disabled={Boolean(error) || isStarting}
            accessibilityRole="button"
            accessibilityLabel="Ir a pagar"
          >
            {isStarting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payText}>
                {error ? 'Ir a pagar' : `Pagar ${formatMoney(amount, currency)} al mes`}
              </Text>
            )}
          </TouchableOpacity>
          <Text style={styles.footnote}>
            El pago se hace de forma segura en Stripe. Puedes cambiar la renovación cuando quieras desde Mis suscripciones.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#d9dde1', alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#222' },
  subtitle: { fontSize: 13, color: '#777', marginTop: 3 },
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
  hint: { fontSize: 12, color: '#868e96' },
  error: { fontSize: 12, color: '#e03131', fontWeight: '600' },
  renewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, marginBottom: 16 },
  renewText: { flex: 1 },
  renewTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 2 },
  payButton: { height: 48, borderRadius: 14, backgroundColor: '#2f9e44', alignItems: 'center', justifyContent: 'center' },
  payButtonDisabled: { backgroundColor: '#adb5bd' },
  payText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  footnote: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 10 },
});

export default SubscribeSheet;
