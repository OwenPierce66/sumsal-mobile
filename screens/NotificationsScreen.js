import React, { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import 'moment/locale/es';
import { useFocusEffect } from '@react-navigation/native';
import api, { getImageUrl } from '../api';
import { NotificationsContext } from '../contexts/NotificationsContext';

moment.locale('es');

const NOTIFICATION_COPY = {
  task_like: { icon: 'heart', color: '#ff5d73', text: 'le dio me gusta a tu tarea' },
  story_like: { icon: 'heart', color: '#ff5d73', text: 'le dio me gusta a tu historia' },
  task_comment_like: { icon: 'heart', color: '#ff5d73', text: 'le dio me gusta a tu comentario' },
  shared_task_like: { icon: 'heart', color: '#ff5d73', text: 'le dio me gusta a tu publicación compartida' },
  shared_task_comment_like: { icon: 'heart', color: '#ff5d73', text: 'le dio me gusta a tu comentario' },
  profile_like: { icon: 'heart-circle', color: '#ff5d73', text: 'le dio me gusta a tu perfil' },
  task_favorite: { icon: 'bookmark', color: '#f59f00', text: 'guardó tu tarea en favoritos' },
  profile_favorite: { icon: 'star', color: '#f59f00', text: 'agregó tu perfil a favoritos' },
  task_comment: { icon: 'chatbubble', color: '#4dabf7', text: 'comentó en tu tarea' },
  task_reply: { icon: 'arrow-undo', color: '#4dabf7', text: 'respondió a tu comentario' },
  shared_task_comment: { icon: 'chatbubble', color: '#4dabf7', text: 'comentó en tu publicación compartida' },
  shared_task_reply: { icon: 'arrow-undo', color: '#4dabf7', text: 'respondió a tu comentario' },
  task_shared: { icon: 'share-social', color: '#51cf66', text: 'compartió tu tarea' },
  task_shared_to_story: { icon: 'time', color: '#845ef7', text: 'compartió tu tarea en una historia' },
  forum_post_like: { icon: 'heart', color: '#ff5d73', text: 'le dio me gusta a tu publicación del foro' },
  forum_reply: { icon: 'arrow-undo', color: '#4dabf7', text: 'respondió a tu comentario del foro' },
  direct_message: { icon: 'mail', color: '#4dabf7', text: 'te envió un mensaje' },
  direct_message_reply: { icon: 'return-up-back', color: '#4dabf7', text: 'respondió a tu mensaje' },
  direct_message_like: { icon: 'heart', color: '#ff5d73', text: 'le dio me gusta a tu mensaje' },
  group_message: { icon: 'people', color: '#4dabf7', text: 'envió un mensaje al grupo' },
  group_message_reply: { icon: 'return-up-back', color: '#4dabf7', text: 'respondió un mensaje del grupo' },
};

const getActorName = (notification) => {
  const actor = notification?.actor || {};
  return actor.username
    || actor.name
    || [actor.first_name, actor.last_name].filter(Boolean).join(' ')
    || notification?.data?.actor_name
    || 'Alguien';
};

const getNotificationType = (notification) => (
  notification?.notification_type || notification?.type || 'notification'
);

const getNotificationText = (notification) => {
  if (notification?.message || notification?.text) {
    return notification.message || notification.text;
  }
  const config = NOTIFICATION_COPY[getNotificationType(notification)];
  return `${getActorName(notification)} ${config?.text || 'interactuó con tu contenido'}`;
};

const getTarget = (notification) => ({
  type: notification?.target_type || notification?.target?.type || notification?.data?.target_type,
  id: notification?.target_id || notification?.target?.id || notification?.data?.target_id,
});

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [error, setError] = useState('');
  const {
    unreadCount,
    refreshUnreadCount,
    markOneReadLocally,
    clearUnreadLocally,
  } = useContext(NotificationsContext);

  const fetchNotifications = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await api.get('notifications/', {
        params: showUnreadOnly ? { unread: 'true' } : undefined,
      });
      const list = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.results)
          ? response.data.results
          : [];
      setNotifications(list);
      setNextPage(response.data?.next || null);
      refreshUnreadCount();
    } catch (requestError) {
      setError('No se pudieron cargar las notificaciones.');
      console.error('[Notifications] Error al cargar:', requestError.response?.data || requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showUnreadOnly, refreshUnreadCount]);

  const loadMore = useCallback(async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await api.get(nextPage);
      const list = Array.isArray(response.data?.results) ? response.data.results : [];
      setNotifications((current) => {
        const knownIds = new Set(current.map((item) => String(item.id)));
        return [...current, ...list.filter((item) => !knownIds.has(String(item.id)))];
      });
      setNextPage(response.data?.next || null);
    } catch (requestError) {
      console.error('[Notifications] Error al cargar más:', requestError.response?.data || requestError.message);
    } finally {
      setLoadingMore(false);
    }
  }, [nextPage, loadingMore]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const navigateToTarget = useCallback((notification) => {
    const target = getTarget(notification);
    if (!target.type || !target.id) return;

    if (target.type === 'profile') {
      const actor = notification.actor || {};
      navigation.navigate('UserProfile', {
        userId: actor.id || target.id,
        userName: actor.username || actor.name,
        userAvatar: getImageUrl(actor.image || actor.user_image || actor.avatar),
      });
      return;
    }
    if (target.type === 'task') {
      navigation.navigate('TaskDetail', { taskId: target.id });
      return;
    }
    if (target.type === 'shared_task') {
      navigation.navigate('SharedTaskDetail', { sharedTaskId: target.id });
      return;
    }
    if (target.type === 'story') {
      navigation.getParent()?.navigate('Stories', { openStoryId: target.id });
      return;
    }
    if (target.type === 'forum_post') {
      navigation.getParent()?.navigate('Forum', {
        screen: 'PostDetail',
        params: { postId: target.id },
      });
      return;
    }
    if (target.type === 'direct_chat') {
      const actor = notification.actor || {};
      navigation.navigate('ChatDetail', {
        chatId: target.id,
        type: 'direct',
        title: actor.username || actor.name || notification.data?.chat_title || 'Mensaje',
        avatar: getImageUrl(actor.image || actor.user_image || actor.avatar),
      });
      return;
    }
    if (target.type === 'group_chat') {
      navigation.navigate('ChatDetail', {
        chatId: target.id,
        type: 'group',
        title: notification.data?.chat_title || 'Grupo',
      });
    }
  }, [navigation]);

  const handleOpenNotification = useCallback(async (notification) => {
    if (!notification.is_read) {
      try {
        await api.post(`notifications/${notification.id}/mark-read/`);
        setNotifications((current) => (
          showUnreadOnly
            ? current.filter((item) => item.id !== notification.id)
            : current.map((item) => (
              item.id === notification.id ? { ...item, is_read: true } : item
            ))
        ));
        markOneReadLocally();
      } catch (requestError) {
        Alert.alert('Error', 'No se pudo actualizar la notificación.');
        return;
      }
    }
    navigateToTarget(notification);
  }, [markOneReadLocally, navigateToTarget, showUnreadOnly]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.post('notifications/mark-all-read/');
      setNotifications((current) => (
        showUnreadOnly ? [] : current.map((item) => ({ ...item, is_read: true }))
      ));
      clearUnreadLocally();
    } catch (requestError) {
      Alert.alert('Error', 'No se pudieron marcar las notificaciones.');
    }
  }, [clearUnreadLocally, showUnreadOnly]);

  const handleDelete = useCallback((notification) => {
    Alert.alert(
      'Eliminar notificación',
      '¿Quieres eliminar esta notificación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`notifications/${notification.id}/`);
              setNotifications((current) => current.filter((item) => item.id !== notification.id));
              if (!notification.is_read) markOneReadLocally();
            } catch (requestError) {
              Alert.alert('Error', 'No se pudo eliminar la notificación.');
            }
          },
        },
      ]
    );
  }, [markOneReadLocally]);

  const hasUnread = unreadCount > 0;

  const renderNotification = ({ item }) => {
    const type = getNotificationType(item);
    const config = NOTIFICATION_COPY[type] || {
      icon: 'notifications',
      color: '#4dabf7',
    };
    const actor = item.actor || {};
    const actorName = getActorName(item);
    const avatar = getImageUrl(actor.image || actor.user_image || actor.avatar || actor.profile_image);
    const detail = item.data?.title || item.data?.excerpt || item.data?.preview;

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.is_read && styles.notificationCardUnread]}
        onPress={() => handleOpenNotification(item)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.82}
      >
        <View style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{actorName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={[styles.typeIcon, { backgroundColor: config.color }]}>
            <Ionicons name={config.icon} size={12} color="#fff" />
          </View>
        </View>

        <View style={styles.notificationCopy}>
          <Text style={styles.notificationText}>
            {getNotificationText(item)}
          </Text>
          {detail ? (
            <Text style={styles.notificationDetail} numberOfLines={2}>{detail}</Text>
          ) : null}
          <Text style={[styles.time, !item.is_read && styles.timeUnread]}>
            {moment(item.created_at).fromNow()}
          </Text>
        </View>

        {!item.is_read ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={!hasUnread}
          style={styles.headerButton}
        >
          <Ionicons
            name="checkmark-done"
            size={24}
            color={hasUnread ? '#4dabf7' : '#bbb'}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filter, !showUnreadOnly && styles.filterActive]}
          onPress={() => setShowUnreadOnly(false)}
        >
          <Text style={[styles.filterText, !showUnreadOnly && styles.filterTextActive]}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filter, showUnreadOnly && styles.filterActive]}
          onPress={() => setShowUnreadOnly(true)}
        >
          <Text style={[styles.filterText, showUnreadOnly && styles.filterTextActive]}>No leídas</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4dabf7" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={42} color="#999" />
          <Text style={styles.emptyTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotification}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications({ refresh: true })}
              tintColor="#4dabf7"
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent,
          ]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator color="#4dabf7" style={styles.loadMoreIndicator} />
          ) : null}
          ListEmptyComponent={(
            <View style={styles.centered}>
              <Ionicons name="notifications-off-outline" size={48} color="#bbb" />
              <Text style={styles.emptyTitle}>
                {showUnreadOnly ? 'No tienes notificaciones sin leer' : 'Todavía no tienes notificaciones'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Aquí aparecerán las interacciones con tu contenido.
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eceef1',
  },
  headerButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#222' },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  filter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f0f1f3',
  },
  filterActive: { backgroundColor: '#e7f3ff' },
  filterText: { color: '#777', fontWeight: '600' },
  filterTextActive: { color: '#228be6' },
  listContent: { padding: 12, paddingBottom: 28 },
  loadMoreIndicator: { marginVertical: 14 },
  emptyListContent: { flexGrow: 1 },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    marginBottom: 9,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eceef1',
  },
  notificationCardUnread: {
    backgroundColor: '#eef7ff',
    borderColor: '#d7ebff',
  },
  avatarWrap: { width: 48, height: 48, marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
  },
  avatarInitial: { fontSize: 19, fontWeight: '800', color: '#228be6' },
  typeIcon: {
    position: 'absolute',
    right: -2,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationCopy: { flex: 1 },
  notificationText: { fontSize: 14, lineHeight: 19, color: '#2d3436' },
  notificationDetail: { fontSize: 13, lineHeight: 18, color: '#6c757d', marginTop: 3 },
  time: { fontSize: 11, color: '#999', marginTop: 5 },
  timeUnread: { color: '#228be6', fontWeight: '700' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#228be6', marginLeft: 9 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#555', textAlign: 'center' },
  emptySubtitle: { marginTop: 5, fontSize: 13, color: '#999', textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: '#4dabf7' },
  retryText: { color: '#fff', fontWeight: '700' },
});

export default NotificationsScreen;
