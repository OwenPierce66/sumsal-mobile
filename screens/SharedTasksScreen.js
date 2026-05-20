import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import moment from 'moment';
import api from '../api';

moment.locale('es');

const getImageUrl = (path) => {
  if (!path) return 'https://via.placeholder.com/40';
  let cleanPath = path.replace('localhost', '192.168.0.103').replace('127.0.0.1', '192.168.0.103');
  if (cleanPath.startsWith('http')) return cleanPath;
  return `http://192.168.0.103:8001${cleanPath}`;
};

const SharedTasksScreen = ({ navigation }) => {
  const [sharedTasks, setSharedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchSharedTasks = useCallback(async (pageNumber = 1) => {
    try {
      setLoading(true);
      const response = await api.get('shared-tasks/', {
        params: { page: pageNumber },
      });

      if (pageNumber === 1) {
        setSharedTasks(response.data.results || []);
      } else {
        setSharedTasks((prev) => [...prev, ...(response.data.results || [])]);
      }

      setHasMore(!!response.data.next);
      setPage(pageNumber);
    } catch (error) {
      console.error('Error fetching shared tasks:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSharedTasks(1);
    }, [fetchSharedTasks])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSharedTasks(1).finally(() => setRefreshing(false));
  };

  const loadMoreTasks = () => {
    if (hasMore && !loadingMore) {
      setLoadingMore(true);
      fetchSharedTasks(page + 1).finally(() => setLoadingMore(false));
    }
  };

  const handleLikeSharedTask = async (sharedTaskId) => {
    const sharedItem = sharedTasks.find(s => s.id === sharedTaskId);
    const isLiked = !sharedItem?.user_has_liked;

    // ⚡ ACTUALIZACIÓN OPTIMISTA AL INSTANTE
    setSharedTasks((prev) => prev.map((item) => {
      if (item.id === sharedTaskId) {
        return { ...item, user_has_liked: isLiked, likes_count: (item.likes_count || 0) + (isLiked ? 1 : -1) };
      }
      return item;
    }));

    try {
      const response = await api.post(`shared-tasks/${sharedTaskId}/like/`);
      setSharedTasks((prev) => prev.map((item) => {
        if (item.id !== sharedTaskId) return item;
        return {
          ...item,
          likes_count: response.data.likes_count_shared,
          user_has_liked: response.data.liked,
        };
      }));
    } catch (error) {
      console.error('Error liking shared task:', error.response?.data || error.message);
    }
  };

  const handleCommentSharedTask = (sharedTaskId) => {
    navigation.navigate('SharedTaskDetail', { sharedTaskId });
  };

  const handleShareSharedTask = async (taskId) => {
    if (!taskId) return;

    // ⚡ ACTUALIZACIÓN OPTIMISTA
    setSharedTasks((prev) => prev.map(s => s.task?.id === taskId ? { ...s, task: { ...s.task, share_count: (s.task.share_count || 0) + 1 } } : s));

    try {
      await api.post('shared-tasks/', { task_id: taskId, description: '' });
      fetchSharedTasks(1);
    } catch (error) {
      console.error('Error re-sharing task:', error.response?.data || error.message);
    }
  };

  const getUserName = (userObj, fallbackName = 'Usuario') => {
    if (!userObj) return fallbackName;
    if (userObj.first_name) return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
    if (userObj.username) return userObj.username;
    if (userObj.email) return userObj.email.split('@')[0];
    return fallbackName;
  };

  const renderSharedTaskCard = ({ item }) => {
    const task = item.task;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate('SharedTaskDetail', { sharedTaskId: item.id })
        }
        activeOpacity={0.9}
      >
        {/* ENCABEZADO: QUIÉN COMPARTIÓ */}
        <View style={styles.sharedByHeader}>
          <Image
            source={{ uri: getImageUrl(item.shared_by?.user_image) }}
            style={styles.sharedByAvatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.sharedByName}>{getUserName(item.shared_by)}</Text>
            <Text style={styles.sharedBySubtext}>compartió una tarea</Text>
          </View>
          <Text style={styles.sharedDate}>{moment(item.created_at).fromNow()}</Text>
        </View>

        {/* DESCRIPCIÓN DE COMPARTICIÓN */}
        {item.description && (
          <Text style={styles.sharedDescription}>{item.description}</Text>
        )}

        {/* TARJETA DE TAREA ORIGINAL */}
        <View style={styles.originalTaskCard}>
          <View style={styles.taskHeader}>
            <Image
              source={{ uri: getImageUrl(task.user?.user_image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) }}
              style={styles.taskAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskAuthor}>
                {getUserName(task.user) !== 'Usuario' ? getUserName(task.user) : (task.username || 'Anónimo')}
              </Text>
            </View>
          </View>

          <Text style={styles.taskDescription} numberOfLines={2}>
            {task.description}
          </Text>

          {/* ⚡ EXTRAEMOS LA PRIMERA IMAGEN DISPONIBLE */}
          {(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) && (
            <Image
              source={{ uri: getImageUrl(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) }}
              style={styles.taskImage}
            />
          )}

          {/* ACCIONES */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleLikeSharedTask(item.id)}
            >
              <Ionicons
                name={item.user_has_liked ? 'heart' : 'heart-outline'}
                size={16}
                color={item.user_has_liked ? '#ff6b6b' : '#999'}
              />
              <Text style={styles.actionText}>{item.likes_count || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCommentSharedTask(item.id)}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#4dabf7" />
              <Text style={styles.actionText}>{item.comments_count || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleShareSharedTask(task?.id)}
            >
              <Ionicons name="share-social-outline" size={16} color="#51cf66" />
              <Text style={styles.actionText}>{task?.share_count ?? 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && sharedTasks.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 50 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ENCABEZADO */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Compartidas</Text>
      </View>

      {/* LISTA */}
      <FlatList
        data={sharedTasks}
        renderItem={renderSharedTaskCard}
        keyExtractor={(item) => item.id.toString()}
        onEndReached={loadMoreTasks}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>No hay tareas compartidas</Text>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color="#4dabf7"
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#333' },

  listContent: { paddingHorizontal: 12, paddingVertical: 10 },

  card: { backgroundColor: '#fff', marginBottom: 16, borderRadius: 20, padding: 16, elevation: 4 },

  sharedByHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  sharedByAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  sharedByName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  sharedBySubtext: { fontSize: 12, color: '#666' },
  sharedDate: { fontSize: 11, color: '#999' },

  sharedDescription: {
    fontSize: 13,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 12,
    paddingHorizontal: 8,
  },

  originalTaskCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4dabf7',
  },

  taskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  taskAvatar: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#eee' },
  taskTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', flex: 1 },
  taskAuthor: { fontSize: 11, color: '#4dabf7', fontWeight: '600' },

  taskDescription: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 10 },
  taskImage: { width: '100%', height: 180, borderRadius: 10, marginTop: 10, backgroundColor: '#eee' },

  actions: {
    flexDirection: 'row',
    gap: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, color: '#666', fontWeight: '600' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#666', fontWeight: '600' },

  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
});

export default SharedTasksScreen;
