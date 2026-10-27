import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import moment from 'moment'; 
import api, { getImageUrl } from '@api';
import { Image } from 'expo-image';
import ShareModal from '@components/ShareModal';
import LikesListModal from '@components/LikesListModal';
import TaskActionsModal from '@components/TaskActionsModal';
import useTaskActions from '@hooks/useTaskActions';
import TouchableUsername from '@components/TouchableUsername';
import TaskPostCard, { FeedVideoVisibilityContext } from '@components/TaskPostCard';
import ShareActionMenu from './ShareActionMenu';
import ReportContentButton from '@components/ReportContentButton';
import { useSharedTaskDetail, useMe, useIsAdmin } from '@hooks/useApi';

moment.locale('es');

// =====================================================================
// COMPONENTE RECURSIVO PARA COMENTARIOS DE TAREAS COMPARTIDAS
// =====================================================================
const SharedCommentItem = ({
  comment,
  depth = 0,
  onReply,
  onLike,
  onLikeLongPress,
  onDelete,
  onEdit,
  currentUserId,
  expandedCommentIds,
  toggleExpand,
  navigation }) => {
  const hasChildren = comment.children && comment.children.length > 0;
  const isExpanded = expandedCommentIds.includes(comment.id);
  const marginLeft = depth > 0 ? 16 : 0;
  const borderLeftWidth = depth > 0 ? 2 : 0;

  // ⚡ HELPER PARA CONTAR TODAS LAS RESPUESTAS ANIDADAS (HIJOS Y NIETOS)
  const countAllReplies = (children = []) => {
    return children.reduce((total, child) => total + 1 + countAllReplies(child.children || []), 0);
  };
  const totalReplies = countAllReplies(comment.children);

  const getCommentAuthorName = (c) => {
    if (c?.created_by?.first_name || c?.created_by?.last_name) {
      return `${c.created_by.first_name || ''} ${c.created_by.last_name || ''}`.trim();
    }
    return c?.created_by?.username || c?.created_by?.email?.split('@')[0] || 'Anónimo';
  };

  return (
    <View
      style={[
        styles.commentWrapper,
        { marginLeft, borderLeftWidth, borderLeftColor: '#4dabf7' },
      ]}
    >
      {/* ENCABEZADO DEL COMENTARIO */}
      <View style={styles.commentHeader}>
        <View style={styles.commentUserInfo}>
          <Image
            source={{ uri: getImageUrl(comment.created_by?.profile?.user_image) }}
            style={styles.commentAvatar}
          />
          <View style={{ flex: 1 }}>
            <TouchableUsername
              username={getCommentAuthorName(comment)}
              userId={comment.created_by?.id || comment.user?.id || null}
              userImage={getImageUrl(comment.created_by?.profile?.user_image || comment.user?.profile?.user_image) || null}
              navigation={navigation}
              style={styles.commentAuthorWrapper}
              textStyle={styles.commentAuthor}
              numberOfLines={1}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.commentDate}>{moment(comment.created_at).fromNow()}</Text>
              <ReportContentButton targetType="shared_comment" targetId={comment.id} size={15} />
            </View>
          </View>
        </View>

        {/* BOTÓN LIKE */}
        {currentUserId && (
          <TouchableOpacity
            style={styles.commentLikeBtn}
            onPress={() => onLike(comment.id)}
            onLongPress={() => onLikeLongPress && onLikeLongPress(comment.id)}
          >
            <Ionicons
              name={comment.user_has_liked ? 'heart' : 'heart-outline'}
              size={14}
              color={comment.user_has_liked ? '#ff6b6b' : '#999'}
            />
            <Text style={styles.commentLikeCount}>{comment.likes_count || 0}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* TEXTO DEL COMENTARIO */}
      <Text style={styles.commentText}>{comment.text}</Text>

      {/* ACCIONES */}
      <View style={styles.commentFooter}>
        <TouchableOpacity onPress={() => onReply(comment)}>
          <Text style={styles.replyActionText}>Responder</Text>
        </TouchableOpacity>

        {currentUserId === comment.created_by?.id && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => onEdit(comment)}>
              <Text style={styles.replyActionText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(comment.id)}>
              <Text style={[styles.replyActionText, { color: '#ff6b6b' }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* BOTÓN PARA EXPANDIR/CONTRAER RESPUESTAS */}
        {hasChildren && (
          <TouchableOpacity
            style={styles.toggleRepliesBtn}
            onPress={() => toggleExpand(comment.id)}
          >
            <Text style={styles.toggleRepliesText}>
              {isExpanded ? '−' : '+'} {totalReplies}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* RESPUESTAS ANIDADAS */}
      {hasChildren && isExpanded && (
        <View style={styles.repliesContainer}>
          {comment.children.map((child) => (
            <SharedCommentItem
              key={child.id}
              comment={child}
              depth={depth + 1}
              onReply={onReply}
              onLike={onLike}
              onLikeLongPress={onLikeLongPress}
              onDelete={onDelete}
              onEdit={onEdit}
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
// PANTALLA PRINCIPAL
// =====================================================================
const SharedTaskDetailScreen = ({ route, navigation }) => {
  const { sharedTaskId } = route.params;

  // ─── React Query ────────────────────────────────────────────────────────────
  const { data: sharedTaskData, isLoading: loading, refetch } = useSharedTaskDetail(sharedTaskId);
  const { data: me } = useMe();

  // Estado local (para edición de comentarios y UI mutable)
  const [sharedTask,         setSharedTask]         = useState(null);
  const [newCommentText,     setNewCommentText]     = useState('');
  const [replyingTo,         setReplyingTo]         = useState(null);
  const [editingCommentId,   setEditingCommentId]   = useState(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionText,    setDescriptionText]    = useState('');
  const [submittingComment,  setSubmittingComment]  = useState(false);
  const [expandedCommentIds, setExpandedCommentIds] = useState([]);
  const [liking,             setLiking]             = useState(null);

  // Modal de likes
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl,     setLikesModalUrl]     = useState('');

  // Modal de compartir
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare,       setTaskToShare]       = useState(null);
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

  // Entrar al detalle de la tarea original que se compartió
  const openOriginalTask = () => {
    const originalId = sharedTask?.task?.id;
    if (originalId) navigation.navigate('TaskDetail', { taskId: originalId });
  };

  const openSubMediaInReels = (originalTask, sub, section) => {
    if (!originalTask?.id || !sub?.video) return;
    navigation.navigate('Reels', {
      openTaskId: originalTask.id,
      openMediaSrc: sub.video,
      openMediaType: 'video',
      openMediaSection: section,
      openMediaRequestId: Date.now(),
    });
  };

  const handleShareSubItemToStory = async (originalTask, section, sub) => {
    if (!originalTask || !sub) return;
    try {
      await api.post('stories/share-task/', {
        task_id: originalTask.id,
        source_item_type: section,
        source_item_id: sub.id,
      });
      Alert.alert('Éxito', 'Se compartió la aportación en tu historia de 24 horas.');
      navigation.navigate('Stories');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo compartir esta aportación en historia.');
    }
  };

  const handleShareToStory = async () => {
    const originalId = sharedTask?.task?.id;
    if (!originalId) return;
    try {
      await api.post('stories/share-task/', { task_id: originalId });
      Alert.alert('Éxito', 'Se compartió en tu historia de 24 horas.');
      navigation.navigate('Stories');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo compartir esta tarea en historia.');
    }
  };

  const handleRepost = async () => {
    const originalId = sharedTask?.task?.id;
    if (!originalId || repostInFlightRef.current) return;
    repostInFlightRef.current = true;
    const task = sharedTask.task;
    const original = {
      user_has_reposted: Boolean(task.user_has_reposted),
      user_has_liked: Boolean(task.user_has_liked),
      likes_count: task.likes_count || 0,
      interaction_score: task.interaction_score || 0,
    };
    const nextReposted = !original.user_has_reposted;
    const updateTask = (userHasReposted, userHasLiked, likesCount, interactionScore) => setSharedTask(prev => prev ? {
      ...prev,
      task: {
        ...prev.task,
        user_has_reposted: userHasReposted,
        user_has_liked: userHasLiked,
        likes_count: likesCount,
        interaction_score: interactionScore,
      },
    } : prev);
    updateTask(
      nextReposted,
      original.user_has_liked || nextReposted,
      original.likes_count + (!original.user_has_liked && nextReposted ? 1 : 0),
      Math.max(0, original.interaction_score + (nextReposted ? 1 : -1)),
    );
    try {
      const response = await api.post(`/tasks/${originalId}/repost/`);
      updateTask(
        response.data.user_has_reposted,
        response.data.user_has_liked,
        response.data.likes_count,
        response.data.interaction_score,
      );
      Alert.alert('Éxito', response.data.reposted ? '¡Publicación impulsada!' : 'Se quitó el impulso; el like se conserva.');
    } catch (error) {
      console.error('Error al repostear:', error.response?.data || error);
      Alert.alert('Error', 'Error al repostear. Inténtalo de nuevo.');
      updateTask(original.user_has_reposted, original.user_has_liked, original.likes_count, original.interaction_score);
    } finally {
      repostInFlightRef.current = false;
    }
  };

  const handleShowProfileLikes = (userId) => {
    if (!userId) return;
    setLikesModalUrl(`profiles/${userId}/likes/`);
    setLikesModalVisible(true);
  };

  const handleShowTaskShares = (originalTaskId) => {
    if (!originalTaskId) return;
    setLikesModalUrl(`tasks/${originalTaskId}/users-who-shared/`);
    setLikesModalVisible(true);
  };

  // Sincronizar el query al estado local mutable
  const currentUserId = me?.id ?? null;

  useEffect(() => {
    if (sharedTaskData) {
      setSharedTask(sharedTaskData);
    }
  }, [sharedTaskData]);

  const fetchSharedTask = async (_showLoader = true) => {
    await refetch();
  };

  // Menu de 3 puntos: 'shared' = la publicacion compartida, 'task' = la tarea original
  const [actionTarget, setActionTarget] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { data: adminData } = useIsAdmin();
  useEffect(() => {
    if (adminData) setIsAdmin(Boolean(adminData.isAdmin || adminData.isStaff));
  }, [adminData]);
  const actionTask = actionTarget === 'shared'
    ? (sharedTask ? { ...sharedTask, isSharedTask: true } : null)
    : actionTarget === 'task' ? (sharedTask?.task || null) : null;
  const taskActions = useTaskActions({
    navigation,
    actionTask,
    currentUserId,
    close: () => setActionTarget(null),
    refresh: fetchSharedTask,
    onShare: () => setShareActionMenuVisible(true),
    onEdit: (a) => {
      if (a?.isSharedTask) {
        setDescriptionText(sharedTask?.description || '');
        setEditingDescription(true);
      } else if (a?.id) {
        navigation.navigate('CreateTask', { task: a });
      }
    },
    onDeleted: () => navigation.goBack(),
  });

  const handleShowSharedTaskLikes = () => {
    setLikesModalUrl(`shared-tasks/${sharedTaskId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  const handleShowCommentLikes = (commentId) => {
    setLikesModalUrl(`shared-tasks/comments/${commentId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  const toggleCommentExpansion = (commentId) => {
    setExpandedCommentIds((prev) =>
      prev.includes(commentId) ? prev.filter((id) => id !== commentId) : [...prev, commentId]
    );
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;

    try {
      setSubmittingComment(true);
      const payload = {
        text: newCommentText,
        parent: replyingTo?.id || null };

      // ⚡ ACTUALIZACIÓN OPTIMISTA: Subimos el contador inmediatamente
      setSharedTask(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);

      if (editingCommentId) {
        await api.patch(`shared-tasks/${sharedTaskId}/comments/${editingCommentId}/`, { text: newCommentText });
      } else {
        await api.post(`shared-tasks/${sharedTaskId}/comments/`, payload);
      }

      // Auto-expandir el comentario padre si se está respondiendo
      if (replyingTo) {
        setExpandedCommentIds((prev) => [...new Set([...prev, replyingTo.id])]);
      }

      setNewCommentText('');
      setEditingCommentId(null);
      setReplyingTo(null);

      // Recargar comentarios (Silencioso)
      fetchSharedTask(false);
    } catch (error) {
      console.error('Error creating comment:', error);
      setSharedTask(prev => prev ? { ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) } : prev);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setNewCommentText(comment.text || '');
    setReplyingTo(null);
  };

  const saveSharedDescription = async () => {
    try {
      const response = await api.patch(`shared-tasks/${sharedTaskId}/`, { description: descriptionText });
      setSharedTask(prev => ({ ...prev, description: response.data.description }));
      setEditingDescription(false);
    } catch (error) {
      console.error('Error updating shared task:', error.response?.data || error.message);
    }
  };

  const handleDeleteSharedTask = async () => {
    try {
      await api.delete(`shared-tasks/${sharedTaskId}/`);
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting shared task:', error.response?.data || error.message);
    }
  };

  const handleLikeComment = async (commentId) => {
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

    // ⚡ ACTUALIZACIÓN OPTIMISTA AL DAR LIKE A COMENTARIO
    setSharedTask(prev => {
      if (!prev) return prev;
      return { ...prev, comments: updateCommentLike(prev.comments, commentId) };
    });

    try {
      setLiking(commentId);
      const response = await api.post(`shared-tasks/${sharedTaskId}/comments/${commentId}/like/`);
      setSharedTask(prev => {
        if (!prev) return prev;
        return { ...prev, comments: updateCommentLike(prev.comments, commentId, response.data.liked, response.data.likes_count) };
      });
    } catch (error) {
      console.error('Error liking comment:', error);
      fetchSharedTask(false); // Revertir si hay error
    } finally {
      setLiking(null);
    }
  };

  const handleDeleteComment = async (commentId) => {
    // ⚡ ACTUALIZACIÓN OPTIMISTA AL BORRAR
    const removeComment = (list) => {
      return list.filter(c => c.id !== commentId).map(c => {
        if (c.children) {
            return { ...c, children: removeComment(c.children) };
        }
        return c;
      });
    };

    setSharedTask(prev => {
      if (!prev) return prev;
      return { 
          ...prev, 
          comments: removeComment(prev.comments),
          comments_count: Math.max(0, (prev.comments_count || 0) - 1)
      };
    });

    try {
      await api.delete(`shared-tasks/${sharedTaskId}/comments/${commentId}/`);
    } catch (error) {
      console.error('Error deleting comment:', error);
      fetchSharedTask(false); // Descargar real si falló el borrado
    }
  };

  const handleLikeSharedTask = async () => {
    // ⚡ ACTUALIZACIÓN OPTIMISTA AL DAR LIKE A LA TAREA COMPARTIDA
    setSharedTask(prev => {
      if (!prev) return prev;
      const isLiked = prev.user_has_liked;
      return {
        ...prev,
        user_has_liked: !isLiked,
        likes_count: prev.likes_count + (isLiked ? -1 : 1)
      };
    });

    try {
      const response = await api.post(`shared-tasks/${sharedTaskId}/like/`);
      setSharedTask(prev => prev ? { 
        ...prev, 
        user_has_liked: response.data.liked, 
        likes_count: response.data.likes_count_shared 
      } : prev);
    } catch (error) {
      console.error('Error liking shared task:', error.response?.data || error.message);
      fetchSharedTask(false);
    }
  };

  const openShareModal = () => {
    if (!sharedTask || !sharedTask.task) return;
    setTaskToShare(sharedTask.task.id);
    setShareModalVisible(true);
  };

  const handleShareSuccess = () => {
    setSharedTask(prev => prev ? { ...prev, task: { ...prev.task, share_count: (prev.task.share_count || 0) + 1 } } : prev);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 50 }} />
      </View>
    );
  }

  if (!sharedTask) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Tarea compartida no encontrada</Text>
      </View>
    );
  }

  const task = sharedTask.task;

  // ⚡ HELPER PARA NOMBRES
  const getUserName = (userObj) => {
    if (!userObj) return 'Usuario';
    if (userObj.first_name) return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
    if (userObj.username) return userObj.username;
    if (userObj.email) return userObj.email.split('@')[0];
    return 'Usuario';
  };

  return (
    <View style={styles.container}>
      {/* ENCABEZADO CON BOTÓN ATRÁS */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('SharedTasksList')}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tarea Compartida</Text>
        {currentUserId === sharedTask?.shared_by?.id ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => { setDescriptionText(sharedTask.description || ''); setEditingDescription(true); }}>
              <Ionicons name="pencil-outline" size={22} color="#4dabf7" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteSharedTask}>
              <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
            </TouchableOpacity>
          </View>
        ) : (
          <ReportContentButton targetType="shared_task" targetId={sharedTask?.id} />
        )}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {/* INFORMACIÓN DE COMPARTICIÓN */}
        <View style={styles.sharedByCard}>
          <View style={styles.sharedByInfo}>
            <Image
              source={{ uri: getImageUrl(sharedTask.shared_by?.user_image) }}
              style={styles.sharedByAvatar}
            />
            <View style={{ flex: 1 }}>
              <TouchableUsername
                username={getUserName(sharedTask.shared_by)}
                userId={sharedTask.shared_by?.id || null}
                userImage={getImageUrl(sharedTask.shared_by?.user_image) || null}
                navigation={navigation}
                style={styles.sharedByNameWrapper}
                textStyle={styles.sharedByName}
                numberOfLines={1}
              />
              <Text style={styles.sharedByText}>compartió una tarea</Text>
              <Text style={styles.sharedByDate}>{moment(sharedTask.created_at).fromNow()}</Text>
            </View>
            <TouchableOpacity onPress={() => setActionTarget('shared')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="ellipsis-vertical" size={20} color="#999" />
            </TouchableOpacity>
          </View>
          {editingDescription ? (
            <View>
              <TextInput style={styles.descriptionInput} value={descriptionText} onChangeText={setDescriptionText} multiline />
              <TouchableOpacity style={styles.saveDescriptionBtn} onPress={saveSharedDescription}>
                <Text style={styles.saveDescriptionText}>Guardar descripción</Text>
              </TouchableOpacity>
            </View>
          ) : sharedTask.description ? (
            <Text style={styles.sharedByDescription}>{sharedTask.description}</Text>
          ) : null}
        </View>

        {/* TAREA ORIGINAL: misma tarjeta que el feed/detalle. Los likes y comentarios son los de la tarea compartida */}
        <FeedVideoVisibilityContext.Provider value={videoVisibility}>
          <TaskPostCard
            task={task}
            navigation={navigation}
            tema={task.pch || ''}
            carouselWidth={carouselWidth}
            stats={{
              user_has_liked: sharedTask.user_has_liked,
              likes_count: sharedTask.likes_count,
              comments_count: sharedTask.comments_count,
            }}
            onAvatarPress={handleShowProfileLikes}
            onOpenDetail={openOriginalTask}
            onOpenActions={() => setActionTarget('task')}
            onRepost={handleRepost}
            onLike={handleLikeSharedTask}
            onShowLikes={handleShowSharedTaskLikes}
            onPressComments={() => scrollRef.current?.scrollToEnd({ animated: true })}
            onShare={() => setShareActionMenuVisible(true)}
            onShowShares={handleShowTaskShares}
            onShareSubItemToStory={handleShareSubItemToStory}
            onOpenSubMediaInReels={openSubMediaInReels}
          />
        </FeedVideoVisibilityContext.Provider>

        {/* ENTRAR AL DETALLE DE LA TAREA ORIGINAL (con sus propios comentarios y likes) */}
        <TouchableOpacity style={styles.openOriginalBtn} onPress={openOriginalTask} activeOpacity={0.8}>
          <Ionicons name="open-outline" size={18} color="#4dabf7" />
          <Text style={styles.openOriginalText}>Ver publicación original</Text>
          <Ionicons name="chevron-forward" size={18} color="#4dabf7" />
        </TouchableOpacity>

        {/* SECCIÓN DE COMENTARIOS */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Comentarios ({sharedTask.comments_count || 0})</Text>

          {sharedTask.comments && sharedTask.comments.length > 0 ? (
            sharedTask.comments.map((comment) => (
              <SharedCommentItem
                key={comment.id}
                comment={comment}
                onReply={setReplyingTo}
                onLike={handleLikeComment}
                onLikeLongPress={handleShowCommentLikes}
                onDelete={handleDeleteComment}
                onEdit={handleEditComment}
                currentUserId={currentUserId}
                expandedCommentIds={expandedCommentIds}
                toggleExpand={toggleCommentExpansion}
                navigation={navigation}
              />
            ))
          ) : (
            <Text style={styles.noComments}>No hay comentarios aún</Text>
          )}
        </View>
      </ScrollView>

      {/* BANNER DE RESPUESTA */}
      {replyingTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>
            Respondiendo a {replyingTo.created_by?.first_name || 'usuario'}
          </Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* INPUT DE COMENTARIO */}
      <View style={styles.commentInputContainer}>
        <TextInput
          style={styles.input}
          placeholder={replyingTo ? 'Escribe tu respuesta...' : 'Escribe un comentario...'}
          value={newCommentText}
          onChangeText={setNewCommentText}
          multiline
          editable={!submittingComment}
        />
        <TouchableOpacity
          style={styles.sendBtn}
          onPress={handleAddComment}
          disabled={submittingComment || !newCommentText.trim()}
        >
          {submittingComment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* MODAL DE LIKES */}
      <LikesListModal 
        visible={likesModalVisible} 
        onClose={() => setLikesModalVisible(false)} 
        apiUrl={likesModalUrl} 
      />

      {/* MODAL DE ACCIONES (3 PUNTOS): mismo menu completo que el feed. Sirve para la compartida y para la tarea original */}
      <TaskActionsModal
        visible={Boolean(actionTarget)}
        onClose={() => setActionTarget(null)}
        actionTask={actionTask}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        handlers={taskActions}
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
        messageTaskId={sharedTask?.id}
        messageTaskType="shared-task"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 34 : 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { flexGrow: 1 },

  sharedByCard: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4dabf7' },
  sharedByInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  sharedByAvatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#eee' },
  sharedByName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  sharedByText: { fontSize: 12, color: '#666' },
  sharedByDate: { fontSize: 11, color: '#999' },
  sharedByDescription: { fontSize: 14, color: '#555', fontStyle: 'italic', marginTop: 8 },
  descriptionInput: { borderWidth: 1, borderColor: '#d9e6f2', borderRadius: 8, padding: 10, minHeight: 70, marginTop: 8, color: '#333' },
  saveDescriptionBtn: { alignSelf: 'flex-end', backgroundColor: '#4dabf7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  saveDescriptionText: { color: '#fff', fontWeight: '700' },

  taskCard: { backgroundColor: '#fff', margin: 12, borderRadius: 12, overflow: 'hidden' },
  taskAuthorHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 0, gap: 10 },
  taskAuthorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  taskAuthorName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  taskDate: { fontSize: 12, color: '#999' },

  taskInfo: { padding: 16 },
  taskTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  taskDescription: { fontSize: 15, color: '#555', lineHeight: 22 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  categoryBadge: { backgroundColor: '#e3f2fd', color: '#4dabf7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  taskImage: { width: '100%', height: 220, borderRadius: 12, marginTop: 12, backgroundColor: '#eee' },

  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#eee',
    padding: 12,
    gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
  actionBtnText: { color: '#666', fontWeight: 'bold' },

  commentsSection: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  noComments: { textAlign: 'center', color: '#999', marginTop: 20 },

  commentWrapper: { marginBottom: 16, borderColor: '#e0e0e0' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  commentUserInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee' },
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
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, minHeight: 45, maxHeight: 100 },
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },

  openOriginalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, paddingVertical: 12, borderRadius: 14, backgroundColor: '#eef6ff', borderWidth: 1, borderColor: '#d0e6fb' },
  openOriginalText: { color: '#4dabf7', fontWeight: '700', fontSize: 14 },

  errorText: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 50 } });

export default SharedTaskDetailScreen;
