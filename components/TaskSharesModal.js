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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerBack}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Compartidas</Text>
        </View>
        <View style={styles.listWrap}>
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
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 34, paddingBottom: 16, backgroundColor: '#fff' },
  headerBack: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '800', color: '#333' },
  listWrap: { flex: 1 },
  listContent: { paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  loader: { marginVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyText: { color: '#999', textAlign: 'center' },
  retry: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#4dabf7' },
  retryText: { color: '#fff', fontWeight: '700' },
});

export default TaskSharesModal;
