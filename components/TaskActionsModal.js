import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getActionTaskInfo } from '@hooks/useTaskActions';
<<<<<<< HEAD
import { useMe } from '@hooks/useApi';
import { setAccountActive } from '../utils/adminActions';
=======
>>>>>>> mis-cambios-hoy

/**
 * Menú de 3 puntos COMPLETO. Es el mismo para el feed, el detalle de tarea y el de tarea compartida.
 *
 * actionTask: tarea normal, o compartida marcada con `isSharedTask: true`.
<<<<<<< HEAD
 * handlers: { toggleFavorite, pinFavorite(kind), viewShares (opcional), directMessage, goToForum, toggleFollow, toggleProfileFavorite,
=======
 * handlers: { toggleFavorite, pinFavorite(kind), share, viewShares (opcional), directMessage, goToForum, toggleProfileFavorite,
>>>>>>> mis-cambios-hoy
 *             edit, delete, approvePodcast, toggleVerified, toggleRecommended }
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
<<<<<<< HEAD
  const { data: me } = useMe();
  const canSuspendAuthor = Boolean(me?.is_superuser) && isOtherUser && Boolean(targetUser?.id) && !targetUser?.is_superuser;
  const isFavorited = Boolean(sourceTask?.is_favorited);
  const isProfileFavorited = Boolean(targetUser?.is_favorited);
  const isFollowing = Boolean(targetUser?.is_following);
=======
  const isFavorited = Boolean(sourceTask?.is_favorited);
  const isProfileFavorited = Boolean(targetUser?.is_favorited);
>>>>>>> mis-cambios-hoy
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
              <TouchableOpacity style={styles.actionOption} onPress={handlers.toggleFavorite}>
                <Ionicons name={isFavorited ? 'bookmark' : 'bookmark-outline'} size={20} color={isFavorited ? '#f59f00' : '#555'} />
                <Text style={styles.actionText}>{isFavorited ? 'Quitar de guardados' : 'Guardar en favoritos'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionOption} onPress={() => handlers.pinFavorite('task')}>
                <Ionicons name="pin-outline" size={20} color="#845ef7" />
                <Text style={styles.actionText}>Anclar tarea en top 5</Text>
              </TouchableOpacity>
<<<<<<< HEAD
=======
              <TouchableOpacity style={styles.actionOption} onPress={handlers.share}>
                <Ionicons name="share-social-outline" size={20} color="#555" />
                <Text style={styles.actionText}>Compartir</Text>
              </TouchableOpacity>
>>>>>>> mis-cambios-hoy
              {handlers.viewShares ? (
                <TouchableOpacity style={styles.actionOption} onPress={handlers.viewShares}>
                  <Ionicons name="people-outline" size={20} color="#555" />
                  <Text style={styles.actionText}>Ver compartidas</Text>
                </TouchableOpacity>
              ) : null}

              {isOtherUser && (
                <>
                  <TouchableOpacity style={styles.actionOption} onPress={handlers.directMessage}>
                    <Ionicons name="chatbubbles-outline" size={20} color="#4dabf7" />
                    <Text style={styles.actionText}>Mensaje Directo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionOption} onPress={handlers.goToForum}>
                    <Ionicons name="newspaper-outline" size={20} color="#4dabf7" />
                    <Text style={styles.actionText}>Ir al foro</Text>
                  </TouchableOpacity>
<<<<<<< HEAD
                  <TouchableOpacity style={styles.actionOption} onPress={handlers.toggleFollow}>
                    <Ionicons name={isFollowing ? 'person-remove-outline' : 'person-add-outline'} size={20} color={isFollowing ? '#4dabf7' : '#555'} />
                    <Text style={styles.actionText}>{isFollowing ? 'Dejar de seguir' : 'Seguir'}</Text>
                  </TouchableOpacity>
=======
>>>>>>> mis-cambios-hoy
                  <TouchableOpacity style={styles.actionOption} onPress={handlers.toggleProfileFavorite}>
                    <Ionicons name={isProfileFavorited ? 'heart' : 'heart-outline'} size={20} color={isProfileFavorited ? '#ff0b5a' : '#555'} />
                    <Text style={styles.actionText}>{isProfileFavorited ? 'Eliminar perfil de favoritos' : 'Agregar perfil a favoritos'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionOption} onPress={() => handlers.pinFavorite('profile')}>
                    <Ionicons name="pin-outline" size={20} color="#845ef7" />
                    <Text style={styles.actionText}>Anclar perfil en top 5</Text>
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
<<<<<<< HEAD
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
=======
>>>>>>> mis-cambios-hoy
                </>
              )}

              {extraOptions}
            </ScrollView>
          ) : null}
        </View>
      </TouchableOpacity>
    </Modal>
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
  actionText: { fontSize: 16, marginLeft: 14, color: '#333', fontWeight: '500' },
});

export default TaskActionsModal;
