import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Platform,
  ActivityIndicator, KeyboardAvoidingView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePetitionSupportCheckout } from '@hooks/usePetitionSupport';
import { CURRENCIES, amountError, formatMoney, parseAmount, subscriptionErrorMessage } from '../utils/subscriptions';
import SupportAmountFields from './SupportAmountFields';

/**
 * Hoja para apoyar monetariamente una petición: un pago único (mínimo 10 MXN o
 * 1 USD) en Stripe Checkout. La puede usar quien creó la petición y cualquier otra persona.
 */
const PetitionSupportSheet = ({ visible, onClose, task, isOwner = false }) => {
  const { startCheckout, isStarting } = usePetitionSupportCheckout();
  const [currency, setCurrency] = useState('mxn');
  const [amountText, setAmountText] = useState(String(CURRENCIES.mxn.recommended));
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setCurrency('mxn');
    setAmountText(String(CURRENCIES.mxn.recommended));
    setServerError(null);
  }, [visible]);

  const chooseCurrency = (code) => {
    setCurrency(code);
    setAmountText(String(CURRENCIES[code].recommended));
    setServerError(null);
  };

  const error = amountError(amountText, currency, '');
  const amount = parseAmount(amountText);

  const handlePay = async () => {
    if (error || isStarting || !task?.id) return;
    setServerError(null);
    try {
      await startCheckout(task.id, { amount: amountText.trim().replace(',', '.'), currency });
      onClose?.();
    } catch (err) {
      const message = subscriptionErrorMessage(err);
      if (err?.response?.status === 400) setServerError(message);
      else Alert.alert('No se pudo iniciar el pago', message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Ionicons name="cash-outline" size={26} color="#2f9e44" />
            <View style={styles.headerText}>
              <Text style={styles.title}>Apoyar petición</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {task?.title ? `«${task.title}». ` : ''}
                {isOwner
                  ? 'Es tu petición: lo que aportes también suma al total recaudado.'
                  : 'Tu aporte se suma al total recaudado de la petición.'}
              </Text>
            </View>
          </View>

          <SupportAmountFields
            currency={currency}
            amountText={amountText}
            onChangeCurrency={chooseCurrency}
            onChangeAmount={(text) => { setAmountText(text); setServerError(null); }}
            error={error || serverError}
          />

          <TouchableOpacity
            style={[styles.payButton, (error || isStarting) && styles.payButtonDisabled]}
            onPress={handlePay}
            disabled={Boolean(error) || isStarting}
            accessibilityRole="button"
            accessibilityLabel="Ir a pagar el apoyo"
          >
            {isStarting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payText}>{error ? 'Ir a pagar' : `Apoyar con ${formatMoney(amount, currency)}`}</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.footnote}>El pago se hace de forma segura en Stripe. No se repite: es un solo cobro.</Text>
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
  payButton: { height: 48, borderRadius: 14, backgroundColor: '#2f9e44', alignItems: 'center', justifyContent: 'center' },
  payButtonDisabled: { backgroundColor: '#adb5bd' },
  payText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  footnote: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 10 },
});

export default PetitionSupportSheet;
