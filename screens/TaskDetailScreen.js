import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Platform, KeyboardAvoidingView, Dimensions, useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment'; 
import 'moment/locale/es'; 
import api, { getImageUrl, UPLOAD_TIMEOUT_MS } from '@api';
import { Image } from 'expo-image';
import ShareModal from '@components/ShareModal';
import TieredLikesModal from './TieredLikesModal';
import ShareActionMenu from './ShareActionMenu';
import TaskPostCard, { FeedVideoVisibilityContext } from '@components/TaskPostCard';
import TaskActionsModal from '@components/TaskActionsModal';
import ReportContentButton from '@components/ReportContentButton';
import useTaskActions from '@hooks/useTaskActions';
import TouchableUsername from '@components/TouchableUsername';
import FollowHeart from '@components/FollowHeart';
import ContentActionsButton from '@components/ContentActionsMenu';
import AportacionCard from '@components/AportacionCard';
import { CommentAttachMenu, CommentMediaChip, CommentAttachmentView } from '@components/CommentAttachments';
import FavoriteAportacionPicker from '@components/FavoriteAportacionPicker';
import HiddenTaskBanner from '@components/HiddenTaskBanner';
import UserTagPicker from '@components/UserTagPicker';
import { useTaskDetail, useTaskComments, useMe, useIsAdmin } from '@hooks/useApi';
import { buildCommentBody, getCommentAportacion } from '../utils/commentAportacion';
import { pickPhotoOrVideo } from '../utils/mediaUpload';
import { toAportacionInfo } from '../utils/aportaciones';
import { optimisticRepost, repostFromResponse, repostSnapshot } from '../utils/repost';
import TaskSearchPicker from '@components/TaskSearchPicker';

moment.locale('es');

/** Ids etiquetados, en orden estable, para saber si cambiaron al editar. */
const tagIdsKey = (users) => users.map((user) => String(user.id)).sort().join(',');

