import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';

// ⚡ Modal propio: solo consulta los filtros guardados del perfil (su CRUD),
// nunca renderiza tareas. Aplicar un filtro solo entrega el payload al padre.
const SavedFiltersModal = ({ visible, onClose, currentFilters, onApplyFilter }) => {
  const [savedFilters, setSavedFilters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSavedFilters = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('saved-filters/');
      setSavedFilters(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('[SavedFiltersModal] Error cargando filtros:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchSavedFilters();
  }, [visible, fetchSavedFilters]);

  const handleSaveCurrent = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const response = await api.post('saved-filters/', {
        name: newName.trim(),
        filters: currentFilters || {},
      });
      setSavedFilters(prev => [response.data, ...prev]);
      setNewName('');
    } catch (error) {
      const detail = error.response?.data?.name || error.response?.data?.detail;
      Alert.alert('No se pudo guardar', String(detail || 'Intenta con otro nombre.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    const executeDelete = async () => {
      try {
        await api.delete(`saved-filters/${item.id}/`);
        setSavedFilters(prev => prev.filter(f => f.id !== item.id));
      } catch (error) {
        Alert.alert('Error', 'No se pudo eliminar el filtro.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar el filtro "${item.name}"?`)) executeDelete();
    } else {
      Alert.alert('Eliminar filtro', `¿Eliminar el filtro "${item.name}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: executeDelete },
      ]);
    }
  };

  const handleApply = (item) => {
    onApplyFilter?.(item.filters || {});
    onClose?.();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Mis filtros guardados</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.saveRow}>
            <TextInput
              style={styles.input}
              placeholder="Nombre del filtro actual..."
              placeholderTextColor="#999"
              value={newName}
              onChangeText={setNewName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCurrent} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="save-outline" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#4dabf7" style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={savedFilters}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => handleApply(item)}>
                  <Ionicons name="filter" size={18} color="#4dabf7" />
                  <Text style={styles.rowText} numberOfLines={1}>{item.name}</Text>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Aún no guardas ningún filtro.</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  content: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '75%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', color: '#333' },
  saveRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  input: { flex: 1, backgroundColor: '#f1f3f5', borderRadius: 10, paddingHorizontal: 12, height: 42, color: '#333' },
  saveBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#4dabf7', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5', gap: 10 },
  rowText: { flex: 1, fontSize: 15, color: '#333', fontWeight: '600' },
  deleteBtn: { padding: 6 },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 24 },
});

export default SavedFiltersModal;
