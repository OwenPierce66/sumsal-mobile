import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeedVideoVisibilityContext } from '@components/TaskPostCard';

/**
 * Modal con TODAS las veces que se compartió una publicación.
 *
 * El feed muestra una sola tarjeta por usuario y publicación (su compartida más
 * reciente); aquí se ven todas. Cada elemento se dibuja con `renderItem`, que es
 * la misma función que usa el feed de TasksScreen, así se ven y funcionan igual.
 *
 * Los videos solo se reproducen mientras están visibles en esta lista.
 */
const TaskSharesModal = ({
  visible,
  onClose,
  items,
  loading,
  error,
  onLoadMore,
  onRetry,
  renderItem,
}) => {
  const listRef = useRef(null);
  const [visibleIds, setVisibleIds] = useState(() => new Set());
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    setVisibleIds(new Set((viewableItems || []).map((entry) => String(entry?.item?.id ?? entry?.key))));
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20, minimumViewTime: 0 }).current;

  const getListBounds = useCallback((callback) => {
    const list = listRef.current;
    const node = list?.getNativeScrollRef ? list.getNativeScrollRef() : list?.getScrollableNode?.();
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
    } else {
      callback(null);
    }
  }, []);

  const videoVisibility = useMemo(
    () => ({ visibleIds, getListBounds }),
    [visibleIds, getListBounds]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Compartidas de esta publicación</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <FeedVideoVisibilityContext.Provider value={videoVisibility}>
            <FlatList
              ref={listRef}
              data={items}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onEndReachedThreshold={0.5}
              onEndReached={onLoadMore}
              initialNumToRender={4}
              windowSize={7}
              contentContainerStyle={styles.listContent}
              ListFooterComponent={loading ? <ActivityIndicator style={styles.loader} color="#4dabf7" /> : null}
              ListEmptyComponent={loading ? null : (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {error ? 'No se pudieron cargar las compartidas.' : 'Nadie ha compartido esta publicación todavía.'}
                  </Text>
                  {error ? (
                    <TouchableOpacity style={styles.retry} onPress={onRetry}>
                      <Text style={styles.retryText}>Reintentar</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            />
          </FeedVideoVisibilityContext.Provider>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#f1f3f5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    height: '88%',
    overflow: 'hidden',
  },
  handle: { width: 40, height: 4, backgroundColor: '#ced4da', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700', color: '#222', flex: 1, marginRight: 12 },
  listContent: { paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  loader: { marginVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyText: { color: '#999', textAlign: 'center' },
  retry: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#4dabf7' },
  retryText: { color: '#fff', fontWeight: '700' },
});

export default TaskSharesModal;