// =====================================================================
// COMPONENTE RECURSIVO (COMENTARIOS)
// =====================================================================
const CommentItem = ({ comment, depth = 0, onReply, onLike, onLikeLongPress, onDelete, onEdit, onOpenAportacion, currentUserId, expandedCommentIds, toggleExpand, navigation }) => {
  const hasChildren = comment.children && comment.children.length > 0;
  const isExpanded = expandedCommentIds.includes(comment.id);

  const marginLeft = depth > 0 ? 16 : 0;
  const borderLeftWidth = depth > 0 ? 2 : 0;

  // ⚡ HELPER PARA CONTAR TODAS LAS RESPUESTAS ANIDADAS (HIJOS Y NIETOS)
  const countAllReplies = (children = []) => {
    return children.reduce((total, child) => total + 1 + countAllReplies(child.children || []), 0);
  };
  const totalReplies = countAllReplies(comment.children);
  const aportacion = getCommentAportacion(comment);

  // ⚡ HELPER PARA EXTRAER EL NOMBRE DEL AUTOR DEL COMENTARIO
// ⚡ HELPER PARA EL NOMBRE DEL COMENTARIO (Basado en tu modelo de Django)
  const getCommentAuthorName = (c) => {
    const userObj = c.created_by || c.user;
    
    if (userObj) {
      // 1. Intentamos usar el nombre y apellido real
      if (userObj.first_name) {
        return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
      }
      // 2. Si no ha puesto nombre, usamos la primera parte de su email
      if (userObj.email) {
        return userObj.email.split('@')[0];
      }
    }
    // 3. Fallback final
    return c.username || 'Anónimo';
  };

  return (
    <View style={[styles.commentWrapper, { marginLeft, borderLeftWidth }]}>
      <View style={styles.commentHeader}>
        <View style={styles.commentUserInfo}>
          <Image
            source={{ uri: getImageUrl(comment.created_by?.user_image || comment.user?.user_image) || 'https://ui-avatars.com/api/?name=Usuario' }}
            style={styles.commentAvatar}
          />
          <View style={{ flex: 1 }}>
            <TouchableUsername
              username={getCommentAuthorName(comment)}
              userId={comment.created_by?.id || comment.user?.id || null}
              userImage={getImageUrl(comment.created_by?.user_image || comment.user?.user_image) || null}
              navigation={navigation}
              style={styles.commentAuthorWrapper}
              textStyle={styles.commentAuthor}
              numberOfLines={1}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.commentDate}>
                {moment(comment.created_at).fromNow()}
              </Text>
              <ReportContentButton targetType="comment" targetId={comment.id} size={15} />
              
              {/* BOTÓN DE ELIMINAR */}
              {(currentUserId === comment.created_by?.id || currentUserId === comment.user?.id) && (
                <View style={{ flexDirection: 'row', marginLeft: 10 }}>
                  <TouchableOpacity onPress={() => onEdit(comment)} style={{ marginRight: 10 }} accessibilityLabel="Editar comentario">
                    <Ionicons name="pencil-outline" size={14} color="#4dabf7" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDelete(comment.id)} accessibilityLabel="Eliminar comentario">
                    <Ionicons name="trash-outline" size={14} color="#ff6b6b" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.commentLikeBtn} 
          onPress={() => onLike(comment.id)}
          onLongPress={() => onLikeLongPress(comment.id)}
        >
          <Text style={styles.commentLikeCount}>{comment.likes_count || 0}</Text>
          <Ionicons name={comment.user_has_liked ? "heart" : "heart-outline"} size={16} color={comment.user_has_liked ? "#ff6b6b" : "#999"} />
        </TouchableOpacity>
        <FollowHeart
          userId={comment.created_by?.id || comment.user?.id}
          username={getCommentAuthorName(comment)}
          size={18}
          style={styles.commentFollowHeart}
        />
        <ContentActionsButton
          accessibilityLabel="Más opciones del comentario"
          author={comment.created_by || comment.user}
          currentUserId={currentUserId}
          navigation={navigation}
          report={{ targetType: 'comment', targetId: comment.id }}
          editLabel="Editar comentario"
          deleteLabel="Eliminar comentario"
          {...(currentUserId === (comment.created_by?.id || comment.user?.id)
            ? { onEdit: () => onEdit(comment), onDelete: () => onDelete(comment.id) }
            : {})}
        />
      </View>

      {comment.text || comment.content ? <Text style={styles.commentText}>{comment.text || comment.content}</Text> : null}
      <CommentAttachmentView comment={comment} />

      {comment.tagged_users?.length ? (
        <View style={styles.commentTags}>
          <Text style={styles.commentTagsLabel}>Con</Text>
          {comment.tagged_users.map((tagged) => (
            <TouchableUsername
              key={tagged.id}
              username={`@${tagged.username || 'usuario'}`}
              userId={tagged.id}
              navigation={navigation}
              textStyle={styles.commentTagName}
            />
          ))}
        </View>
      ) : null}

      {aportacion ? (
        <AportacionCard
          info={comment.aportacion_info}
          onPress={() => onOpenAportacion(aportacion)}
          style={styles.commentAportacion}
        />
      ) : null}

      <View style={styles.commentFooter}>
        <TouchableOpacity onPress={() => onReply(comment)} accessibilityLabel="Responder">
          <Text style={styles.replyActionText}>Responder</Text>
        </TouchableOpacity>

        {hasChildren && (
          <TouchableOpacity onPress={() => toggleExpand(comment.id)} style={styles.toggleRepliesBtn}>
            <Text style={styles.toggleRepliesText}>
              {isExpanded ? "Ocultar respuestas" : `Ver respuestas (${totalReplies})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* RENDERIZADO RECURSIVO DE RESPUESTAS */}
      {isExpanded && hasChildren && (
        <View style={styles.repliesContainer}>
          {comment.children.map(child => (
            <CommentItem 
              key={child.id} 
              comment={child} 
              depth={depth + 1} 
              onReply={onReply} 
              onLike={onLike}
              onLikeLongPress={onLikeLongPress}
              onDelete={onDelete}
              onEdit={onEdit}
              onOpenAportacion={onOpenAportacion}
              currentUserId={currentUserId}
              expandedCommentIds={expandedCommentIds}
              toggleExpand={toggleExpand}
              navigation={navigation}
            />
          ))}
        </View>
      )}
    </View>
  );
};


// =====================================================================
// PANTALLA PRINCIPAL DE DETALLE
// =====================================================================
const TaskDetailScreen = ({ route, navigation }) => {
  const { taskId } = route.params;
  const [task,             setTask]             = useState(null);
  const [comments,         setComments]         = useState([]);
  const [commentText,      setCommentText]      = useState('');
  const [isCreatingComment, setIsCreatingComment] = useState(false);
  const [replyingTo,       setReplyingTo]       = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [currentUserId,    setCurrentUserId]    = useState(null);
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [podcastInvitationStatus, setPodcastInvitationStatus] = useState(null);
  const [respondingToPodcast,     setRespondingToPodcast]     = useState(false);
  const [expandedCommentIds, setExpandedCommentIds] = useState([]);
  // Aportación favorita adjunta al comentario o respuesta (también al editar).
  const [attachedAportacion, setAttachedAportacion] = useState(null);
  const [aportacionPickerVisible, setAportacionPickerVisible] = useState(false);
  const [editingAportacionId, setEditingAportacionId] = useState(null);
  // Personas etiquetadas en el comentario (testimonio en su perfil si lo aprueban).
  const [commentTags, setCommentTags] = useState([]);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const [editingTagIds, setEditingTagIds] = useState('');
  // Foto o video adjunto al comentario nuevo (al editar no se cambia).
  const [commentMedia, setCommentMedia] = useState(null);

  // Modal de likes
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl,     setLikesModalUrl]     = useState('');
  const [likesModalTitle,   setLikesModalTitle]   = useState('Likes');

  // Modal de compartir
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare,       setTaskToShare]       = useState(null);
  // Modal de acciones
  const [actionModalVisible, setActionModalVisible] = useState(false);

  const openMediaInReels = useCallback((mediaUri) => {
    if (!task?.id || !mediaUri) return;
    navigation.navigate('Reels', {
      openTaskId: task.id,
      openMediaSrc: mediaUri,
      openMediaType: 'video',
      openMediaRequestId: Date.now(),
    });
  }, [navigation, task?.id]);

  const [shareActionMenuVisible, setShareActionMenuVisible] = useState(false);

  const { width: screenWidth } = useWindowDimensions();
  const carouselWidth = Math.max(280, screenWidth - 56);

  // Autoplay de videos: se mide contra el ScrollView real (no toda la ventana)
  const scrollRef = useRef(null);
  const repostInFlightRef = useRef(false);
  const getScrollBounds = useCallback((callback) => {
    const node = scrollRef.current?.getNativeScrollRef?.() || scrollRef.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
    } else {
      callback(null);
    }
  }, []);
  const videoVisibility = useMemo(
    () => ({ visibleIds: null, getListBounds: getScrollBounds }),
    [getScrollBounds]
  );

  const openSubMediaInReels = useCallback((subTask, sub, section) => {
    if (!subTask?.id || !sub?.video) return;
    navigation.navigate('Reels', {
      openTaskId: subTask.id,
      openMediaSrc: sub.video,
      openMediaType: 'video',
      openMediaSection: section,
      openMediaRequestId: Date.now(),
    });
  }, [navigation]);

  const handleShareSubItemToStory = useCallback(async (subTask, section, sub) => {
    if (!subTask || !sub) return;
    try {
      await api.post('stories/share-task/', {
        task_id: subTask.id,
        source_item_type: section,
        source_item_id: sub.id,
      });
      Alert.alert('Éxito', 'Se compartió la aportación en tu historia de 24 horas.');
      navigation.navigate('Stories');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo compartir esta aportación en historia.');
    }
  }, [navigation]);

  const handleShareToStory = useCallback(async () => {
    if (!task?.id) return;
    try {
      await api.post('stories/share-task/', { task_id: task.id });
      Alert.alert('Éxito', 'Se compartió en tu historia de 24 horas.');
      navigation.navigate('Stories');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo compartir esta tarea en historia.');
    }
  }, [task?.id, navigation]);

  const handleRepost = useCallback(async () => {
    if (!task?.id || repostInFlightRef.current) return;
    repostInFlightRef.current = true;
    const original = repostSnapshot(task);
    const updateTask = (patch) => setTask(prev => (prev ? { ...prev, ...patch } : prev));
    updateTask(optimisticRepost(original));
    try {
      const response = await api.post(`tasks/${task.id}/repost/`);
      updateTask(repostFromResponse(response.data));
    } catch (error) {
      console.error('Error al impulsar:', error.response?.data || error);
      Alert.alert('Error', 'No se pudo impulsar la publicación. Inténtalo de nuevo.');
      updateTask(original);
    } finally {
      repostInFlightRef.current = false;
    }
  }, [task]);

  const handleShowProfileLikes = (userId) => {
    setLikesModalUrl(`profiles/${userId}/likes/`);
    setLikesModalTitle('Likes del Perfil');
    setLikesModalVisible(true);
  };

  const handleShowTaskShares = (sharedTaskId) => {
    setLikesModalUrl(`tasks/${sharedTaskId}/users-who-shared/`);
    setLikesModalTitle('Compartido por');
    setLikesModalVisible(true);
  };

  const handlePodcastInvitationResponse = async (accepted) => {
    if (!task?.id || respondingToPodcast) return;
    setRespondingToPodcast(true);
    try {
      const response = await api.post(`tasks/${task.id}/podcast-invitation/`, { accepted });
      setPodcastInvitationStatus(response.data?.status || (accepted ? 'accepted' : 'declined'));
      Alert.alert(
        accepted ? 'Invitación aceptada' : 'Invitación rechazada',
        accepted
          ? 'Se notificó al equipo y se envió tu respuesta por mensaje.'
          : 'Se notificó al equipo de tu respuesta.'
      );
    } catch (error) {
      Alert.alert('No se pudo responder', error.response?.data?.detail || 'Intenta de nuevo.');
    } finally {
      setRespondingToPodcast(false);
    }
  };


  const handleShowTaskLikes = () => {
    setLikesModalUrl(`tasks/${taskId}/users-who-liked/`);
    setLikesModalTitle('Likes');
    setLikesModalVisible(true);
  };

  const handleShowCommentLikes = (commentId) => {
    setLikesModalUrl(`tasks/comments/${commentId}/users-who-liked/`);
    setLikesModalTitle('Likes');
    setLikesModalVisible(true);
  };

  const toggleCommentExpansion = (commentId) => {
    setExpandedCommentIds((prev) =>
      prev.includes(commentId) ? prev.filter((id) => id !== commentId) : [...prev, commentId]
    );
  };

  // ─── React Query para data inicial ─────────────────────────────────────────
  // Anterior / siguiente recomendado: el autor los elige desde aquí ('previous' | 'next').
  const [seriesPicker, setSeriesPicker] = useState(null);
  const { data: taskData, isLoading: loading, refetch: refetchTask } = useTaskDetail(taskId);
  const {
    data: commentsData,
    refetch: refetchComments,
    fetchNextPage: fetchMoreComments,
    hasNextPage: hasMoreComments,
    isFetchingNextPage: isFetchingMoreComments,
    remaining: remainingComments,
  } = useTaskComments(taskId);
  const { data: me } = useMe();
  const { data: adminData } = useIsAdmin();

  // Sincronizar React Query → estado local
  useEffect(() => {
    if (taskData) {
      setTask(taskData);
      setPodcastInvitationStatus(taskData?.podcast_invitation_status || null);
    }
  }, [taskData]);

  useEffect(() => {
    if (commentsData) {
      const parentComments = commentsData.filter(c => c.is_parent || !c.parent);
      setComments(parentComments);
    }
  }, [commentsData]);

  useEffect(() => {
    if (me?.id) setCurrentUserId(me.id);
  }, [me]);

  const saveSeriesLink = async (field, linkedTaskId) => {
    try {
      await api.patch(`tasks/${task.id}/`, { [field]: linkedTaskId });
      await refetchTask();
    } catch (error) {
      Alert.alert('No se pudo guardar', String(error.response?.data?.[field]?.[0] || 'Intenta de nuevo.'));
    }
  };

  useEffect(() => {
    if (adminData) setIsAdmin(adminData.isAdmin || adminData.isStaff);
  }, [adminData]);

  // fetchTaskDetail y fetchComments como wrappers del refetch para no romper handlers existentes
  const fetchComments = useCallback(async () => {
    await refetchComments();
  }, [refetchComments]);

  const fetchTaskDetail = useCallback(async () => {
    await refetchTask();
    await refetchComments();
  }, [refetchTask, refetchComments]);

  useFocusEffect(
    useCallback(() => {
      refetchTask();
      refetchComments();
    }, [refetchTask, refetchComments])
  );

  const resetComposer = () => {
    setCommentText('');
    setCommentMedia(null);
    setEditingCommentId(null);
    setEditingAportacionId(null);
    setAttachedAportacion(null);
    setCommentTags([]);
    setEditingTagIds('');
  };

  const pickCommentMedia = async () => {
    const asset = await pickPhotoOrVideo();
    if (asset) setCommentMedia(asset);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() && !(commentMedia && !editingCommentId)) return;
    setIsCreatingComment(true);

    try {
      if (editingCommentId) {
        const changes = { text: commentText };
        const nextAportacionId = attachedAportacion?.id ?? null;
        // Solo se envía si cambió: el backend no vuelve a exigir favorito a la que ya tenía.
        if (String(nextAportacionId ?? '') !== String(editingAportacionId ?? '')) {
          changes.aportacion = nextAportacionId;
        }
        if (tagIdsKey(commentTags) !== editingTagIds) {
          changes.tagged_user_ids = commentTags.map((user) => user.id);
        }
        await api.patch(`comments/${editingCommentId}/`, changes);
      } else {
        const body = await buildCommentBody({
          text: commentText,
          replyingTo,
          aportacion: attachedAportacion,
          tagIds: commentTags.map((user) => user.id),
          media: commentMedia,
        });
        if (commentMedia) await api.post(`tasks/${taskId}/comments/`, body, { timeout: UPLOAD_TIMEOUT_MS });
        else await api.post(`tasks/${taskId}/comments/`, body);
        // ⚡ ACTUALIZACIÓN OPTIMISTA: Incrementamos el conteo global al instante
        setTask(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);
      }

      resetComposer();
      if (replyingTo) {
        setExpandedCommentIds((prev) => [...new Set([...prev, replyingTo.id])]);
      }
      setReplyingTo(null);
      await fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error.response?.data || error.message);
      // Mensajes de validación del backend (p. ej. "Solo puedes adjuntar una de tus aportaciones favoritas.")
      const data = error.response?.data;
      const detail = [data?.aportacion, data?.tagged_user_ids, data?.text, data?.detail]
        .map(value => (Array.isArray(value) ? value[0] : value))
        .find(value => typeof value === 'string' && value);
      Alert.alert('Error', detail || 'No se pudo publicar el comentario');
    } finally {
      setIsCreatingComment(false);
    }
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setCommentText(comment.text || comment.content || '');
    setReplyingTo(null);
    setEditingAportacionId(comment.aportacion_info?.id ?? null);
    setAttachedAportacion(comment.aportacion_info || null);
    const tags = (comment.tagged_users || []).map(({ id, username }) => ({ id, username }));
    setCommentTags(tags);
    setEditingTagIds(tagIdsKey(tags));
  };

  const handleSelectAportacion = (favoriteTask) => {
    setAttachedAportacion(toAportacionInfo(favoriteTask));
    setAportacionPickerVisible(false);
  };

  const openAportacion = useCallback((info) => {
    if (!info?.id) return;
    if (typeof navigation.push === 'function') navigation.push('TaskDetail', { taskId: info.id });
    else navigation.navigate('TaskDetail', { taskId: info.id });
  }, [navigation]);

  const handleLikeTask = async () => {
    // ⚡ ACTUALIZACIÓN OPTIMISTA: Cambiamos el corazón y el conteo al instante
    setTask(prev => {
      if (!prev) return prev;
      const isLiked = prev.user_has_liked;
      return {
        ...prev,
        user_has_liked: !isLiked,
        likes_count: prev.likes_count + (isLiked ? -1 : 1)
      };
    });

    try {
      const response = await api.post(`tasks/${taskId}/like/`); // ✅ Endpoint correcto
      // Confirmamos con los datos exactos del servidor en segundo plano
      setTask(prev => prev ? { ...prev, user_has_liked: response.data.liked, likes_count: response.data.likes_count } : prev);
    } catch (error) {
      console.error('Error liking task:', error);
      fetchTaskDetail(); // Revertimos descargando de nuevo si falló
    }
  };

  const openShareModal = () => {
    if (!task) return;
    setTaskToShare(task.id);
    setShareModalVisible(true);
  };

  const handleShareSuccess = () => {
    setTask(prev => prev ? { ...prev, share_count: (prev.share_count || 0) + 1 } : prev);
  };

  const handleLikeComment = async (commentId) => {
    // Helper para actualizar recursivamente los likes sin recargar
    const updateCommentLike = (commentsList, id, liked, count) => {
      return commentsList.map(comment => {
        if (comment.id === id) {
          const newLiked = liked !== undefined ? liked : !comment.user_has_liked;
          const newCount = count !== undefined ? count : comment.likes_count + (comment.user_has_liked ? -1 : 1);
          return { ...comment, user_has_liked: newLiked, likes_count: newCount };
        }
        if (comment.children && comment.children.length > 0) {
          return { ...comment, children: updateCommentLike(comment.children, id, liked, count) };
        }
        return comment;
      });
    };

    // ⚡ ACTUALIZACIÓN OPTIMISTA
    setComments(prev => updateCommentLike(prev, commentId));

    try {
      const response = await api.post(`comments/${commentId}/like/`); 
      setComments(prev => updateCommentLike(prev, commentId, response.data.liked, response.data.likes_count));
    } catch (error) {
      console.error('Error liking comment:', error.response?.data || error.message);
      fetchComments(); // Revertimos
    }
  };

  const handleDeleteComment = (commentId) => {
    const executeDelete = async () => {
      // ⚡ ACTUALIZACIÓN OPTIMISTA AL BORRAR
      const removeComment = (list) => {
        return list.filter(c => c.id !== commentId).map(c => {
          if (c.children) {
             return { ...c, children: removeComment(c.children) };
          }
          return c;
        });
      };
      setComments(prev => removeComment(prev));
      setTask(prev => prev ? { ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) } : prev);

      try {
        await api.delete(`comments/${commentId}/`);
        if (Platform.OS !== 'web') Alert.alert("Éxito", "Comentario eliminado.");
      } catch (error) {
        console.error("Error eliminando comentario:", error.response?.data || error.message);
        fetchComments(); // Revertir silenciosamente en caso de fallo
        if (Platform.OS !== 'web') Alert.alert("Error", "No se pudo eliminar el comentario.");
        else window.alert("Error: No se pudo eliminar el comentario.");
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("¿Estás seguro de que deseas eliminar este comentario de forma permanente?")) {
        executeDelete();
      }
    } else {
      Alert.alert(
        "Eliminar Comentario",
        "¿Estás seguro de que deseas eliminar este comentario de forma permanente?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Eliminar", style: "destructive", onPress: executeDelete }
        ]
      );
    }
  };

  const onReplyPress = (comment) => {
    setReplyingTo(comment);
  };

  // ⚡ HELPER PARA EXTRAER EL NOMBRE DEL AUTOR DE LA TAREA PRINCIPAL
// ⚡ HELPER PARA EL NOMBRE DE LA TAREA PRINCIPAL
  const getTaskAuthorName = () => {
    if (!task) return 'Anónimo';
    
    // 1. Intentamos el nombre real del usuario relacional
    if (task.user?.first_name) {
      return `${task.user.first_name} ${task.user.last_name || ''}`.trim();
    }
    // 2. Intentamos el campo de texto 'username' que tienes en el modelo Task
    if (task.username) {
      return task.username;
    }
    // 3. Fallback al inicio del correo electrónico
    if (task.user?.email) {
      return task.user.email.split('@')[0];
    }
    
    return 'Anónimo';
  };

  // ⚡ HELPER PARA EL AVATAR DE LA TAREA PRINCIPAL
  const getTaskAuthorAvatar = () => {
    if (!task) return 'https://ui-avatars.com/api/?name=A';
    
    // SimpleUserSerializer devuelve 'user_image' directamente en el objeto user
    const uri = task.user?.user_image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image;
    return getImageUrl(uri) || 'https://ui-avatars.com/api/?name=' + getTaskAuthorName();
  };

  const taskOwnerId = task?.user?.id || task?.user_id || task?.user;
  const isTaskOwner = currentUserId && taskOwnerId && String(currentUserId) === String(taskOwnerId);

  // Menú de 3 puntos completo (mismos handlers que el feed)
  const taskActions = useTaskActions({
    navigation,
    actionTask: task,
    currentUserId,
    close: () => setActionModalVisible(false),
    refresh: fetchTaskDetail,
    onShare: () => setShareActionMenuVisible(true),
    onDeleted: () => {
      Alert.alert('Éxito', 'Tarea eliminada.');
      navigation.goBack();
    },
  });

  // ⚡ HELPER PARA EXTRAER EL AVATAR DEL AUTOR DE LA TAREA PRINCIPAL
  // const getTaskAuthorAvatar = () => {
  //   if (!task) return 'https://ui-avatars.com/api/?name=A';
  //   const uri = task.user_image || task.user?.user_image;
  //   return getImageUrl(uri) || 'https://ui-avatars.com/api/?name=' + getTaskAuthorName();
  // };

  if (loading || !task) return <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 50 }} />;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TasksList')}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Aportación</Text>
        {podcastInvitationStatus === 'pending' ? (
          <TouchableOpacity
            style={styles.podcastAcceptButton}
            onPress={() => handlePodcastInvitationResponse(true)}
            disabled={respondingToPodcast}
          >
            {respondingToPodcast ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.podcastAcceptText}>Aceptar</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
        <ReportContentButton targetType="task" targetId={task.id} />
        <View style={{ width: 24 }} />
      </View>

      <ScrollView ref={scrollRef} style={styles.content}>
        <View style={styles.hiddenBannerWrap}>
          <HiddenTaskBanner task={task} onPublished={() => refetchTask()} />
        </View>
        {/* LA TAREA PRINCIPAL (misma tarjeta que en el feed) */}
        <FeedVideoVisibilityContext.Provider value={videoVisibility}>
          <TaskPostCard
            task={task}
            navigation={navigation}
            tema={task.pch || ''}
            carouselWidth={carouselWidth}
            onAvatarPress={handleShowProfileLikes}
            onOpenActions={() => setActionModalVisible(true)}
            onRepost={handleRepost}
            onLike={handleLikeTask}
            onShowLikes={handleShowTaskLikes}
            onPressComments={() => {}}
            onShare={() => setShareActionMenuVisible(true)}
            onShowShares={handleShowTaskShares}
            onShareSubItemToStory={handleShareSubItemToStory}
            onOpenSubMediaInReels={openSubMediaInReels}
          />
        </FeedVideoVisibilityContext.Provider>
        {/* Anterior / siguiente recomendado por su autor (series, el próximo podcast).
            En sus propias publicaciones el autor los elige, cambia o quita aquí mismo. */}
        {/* La serie completa: todas las partes en orden, la actual resaltada. */}
        {task.series?.length > 1 ? (
          <View style={styles.seriesPanel}>
            <Text style={styles.seriesPanelTitle}>
              {`Serie · Parte ${task.series.findIndex((part) => part.current) + 1} de ${task.series.length}`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seriesParts}>
              {task.series.map((part, index) => (
                <TouchableOpacity
                  key={part.id}
                  style={[styles.seriesPart, part.current && styles.seriesPartCurrent]}
                  onPress={() => navigation.push('TaskDetail', { taskId: part.id })}
                  disabled={part.current}
                  accessibilityLabel={`Parte ${index + 1}: ${part.title || 'publicación'}`}
                >
                  <Text style={[styles.seriesPartNumber, part.current && styles.seriesPartTextCurrent]}>{index + 1}</Text>
                  <Text style={[styles.seriesPartTitle, part.current && styles.seriesPartTextCurrent]} numberOfLines={2}>
                    {part.title || 'Publicación'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {(task.previous_task_info || task.next_task_info || isTaskOwner) && !task.testimonial_for_info ? (
          <View style={styles.seriesBox}>
            {task.previous_task_info ? (
              <View style={styles.seriesSide}>
                <TouchableOpacity
                  style={[styles.seriesItem, styles.seriesCard]}
                  onPress={() => navigation.push('TaskDetail', { taskId: task.previous_task_info.id })}
                  accessibilityLabel={`Anterior: ${task.previous_task_info.title}`}
                >
                  <Ionicons name="arrow-back-circle" size={22} color="#4dabf7" />
                  <View style={styles.seriesText}>
                    <Text style={styles.seriesLabel}>Anterior</Text>
                    <Text style={styles.seriesTitle} numberOfLines={2}>{task.previous_task_info.title || 'Publicación'}</Text>
                  </View>
                </TouchableOpacity>
                {isTaskOwner ? (
                  <View style={styles.seriesOwnerActions}>
                    <TouchableOpacity onPress={() => setSeriesPicker('previous')} accessibilityLabel="Cambiar anterior recomendado">
                      <Text style={styles.seriesLink}>Cambiar</Text>
                    </TouchableOpacity>
                    {task.previous_task_info.chosen ? (
                      <TouchableOpacity onPress={() => saveSeriesLink('previous_task', null)} accessibilityLabel="Quitar anterior recomendado">
                        <Text style={[styles.seriesLink, styles.seriesLinkDanger]}>Quitar</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : isTaskOwner ? (
              <TouchableOpacity
                style={[styles.seriesSide, styles.seriesChoose]}
                onPress={() => setSeriesPicker('previous')}
                accessibilityLabel="Elegir anterior recomendado"
              >
                <Ionicons name="add-circle-outline" size={20} color="#4dabf7" />
                <Text style={styles.seriesChooseText}>Elegir anterior recomendado</Text>
              </TouchableOpacity>
            ) : <View style={styles.seriesSide} />}
            {task.next_task_info ? (
              <View style={styles.seriesSide}>
                <TouchableOpacity
                  style={[styles.seriesItem, styles.seriesCard, styles.seriesNext]}
                  onPress={() => navigation.push('TaskDetail', { taskId: task.next_task_info.id })}
                  accessibilityLabel={`Siguiente recomendado: ${task.next_task_info.title}`}
                >
                  <View style={[styles.seriesText, styles.seriesTextNext]}>
                    <Text style={styles.seriesLabel}>Siguiente recomendado</Text>
                    <Text style={styles.seriesTitle} numberOfLines={2}>{task.next_task_info.title || 'Publicación'}</Text>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={22} color="#4dabf7" />
                </TouchableOpacity>
                {isTaskOwner ? (
                  <View style={[styles.seriesOwnerActions, styles.seriesOwnerActionsEnd]}>
                    <TouchableOpacity onPress={() => setSeriesPicker('next')} accessibilityLabel="Cambiar siguiente recomendado">
                      <Text style={styles.seriesLink}>Cambiar</Text>
                    </TouchableOpacity>
                    {task.next_task_info.chosen ? (
                      <TouchableOpacity onPress={() => saveSeriesLink('next_task', null)} accessibilityLabel="Quitar siguiente recomendado">
                        <Text style={[styles.seriesLink, styles.seriesLinkDanger]}>Quitar</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : isTaskOwner ? (
              <TouchableOpacity
                style={[styles.seriesSide, styles.seriesChoose]}
                onPress={() => setSeriesPicker('next')}
                accessibilityLabel="Elegir siguiente recomendado"
              >
                <Ionicons name="add-circle-outline" size={20} color="#4dabf7" />
                <Text style={styles.seriesChooseText}>Elegir siguiente recomendado</Text>
              </TouchableOpacity>
            ) : <View style={styles.seriesSide} />}
          </View>
        ) : null}
        <TaskSearchPicker
          visible={Boolean(seriesPicker)}
          onClose={() => setSeriesPicker(null)}
          onSelect={(picked) => saveSeriesLink(seriesPicker === 'previous' ? 'previous_task' : 'next_task', picked.id)}
          excludeTaskId={task.id}
          title={seriesPicker === 'previous' ? 'Anterior recomendado' : 'Siguiente recomendado'}
        />
        {/* SECCIÓN DE COMENTARIOS */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Comentarios</Text>
          {comments.length === 0 ? (
            <Text style={styles.noComments}>No hay comentarios aún. ¡Sé el primero!</Text>
          ) : (
            comments.map(comment => (
              <CommentItem 
                key={comment.id} 
                comment={comment} 
                onReply={onReplyPress} 
                onLike={handleLikeComment}
                onLikeLongPress={handleShowCommentLikes}
                onDelete={handleDeleteComment} 
                onEdit={handleEditComment}
                onOpenAportacion={openAportacion}
                currentUserId={currentUserId}
                expandedCommentIds={expandedCommentIds}
                toggleExpand={toggleCommentExpansion}
                navigation={navigation}
              />
            ))
          )}
          {hasMoreComments && (
            <TouchableOpacity
              style={styles.loadMoreComments}
              onPress={() => fetchMoreComments()}
              disabled={isFetchingMoreComments}
              activeOpacity={0.7}
            >
              {isFetchingMoreComments ? (
                <ActivityIndicator size="small" color="#4dabf7" />
              ) : (
                <Text style={styles.loadMoreCommentsText}>
                  {remainingComments > 0
                    ? `Ver más comentarios (${remainingComments})`
                    : 'Ver más comentarios'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* BANNER DE RESPUESTA */}
      {replyingTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>
            Respondiendo a: <Text style={{fontWeight: 'bold'}}>{replyingTo.created_by?.username || replyingTo.user?.username || 'Usuario'}</Text>
          </Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}
      {editingCommentId && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>Editando comentario</Text>
          <TouchableOpacity onPress={resetComposer} accessibilityLabel="Cancelar edición">
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* APORTACIÓN FAVORITA QUE SE VA A ADJUNTAR (COMENTARIO O RESPUESTA) */}
      {attachedAportacion && (
        <View style={styles.attachmentBar}>
          <AportacionCard
            info={attachedAportacion}
            label={editingCommentId ? 'Aportación adjunta' : 'Vas a adjuntar'}
            onRemove={() => setAttachedAportacion(null)}
          />
        </View>
      )}

      {/* PERSONAS ETIQUETADAS EN EL COMENTARIO */}
      {commentTags.length > 0 && (
        <View style={styles.tagsBar}>
          <Text style={styles.tagsBarLabel}>Etiquetas:</Text>
          {commentTags.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={styles.tagChip}
              onPress={() => setCommentTags((prev) => prev.filter((item) => String(item.id) !== String(user.id)))}
              accessibilityLabel={`Quitar etiqueta @${user.username}`}
            >
              <Text style={styles.tagChipText}>@{user.username}</Text>
              <Ionicons name="close" size={14} color="#1971c2" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {commentMedia ? (
        <View style={styles.attachmentBar}>
          <CommentMediaChip media={commentMedia} onRemove={() => setCommentMedia(null)} />
        </View>
      ) : null}

      {/* INPUT DE COMENTARIO FIJO ABAJO */}
      <View style={styles.commentInputContainer}>
        {/* Clip: comentar con una publicación guardada, etiquetar o adjuntar una foto o video. */}
        <CommentAttachMenu
          onPickAportacion={() => setAportacionPickerVisible(true)}
          onTag={() => setTagPickerVisible(true)}
          onPickMedia={pickCommentMedia}
          active={Boolean(attachedAportacion || commentTags.length || commentMedia)}
          mediaDisabled={Boolean(editingCommentId)}
        />
        <TextInput
          style={styles.input}
          // En la web un campo de varias líneas arranca con 2 renglones: se deja en uno, como los íconos.
          numberOfLines={Platform.OS === 'web' ? 1 : undefined}
          placeholder={editingCommentId ? "Edita tu comentario..." : replyingTo ? "Escribe tu respuesta..." : "Escribe un comentario..."}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendBtn, isCreatingComment && { opacity: 0.5 }]} 
          onPress={handleAddComment}
          disabled={isCreatingComment}
          accessibilityLabel="Publicar comentario"
        >
          {isCreatingComment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* MODAL DE LIKES */}
      {/* ✅ 2. Usamos el componente unificado TieredLikesModal */}
      <TieredLikesModal 
        visible={likesModalVisible} 
        onClose={() => setLikesModalVisible(false)} 
        apiUrl={likesModalUrl} 
        title={likesModalTitle}
      />

      {/* MODAL DE ACCIONES (3 PUNTOS): mismo menú completo que el feed */}
      <TaskActionsModal
        visible={actionModalVisible}
        onClose={() => setActionModalVisible(false)}
        actionTask={task}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        canEdit={Boolean(isTaskOwner)}
        handlers={taskActions}
        extraOptions={podcastInvitationStatus === 'pending' ? (
          <TouchableOpacity
            style={styles.actionOption}
            onPress={() => {
              setActionModalVisible(false);
              handlePodcastInvitationResponse(false);
            }}
          >
            <Ionicons name="close-circle-outline" size={20} color="#e03131" />
            <Text style={[styles.actionText, { color: '#e03131' }]}>Rechazar invitación</Text>
          </TouchableOpacity>
        ) : null}
      />

      {/* MENÚ DE COMPARTIR (igual que en el feed) */}
      <ShareActionMenu
        isVisible={shareActionMenuVisible}
        onClose={() => setShareActionMenuVisible(false)}
        onShare={() => { setShareActionMenuVisible(false); openShareModal(); }}
        onSendMessage={() => { setShareActionMenuVisible(false); openShareModal(); }}
        onShareToStory={() => { setShareActionMenuVisible(false); handleShareToStory(); }}
      />

      {/* MODAL DE COMPARTIR */}
      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        taskId={taskToShare}
        onShareSuccess={handleShareSuccess}
        navigation={navigation}
        taskTitle={task?.title || 'esta publicación'}
        taskDescription={task?.description || ''}
        messageTaskId={task?.id}
        messageTaskType="task"
      />

      {/* SELECTOR DE PERSONAS PARA ETIQUETAR EN EL COMENTARIO */}
      <UserTagPicker
        visible={tagPickerVisible}
        onClose={() => setTagPickerVisible(false)}
        selected={commentTags}
        onChange={setCommentTags}
        excludeIds={currentUserId ? [currentUserId] : []}
      />

      {/* SELECTOR DE APORTACIÓN FAVORITA PARA EL COMENTARIO */}
      <FavoriteAportacionPicker
        visible={aportacionPickerVisible}
        onClose={() => setAportacionPickerVisible(false)}
        onSelect={handleSelectAportacion}
        selectedId={attachedAportacion?.id}
        excludeTaskId={taskId}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'android' ? 34 : 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  podcastAcceptButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#51cf66', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 'auto', marginRight: 8 },
  podcastAcceptText: { color: '#fff', fontSize: 12, fontWeight: '800', marginLeft: 4 },
  content: { flex: 1 },
  
  taskCard: { backgroundColor: '#fff', margin: 12, borderRadius: 12, overflow: 'hidden' },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  actionModalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 40 : 24, boxShadow: "0px -2px 10px rgba(0, 0, 0, 0.1)", elevation: 10 },
  modalDragHandle: { width: 40, height: 4, backgroundColor: "#e0e0e0", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  actionOption: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: "#f5f5f5" },
  actionOptionDelete: { backgroundColor: "#ffe3e3" },
  actionText: { fontSize: 16, marginLeft: 14, color: "#333", fontWeight: "500" },
  
  // ⚡ ESTILOS NUEVOS PARA EL AUTOR DE LA TAREA
  taskAuthorHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 0, gap: 10 },
  taskAuthorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  taskAuthorNameWrap: { flexShrink: 1 },
  taskAuthorName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  taskDate: { fontSize: 12, color: '#999' },
  dmButton: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#4dabf7', borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 4 },
  dmButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  taskInfo: { padding: 16 },
  taskTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  taskDescription: { fontSize: 15, color: '#555', lineHeight: 22 },
  mediaBlock: { marginTop: 14 },
  detailVideoWrapper: { width: '100%', height: 240, borderRadius: 12, overflow: 'hidden', backgroundColor: '#171717' },
  detailVideoTouchSurface: { ...StyleSheet.absoluteFillObject },
  detailVideoControls: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, backgroundColor: 'rgba(0,0,0,0.62)' },
  detailVideoControlButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  detailVideoProgress: { flex: 1, height: 40, marginHorizontal: 4 },
  detailExpandButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  detailImage: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#eef0f2' },
  detailVideo: { width: '100%', height: '100%', backgroundColor: '#171717' },
  mediaLabel: { fontSize: 10, color: '#8b949e', fontWeight: '700', marginTop: 5, textTransform: 'uppercase' },
  subtaskDetail: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#edf0f2' },
  subtaskDetailSection: { fontSize: 10, color: '#4dabf7', fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  subtaskDetailTitle: { fontSize: 16, color: '#333', fontWeight: '700' },
  subtaskDetailDescription: { fontSize: 14, color: '#666', lineHeight: 20, marginTop: 5 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  categoryBadge: { backgroundColor: '#e3f2fd', color: '#4dabf7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#eee', padding: 12, gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
  actionBtnText: { color: '#666', fontWeight: 'bold' },

  seriesBox: { flexDirection: 'row', gap: 10, marginHorizontal: 12, marginBottom: 12 },
  seriesPanel: { marginHorizontal: 12, marginBottom: 10, padding: 12, borderRadius: 14, backgroundColor: '#fff' },
  seriesPanelTitle: { fontSize: 13, fontWeight: '800', color: '#1864ab', marginBottom: 8 },
  seriesParts: { gap: 8 },
  seriesPart: { width: 140, padding: 10, borderRadius: 12, backgroundColor: '#f1f3f5', gap: 2 },
  seriesPartCurrent: { backgroundColor: '#4dabf7' },
  seriesPartNumber: { fontSize: 18, fontWeight: '900', color: '#868e96' },
  seriesPartTitle: { fontSize: 12, fontWeight: '700', color: '#343a40' },
  seriesPartTextCurrent: { color: '#fff' },
  seriesSide: { flex: 1, gap: 4 },
  seriesItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seriesCard: { padding: 10, borderRadius: 12, backgroundColor: '#e7f5ff' },
  seriesNext: { justifyContent: 'flex-end' },
  seriesOwnerActionsEnd: { justifyContent: 'flex-end' },
  seriesOwnerActions: { flexDirection: 'row', gap: 14 },
  seriesLink: { color: '#1864ab', fontSize: 12, fontWeight: '700' },
  seriesLinkDanger: { color: '#e03131' },
  seriesChoose: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#74c0fc' },
  seriesChooseText: { color: '#1864ab', fontSize: 13, fontWeight: '700' },
  seriesText: { flexShrink: 1 },
  seriesTextNext: { alignItems: 'flex-end' },
  seriesLabel: { fontSize: 11, fontWeight: '800', color: '#1864ab', textTransform: 'uppercase' },
  seriesTitle: { fontSize: 13, fontWeight: '700', color: '#343a40' },
  commentsSection: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  noComments: { textAlign: 'center', color: '#999', marginTop: 20 },
  loadMoreComments: { alignSelf: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#eef6ff', minWidth: 190, alignItems: 'center' },
  loadMoreCommentsText: { color: '#4dabf7', fontWeight: '700', fontSize: 13 },
  
  commentWrapper: { marginBottom: 16, borderColor: '#e0e0e0' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  // flex: 1 para que el corazón de seguir quede al otro extremo, junto al like.
  commentUserInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  commentFollowHeart: { marginHorizontal: 8 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee' },
  commentAuthorWrapper: { flexShrink: 1 },
  commentAuthor: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  commentDate: { fontSize: 11, color: '#999' },
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentLikeCount: { fontSize: 12, color: '#666' },
  
  commentText: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  commentFooter: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  replyActionText: { fontSize: 12, color: '#4dabf7', fontWeight: 'bold' },
  toggleRepliesBtn: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  toggleRepliesText: { fontSize: 11, color: '#666', fontWeight: 'bold' },
  
  repliesContainer: { marginTop: 12 },

  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#e3f2fd', padding: 10, alignItems: 'center', borderTopWidth: 1, borderColor: '#b3e5fc' },
  replyBannerText: { fontSize: 13, color: '#333' },
  commentInputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', alignItems: 'flex-end', gap: 8 },
  // Del alto del clip y del botón de enviar (36); crece si escribes varias líneas.
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, minHeight: 36, maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },

  // Aportación favorita adjunta al comentario
  hiddenBannerWrap: { paddingHorizontal: 12, paddingTop: 12 },
  attachmentBar: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
  commentAportacion: { marginBottom: 10 },
  commentTags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8 },
  commentTagsLabel: { fontSize: 12, color: '#868e96' },
  commentTagName: { fontSize: 12, color: '#1971c2', fontWeight: '700' },
  tagsBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
  tagsBarLabel: { fontSize: 12, fontWeight: '700', color: '#555' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#e7f5ff' },
  tagChipText: { fontSize: 12, fontWeight: '700', color: '#1971c2' },
});

export default TaskDetailScreen;
