import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Platform,
  ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { getImageUrl } from '@api';
import { useFavoritesCollection } from '@hooks/useApi';
import {
  PCH_LABELS,
  PCH_ICONS,
  getTaskThumbnail,
  getTaskAuthor,
  toFavoriteAportaciones,
  filterAportaciones,
} from '../utils/aportaciones';

const PCH_FILTERS = [
  ['', 'Todas'],
  ['consejos', 'Consejos'],
  ['peticiones', 'Peticiones'],
  ['historias', 'Historias'],
];

/**
 * Hoja para elegir una de mis aportaciones favoritas y adjuntarla a un
 * comentario. Las ancladas (top 5) salen primero, como en Favoritos.
 */
const FavoriteAportacionPicker = ({ visible, onClose, onSelect, selectedId, excludeTaskId }) => {
  const [query, setQuery] = useState('');
  const [pch, setPch] = useState('');
  const { data, isLoading, isError, refetch } = useFavoritesCollection(null, { enabled: visible });

  // Al abrir se refresca (pudo agregar favoritas en otra pantalla); al cerrar se limpia.
  useEffect(() => {
    if (visible) {
      refetch({ cancelRefetch: false });
    } else {
      setQuery('');
      setPch('');
    }
  }, [visible, refetch]);

  const favorites = useMemo(
    () => toFavoriteAportaciones(data?.tasks, excludeTaskId),
    [data, excludeTaskId],
  );
  const results = useMemo(() => filterAportaciones(favorites, { query, pch }), [favorites, query, pch]);

  const renderItem = ({ item }) => {
    const thumbnail = getImageUrl(getTaskThumbnail(item));
    const author = getTaskAuthor(item);
    const isSelected = selectedId != null && String(selectedId) === String(item.id);
    const meta = [author && `@${author}`, PCH_LABELS[item.pch]].filter(Boolean).join(' · ');

    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => onSelect(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`Adjuntar ${item.title || 'aportación sin título'}`}
      >
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name={PCH_ICONS[item.pch] || 'document-text-outline'} size={22} color="#4dabf7" />
          </View>
        )}
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={2}>{item.title || 'Sin título'}</Text>
          {meta ? <Text style={styles.rowMeta} numberOfLines={1}>{meta}</Text> : null}
        </View>
        {item.isPinned ? (
          <Ionicons name="pin" size={15} color="#845ef7" accessibilityLabel="Anclada en tu top 5" />
        ) : null}
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
          size={24}
          color={isSelected ? '#40c057' : '#4dabf7'}
        />
      </TouchableOpacity>
    );
  };

  let emptyState = null;
  if (isLoading) {
    emptyState = <ActivityIndicator size="large" color="#4dabf7" style={styles.loading} />;
  } else if (isError && !data) {
    emptyState = (
      <View style={styles.empty}>
        <Ionicons name="cloud-offline-outline" size={36} color="#adb5bd" />
        <Text style={styles.emptyTitle}>No se pudieron cargar tus favoritas</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (favorites.length === 0) {
    emptyState = (
      <View style={styles.empty}>
        <Ionicons name="star-outline" size={36} color="#adb5bd" />
        <Text style={styles.emptyTitle}>Aún no tienes aportaciones favoritas</Text>
        <Text style={styles.emptyHint}>
          Abre el menú ⋮ de una aportación y elige “Agregar a favoritos” para poder adjuntarla aquí.
        </Text>
      </View>
    );
  } else if (results.length === 0) {
    emptyState = (
      <View style={styles.empty}>
        <Ionicons name="search-outline" size={36} color="#adb5bd" />
        <Text style={styles.emptyTitle}>Ninguna favorita coincide</Text>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Cerrar"
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Adjuntar aportación favorita</Text>
              <Text style={styles.subtitle}>Acompaña tu comentario con una de tus favoritas.</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {favorites.length > 0 ? (
            <>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color="#868e96" />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar por título, autor o categoría"
                  placeholderTextColor="#999"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query ? (
                  <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Limpiar búsqueda">
                    <Ionicons name="close-circle" size={18} color="#adb5bd" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.filters}>
                {PCH_FILTERS.map(([value, label]) => (
                  <TouchableOpacity
                    key={value || 'all'}
                    style={[styles.filterChip, pch === value && styles.filterChipActive]}
                    onPress={() => setPch(value)}
                    accessibilityState={{ selected: pch === value }}
                  >
                    <Text style={[styles.filterText, pch === value && styles.filterTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : null}

          {emptyState || (
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
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
    height: '78%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#d9dde1', alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#222' },
  subtitle: { fontSize: 13, color: '#777', marginTop: 3 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: '#f1f3f5',
  },
  searchInput: { flex: 1, height: 42, fontSize: 14, color: '#333' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f1f3f5' },
  filterChipActive: { backgroundColor: '#333' },
  filterText: { fontSize: 12, fontWeight: '700', color: '#666' },
  filterTextActive: { color: '#fff' },
  listContent: { paddingVertical: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
    borderRadius: 12, marginBottom: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f3f5',
  },
  rowSelected: { borderColor: '#8ce99a', backgroundColor: '#f4fce3' },
  thumbnail: { width: 54, height: 54, borderRadius: 10, backgroundColor: '#e9ecef' },
  thumbnailPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7f5ff' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  rowMeta: { fontSize: 12, color: '#868e96', marginTop: 3 },
  loading: { marginTop: 40 },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 36, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#495057', textAlign: 'center' },
  emptyHint: { fontSize: 13, color: '#868e96', textAlign: 'center', lineHeight: 19 },
  retryBtn: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#e7f5ff' },
  retryText: { color: '#1c7ed6', fontWeight: '700' },
});

export default FavoriteAportacionPicker;
