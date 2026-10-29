import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/es';
import { useMe, useMyPetitionSupports } from '@hooks/useApi';
import PetitionSupportersModal from '@components/PetitionSupportersModal';
import { PAYMENTS_UNAVAILABLE, formatMoney } from '../utils/subscriptions';

/**
 * Mis apoyos: las peticiones que apoyé (con lo que di a cada una) y lo que
 * recibieron las mías. Como Mis suscripciones, pero de pagos únicos.
 * Con `route.params.userId` muestra los de otro perfil (es información pública).
 */
const PetitionSupportsScreen = ({ navigation, route }) => {
  const { data: me } = useMe();
  const otherUserId = route?.params?.userId && String(route.params.userId) !== String(me?.id) ? route.params.userId : null;
  const { data, isLoading, isError, refetch, isRefetching } = useMyPetitionSupports(otherUserId);
  const name = otherUserId ? `@${data?.user?.username || route?.params?.username || 'usuario'}` : null;
  const [supportersTaskId, setSupportersTaskId] = useState(null);

  const given = data?.given ?? [];
  const received = data?.received ?? [];
  const summary = data?.summary;

  // Una petición que su autor volvió a ocultar ya no se puede abrir.
  const canOpen = (task) => !task.is_hidden || String(task.user?.id) === String(me?.id);
  const openTask = (task) => canOpen(task) && navigation.push('TaskDetail', { taskId: task.id });
  const when = (date) => (date ? moment(date).locale('es').fromNow() : '');

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
        <Text style={styles.topBarTitle} numberOfLines={1}>{name ? `Apoyos de ${name}` : 'Mis apoyos'}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#2f9e44" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Apoyo monetario a peticiones</Text>
            {isError ? (
              <TouchableOpacity onPress={() => refetch()} accessibilityRole="button">
                <Text style={styles.muted}>No se pudieron cargar tus apoyos. Toca para reintentar.</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.totals}>
                <View style={styles.total}>
                  <Text style={styles.totalAmount}>{formatMoney(summary?.given_mxn, 'mxn')}</Text>
                  <Text style={styles.hint}>{name ? 'Ha dado' : 'Has dado'}</Text>
                </View>
                <View style={styles.total}>
                  <Text style={styles.totalAmount}>{formatMoney(summary?.received_mxn, 'mxn')}</Text>
                  <Text style={styles.hint}>{name ? 'Recibieron sus peticiones' : 'Recibieron tus peticiones'}</Text>
                </View>
              </View>
            )}
            <Text style={styles.hint}>
              Son pagos únicos. Para apoyar una petición usa el menú de 3 puntos o el ícono 💵 de su tarjeta.
              Lo pagado en dólares se muestra en pesos.
            </Text>
            {data && !data.stripe_enabled ? <Text style={styles.hint}>{PAYMENTS_UNAVAILABLE.message}</Text> : null}
          </View>

          <Text style={styles.sectionTitle}>{name ? 'Peticiones que apoyó' : 'Peticiones que apoyé'}</Text>
          {given.length === 0 ? (
            <Text style={styles.empty}>{name ? `${name} aún no apoya ninguna petición.` : 'Aún no apoyas ninguna petición.'}</Text>
          ) : given.map((row) => (
            <TouchableOpacity
              key={row.task.id}
              style={styles.row}
              onPress={() => openTask(row.task)}
              disabled={!canOpen(row.task)}
              accessibilityLabel={`Abrir petición ${row.task.title}`}
            >
              <Ionicons name="cash-outline" size={20} color="#2f9e44" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>{row.task.title || 'Petición'}</Text>
                <Text style={styles.rowSubtitle}>
                  de @{row.task.user?.username || 'usuario'} · {row.times === 1 ? '1 apoyo' : `${row.times} apoyos`} · {when(row.last_paid_at)}
                </Text>
              </View>
              <Text style={styles.amount}>{formatMoney(row.amount_mxn, 'mxn')}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionTitle}>{name ? 'Lo que recibieron sus peticiones' : 'Lo que recibieron mis peticiones'}</Text>
          {received.length === 0 ? (
            <Text style={styles.empty}>{name ? 'Nadie ha apoyado sus peticiones todavía.' : 'Nadie ha apoyado tus peticiones todavía.'}</Text>
          ) : received.map((row) => (
            <TouchableOpacity
              key={row.task.id}
              style={styles.row}
              onPress={() => setSupportersTaskId(row.task.id)}
              accessibilityLabel={`Ver quién apoyó ${row.task.title}`}
            >
              <Ionicons name="people-outline" size={20} color="#2f9e44" />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>{row.task.title || 'Petición'}</Text>
                <Text style={styles.rowSubtitle}>
                  {row.supporters_count === 1 ? '1 persona' : `${row.supporters_count} personas`} · último {when(row.last_paid_at)}
                </Text>
              </View>
              <Text style={styles.amount}>{formatMoney(row.amount_mxn, 'mxn')}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {supportersTaskId ? (
        <PetitionSupportersModal
          visible
          onClose={() => setSupportersTaskId(null)}
          taskId={supportersTaskId}
          navigation={navigation}
        />
      ) : null}
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
  totals: { flexDirection: 'row', gap: 12 },
  total: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#ebfbee' },
  totalAmount: { fontSize: 17, fontWeight: '800', color: '#2b8a3e' },
  muted: { fontSize: 14, color: '#868e96' },
  hint: { fontSize: 12, color: '#868e96' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#333', marginTop: 22, marginBottom: 8 },
  empty: { fontSize: 13, color: '#868e96' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8,
    borderRadius: 14, backgroundColor: '#fff',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  rowSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '800', color: '#2f9e44' },
});

export default PetitionSupportsScreen;
