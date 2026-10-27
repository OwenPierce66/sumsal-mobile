import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSubscriptionStatus } from '@hooks/useApi';
import SubscribeSheet from './SubscribeSheet';
import {
  PAYMENTS_UNAVAILABLE,
  SUBSCRIPTION_TIERS,
  formatMoney,
  renewalText,
} from '../utils/subscriptions';

/**
 * Suscripción en el perfil: lo que recibe al mes (todas sus suscripciones
 * sumadas), la que yo le pago y el botón para suscribirme o regalarle una.
 */
const ProfileSubscription = ({ userId, username, isCurrentUser, navigation }) => {
  const { data, isError, refetch } = useSubscriptionStatus(userId);
  const [sheetVisible, setSheetVisible] = useState(false);

  if (!data && !isError) return null;

  // Si no carga, el botón sigue visible y explica por qué no se puede pagar aún.
  const status = data ?? {};

  const tier = SUBSCRIPTION_TIERS[status.tier];
  const mine = status.my_subscription;
  const subscribers = status.subscribers_count;
  const openManage = () => navigation.navigate('Subscriptions');
  const openSubscribe = () => {
    if (status.stripe_enabled) setSheetVisible(true);
    else Alert.alert(PAYMENTS_UNAVAILABLE.title, PAYMENTS_UNAVAILABLE.message);
  };

  return (
    <View style={styles.container}>
      {!data ? (
        <TouchableOpacity onPress={() => refetch()} accessibilityRole="button">
          <Text style={styles.inactiveText}>No se pudo cargar la suscripción. Toca para reintentar.</Text>
        </TouchableOpacity>
      ) : status.active && tier ? (
        <View style={styles.statusRow}>
          <View style={[styles.badge, { backgroundColor: tier.color }]}>
            <Ionicons name={tier.icon} size={13} color="#fff" />
            <Text style={styles.badgeText}>{tier.label}</Text>
          </View>
          <Text style={styles.statusText}>
            {formatMoney(status.amount_usd, 'usd')} al mes
            {subscribers > 1 ? ` · ${subscribers} suscriptores` : ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.inactiveText}>
          {isCurrentUser ? 'No tienes una suscripción activa.' : 'Sin suscripción activa.'}
        </Text>
      )}

      {mine ? (
        <Text style={styles.mineText}>
          {isCurrentUser ? 'Tu suscripción' : 'Le pagas'} {formatMoney(mine.amount, mine.currency)} al mes ·{' '}
          {renewalText(mine)}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {!mine ? (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, !status.stripe_enabled && styles.primaryButtonDisabled]}
            onPress={openSubscribe}
            accessibilityRole="button"
          >
            <Ionicons name={isCurrentUser ? 'star' : 'gift'} size={16} color="#fff" />
            <Text style={styles.primaryText}>
              {isCurrentUser ? 'Suscribirme' : `Suscribir a @${username}`}
            </Text>
          </TouchableOpacity>
        ) : null}
        {isCurrentUser || mine ? (
          <TouchableOpacity style={styles.button} onPress={openManage} accessibilityRole="button">
            <Ionicons name="card-outline" size={16} color="#2f9e44" />
            <Text style={styles.buttonText}>Mis suscripciones</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <SubscribeSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        recipient={isCurrentUser ? null : { id: userId, username }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 14, gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  statusText: { fontSize: 13, fontWeight: '700', color: '#495057' },
  inactiveText: { fontSize: 13, color: '#868e96' },
  mineText: { fontSize: 12, color: '#495057' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 18, backgroundColor: '#ebfbee', borderWidth: 1, borderColor: '#d3f9d8',
  },
  buttonText: { color: '#2f9e44', fontSize: 13, fontWeight: '700' },
  primaryButton: { backgroundColor: '#2f9e44', borderColor: '#2f9e44' },
  primaryButtonDisabled: { backgroundColor: '#adb5bd', borderColor: '#adb5bd' },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});

export default ProfileSubscription;
