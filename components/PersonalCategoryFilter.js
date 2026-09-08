import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';
import CategoryHierarchy from './CategoryHierarchy';

// ⚡ Filtro personal por perfil: categorías propias guardadas aparte (CRUD),
// no recalculadas al renderizar tareas. Se muestra igual que CategoryHierarchy
// en TasksScreen; en modo dueño permite agregar, quitar y reordenar.
const PersonalCategoryFilter = ({ userId, isOwner = false, title, onSelect }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [newName, setNewName] = useState('');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isOwner ? 'categories/' : `categories/user/${userId}/`;
      const response = await api.get(endpoint);
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('[PersonalCategoryFilter] Error cargando filtro:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  }, [isOwner, userId]);

  useEffect(() => {
    if (isOwner || userId) fetchCategories();
  }, [isOwner, userId, fetchCategories]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (name.toLowerCase() === 'aprobada') {
      Alert.alert('No permitido', "La etiqueta 'aprobada' es exclusiva de administradores.");
      return;
    }
    try {
      const response = await api.post('categories/', { name });
      setCategories(prev => [...prev, response.data]);
      setNewName('');
    } catch (error) {
      const detail = error.response?.data?.name;
      Alert.alert('No se pudo agregar', String(detail || 'Intenta con otro nombre.'));
    }
  };

  const handleDelete = (cat) => {
    const executeDelete = async () => {
      try {
        await api.delete(`categories/${cat.id}/`);
        setCategories(prev => prev.filter(c => c.id !== cat.id));
      } catch (error) {
        Alert.alert('Error', 'No se pudo quitar la categoría.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Quitar "${cat.name}" de tu filtro?`)) executeDelete();
    } else {
      Alert.alert('Quitar categoría', `¿Quitar "${cat.name}" de tu filtro?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: executeDelete },
      ]);
    }
  };

  // Mismo concepto que usan los admins para acomodar categorías globales del filtro,
  // aplicado aquí al filtro personal (y reutilizable luego para perfiles/tareas favoritas).
  const moveItem = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setCategories(reordered);
    try {
      await api.patch('categories/reorder/', { order: reordered.map(c => c.id) });
    } catch (error) {
      console.error('[PersonalCategoryFilter] Error reordenando:', error.response?.data || error.message);
      fetchCategories();
    }
  };

  if (!isOwner && categories.length === 0 && !loading) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {isOwner && categories.length > 0 && (
          <TouchableOpacity onPress={() => setReorderMode(prev => !prev)}>
            <Ionicons name={reorderMode ? 'checkmark-done-outline' : 'swap-vertical-outline'} size={20} color="#4dabf7" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 10 }} />
      ) : reorderMode ? (
        <View style={styles.reorderList}>
          {categories.map((cat, index) => (
            <View key={cat.id} style={styles.reorderRow}>
              <Text style={styles.reorderText} numberOfLines={1}>{cat.name}</Text>
              <View style={styles.reorderActions}>
                <TouchableOpacity onPress={() => moveItem(index, -1)} disabled={index === 0}>
                  <Ionicons name="chevron-up" size={20} color={index === 0 ? '#ccc' : '#4dabf7'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveItem(index, 1)} disabled={index === categories.length - 1}>
                  <Ionicons name="chevron-down" size={20} color={index === categories.length - 1 ? '#ccc' : '#4dabf7'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(cat)}>
                  <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <CategoryHierarchy
          availableCategories={categories}
          showDescendants
          onSelect={onSelect}
        />
      )}

      {isOwner && !reorderMode && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Agregar categoría a mi filtro..."
            placeholderTextColor="#999"
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginHorizontal: 12, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  title: { fontSize: 13, fontWeight: '800', color: '#555' },
  reorderList: { marginTop: 6 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#f8f9fa', borderRadius: 10, marginBottom: 6 },
  reorderText: { flex: 1, color: '#333', fontWeight: '600', marginRight: 8 },
  reorderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, marginTop: 4 },
  addInput: { flex: 1, backgroundColor: '#f1f3f5', borderRadius: 10, paddingHorizontal: 12, height: 38, color: '#333' },
  addBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#4dabf7', alignItems: 'center', justifyContent: 'center' },
});

export default PersonalCategoryFilter;
