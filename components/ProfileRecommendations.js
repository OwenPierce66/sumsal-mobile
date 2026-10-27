import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';

import api, { getImageUrl } from '@api';
import { useUserRecommendations } from '@hooks/useApi';

/**
 * Sección de recomendaciones del perfil (se muestra desde el menú de 3 puntos).
 *
 * - Lista las recibidas y las dadas (con el comentario opcional), en dos pestañas.
 * - Si es el propio perfil: interruptor para mostrar u ocultar las recomendaciones a los demás.
 * - Si el dueño las ocultó, los demás solo ven un aviso.
 *
 * Recomendar se hace desde el icono junto al nombre (`RecommendButton`).
 */
const ProfileRecommendations = ({ userId, isCurrentUser, currentUserId, onOpenProfile }) => {
  const queryClient = useQueryClient();
  const { data, dataUpdatedAt, isLoading, isError, refetch } = useUserRecommendations(userId);
  const [tab, setTab] = useState('received');
  const [togglingPublic, setTogglingPublic] = useState(false);

  const applyResponse = useCallback((payload) => {
    queryClient.setQueryData(['userRecommendations', userId], payload);
    queryClient.invalidateQueries({ queryKey: ['userRecommendations'] });
  }, [queryClient, userId]);

  const togglePublic = async (value) => {
    if (togglingPublic) return;
    setTogglingPublic(true);
    try {
      const response = await api.patch(`users/${userId}/recommendations/`, { public: value });
      applyResponse(response.data);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar la privacidad.');
    } finally {
      setTogglingPublic(false);
    }
  };

  // Cambio inmediato del icono mientras llega la lista actualizada del servidor.
  const [overrides, setOverrides] = useState({});
  const [pendingPersonId, setPendingPersonId] = useState(null);
  useEffect(() => { setOverrides({}); }, [dataUpdatedAt]);

  const togglePersonRecommendation = async (personId, currentlyRecommended) => {
    if (!personId || pendingPersonId) return;
    setPendingPersonId(personId);
    setOverrides((prev) => ({ ...prev, [personId]: !currentlyRecommended }));
    try {
      const endpoint = `users/${personId}/recommendations/`;
      if (currentlyRecommended) await api.delete(endpoint);
      else await api.post(endpoint, {});
      await queryClient.invalidateQueries({ queryKey: ['userRecommendations'] });
    } catch (error) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[personId];
        return next;
      });
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo actualizar la recomendación.');
    } finally {
      setPendingPersonId(null);
    }
  };

  if (!userId) return null;

  const items = tab === 'received' ? data?.received : data?.given;
  const emptyText = tab === 'received'
    ? (isCurrentUser ? 'Aún nadie te ha recomendado.' : 'Aún nadie ha recomendado a esta persona.')
    : (isCurrentUser ? 'Aún no has recomendado a nadie.' : 'Esta persona aún no ha recomendado a nadie.');

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Recomendaciones</Text>
      </View>

      {isCurrentUser ? (
        <View style={styles.privacyRow}>
          <Text style={styles.privacyText}>
            {data?.public === false ? 'Solo tú ves tus recomendaciones' : 'Todos ven tus recomendaciones'}
          </Text>
          <Switch
            value={data?.public !== false}
            onValueChange={togglePublic}
            disabled={!data || togglingPublic}
            trackColor={{ true: '#a5d8ff', false: '#dee2e6' }}
            thumbColor={data?.public !== false ? '#4dabf7' : '#adb5bd'}
          />
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#4dabf7" />
      ) : isError ? (
        <TouchableOpacity onPress={() => refetch()} accessibilityRole="button">
          <Text style={styles.errorText}>No se pudieron cargar las recomendaciones. Toca para reintentar.</Text>
        </TouchableOpacity>
      ) : data?.hidden ? (
        <Text style={styles.hiddenText}>Esta persona mantiene ocultas sus recomendaciones.</Text>
      ) : (
        <>
          <View style={styles.tabs}>
            {[
              { key: 'received', label: 'Recibidas', count: data?.received_count },
              { key: 'given', label: 'Dadas', count: data?.given_count },
            ].map((entry) => (
              <TouchableOpacity
                key={entry.key}
                style={[styles.tab, tab === entry.key && styles.tabActive]}
                onPress={() => setTab(entry.key)}
                accessibilityRole="button"
              >
                <Text style={[styles.tabText, tab === entry.key && styles.tabTextActive]}>
                  {entry.label} ({entry.count ?? 0})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {items?.length ? items.map((item) => {
            const person = item.user || {};
            const name = person.username || [person.first_name, person.last_name].filter(Boolean).join(' ') || 'Usuario';
            const isSelf = currentUserId != null && String(person.id) === String(currentUserId);
            const recommended = person.id in overrides ? overrides[person.id] : Boolean(item.is_recommended_by_me);
            const baseCount = item.recommendations_count;
            const count = typeof baseCount === 'number'
              ? Math.max(0, baseCount + (person.id in overrides ? (overrides[person.id] ? 1 : 0) - (item.is_recommended_by_me ? 1 : 0) : 0))
              : null;
            return (
              <View key={item.id} style={styles.row}>
                <TouchableOpacity
                  style={styles.rowMain}
                  onPress={() => onOpenProfile?.(person)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir perfil de ${name}`}
                >
                  <Image
                    source={{ uri: getImageUrl(person.user_image || person.profile?.user_image) }}
                    style={styles.avatar}
                  />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                    {item.comment ? <Text style={styles.rowComment}>{item.comment}</Text> : null}
                  </View>
                </TouchableOpacity>
                <View style={styles.rowEnd}>
                  {count !== null ? <Text style={styles.rowCount}>{count}</Text> : null}
                  {isSelf ? null : (
                    <TouchableOpacity
                      onPress={() => togglePersonRecommendation(person.id, recommended)}
                      disabled={pendingPersonId === person.id}
                      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={recommended ? `Quitar recomendación a ${name}` : `Recomendar a ${name}`}
                      accessibilityState={{ selected: recommended }}
                    >
                      <Ionicons
                        name={recommended ? 'ribbon' : 'ribbon-outline'}
                        size={22}
                        color={recommended ? '#f59f00' : '#adb5bd'}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }) : (
            <Text style={styles.emptyText}>{emptyText}</Text>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#333' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  privacyText: { color: '#777', fontSize: 13, flex: 1, marginRight: 12 },
  loader: { marginVertical: 12 },
  errorText: { color: '#d9480f', fontSize: 12 },
  hiddenText: { color: '#868e96', fontSize: 13, paddingVertical: 8 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f1f3f5' },
  tabActive: { backgroundColor: '#d0ebff' },
  tabText: { color: '#666', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#1864ab' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 10 },
  rowCount: { color: '#555', fontWeight: '800', fontSize: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eee', marginRight: 10 },
  rowBody: { flex: 1 },
  rowName: { color: '#333', fontWeight: '700', fontSize: 14 },
  rowComment: { color: '#555', fontSize: 13, marginTop: 2 },
  emptyText: { color: '#999', fontSize: 13, paddingVertical: 8 },
});

export default ProfileRecommendations;
