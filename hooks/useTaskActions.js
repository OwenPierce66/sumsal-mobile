import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import api, { getImageUrl } from '@api';

const userDisplayName = (userObj, fallback = 'Usuario') => {
  if (!userObj) return fallback;
  if (userObj.first_name) return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
  if (userObj.username) return userObj.username;
  if (userObj.email) return userObj.email.split('@')[0];
  return fallback;
};

/**
 * Datos derivados de la publicación sobre la que se abrió el menú de 3 puntos.
 * `actionTask` es una tarea normal, o una compartida marcada con `isSharedTask: true`
 * (mismo formato que usa TasksScreen).
 */
export const getActionTaskInfo = (actionTask, currentUserId) => {
  if (!actionTask) return {};
  const isShared = Boolean(actionTask.isSharedTask);
  const sourceTask = isShared ? actionTask.task : actionTask;
  const targetUser = isShared ? actionTask.shared_by : actionTask.user;
  const ownerRaw = isShared
    ? actionTask.shared_by?.id
    : actionTask.user?.id || actionTask.user_id || actionTask.user;
  const isOwner = Boolean(currentUserId && ownerRaw && String(currentUserId) === String(ownerRaw));
  return { isShared, sourceTask, targetUser, ownerId: ownerRaw, isOwner };
};

/**
 * Handlers del menú de 3 puntos para las pantallas de detalle (TaskDetail / SharedTaskDetail).
 * Hacen lo mismo que los de TasksScreen, pero en lugar de parchar listas locales llaman a `refresh`
 * para recargar los datos de la pantalla.
 */
export default function useTaskActions({
  navigation,
  actionTask,
  currentUserId,
  close,
  refresh,
  onShare,
  onEdit,
  onDeleted,
}) {
  const info = getActionTaskInfo(actionTask, currentUserId);
  const { isShared, sourceTask, targetUser } = info;

  const toggleFavorite = useCallback(async () => {
    if (!sourceTask?.id) return;
    try {
      await api.post('favoritos/agregar/', { task_id: sourceTask.id });
      await refresh?.();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      close?.();
    }
  }, [sourceTask?.id, refresh, close]);

  const pinFavorite = useCallback(async (kind) => {
    const target = kind === 'profile' ? targetUser : sourceTask;
    const targetId = typeof target === 'object' ? target?.id : target;
    if (!targetId) return;
    try {
      await api.post('favorites/pin/', { type: kind, target_id: targetId, is_pinned: true });
      // Anclar agrega a favoritos si faltaba: recarga para actualizar los botones.
      await refresh?.();
      Alert.alert('Favorito anclado', 'Se colocó dentro de tus primeros 5 favoritos.');
    } catch (error) {
      const message = error.response?.data?.is_pinned?.[0] || 'No se pudo anclar este favorito.';
      Alert.alert('No se pudo anclar', message);
    } finally {
      close?.();
    }
  }, [targetUser, sourceTask, close, refresh]);

  const share = useCallback(() => {
    close?.();
    onShare?.(actionTask);
  }, [close, onShare, actionTask]);

  const directMessage = useCallback(() => {
    if (!targetUser) return;
    close?.();
    navigation.navigate('ChatDetail', {
      chatId: targetUser.id,
      type: 'direct',
      title: userDisplayName(targetUser, 'Anónimo'),
      avatar: getImageUrl(targetUser.user_image),
    });
  }, [targetUser, close, navigation]);

  // "Ir al foro": abre la pestaña del foro
  const goToForum = useCallback(() => {
    close?.();
    navigation.navigate('Forum', {
      screen: 'ForumMain',
      params: targetUser?.id
        ? { userId: targetUser.id, userName: userDisplayName(targetUser, 'usuario') }
        : { userId: undefined, userName: undefined },
    });
  }, [close, navigation, targetUser]);

  const toggleProfileFavorite = useCallback(async () => {
    if (!targetUser?.id) return;
    try {
      await api.post('pfavoritos/agregar/', { perfil_id: targetUser.id });
      await refresh?.();
    } catch (error) {
      console.error('Error toggling profile favorite:', error);
    } finally {
      close?.();
    }
  }, [targetUser?.id, refresh, close]);

  // Seguir -> Favorito -> Anclado: dejar de seguir quita también el favorito (lo hace el servidor).
  const toggleFollow = useCallback(async () => {
    if (!targetUser?.id) return;
    try {
      if (targetUser.is_following) {
        await api.delete(`users/${targetUser.id}/follow/`);
      } else {
        await api.post(`users/${targetUser.id}/follow/`);
      }
      await refresh?.();
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      close?.();
    }
  }, [targetUser?.id, targetUser?.is_following, refresh, close]);

  const toggleVerified = useCallback(async () => {
    if (!targetUser?.id) return;
    try {
      await api.post(`admin/users/${targetUser.id}/verify/`, { is_verified: !targetUser.profile?.is_verified });
      await refresh?.();
    } catch (error) {
      console.error('Error toggling verified:', error);
    } finally {
      close?.();
    }
  }, [targetUser, refresh, close]);

  const toggleRecommended = useCallback(async () => {
    if (!targetUser?.id) return;
    try {
      await api.post(`admin/users/${targetUser.id}/recommend/`, { is_recommended: !targetUser.profile?.is_recommended });
      await refresh?.();
    } catch (error) {
      console.error('Error toggling recommended:', error);
    } finally {
      close?.();
    }
  }, [targetUser, refresh, close]);

  const approvePodcast = useCallback(() => {
    if (!sourceTask?.id) return;
    const approve = async () => {
      try {
        await api.post(`tasks/${sourceTask.id}/approve/`, { approve: true });
        await refresh?.();
        close?.();
        Alert.alert('Podcast aprobado', 'Se notificó al creador y a las personas etiquetadas.');
      } catch (error) {
        Alert.alert('No se pudo aprobar', error.response?.data?.detail || 'Intenta de nuevo.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Aprobar este podcast y notificar a sus involucrados?')) approve();
    } else {
      Alert.alert(
        'Aprobar podcast',
        'Se cambiará Procesando por Aprobada y se notificará al creador y a las personas etiquetadas.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Aprobar', onPress: approve },
        ],
      );
    }
  }, [sourceTask?.id, refresh, close]);

  const edit = useCallback(() => {
    close?.();
    if (onEdit) onEdit(actionTask);
    else if (!isShared) navigation.navigate('CreateTask', { task: actionTask });
  }, [close, onEdit, actionTask, isShared, navigation]);

  const remove = useCallback(() => {
    if (!actionTask?.id) return;
    const execute = async () => {
      try {
        await api.delete(`${isShared ? 'shared-tasks' : 'tasks'}/${actionTask.id}/`);
        close?.();
        onDeleted?.(actionTask);
      } catch (error) {
        console.error('Error deleting task:', error);
        if (Platform.OS !== 'web') Alert.alert('Error', 'No se pudo eliminar la tarea.');
        else window.alert('Error: No se pudo eliminar la tarea.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que deseas eliminar esta tarea permanentemente?')) execute();
    } else {
      Alert.alert(
        'Eliminar Tarea',
        '¿Estás seguro de que deseas eliminar esta tarea permanentemente?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: execute },
        ],
      );
    }
  }, [actionTask, isShared, close, onDeleted]);

  return {
    toggleFavorite,
    pinFavorite,
    share,
    directMessage,
    goToForum,
    toggleFollow,
    toggleProfileFavorite,
    toggleVerified,
    toggleRecommended,
    approvePodcast,
    edit,
    delete: remove,
  };
}
