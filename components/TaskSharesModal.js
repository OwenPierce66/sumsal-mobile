<<<<<<< HEAD
import React, { useCallback, useMemo, useRef, useState } from 'react';
=======
import React, { useCallback, useEffect, useRef, useState } from 'react';
>>>>>>> mis-cambios-hoy
import {
  ActivityIndicator, FlatList, Modal, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
<<<<<<< HEAD
import { FeedVideoVisibilityContext } from '@components/TaskPostCard';
=======
import { Image } from 'expo-image';
import moment from 'moment';
import 'moment/locale/es';
import api, { getImageUrl } from '@api';

const getSharerName = (userObj) => {
  if (!userObj) return 'Usuario';
  if (userObj.first_name) return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
  if (userObj.username) return userObj.username;
  if (userObj.email) return userObj.email.split('@')[0];
  return 'Usuario';
};
>>>>>>> mis-cambios-hoy

/**
 * Modal con TODAS las veces que se compartió una publicación.
 *
<<<<<<< HEAD
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
=======
 * El feed muestra una sola tarjeta por usuario y publicación (su compartida
 * más reciente); aquí se ven todas, cada una con su propia descripción.
 * Se abre desde el botón "Ver compartidas" del menú de 3 puntos.
 *
 * Props:
 *  - visible, onClose
 *  - taskId: id de la publicación original
 *  - onOpenShared(sharedTaskId): se llama al tocar una compartida
 */
const TaskSharesModal = ({ visible, onClose, taskId, onOpenShared }) => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);

  const loadPage = useCallback(async (pageToLoad) => {
    if (!taskId) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('shared-tasks/', {
        params: { task_id: taskId, page: pageToLoad },
      });
      if (requestId !== requestRef.current) return;
      const data = response.data;
      const results = Array.isArray(data) ? data : data?.results ?? [];
      setItems((previous) => {
        if (pageToLoad === 1) return results;
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...results.filter((item) => !seen.has(item.id))];
      });
      setPage(pageToLoad);
      setHasMore(Boolean(!Array.isArray(data) && data?.next));
    } catch (requestError) {
      if (requestId !== requestRef.current) return;
      console.error('[TaskSharesModal] Error cargando compartidas:', requestError.response?.data || requestError.message);
      setError(true);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!visible || !taskId) return undefined;
    setItems([]);
    setPage(1);
    setHasMore(false);
    loadPage(1);
    return () => {
      requestRef.current += 1;
    };
  }, [visible, taskId, loadPage]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => onOpenShared?.(item.id)}
    >
      <Image
        source={{ uri: getImageUrl(item.shared_by?.user_image) || 'https://ui-avatars.com/api/?name=User&background=random' }}
        style={styles.avatar}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Text style={styles.name} numberOfLines={1}>{getSharerName(item.shared_by)}</Text>
          <Text style={styles.date}>{moment(item.created_at).fromNow()}</Text>
        </View>
        <Text style={item.description ? styles.description : styles.noDescription} numberOfLines={4}>
          {item.description || 'Compartió sin descripción'}
        </Text>
        <View style={styles.stats}>
          <Ionicons name="heart-outline" size={14} color="#999" />
          <Text style={styles.statText}>{item.likes_count || 0}</Text>
          <Ionicons name="chatbubble-outline" size={14} color="#999" style={{ marginLeft: 12 }} />
          <Text style={styles.statText}>{item.comments_count || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
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
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (hasMore && !loading) loadPage(page + 1);
            }}
            ListFooterComponent={loading ? <ActivityIndicator style={styles.loader} color="#4dabf7" /> : null}
            ListEmptyComponent={loading ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {error ? 'No se pudieron cargar las compartidas.' : 'Nadie ha compartido esta publicación todavía.'}
                </Text>
                {error ? (
                  <TouchableOpacity style={styles.retry} onPress={() => loadPage(1)}>
                    <Text style={styles.retryText}>Reintentar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          />
>>>>>>> mis-cambios-hoy
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 34, paddingBottom: 16, backgroundColor: '#fff' },
  headerBack: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '800', color: '#333' },
  listWrap: { flex: 1 },
  listContent: { paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  loader: { marginVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
=======
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    maxHeight: '80%',
    minHeight: '40%',
  },
  handle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 17, fontWeight: '700', color: '#222', flex: 1, marginRight: 12 },
  row: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5e5' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#eee' },
  rowBody: { flex: 1 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '700', color: '#222', flex: 1, marginRight: 8 },
  date: { fontSize: 12, color: '#999' },
  description: { fontSize: 14, color: '#333', marginTop: 4 },
  noDescription: { fontSize: 14, color: '#999', fontStyle: 'italic', marginTop: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statText: { fontSize: 12, color: '#777', marginLeft: 4 },
  loader: { marginVertical: 16 },
  empty: { alignItems: 'center', paddingVertical: 32 },
>>>>>>> mis-cambios-hoy
  emptyText: { color: '#999', textAlign: 'center' },
  retry: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#4dabf7' },
  retryText: { color: '#fff', fontWeight: '700' },
});

export default TaskSharesModal;
