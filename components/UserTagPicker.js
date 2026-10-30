import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Platform,
  ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@api';
import { NameWithBadges } from './UserBadges';

export const MAX_TAGS = 10;
const SEARCH_DELAY_MS = 300;

/**
 * Hoja para etiquetar personas en un comentario. Si la persona lo aprueba,
 * el comentario aparece en su perfil como testimonio.
 */
const UserTagPicker = ({ visible, onClose, selected = [], onChange, excludeIds = [] }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  useEffect(() => {
    const text = query.trim();
    if (!visible) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    // Sin texto: sugerencias al abrir (a quien sigues, quien te sigue y otras cuentas).
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('search/directory/', { params: { q: text, scope: 'profiles' } });
        if (!cancelled) setResults(Array.isArray(data?.profiles) ? data.profiles : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, text ? SEARCH_DELAY_MS : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, visible]);

  const selectedIds = selected.map((user) => String(user.id));
  const visibleResults = results.filter((user) => !excludeIds.map(String).includes(String(user.id)));

  const toggle = (user) => {
    const id = String(user.id);
    if (selectedIds.includes(id)) {
      onChange(selected.filter((item) => String(item.id) !== id));
    } else if (selected.length < MAX_TAGS) {
      onChange([...selected, { id: user.id, username: user.username }]);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Etiquetar personas</Text>
              <Text style={styles.subtitle}>
                Si lo aprueban, tu comentario aparecerá en su perfil como testimonio.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
              <Text style={styles.doneText}>Listo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#868e96" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nombre"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Buscar personas para etiquetar"
            />
          </View>
          <Text style={styles.counter}>{selected.length} de {MAX_TAGS} etiquetas</Text>
          {!query.trim() && !loading && visibleResults.length ? (
            <Text style={styles.sectionLabel}>Sugerencias</Text>
          ) : null}

          {loading ? (
            <ActivityIndicator style={styles.loader} color="#4dabf7" />
          ) : (
            <FlatList
              data={visibleResults}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={(
                <Text style={styles.empty}>
                  {query.trim() ? 'No se encontraron personas.' : 'Escribe un nombre para buscar a alguien.'}
                </Text>
              )}
              renderItem={({ item }) => {
                const isSelected = selectedIds.includes(String(item.id));
                const isFull = !isSelected && selected.length >= MAX_TAGS;
                return (
                  <TouchableOpacity
                    style={[styles.row, isFull && styles.rowDisabled]}
                    onPress={() => toggle(item)}
                    disabled={isFull}
                    accessibilityRole="button"
                    accessibilityLabel={`${isSelected ? 'Quitar etiqueta' : 'Etiquetar'} @${item.username}`}
                  >
                    <NameWithBadges userId={item.id} style={styles.name} containerStyle={styles.nameRow}>
                      @{item.username}
                    </NameWithBadges>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? '#4dabf7' : '#ced4da'}
                    />
                  </TouchableOpacity>
                );
              }}
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
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#d9dde1', alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#222' },
  subtitle: { fontSize: 13, color: '#777', marginTop: 3 },
  doneBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#4dabf7' },
  doneText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#f1f3f5' },
  searchInput: { flex: 1, height: 42, fontSize: 14, color: '#333' },
  counter: { fontSize: 12, color: '#868e96', marginTop: 6, marginBottom: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#495057', marginTop: 4 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: '#868e96', marginTop: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  rowDisabled: { opacity: 0.4 },
  nameRow: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#343a40' },
});

export default UserTagPicker;
