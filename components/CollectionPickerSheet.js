import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@api';

/**
 * Elegir en qué colecciones (álbumes de guardados) va una publicación, o crear una nueva
 * con ella. Agregarla la guarda si faltaba. Sin React Query: solo vive mientras está abierta.
 */
const CollectionPickerSheet = ({ visible, taskId, onClose, onChanged }) => {
  const [collections, setCollections] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!visible || !taskId) return undefined;
    let active = true;
    setCollections(null);
    setError('');
    api.get(`tasks/${taskId}/collections/`)
      .then((response) => { if (active) setCollections(response.data || []); })
      .catch(() => { if (active) setError('No se pudieron cargar tus colecciones.'); });
    return () => { active = false; };
  }, [visible, taskId]);

  const toggle = async (collection) => {
    if (busyId) return;
    setBusyId(collection.id);
    setError('');
    try {
      const response = collection.contains
        ? await api.delete(`collections/${collection.id}/items/${taskId}/`)
        : await api.post(`collections/${collection.id}/items/`, { task_id: taskId });
      setCollections((previous) => previous.map((item) => (
        item.id === collection.id ? { ...item, ...response.data, contains: !collection.contains } : item
      )));
      onChanged?.();
    } catch {
      setError('No se pudo actualizar la colección.');
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name || busyId) return;
    setBusyId('new');
    setError('');
    try {
      const { data: created } = await api.post('collections/', { name });
      const { data: updated } = await api.post(`collections/${created.id}/items/`, { task_id: taskId });
      setCollections((previous) => [...(previous || []), { ...created, ...updated, contains: true }]);
      setNewName('');
      onChanged?.();
    } catch (requestError) {
      const data = requestError.response?.data;
      setError(String(data?.name?.[0] || data?.detail || 'No se pudo crear la colección.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Guardar en una colección</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {!collections && !error ? <ActivityIndicator style={styles.loader} color="#4dabf7" /> : null}
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {(collections || []).map((collection) => (
              <TouchableOpacity
                key={collection.id}
                style={styles.row}
                onPress={() => toggle(collection)}
                disabled={Boolean(busyId)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(collection.contains) }}
                accessibilityLabel={collection.name}
              >
                <Ionicons
                  name={collection.contains ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={collection.contains ? '#4dabf7' : '#adb5bd'}
                />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{collection.name}</Text>
                  <Text style={styles.rowMeta}>
                    {collection.count} {collection.count === 1 ? 'publicación' : 'publicaciones'}
                    {collection.is_private ? ' · solo tú' : ' · pública'}
                  </Text>
                </View>
                {busyId === collection.id ? <ActivityIndicator size="small" color="#4dabf7" /> : null}
              </TouchableOpacity>
            ))}
            {collections && !collections.length ? (
              <Text style={styles.empty}>Aún no tienes colecciones. Crea la primera aquí abajo.</Text>
            ) : null}
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.newRow}>
            <TextInput
              style={styles.input}
              placeholder="Nueva colección..."
              placeholderTextColor="#999"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={create}
              maxLength={60}
              accessibilityLabel="Nombre de la nueva colección"
            />
            <TouchableOpacity style={styles.addButton} onPress={create} disabled={Boolean(busyId)} accessibilityLabel="Crear colección">
              {busyId === 'new' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={22} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 18, paddingBottom: Platform.OS === 'ios' ? 36 : 22, maxHeight: '75%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '800', color: '#222' },
  loader: { marginVertical: 16 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#343a40' },
  rowMeta: { fontSize: 12, color: '#868e96', marginTop: 2 },
  empty: { color: '#868e96', marginVertical: 14 },
  error: { color: '#e03131', fontSize: 13, marginTop: 8 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  input: { flex: 1, height: 40, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#f1f3f5', color: '#333' },
  addButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#4dabf7', alignItems: 'center', justifyContent: 'center' },
});

export default CollectionPickerSheet;
