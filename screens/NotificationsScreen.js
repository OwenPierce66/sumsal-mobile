import React, { useCallback, useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
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
import { useQueryClient, useMutation } from '@tanstack/react-query';
import SideMenu from '@components/SideMenu';
import { AuthContext } from '@app';
import api, { getImageUrl } from '@api';
import { NotificationsContext } from '@contexts/NotificationsContext';
import { useNotificationsInfinite } from '@hooks/useApi';

moment.locale('es');

// ─── Constantes de tipo de notificación ──────────────────────────────────────

const NOTIFICATION_COPY = {
  task_like:                    { icon: 'heart',             color: '#ff5d73', text: 'le dio me gusta a tu tarea' },
  story_like:                   { icon: 'heart',             color: '#ff5d73', text: 'le dio me gusta a tu historia' },
  task_comment_like:            { icon: 'heart',             color: '#ff5d73', text: 'le dio me gusta a tu comentario' },
  shared_task_like:             { icon: 'heart',             color: '#ff5d73', text: 'le dio me gusta a tu publicación compartida' },
  shared_task_comment_like:     { icon: 'heart',             color: '#ff5d73', text: 'le dio me gusta a tu comentario' },
  profile_like:                 { icon: 'heart-circle',      color: '#ff5d73', text: 'le dio me gusta a tu perfil' },
  task_favorite:                { icon: 'bookmark',          color: '#f59f00', text: 'guardó tu tarea en favoritos' },
  profile_favorite:             { icon: 'star',              color: '#f59f00', text: 'agregó tu perfil a favoritos' },
  user_follow:                  { icon: 'person-add',       color: '#4dabf7', text: 'empezó a seguirte' },
  favorite_pin:                 { icon: 'pin',               color: '#845ef7', text: 'te colocó entre sus 5 favoritos' },
  task_comment:                 { icon: 'chatbubble',        color: '#4dabf7', text: 'comentó en tu tarea' },
  task_reply:                   { icon: 'arrow-undo',        color: '#4dabf7', text: 'respondió a tu comentario' },
  shared_task_comment:          { icon: 'chatbubble',        color: '#4dabf7', text: 'comentó en tu publicación compartida' },
  shared_task_reply:            { icon: 'arrow-undo',        color: '#4dabf7', text: 'respondió a tu comentario' },
  task_shared:                  { icon: 'share-social',      color: '#51cf66', text: 'compartió tu tarea' },
  task_shared_to_story:         { icon: 'time',              color: '#845ef7', text: 'compartió tu tarea en una historia' },
  task_tag:                     { icon: 'pricetag',          color: '#845ef7', text: 'te etiquetó en una publicación' },
  task_mention:                 { icon: 'at',                color: '#845ef7', text: 'te mencionó en un comentario' },
  podcast_invite:               { icon: 'mic',               color: '#f783ac', text: '¡te eligió para grabar un podcast! 🎉' },
  podcast_approved:             { icon: 'ribbon',            color: '#f59f00', text: '¡El podcast donde fuiste etiquetado fue aprobado! ¡A grabar se ha dicho! 🎙️' },
  podcast_invitation_response:  { icon: 'chatbubbles',       color: '#4dabf7', text: 'respondió a la invitación del podcast' },
  task_approved:                { icon: 'checkmark-circle',  color: '#51cf66', text: 'Tu aportación fue aprobada ✅' },
  petition_top_month:           { icon: 'trending-up',       color: '#f59f00', text: 'Una petición entró al top 5 mensual' },
  forum_post_like:              { icon: 'heart',             color: '#ff5d73', text: 'le dio me gusta a tu publicación del foro' },
  forum_reply:                  { icon: 'arrow-undo',        color: '#4dabf7', text: 'respondió a tu comentario del foro' },
  direct_message:               { icon: 'mail',              color: '#4dabf7', text: 'te envió un mensaje' },
  direct_message_reply:         { icon: 'return-up-back',    color: '#4dabf7', text: 'respondió a tu mensaje' },
  direct_message_like:          { icon: 'heart',             color: '#ff5d73', text: 'le dio me gusta a tu mensaje' },
  group_message:                { icon: 'people',            color: '#4dabf7', text: 'envió un mensaje al grupo' },
  group_message_reply:          { icon: 'return-up-back',    color: '#4dabf7', text: 'respondió un mensaje del grupo' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getActorName = (n) => {
  const a = n?.actor || {};
  return a.username || a.name
    || [a.first_name, a.last_name].filter(Boolean).join(' ')
    || n?.data?.actor_name || 'Alguien';
};

const getNotificationType = (n) => n?.notification_type || n?.type || 'notification';

const getNotificationText = (n) => {
  if (n?.message || n?.text) return n.message || n.text;
  const cfg = NOTIFICATION_COPY[getNotificationType(n)];
  return `${getActorName(n)} ${cfg?.text || 'interactuó con tu contenido'}`;
};

const getTarget = (n) => ({
  type: n?.target_type || n?.target?.type || n?.data?.target_type,
  id:   n?.target_id   || n?.target?.id   || n?.data?.target_id,
});

// ─── Componente principal ─────────────────────────────────────────────────────

const NotificationsScreen = ({ navigation }) => {
  const { user, signOut } = useContext(AuthContext);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const queryClient = useQueryClient();
  const {
    unreadCount,
    refreshUnreadCount,
    markOneReadLocally,
    clearUnreadLocally,
  } = useContext(NotificationsContext);

  // ─── React Query: lista infinita ─────────────────────────────────────────
  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useNotificationsInfinite();

  // Aplana las páginas en un array plano
  const allNotifications = data?.pages?.flatMap((p) =>
    Array.isArray(p) ? p : (p.results ?? [])
  ) ?? [];

  // Filtra no leídas localmente (evita un request extra al servidor)
  const notifications = showUnreadOnly
    ? allNotifications.filter((n) => !n.is_read)
    : allNotifications;

  // Refresca al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refreshUnreadCount();
    }, [queryClient, refreshUnreadCount])
  );

  // ─── Mutaciones ───────────────────────────────────────────────────────────

  const markReadMutation = useMutation({
    mutationFn: (id) => api.post(`notifications/${id}/mark-read/`),
    onSuccess: (_data, id) => {
      // Actualización optimista en caché
      queryClient.setQueryData(['notifications'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => {
            const results = Array.isArray(page) ? page : (page.results ?? []);
            const updated = results.map((n) =>
              n.id === id ? { ...n, is_read: true } : n
            );
            return Array.isArray(page) ? updated : { ...page, results: updated };
          }),
        };
      });
      markOneReadLocally();
    },
    onError: () => Alert.alert('Error', 'No se pudo marcar como leída.'),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('notifications/mark-all-read/'),
    onSuccess: () => {
      queryClient.setQueryData(['notifications'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => {
            const results = Array.isArray(page) ? page : (page.results ?? []);
            const updated = results.map((n) => ({ ...n, is_read: true }));
            return Array.isArray(page) ? updated : { ...page, results: updated };
          }),
        };
      });
      clearUnreadLocally();
    },
    onError: () => Alert.alert('Error', 'No se pudieron marcar las notificaciones.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`notifications/${id}/`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(['notifications'], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => {
            const results = Array.isArray(page) ? page : (page.results ?? []);
            const filtered = results.filter((n) => n.id !== id);
            return Array.isArray(page) ? filtered : { ...page, results: filtered };
          }),
        };
      });
    },
    onError: () => Alert.alert('Error', 'No se pudo eliminar la notificación.'),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const navigateToTarget = useCallback((notification) => {
    const target = getTarget(notification);
    if (!target.type || !target.id) return;
    const actor = notification.actor || {};

    switch (target.type) {
      case 'profile':
        navigation.navigate('UserProfile', {
          userId: actor.id || target.id,
          userName: actor.username || actor.name,
          userAvatar: getImageUrl(actor.image || actor.user_image || actor.avatar),
        });
        break;
      case 'task':
        navigation.navigate('TaskDetail', { taskId: target.id });
        break;
      case 'shared_task':
        navigation.navigate('SharedTaskDetail', { sharedTaskId: target.id });
        break;
      case 'story':
        navigation.getParent()?.navigate('Stories', { openStoryId: target.id });
        break;
      case 'forum_post':
        navigation.getParent()?.navigate('Forum', {
          screen: 'PostDetail', params: { postId: target.id },
        });
        break;
      case 'direct_chat':
        navigation.navigate('ChatDetail', {
          chatId: target.id, type: 'direct',
          title: actor.username || actor.name || notification.data?.chat_title || 'Mensaje',
          avatar: getImageUrl(actor.image || actor.user_image || actor.avatar),
        });
        break;
      case 'group_chat':
        navigation.navigate('ChatDetail', {
          chatId: target.id, type: 'group',
          title: notification.data?.chat_title || 'Grupo',
        });
        break;
    }
  }, [navigation]);

  const handleOpenNotification = useCallback((notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    navigateToTarget(notification);
  }, [markReadMutation, navigateToTarget]);

  const handleDelete = useCallback((notification) => {
    Alert.alert(
      'Eliminar notificación',
      '¿Quieres eliminar esta notificación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: () => {
            if (!notification.is_read) markOneReadLocally();
            deleteMutation.mutate(notification.id);
          },
        },
      ]
    );
  }, [deleteMutation, markOneReadLocally]);

  // ─── Render item ──────────────────────────────────────────────────────────

  const [savingStoryId, setSavingStoryId] = useState(null);

  const handleSaveStory = useCallback(async (notification) => {
    const storyId = notification.data?.story_id || notification.target_id;
    if (!storyId || savingStoryId) return;
    setSavingStoryId(notification.id);
    try {
      await api.post(`stories/${storyId}/save/`);
      if (!notification.is_read) markReadMutation.mutate(notification.id);
      queryClient.invalidateQueries();
      Alert.alert(
        'Historia guardada',
        'Ya está en tus aportaciones. Los me gusta que tenía se conservan en el total; cada persona vuelve a aparecer en la lista cuando le dé me gusta otra vez.'
      );
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo guardar la historia.');
    } finally {
      setSavingStoryId(null);
    }
  }, [markReadMutation, queryClient, savingStoryId]);

  const renderStoryExpired = (item) => {
    const story = item.data || {};
    const saved = !!story.story_saved;
    const gone = story.story_exists === false;
    const preview = getImageUrl(story.story_image);
    return (
      <View style={[styles.storyAd, !item.is_read && styles.storyAdUnread]}>
        <View style={styles.storyAdTag}>
          <Ionicons name="time" size={12} color="#845ef7" />
          <Text style={styles.storyAdTagText}>Tu historia terminó</Text>
        </View>
        <View style={styles.storyAdRow}>
          {preview ? (
            <Image source={{ uri: preview }} style={styles.storyAdThumb} contentFit="cover" />
          ) : (
            <View style={[styles.storyAdThumb, styles.storyAdThumbEmpty]}>
              <Ionicons name={story.story_video ? 'videocam' : 'image'} size={24} color="#845ef7" />
            </View>
          )}
          <View style={styles.storyAdCopy}>
            <Text style={styles.storyAdTitle}>
              {saved ? 'Guardada en tus aportaciones' : '¿Guardarla en tus aportaciones?'}
            </Text>
            <Text style={styles.storyAdText}>
              {saved
                ? 'Quienes le dieron me gusta aparecerán en la lista cuando se lo den otra vez; el total se conserva.'
                : gone
                  ? 'Esta historia ya no existe.'
                  : 'Se guardará en el tema de historias. Si no la guardas, solo tú la conservas en privado.'}
            </Text>
          </View>
        </View>
        {!saved && !gone ? (
          <View style={styles.storyAdActions}>
            <TouchableOpacity
              style={[styles.storyAdButton, styles.storyAdButtonPrimary]}
              onPress={() => handleSaveStory(item)}
              disabled={savingStoryId === item.id}
              accessibilityLabel="Guardar historia en mis aportaciones"
            >
              {savingStoryId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.storyAdButtonPrimaryText}>Guardar</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.storyAdButton}
              onPress={() => (item.is_read ? null : markReadMutation.mutate(item.id))}
              accessibilityLabel="No guardar ahora"
            >
              <Text style={styles.storyAdButtonText}>Ahora no</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <Text style={[styles.time, !item.is_read && styles.timeUnread]}>
          {moment(item.created_at).fromNow()}
        </Text>
      </View>
    );
  };

  const renderNotification = ({ item }) => {
    const type = getNotificationType(item);
    if (type === 'story_expired') return renderStoryExpired(item);
    const config = NOTIFICATION_COPY[type] || { icon: 'notifications', color: '#4dabf7' };
    const isPodcastSpecial = ['podcast_invite', 'podcast_approved'].includes(type);
    const actor = item.actor || {};
    const actorName = getActorName(item);
    const avatar = getImageUrl(actor.image || actor.user_image || actor.avatar || actor.profile_image);
    const detail = item.data?.task_title || item.data?.title || item.data?.excerpt || item.data?.preview;

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.is_read && styles.notificationCardUnread,
          isPodcastSpecial && styles.notificationCardPodcast,
        ]}
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
          {isPodcastSpecial && (
            <View style={styles.podcastHeaderRow}>
              <Ionicons name="sparkles" size={14} color="#f783ac" />
              <Text style={styles.podcastHeader}>¡Felicidades!</Text>
              <Ionicons name="sparkles" size={14} color="#f783ac" />
            </View>
          )}
          <Text style={[styles.notificationText, isPodcastSpecial && styles.podcastText]}>
            {getNotificationText(item)}
          </Text>
          {detail ? (
            <Text style={styles.notificationDetail} numberOfLines={2}>{detail}</Text>
          ) : null}
          <Text style={[styles.time, !item.is_read && styles.timeUnread]}>
            {moment(item.created_at).fromNow()}
          </Text>
        </View>

        {!item.is_read && (
          <View style={[styles.unreadDot, isPodcastSpecial && styles.unreadDotPodcast]} />
        )}
      </TouchableOpacity>
    );
  };

  const hasUnread = unreadCount > 0;
  const handleBack = () => {
    if ((navigation.getState()?.index ?? 0) > 0) {
      navigation.goBack();
      return;
    }
  };

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {(navigation.getState()?.index ?? 0) > 0 ? (
          <TouchableOpacity onPress={handleBack} style={styles.headerButton} accessibilityLabel="Regresar">
            <Ionicons name="arrow-back" size={24} color="#222" />
          </TouchableOpacity>
        ) : (
          <SideMenu
            navigation={navigation}
            signOut={signOut}
            user={user}
            buttonStyle={styles.menuButton}
          />
        )}
        <Text style={styles.headerTitle}>Notificaciones</Text>
        <TouchableOpacity
          onPress={() => markAllReadMutation.mutate()}
          disabled={!hasUnread}
          style={styles.headerButton}
        >
          <Ionicons name="checkmark-done" size={24} color={hasUnread ? '#4dabf7' : '#bbb'} />
        </TouchableOpacity>
      </View>

      {/* Filtros Todas / No leídas */}
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

      {/* Contenido */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4dabf7" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={42} color="#999" />
          <Text style={styles.emptyTitle}>No se pudieron cargar las notificaciones.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNotification}
          extraData={savingStoryId}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => {
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
                refetch();
              }}
              tintColor="#4dabf7"
            />
          }
          contentContainerStyle={[
            styles.listContent,
            notifications.length === 0 && styles.emptyListContent,
          ]}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            isFetchingNextPage
              ? <ActivityIndicator color="#4dabf7" style={styles.loadMoreIndicator} />
              : null
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="notifications-off-outline" size={48} color="#bbb" />
              <Text style={styles.emptyTitle}>
                {showUnreadOnly
                  ? 'No tienes notificaciones sin leer'
                  : 'Todavía no tienes notificaciones'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Aquí aparecerán las interacciones con tu contenido.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

// ─── Estilos (sin cambios respecto al original) ───────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7f9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 34 : 14, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eceef1',
  },
  headerButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  menuButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#222' },
  filters: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: '#fff',
  },
  filter: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: '#f0f1f3' },
  filterActive: { backgroundColor: '#e7f3ff' },
  filterText: { color: '#777', fontWeight: '600' },
  filterTextActive: { color: '#228be6' },
  listContent: { padding: 12, paddingBottom: 28 },
  loadMoreIndicator: { marginVertical: 14 },
  emptyListContent: { flexGrow: 1 },
  notificationCard: {
    flexDirection: 'row', alignItems: 'center', padding: 13,
    marginBottom: 9, borderRadius: 16, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#eceef1',
  },
  notificationCardUnread: { backgroundColor: '#eef7ff', borderColor: '#d7ebff' },
  avatarWrap: { width: 48, height: 48, marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#dbeafe',
  },
  avatarInitial: { fontSize: 19, fontWeight: '800', color: '#228be6' },
  typeIcon: {
    position: 'absolute', right: -2, bottom: -1, width: 20, height: 20,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  notificationCopy: { flex: 1 },
  notificationText: { fontSize: 14, lineHeight: 19, color: '#2d3436' },
  notificationDetail: { fontSize: 13, lineHeight: 18, color: '#6c757d', marginTop: 3 },
  time: { fontSize: 11, color: '#999', marginTop: 5 },
  timeUnread: { color: '#228be6', fontWeight: '700' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#228be6', marginLeft: 9 },
  unreadDotPodcast: { backgroundColor: '#f783ac' },
  notificationCardPodcast: { backgroundColor: '#fff0f6', borderColor: '#fcc2d7', borderWidth: 1.5 },
  podcastHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 },
  podcastHeader: { fontSize: 12, fontWeight: '800', color: '#e64980', letterSpacing: 0.5, textTransform: 'uppercase' },
  podcastText: { color: '#a61e4d', fontWeight: '600' },
  storyAd: {
    padding: 14, marginBottom: 9, borderRadius: 16, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#e5dbff',
  },
  storyAdUnread: { backgroundColor: '#f8f5ff' },
  storyAdTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  storyAdTagText: { fontSize: 11, fontWeight: '800', color: '#845ef7', letterSpacing: 0.5, textTransform: 'uppercase' },
  storyAdRow: { flexDirection: 'row', alignItems: 'center' },
  storyAdThumb: { width: 56, height: 72, borderRadius: 10, marginRight: 12, backgroundColor: '#f1f3f5' },
  storyAdThumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f0ff' },
  storyAdCopy: { flex: 1 },
  storyAdTitle: { fontSize: 15, fontWeight: '800', color: '#2d3436' },
  storyAdText: { fontSize: 13, lineHeight: 18, color: '#6c757d', marginTop: 3 },
  storyAdActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  storyAdButton: {
    flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f1f3f5',
  },
  storyAdButtonPrimary: { backgroundColor: '#845ef7' },
  storyAdButtonText: { color: '#495057', fontWeight: '700' },
  storyAdButtonPrimaryText: { color: '#fff', fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#555', textAlign: 'center' },
  emptySubtitle: { marginTop: 5, fontSize: 13, color: '#999', textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: '#4dabf7' },
  retryText: { color: '#fff', fontWeight: '700' },
});

export default NotificationsScreen;
