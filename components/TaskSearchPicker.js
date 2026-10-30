import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@api';

const SEARCH_DELAY_MS = 300;

/**
 * Elegir una publicación (p. ej. el "siguiente recomendado"): al abrir sugiere tus
 * publicaciones recientes; al escribir busca entre todas las que puedes ver.
 */
const TaskSearchPicker = ({ visible, onClose, onSelect, excludeTaskId, title = 'Elegir publicación' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!visible) setQuery(''); }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const text = query.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('search/directory/', { params: { q: text, scope: 'tasks' } });
        if (!cancelled) setResults(Array.isArray(data?.tasks) ? data.tasks : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, text ? SEARCH_DELAY_MS : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, visible]);

  const visibleResults = results.filter((task) => String(task.id) !== String(excludeTaskId));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#868e96" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por título o descripción"
              placeholderTextColor="#999"
              style={styles.searchInput}
              autoCorrect={false}
              accessibilityLabel="Buscar publicación"
            />
          </View>
          {!query.trim() && !loading && visibleResults.length ? <Text style={styles.label}>Tus publicaciones recientes</Text> : null}
          {loading ? <ActivityIndicator style={styles.loader} color="#4dabf7" /> : (
            <FlatList
              data={visibleResults}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={(
                <Text style={styles.empty}>{query.trim() ? 'No se encontraron publicaciones.' : 'Escribe para buscar una publicación.'}</Text>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => { onSelect?.(item); onClose?.(); }}
                  accessibilityRole="button"
                  accessibilityLabel={`Elegir ${item.title || 'publicación'}`}
                >
                  <Ionicons name="document-text-outline" size={20} color="#4dabf7" />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.title || 'Sin título'}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      @{item.user?.username || 'usuario'}{item.pch ? ` · ${item.pch}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    height: '70%', backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', color: '#222' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#f1f3f5' },
  searchInput: { flex: 1, height: 42, fontSize: 14, color: '#333' },
  label: { fontSize: 12, fontWeight: '800', color: '#495057', marginTop: 10 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: '#868e96', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#343a40' },
  rowMeta: { fontSize: 12, color: '#868e96', marginTop: 2 },
});

export default TaskSearchPicker;
