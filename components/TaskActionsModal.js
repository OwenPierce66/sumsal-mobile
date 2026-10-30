import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, useWindowDimensions, Alert } from 'react-native';
import api from '@api';
import { Ionicons } from '@expo/vector-icons';
import { getActionTaskInfo } from '@hooks/useTaskActions';
import { useMe } from '@hooks/useApi';
import { useDownloadTask } from '@hooks/useDownloadTask';
import { setAccountActive } from '../utils/adminActions';
import PetitionSupportSheet from './PetitionSupportSheet';
import { useMyRelations } from '../hooks/useMyRelations';
import useProfileActions from '../hooks/useProfileActions';
import { taskCategories } from '../utils/relations';
import { subItemTitle } from '../utils/aportaciones';
import TaskStatsSheet from './TaskStatsSheet';
import { shareExternally, taskShareLink } from '../utils/externalShare';
import CollectionPickerSheet from './CollectionPickerSheet';

const STORY_SECTIONS = [
  ['subtasks', 'Publicación'],
  ['subfactores', 'Factor'],
  ['subfuentes', 'Fuente'],
];

/** Publicaciones, factores y fuentes de la tarea, para compartir uno solo en la historia. */
const storyItemsOf = (task) => STORY_SECTIONS.flatMap(([section, label]) => (
  (Array.isArray(task?.[section]) ? task[section] : [])
    .filter((sub) => sub?.id)
    .map((sub, idx) => ({ section, id: sub.id, title: subItemTitle(sub) || `${label} ${idx + 1}` }))
));

/** Comparte la tarea completa, o solo una de sus publicaciones/factores/fuentes, en la historia de 24 h. */
async function shareToStory(task, item) {
  if (!task?.id) return;
  const payload = { task_id: task.id };
  if (item?.id) {
    payload.source_item_type = item.section;
    payload.source_item_id = item.id;
  }
  try {
    await api.post('stories/share-task/', payload);
    Alert.alert('Listo', 'Se compartió en tu historia de 24 horas.');
  } catch (error) {
    Alert.alert('Error', error.response?.data?.error || 'No se pudo compartir en tu historia.');
  }
}

/**
 * Menú de 3 puntos COMPLETO. Es el mismo para el feed, el detalle de tarea y el de tarea compartida.
 *
 * actionTask: tarea normal, o compartida marcada con `isSharedTask: true`.
 * handlers: { pinFavorite(kind), viewShares (opcional), directMessage, goToForum, toggleFollow, toggleProfileFavorite,
 *             edit, delete, approvePodcast, toggleVerified, toggleRecommended, toggleAppLike (opcional, superadmin) }
 * Guardar / favoritos / top 5 (general y por categoría) / "solo para mí" de la tarea los resuelve el
 * propio menú con el estado compartido de `useMyRelations`.
 * Siempre incluye "Descargar" (imágenes y videos de la aportación original) y, en peticiones,
 * "Apoyar monetariamente" (para quien la creó y para cualquier otra persona).
 * extraOptions: nodo opcional con opciones adicionales propias de la pantalla (p. ej. invitación a podcast).
 */
