import React, { useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import moment from 'moment';
import { getImageUrl } from '@api';
import { Image } from 'expo-image';
import TouchableUsername from '@components/TouchableUsername';
import LikesListModal from '@components/LikesListModal';
import ShareModal from '@components/ShareModal';
import { useSharedTasksInfinite, useLikeSharedTask } from '@hooks/useApi';

moment.locale('es');

const SharedTasksScreen = ({ navigation }) => {
  // ─── Modal state ─────────────────────────────────────────────────────────────
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl,     setLikesModalUrl]     = useState('');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare,       setTaskToShare]       = useState(null);

  // ─── React Query ─────────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isFetching,
  } = useSharedTasksInfinite({});

  const likeMutation = useLikeSharedTask();

  // Aplanar páginas infinitas en un array
  const sharedTasks = useMemo(
    () => data?.pages?.flatMap((p) => p.results ?? []) ?? [],
    [data],
  );

  const refreshing = isFetching && !isLoading;

  // Refetch al enfocar la pantalla
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleShowSharedTaskLikes = (sharedTaskId) => {
    setLikesModalUrl(`shared-tasks/${sharedTaskId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  const handleLikeSharedTask = (sharedTaskId) => likeMutation.mutate(sharedTaskId);

  const openShareModal = (taskId) => {
    if (!taskId) return;
    setTaskToShare(taskId);
    setShareModalVisible(true);
  };

  const handleShareSuccess = () => {
    setTaskToShare(null);
    refetch();
  };

  const getUserName = (userObj, fallbackName = 'Usuario') => {
    if (!userObj) return fallbackName;
    if (userObj.first_name) return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
    if (userObj.username)   return userObj.username;
    if (userObj.email)      return userObj.email.split('@')[0];
    return fallbackName;
  };

  // ─── Render item ─────────────────────────────────────────────────────────────
  const renderSharedTaskCard = ({ item }) => {
    const task = item.task;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SharedTaskDetail', { sharedTaskId: item.id })}
        activeOpacity={0.9}
      >
        {/* ENCABEZADO: QUIÉN COMPARTIÓ */}
        <View style={styles.sharedByHeader}>
          <Image
            source={{ uri: getImageUrl(item.shared_by?.user_image) }}
            style={styles.sharedByAvatar}
          />
          <View style={{ flex: 1 }}>
            <TouchableUsername
              username={getUserName(item.shared_by)}
              userId={item.shared_by?.id || null}
              userImage={getImageUrl(item.shared_by?.user_image) || null}
              navigation={navigation}
              textStyle={styles.sharedByName}
              numberOfLines={1}
            />
            <Text style={styles.sharedBySubtext}>compartió una tarea</Text>
          </View>
          <Text style={styles.sharedDate}>{moment(item.created_at).fromNow()}</Text>
        </View>

        {item.description && (
          <Text style={styles.sharedDescription}>{item.description}</Text>
        )}

        {/* TARJETA ORIGINAL */}
        <View style={styles.originalTaskCard}>
          <View style={styles.taskHeader}>
            <Image
              source={{ uri: getImageUrl(task.user?.user_image || task.subtasks?.[0]?.image) }}
              style={styles.taskAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <TouchableUsername
                username={getUserName(task.user) !== 'Usuario' ? getUserName(task.user) : (task.username || 'Anónimo')}
                userId={task.user?.id || task.user_id || null}
                userImage={getImageUrl(task.user?.user_image) || null}
                navigation={navigation}
                textStyle={styles.taskAuthor}
                numberOfLines={1}
              />
            </View>
          </View>

          <Text style={styles.taskDescription} numberOfLines={2}>{task.description}</Text>

          {task.categories ? (
            <View style={styles.categoriesList}>
              {task.categories.split(',').map((cat, idx) => (
                <Text key={idx} style={styles.categoryBadge}>{cat.trim()}</Text>
              ))}
            </View>
          ) : null}

          {(task.image || task.subtasks?.[0]?.image) && (
            <Image
              source={{ uri: getImageUrl(task.image || task.subtasks?.[0]?.image) }}
              style={styles.taskImage}
            />
          )}

          {/* ACCIONES */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleLikeSharedTask(item.id)}
              onLongPress={() => handleShowSharedTaskLikes(item.id)}
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
              onPress={() => navigation.navigate('SharedTaskDetail', { sharedTaskId: item.id })}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#4dabf7" />
              <Text style={styles.actionText}>{item.comments_count || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => openShareModal(task?.id)}
            >
              <Ionicons name="share-social-outline" size={16} color="#51cf66" />
              <Text style={styles.actionText}>{task?.share_count ?? 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && sharedTasks.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 50 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Compartidas</Text>
      </View>

      <FlatList
        data={sharedTasks}
        renderItem={renderSharedTaskCard}
        keyExtractor={(item) => item.id.toString()}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.emptyText}>No hay tareas compartidas</Text>
          ) : null
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 16 }} />
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      <LikesListModal
        visible={likesModalVisible}
        onClose={() => setLikesModalVisible(false)}
        apiUrl={likesModalUrl}
      />

      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        taskId={taskToShare}
        onShareSuccess={handleShareSuccess}
        navigation={navigation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FEF6F5' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle:  { fontSize: 24, fontWeight: '800', color: '#333' },
  listContent:  { paddingHorizontal: 12, paddingVertical: 10 },
  card:         { backgroundColor: '#fff', marginBottom: 16, borderRadius: 20, padding: 16, elevation: 4 },
  sharedByHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  sharedByAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  sharedByName:   { fontSize: 14, fontWeight: 'bold', color: '#333' },
  sharedBySubtext: { fontSize: 12, color: '#666' },
  sharedDate:   { fontSize: 11, color: '#999' },
  sharedDescription: { fontSize: 13, color: '#555', fontStyle: 'italic', marginBottom: 12, paddingHorizontal: 8 },
  originalTaskCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#4dabf7' },
  taskHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  taskAvatar:   { width: 35, height: 35, borderRadius: 17.5, backgroundColor: '#eee' },
  taskTitle:    { fontSize: 14, fontWeight: 'bold', color: '#333', flex: 1 },
  taskAuthor:   { fontSize: 11, color: '#4dabf7', fontWeight: '600' },
  taskDescription: { fontSize: 13, color: '#555', lineHeight: 18 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 10 },
  categoryBadge:  { backgroundColor: '#e3f2fd', color: '#4dabf7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 11, fontWeight: '600' },
  taskImage:    { width: '100%', height: 180, borderRadius: 10, marginTop: 10, backgroundColor: '#eee' },
  actions:      { flexDirection: 'row', gap: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText:   { fontSize: 12, color: '#666', fontWeight: '600' },
  emptyText:    { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 40 },
});

export default SharedTasksScreen;
