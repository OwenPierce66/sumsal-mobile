import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Switch,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import api from '@api';
import SubscribeSheet from '@components/SubscribeSheet';
import { useMe, useMySubscriptions } from '@hooks/useApi';
import {
  PAYMENTS_UNAVAILABLE,
  SUBSCRIPTION_TIERS,
  formatMoney,
  renewalText,
  subscriptionErrorMessage,
} from '../utils/subscriptions';

/**
 * Mis suscripciones: las que pago (mía o regaladas, con su renovación
 * automática) y las que recibo, que se suman en mi perfil.
 */
const SubscriptionsScreen = ({ navigation, route }) => {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  // Con userId (de otro perfil) es solo lectura: no se cambia la renovación ni se suscribe desde aquí.
  const otherUserId = route?.params?.userId && String(route.params.userId) !== String(me?.id) ? route.params.userId : null;
  const { data, isLoading, isError, refetch, isRefetching } = useMySubscriptions(otherUserId);
  const name = otherUserId ? `@${data?.user?.username || route?.params?.username || 'usuario'}` : null;
  const [sheetVisible, setSheetVisible] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const paid = data?.paid ?? [];
  const received = data?.received ?? [];
  const summary = data?.summary;
  const tier = SUBSCRIPTION_TIERS[summary?.tier];
  const hasOwnActive = paid.some((sub) => sub.is_active && !sub.is_gift);

  const toggleAutoRenew = async (subscription, autoRenew) => {
    setUpdatingId(subscription.id);
    try {
      await api.patch(`subscriptions/${subscription.id}/`, { auto_renew: autoRenew });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    } catch (error) {
      Alert.alert('No se pudo cambiar la renovación', subscriptionErrorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  };

  // El botón siempre se ve; si aún no se puede pagar, se explica por qué.
  const openSubscribe = () => {
    if (data?.stripe_enabled) setSheetVisible(true);
    else Alert.alert(PAYMENTS_UNAVAILABLE.title, PAYMENTS_UNAVAILABLE.message);
  };

  const personLabel = (person, prefix) => (
    person?.id === me?.id ? `${prefix} mí` : `${prefix} @${person?.username || 'usuario'}`
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ProfileMain'))}
          style={styles.backBtn}
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{name ? `Suscripciones de ${name}` : 'Mis suscripciones'}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#2f9e44" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{name ? `En el perfil de ${name}` : 'En tu perfil'}</Text>
            {isError ? (
              <TouchableOpacity onPress={() => refetch()} accessibilityRole="button">
                <Text style={styles.muted}>No se pudieron cargar tus suscripciones. Toca para reintentar.</Text>
              </TouchableOpacity>
            ) : summary?.active && tier ? (
              <View style={styles.summaryRow}>
                <View style={[styles.badge, { backgroundColor: tier.color }]}>
                  <Ionicons name={tier.icon} size={13} color="#fff" />
                  <Text style={styles.badgeText}>{tier.label}</Text>
                </View>
                <Text style={styles.summaryAmount}>{formatMoney(summary.amount_usd, 'usd')} al mes</Text>
              </View>
            ) : (
              <Text style={styles.muted}>{name ? `${name} no tiene una suscripción activa.` : 'No tienes una suscripción activa.'}</Text>
            )}
            <Text style={styles.hint}>
              Se suman todas las suscripciones que recibes. Desde {formatMoney(8, 'usd')} al mes (o su equivalente en pesos) tu perfil muestra "Suscripción +".
            </Text>
            {!hasOwnActive && !name ? (
              <TouchableOpacity
                style={[styles.primaryButton, !data?.stripe_enabled && styles.primaryButtonDisabled]}
                onPress={openSubscribe}
                accessibilityRole="button"
              >
                <Ionicons name="star" size={16} color="#fff" />
                <Text style={styles.primaryText}>Suscribirme</Text>
              </TouchableOpacity>
            ) : null}
            {data && !data.stripe_enabled && !name ? (
              <Text style={styles.hint}>{PAYMENTS_UNAVAILABLE.message}</Text>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>{name ? 'Las que regala' : 'Las que pago'}</Text>
          {paid.length === 0 ? (
            <Text style={styles.empty}>
              {name
                ? `${name} no está regalando suscripciones ahora.`
                : 'Aún no pagas ninguna. Puedes suscribirte tú o regalar una desde el perfil de alguien.'}
            </Text>
          ) : paid.map((sub) => (
            <View key={sub.id} style={styles.row}>
              <Ionicons
                name={sub.is_gift ? 'gift-outline' : 'star-outline'}
                size={20}
                color={sub.is_active ? '#2f9e44' : '#adb5bd'}
              />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{personLabel(sub.recipient, 'Para')}</Text>
                <Text style={styles.rowSubtitle}>
                  {formatMoney(sub.amount, sub.currency)} al mes · {renewalText(sub)}
                </Text>
              </View>
              {sub.is_active && !name ? (
                <View style={styles.renew}>
                  {updatingId === sub.id ? (
                    <ActivityIndicator size="small" color="#2f9e44" />
                  ) : (
                    <Switch
                      value={sub.auto_renew}
                      onValueChange={(value) => toggleAutoRenew(sub, value)}
                      accessibilityLabel={`Renovar automáticamente ${personLabel(sub.recipient, 'para')}`}
                    />
                  )}
                  <Text style={styles.renewLabel}>Renovar</Text>
                </View>
              ) : null}
            </View>
          ))}

          <Text style={styles.sectionTitle}>{name ? 'Las que recibe' : 'Las que recibo'}</Text>
          {received.length === 0 ? (
            <Text style={styles.empty}>{name ? `${name} no recibe suscripciones ahora.` : 'Nadie te ha regalado una suscripción todavía.'}</Text>
          ) : received.map((sub) => (
            <View key={sub.id} style={styles.row}>
              <Ionicons name="heart-outline" size={20} color="#2f9e44" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{personLabel(sub.subscriber, 'De')}</Text>
                <Text style={styles.rowSubtitle}>
                  {formatMoney(sub.amount, sub.currency)} al mes · {renewalText(sub)}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.row, styles.supportsLink]}
            onPress={() => navigation.navigate('PetitionSupports', otherUserId ? { userId: otherUserId } : undefined)}
            accessibilityRole="button"
          >
            <Ionicons name="cash-outline" size={20} color="#2f9e44" />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{name ? `Apoyos a peticiones de ${name}` : 'Mis apoyos a peticiones'}</Text>
              <Text style={styles.rowSubtitle}>
                {name ? 'Las peticiones que apoyó y lo que recibieron las suyas' : 'Las peticiones que apoyaste y lo que recibieron las tuyas'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#adb5bd" />
          </TouchableOpacity>
        </ScrollView>
      )}

      {!name ? <SubscribeSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  topBar: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 16 },
  backBtn: { position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 50 : 16, zIndex: 10 },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#333', maxWidth: '75%' },
  loader: { marginTop: 40 },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, elevation: 2 },
  cardLabel: { fontSize: 13, fontWeight: '800', color: '#555' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  summaryAmount: { fontSize: 16, fontWeight: '800', color: '#333' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  muted: { fontSize: 14, color: '#868e96' },
  hint: { fontSize: 12, color: '#868e96' },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44,
    borderRadius: 14, backgroundColor: '#2f9e44',
  },
  primaryButtonDisabled: { backgroundColor: '#adb5bd' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#333', marginTop: 22, marginBottom: 8 },
  empty: { fontSize: 13, color: '#868e96' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8,
    borderRadius: 14, backgroundColor: '#fff',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  rowSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  renew: { alignItems: 'center' },
  renewLabel: { fontSize: 10, color: '#868e96' },
  supportsLink: { marginTop: 14, borderWidth: 1, borderColor: '#b2f2bb' },
});

export default SubscriptionsScreen;