const TaskActionsModal = ({
  visible,
  onClose,
  actionTask,
  currentUserId,
  isAdmin,
  canEdit,
  handlers,
  extraOptions,
}) => {
  const { height: windowHeight } = useWindowDimensions();
  const { isShared, sourceTask, targetUser, isOwner } = getActionTaskInfo(actionTask, currentUserId);
  const isOtherUser = Boolean(targetUser) && String(currentUserId) !== String(targetUser?.id || targetUser);
  const { data: me } = useMe();
  const { downloadTask, isDownloading } = useDownloadTask();
  // La hoja de apoyo vive fuera del menú: el menú se cierra y la hoja se queda con la petición elegida.
  const [supportTask, setSupportTask] = useState(null);
  // Estadísticas de la publicación: también viven fuera del menú.
  const [statsTaskId, setStatsTaskId] = useState(null);
  // Colecciones (álbumes de guardados) donde va esta publicación.
  const [collectionTaskId, setCollectionTaskId] = useState(null);
  const [storyOptionsOpen, setStoryOptionsOpen] = useState(false);
  const [categoryPinsOpen, setCategoryPinsOpen] = useState(false);
  useEffect(() => {
    if (!visible) {
      setStoryOptionsOpen(false);
      setCategoryPinsOpen(false);
    }
  }, [visible]);
  const canSuspendAuthor = Boolean(me?.is_superuser) && isOtherUser && Boolean(targetUser?.id) && !targetUser?.is_superuser;
  // Seguir / favorito / top 5 del perfil: el mismo estado que el corazón (los datos de la tarea pueden ser viejos).
  const profileActions = useProfileActions(targetUser, { onBefore: onClose });
  const { isFollowing, isFavorited: isProfileFavorited, isPinned: isProfilePinned } = profileActions;
  const {
    ready: relationsReady, getTaskState, setTaskStateLocally, refresh: refreshRelations,
  } = useMyRelations();
  // Tarea: Guardar -> Favorito -> Top 5 (y top 5 por categoría), con "solo para mí".
  const taskId = sourceTask?.id;
  const taskState = (relationsReady && taskId ? getTaskState(taskId) : null) || {
    saved: Boolean(sourceTask?.is_favorited),
    favorite: Boolean(sourceTask?.is_favorited),
    pinned: false,
    private: false,
    categories: [],
  };
  const pinnableCategories = taskCategories(sourceTask);
  const isPinnedIn = (category) => taskState.categories.some((name) => name.toLowerCase() === category.toLowerCase());
  const runTaskAction = async (patch, request, { keepOpen = false } = {}) => {
    if (!keepOpen) onClose?.();
    if (relationsReady) setTaskStateLocally(taskId, patch);
    try {
      await request();
    } catch (error) {
      refreshRelations?.();
      const data = error.response?.data;
      Alert.alert('Error', data?.detail || data?.category || 'No se pudo completar la acción');
    }
  };
  const taskActions = {
    // Quitar de guardados quita también favoritos, top 5 y sus anclajes por categoría.
    toggleSave: () => runTaskAction(
      { saved: !taskState.saved },
      () => (taskState.saved ? api.delete(`tasks/${taskId}/save/`) : api.post(`tasks/${taskId}/save/`)),
    ),
    toggleFavorite: () => runTaskAction(
      { favorite: !taskState.favorite },
      () => api.post('favoritos/agregar/', { task_id: taskId }),
    ),
    togglePin: () => runTaskAction(
      { pinned: !taskState.pinned },
      () => api.post('favorites/pin/', { type: 'task', target_id: taskId, is_pinned: !taskState.pinned }),
    ),
    // Se queda abierto para anclar en varias categorías seguidas.
    toggleCategoryPin: (category) => {
      const pinned = isPinnedIn(category);
      return runTaskAction(
        {
          categories: pinned
            ? taskState.categories.filter((name) => name.toLowerCase() !== category.toLowerCase())
            : [...taskState.categories, category],
        },
        () => api.post('favorites/category-pin/', { task_id: taskId, category, is_pinned: !pinned }),
        { keepOpen: true },
      );
    },
    togglePrivate: () => runTaskAction(
      { private: !taskState.private },
      () => api.patch(`tasks/${taskId}/save/`, { is_private: !taskState.private }),
    ),
  };
  const categories = String(sourceTask?.categories || '')
    .split(',')
    .map((category) => category.trim().toLowerCase());
  const isPodcast = categories.includes('grabar podcast');
  const isPetition = ['peticion', 'peticiones'].includes(
    String(sourceTask?.pch || '').trim().toLowerCase()
  );
  const isModeratable = isPodcast || isPetition;
  const isApproved = categories.some((category) =>
    ['aprobada', 'aprobadas', 'aprovada', 'aprovadas'].includes(category)
  );

  return (
    <>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.actionModalContainer}>
          <View style={styles.modalDragHandle} />
          {actionTask ? (
            <ScrollView
              style={{ maxHeight: Math.round(windowHeight * 0.7) }}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity style={styles.actionOption} onPress={taskActions.toggleSave}>
                <Ionicons name={taskState.saved ? 'bookmark' : 'bookmark-outline'} size={20} color={taskState.saved ? '#f59f00' : '#555'} />
                <Text style={styles.actionText}>{taskState.saved ? 'Quitar de guardados' : 'Guardar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionOption} onPress={taskActions.toggleFavorite}>
                <Ionicons name={taskState.favorite ? 'star' : 'star-outline'} size={20} color={taskState.favorite ? '#f59f00' : '#555'} />
                <Text style={styles.actionText}>{taskState.favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionOption} onPress={taskActions.togglePin}>
                <Ionicons name={taskState.pinned ? 'pin' : 'pin-outline'} size={20} color="#845ef7" />
                <Text style={styles.actionText}>{taskState.pinned ? 'Quitar de mi top 5' : 'Anclar en mi top 5'}</Text>
              </TouchableOpacity>
              {pinnableCategories.length ? (
                <>
                  <TouchableOpacity
                    style={styles.actionOption}
                    onPress={() => setCategoryPinsOpen((open) => !open)}
                    accessibilityLabel="Top 5 por categoría"
                  >
                    <Ionicons name="pricetags-outline" size={20} color="#845ef7" />
                    <Text style={styles.actionText}>Top 5 por categoría</Text>
                    <Ionicons name={categoryPinsOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#999" style={styles.chevron} />
                  </TouchableOpacity>
                  {categoryPinsOpen ? (
                    <View style={styles.storySubOptions}>
                      {pinnableCategories.map((category) => {
                        const pinned = isPinnedIn(category);
                        return (
                          <TouchableOpacity
                            key={category}
                            style={[styles.categoryPinOption, pinned && styles.categoryPinOptionOn]}
                            onPress={() => taskActions.toggleCategoryPin(category)}
                            accessibilityLabel={pinned ? `Quitar del top 5 de ${category}` : `Anclar en el top 5 de ${category}`}
                          >
                            <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={16} color="#845ef7" />
                            <Text style={styles.categoryPinText} numberOfLines={1}>{category}</Text>
                            {pinned ? <Text style={styles.categoryPinState}>En tu top 5</Text> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </>
              ) : null}
              <TouchableOpacity
                style={styles.actionOption}
                onPress={() => { setCollectionTaskId(taskId || null); onClose?.(); }}
                accessibilityLabel="Guardar en una colección"
              >
                <Ionicons name="albums-outline" size={20} color="#845ef7" />
                <Text style={styles.actionText}>Guardar en una colección</Text>
              </TouchableOpacity>
              {taskState.saved ? (
                <TouchableOpacity style={styles.actionOption} onPress={taskActions.togglePrivate}>
                  <Ionicons name={taskState.private ? 'lock-closed' : 'lock-open-outline'} size={20} color="#495057" />
                  <Text style={styles.actionText}>{taskState.private ? 'Mostrarla a los demás' : 'Guardarla solo para mí'}</Text>
                </TouchableOpacity>
              ) : null}
              {handlers.viewShares ? (
                <TouchableOpacity style={styles.actionOption} onPress={handlers.viewShares}>
                  <Ionicons name="people-outline" size={20} color="#555" />
                  <Text style={styles.actionText}>Ver compartidas</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.actionOption}
                onPress={() => {
                  const target = sourceTask;
                  onClose?.();
                  shareExternally({
                    title: target?.title,
                    text: String(target?.description || '').slice(0, 200),
                    link: taskShareLink(target?.id),
                  }).catch(() => {});
                }}
                accessibilityLabel="Compartir en otras apps"
              >
                <Ionicons name="paper-plane-outline" size={20} color="#4dabf7" />
                <Text style={styles.actionText}>Compartir en otras apps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionOption}
                onPress={() => { setStatsTaskId(sourceTask?.id || null); onClose?.(); }}
                accessibilityLabel="Estadísticas"
              >
                <Ionicons name="stats-chart-outline" size={20} color="#4dabf7" />
                <Text style={styles.actionText}>Estadísticas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionOption}
                onPress={() => { const target = sourceTask; onClose?.(); downloadTask(target); }}
                disabled={isDownloading}
                accessibilityLabel="Descargar imágenes y videos"
              >
                <Ionicons name="download-outline" size={20} color="#555" />
                <Text style={styles.actionText}>{isDownloading ? 'Descargando…' : 'Descargar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionOption}
                onPress={() => setStoryOptionsOpen((open) => !open)}
                accessibilityLabel="Compartir en mi historia"
              >
                <Ionicons name="share-social-outline" size={20} color="#51cf66" />
                <Text style={styles.actionText}>Compartir en mi historia</Text>
                <Ionicons name={storyOptionsOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#999" style={styles.chevron} />
              </TouchableOpacity>
              {storyOptionsOpen ? (
                <View style={styles.storySubOptions}>
                  {[{ section: null, id: null, title: 'Toda la aportación' }, ...storyItemsOf(sourceTask)].map((item) => (
                    <TouchableOpacity
                      key={item.id || 'all'}
                      style={styles.storySubOption}
                      onPress={() => { onClose?.(); shareToStory(sourceTask, item); }}
                    >
                      <Ionicons name={item.id ? 'albums-outline' : 'documents-outline'} size={16} color="#51cf66" />
                      <Text style={styles.storySubOptionText} numberOfLines={1}>{item.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {isPetition ? (
                <TouchableOpacity
                  style={[styles.actionOption, styles.actionOptionSupport]}
                  onPress={() => { setSupportTask(sourceTask); onClose?.(); }}
                >
                  <Ionicons name="cash-outline" size={20} color="#2f9e44" />
                  <Text style={[styles.actionText, styles.actionTextSupport]}>Apoyar monetariamente</Text>
                </TouchableOpacity>
              ) : null}

              {/* El foro del perfil de quien publicó (o compartió): también el propio. */}
              {handlers.goToForum && targetUser ? (
                <TouchableOpacity style={styles.actionOption} onPress={handlers.goToForum}>
                  <Ionicons name="newspaper-outline" size={20} color="#4dabf7" />
                  <Text style={styles.actionText}>
                    {isOtherUser ? `Ir al foro de @${targetUser?.username || 'usuario'}` : 'Ir a mi foro'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {isOtherUser && (
                <>
                  <TouchableOpacity style={styles.actionOption} onPress={handlers.directMessage}>
                    <Ionicons name="chatbubbles-outline" size={20} color="#4dabf7" />
                    <Text style={styles.actionText}>Mensaje Directo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionOption} onPress={targetUser?.id ? profileActions.toggleFollow : handlers.toggleFollow}>
                    <Ionicons name={isFollowing ? 'person-remove-outline' : 'person-add-outline'} size={20} color={isFollowing ? '#4dabf7' : '#555'} />
                    <Text style={styles.actionText}>{isFollowing ? 'Dejar de seguir' : 'Seguir'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionOption} onPress={targetUser?.id ? profileActions.toggleFavorite : handlers.toggleProfileFavorite}>
                    <Ionicons name={isProfileFavorited ? 'heart' : 'heart-outline'} size={20} color={isProfileFavorited ? '#ff0b5a' : '#555'} />
                    <Text style={styles.actionText}>{isProfileFavorited ? 'Eliminar perfil de favoritos' : 'Agregar perfil a favoritos'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionOption} onPress={targetUser?.id ? profileActions.togglePin : () => handlers.pinFavorite('profile')}>
                    <Ionicons name={isProfilePinned ? 'pin' : 'pin-outline'} size={20} color="#845ef7" />
                    <Text style={styles.actionText}>{isProfilePinned ? 'Quitar perfil del top 5' : 'Anclar perfil en top 5'}</Text>
                  </TouchableOpacity>
                </>
              )}

              {isOwner && (
                <>
                  {canEdit !== false && (
                    <TouchableOpacity style={styles.actionOption} onPress={handlers.edit}>
                      <Ionicons name="pencil-outline" size={20} color="#4dabf7" />
                      <Text style={styles.actionText}>Editar</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {(isOwner || isAdmin) && (
                <TouchableOpacity style={[styles.actionOption, styles.actionOptionDelete]} onPress={handlers.delete}>
                  <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                  <Text style={[styles.actionText, { color: '#ff6b6b', fontWeight: 'bold' }]}>Eliminar</Text>
                </TouchableOpacity>
              )}

              {isAdmin && (
                <>
                  {isModeratable ? (
                    <TouchableOpacity style={styles.actionOption} onPress={handlers.approvePodcast}>
                      <Ionicons name={isApproved ? 'close-circle-outline' : 'ribbon-outline'} size={20} color="#f59f00" />
                      <Text style={[styles.actionText, { color: '#e67700', fontWeight: '700' }]}>
                        {isApproved ? 'Retirar aprobación' : isPodcast ? 'Aprobar podcast' : 'Aprobar petición'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {me?.is_superuser && handlers.toggleAppLike ? (
                    <TouchableOpacity style={styles.actionOption} onPress={handlers.toggleAppLike}>
                      <Ionicons name={sourceTask?.app_has_liked ? 'heart-dislike-outline' : 'heart-circle-outline'} size={20} color="#ff6b6b" />
                      <Text style={styles.actionText}>{sourceTask?.app_has_liked ? 'Quitar like de la App' : 'Dar like como la App'}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.actionOption} onPress={handlers.toggleVerified}>
                    <Ionicons
                      name={targetUser?.profile?.is_verified ? 'checkmark-circle' : 'checkmark-circle-outline'}
                      size={20}
                      color={targetUser?.profile?.is_verified ? '#4dabf7' : '#555'}
                    />
                    <Text style={styles.actionText}>{targetUser?.profile?.is_verified ? 'Quitar Verificación' : 'Verificar Perfil'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionOption} onPress={handlers.toggleRecommended}>
                    <Ionicons
                      name={targetUser?.profile?.is_recommended ? 'ribbon' : 'ribbon-outline'}
                      size={20}
                      color={targetUser?.profile?.is_recommended ? '#f59f00' : '#555'}
                    />
                    <Text style={styles.actionText}>{targetUser?.profile?.is_recommended ? 'Quitar Recomendación' : 'Recomendar Perfil'}</Text>
                  </TouchableOpacity>
                  {canSuspendAuthor ? (
                    <TouchableOpacity
                      style={styles.actionOption}
                      onPress={() => {
                        onClose?.();
                        setAccountActive(
                          targetUser.id,
                          targetUser.username || targetUser.first_name || '',
                          false,
                        );
                      }}
                    >
                      <Ionicons name="pause-circle-outline" size={20} color="#ff6b6b" />
                      <Text style={[styles.actionText, { color: '#ff6b6b', fontWeight: '700' }]}>Suspender cuenta del autor</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}

              {extraOptions}
            </ScrollView>
          ) : null}
        </View>
      </TouchableOpacity>
    </Modal>
    {statsTaskId ? (
      <TaskStatsSheet visible taskId={statsTaskId} onClose={() => setStatsTaskId(null)} />
    ) : null}
    {collectionTaskId ? (
      <CollectionPickerSheet visible taskId={collectionTaskId} onClose={() => setCollectionTaskId(null)} />
    ) : null}
    {supportTask ? (
      <PetitionSupportSheet
        visible
        onClose={() => setSupportTask(null)}
        task={supportTask}
        isOwner={String(supportTask.user?.id || supportTask.user) === String(currentUserId)}
      />
    ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    boxShadow: '0px -2px 10px rgba(0, 0, 0, 0.1)',
    elevation: 10,
  },
  modalDragHandle: { width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  actionOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#f5f5f5' },
  actionOptionDelete: { backgroundColor: '#ffe3e3' },
  actionOptionSupport: { backgroundColor: '#ebfbee' },
  actionTextSupport: { color: '#2b8a3e', fontWeight: '700' },
  actionText: { fontSize: 16, marginLeft: 14, color: '#333', fontWeight: '500' },
  chevron: { marginLeft: 'auto' },
  storySubOptions: { marginTop: -4, marginBottom: 8, marginLeft: 24, gap: 6 },
  storySubOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#ebfbee' },
  storySubOptionText: { flex: 1, fontSize: 14, color: '#2b8a3e', fontWeight: '600' },
  categoryPinOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f3f0ff' },
  categoryPinOptionOn: { backgroundColor: '#e5dbff' },
  categoryPinText: { flex: 1, fontSize: 14, color: '#5f3dc4', fontWeight: '600' },
  categoryPinState: { fontSize: 11, color: '#7048e8', fontWeight: '700' },
});

export default TaskActionsModal;
