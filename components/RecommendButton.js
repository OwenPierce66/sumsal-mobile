import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import api from '@api';
import { useUserRecommendations } from '@hooks/useApi';

const MAX_COMMENT = 200;

/**
 * Contador + icono de recomendación para el encabezado del perfil (junto al nombre).
 *
 * - Muestra cuántas recomendaciones tiene la persona (se omite si las ocultó).
 * - En perfiles ajenos el icono se pinta de color cuando ya la recomiendas y va en gris
 *   cuando no; al tocarlo se abre el modal para recomendar (con comentario), editar o quitar.
 * - En el perfil propio solo es informativo.
 *
 * Es independiente de la insignia "recomendado" que pone un administrador.
 */
const RecommendButton = ({ userId, isCurrentUser }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useUserRecommendations(userId);
  const [modalVisible, setModalVisible] = useState(false);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  if (!userId) return null;

  const recommended = Boolean(data?.is_recommended_by_me);
  const count = data?.received_count;

  const applyResponse = (payload) => {
    queryClient.setQueryData(['userRecommendations', userId], payload);
    queryClient.invalidateQueries({ queryKey: ['userRecommendations'] });
  };

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

  const icon = (
    <Ionicons
      name={recommended ? 'ribbon' : 'ribbon-outline'}
      size={26}
      color={recommended ? '#f59f00' : '#adb5bd'}
    />
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="small" color="#adb5bd" />
      ) : (
        <>
          {typeof count === 'number' ? <Text style={styles.count}>{count}</Text> : null}
          {isCurrentUser ? icon : (
            <TouchableOpacity
              onPress={openModal}
              disabled={isError}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={recommended ? 'Editar mi recomendación' : 'Recomendar'}
              accessibilityState={{ selected: recommended }}
            >
              {icon}
            </TouchableOpacity>
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
              {recommended ? 'Tu recomendación' : 'Recomendar a esta persona'}
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
              {recommended ? (
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
  container: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 12 },
  count: { color: '#555', fontWeight: '800', fontSize: 16 },
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

export default RecommendButton;
