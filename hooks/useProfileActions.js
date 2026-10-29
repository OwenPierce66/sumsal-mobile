import { Alert } from 'react-native';
import api from '@api';
import { useMyRelations } from './useMyRelations';

/**
 * Seguir / favoritos / top 5 de un perfil desde un menú de 3 puntos, con el mismo estado
 * que el corazón (`useMyRelations`); los datos que trae cada tarjeta pueden ser viejos.
 * `onBefore` se llama antes de cada acción (p. ej. para cerrar el menú).
 */
export default function useProfileActions(targetUser, { onBefore } = {}) {
  const { ready, getState, setStateLocally } = useMyRelations();
  const relation = ready && targetUser?.id ? getState(targetUser.id) : null;
  const isFavorited = relation ? ['favorite', 'pinned'].includes(relation) : Boolean(targetUser?.is_favorited);
  const isFollowing = relation ? relation !== 'none' : Boolean(targetUser?.is_following);
  const isPinned = relation === 'pinned';

  const run = async (nextState, request) => {
    onBefore?.();
    if (relation) setStateLocally(targetUser.id, nextState);
    try {
      await request();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo completar la acción');
    }
  };

  return {
    isFollowing,
    isFavorited,
    isPinned,
    // Dejar de seguir quita también el favorito y el lugar en el top 5.
    toggleFollow: () => run(
      isFollowing ? 'none' : 'following',
      () => (isFollowing ? api.delete(`users/${targetUser.id}/follow/`) : api.post(`users/${targetUser.id}/follow/`)),
    ),
    toggleFavorite: () => run(
      isFavorited ? 'following' : 'favorite',
      () => api.post('pfavoritos/agregar/', { perfil_id: targetUser.id }),
    ),
    togglePin: () => run(
      isPinned ? 'favorite' : 'pinned',
      () => api.post('favorites/pin/', { type: 'profile', target_id: targetUser.id, is_pinned: !isPinned }),
    ),
  };
}
