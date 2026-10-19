import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';

import api, { getImageUrl } from '@api';
import { useUserRecommendations } from '@hooks/useApi';

const MAX_COMMENT = 200;

/**
 * Recomendaciones entre usuarios en el perfil.
 *
 * - Muestra las recibidas y las dadas (con el comentario opcional), en dos pestañas.
 * - Si el perfil es de otra persona: botón para recomendar (con comentario) o quitar.
 * - Si es el propio: interruptor para mostrar u ocultar las recomendaciones a los demás.
 * - Si el dueño las ocultó, los demás solo ven un aviso (el botón de recomendar sigue).
 *
 * Es independiente de la insignia "recomendado" que pone un administrador.
 */
const ProfileRecommendations = ({ userId, isCurrentUser, onOpenProfile }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useUserRecommendations(userId);
  const [tab, setTab] = useState('received');
  const [modalVisible, setModalVisible] = useState(false);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const applyResponse = useCallback((payload) => {
    queryClient.setQueryData(['userRecommendations', userId], payload);
    queryClient.invalidateQueries({ queryKey: ['userRecommendations'] });
  }, [queryClient, userId]);

  const openModal = () => {
    setComment(data?.my_comment || '');
    setModalVisible(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await api.post(`users/${userId}/recommendations/`, { comment: comment.trim() });
      applyResponse(response.data);
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo guardar la recomendación.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const response = await api.delete(`users/${userId}/recommendations/`);
      applyResponse(response.data);
      setModalVisible(false);
    } catch {
      Alert.alert('Error', 'No se pudo quitar la recomendación.');
    } finally {
      setSaving(false);
    }
  };

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

  if (!userId) return null;

  const items = tab === 'received' ? data?.received : data?.given;
  const emptyText = tab === 'received'
    ? (isCurrentUser ? 'Aún nadie te ha recomendado.' : 'Aún nadie ha recomendado a esta persona.')
    : (isCurrentUser ? 'Aún no has recomendado a nadie.' : 'Esta persona aún no ha recomendado a nadie.');

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Recomendaciones</Text>
        {!isCurrentUser ? (
          <TouchableOpacity
            style={[styles.recommendButton, data?.is_recommended_by_me && styles.recommendButtonActive]}
            onPress={openModal}
            disabled={isLoading || isError}
            accessibilityRole="button"
            accessibilityLabel={data?.is_recommended_by_me ? 'Editar mi recomendación' : 'Recomendar'}
          >
            <Ionicons
              name={data?.is_recommended_by_me ? 'ribbon' : 'ribbon-outline'}
              size={16}
              color={data?.is_recommended_by_me ? '#f59f00' : '#fff'}
            />
            <Text style={[styles.recommendButtonText, data?.is_recommended_by_me && styles.recommendButtonTextActive]}>
              {data?.is_recommended_by_me ? 'Recomendado' : 'Recomendar'}
            </Text>
          </TouchableOpacity>
        ) : null}
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
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
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
            );
          }) : (
            <Text style={styles.emptyText}>{emptyText}</Text>
          )}
        </>
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {data?.is_recommended_by_me ? 'Tu recomendación' : 'Recomendar a esta persona'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Comentario (opcional)"
              placeholderTextColor="#adb5bd"
              value={comment}
              onChangeText={setComment}
              maxLength={MAX_COMMENT}
              multiline
            />
            <Text style={styles.counter}>{comment.length}/{MAX_COMMENT}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)} disabled={saving}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              {data?.is_recommended_by_me ? (
                <TouchableOpacity style={styles.removeButton} onPress={remove} disabled={saving}>
                  <Text style={styles.removeText}>Quitar</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#333' },
  recommendButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f59f00', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  recommendButtonActive: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#f59f00' },
  recommendButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  recommendButtonTextActive: { color: '#e67700' },
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
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eee', marginRight: 10 },
  rowBody: { flex: 1 },
  rowName: { color: '#333', fontWeight: '700', fontSize: 14 },
  rowComment: { color: '#555', fontSize: 13, marginTop: 2 },
  emptyText: { color: '#999', fontSize: 13, paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#333', marginBottom: 12 },
  input: { minHeight: 80, maxHeight: 160, borderWidth: 1, borderColor: '#dee2e6', borderRadius: 12, padding: 12, color: '#333', textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', color: '#adb5bd', fontSize: 12, marginTop: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12 },
  cancelButton: { paddingHorizontal: 12, paddingVertical: 10 },
  cancelText: { color: '#666', fontWeight: '600' },
  removeButton: { paddingHorizontal: 12, paddingVertical: 10 },
  removeText: { color: '#e03131', fontWeight: '700' },
  saveButton: { minWidth: 90, alignItems: 'center', backgroundColor: '#4dabf7', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10 },
  saveText: { color: '#fff', fontWeight: '700' },
});

export default ProfileRecommendations;
