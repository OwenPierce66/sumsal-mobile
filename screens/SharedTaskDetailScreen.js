import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import moment from 'moment';
import api from '../api';
import { Image } from 'expo-image';
import ShareModal from '../components/ShareModal';
import LikesListModal from '../components/LikesListModal';

moment.locale('es');

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') && !path.includes('localhost') && !path.includes('127.0.0.1') && !path.includes('192.168.')) {
    return path;
  }
  const IP = Platform.OS === 'web' ? '127.0.0.1' : '192.168.0.115';
  let cleanPath = path;
  if (cleanPath.startsWith('http')) {
    cleanPath = cleanPath.replace(/^https?:\/\/[^\/]+/, '');
  }
  return `http://${IP}:8001${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
};

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
  currentUserId,
  expandedCommentIds,
  toggleExpand }) => {
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
          <View>
            <Text style={styles.commentAuthor}>{getCommentAuthorName(comment)}</Text>
            <Text style={styles.commentDate}>{moment(comment.created_at).fromNow()}</Text>
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
          <TouchableOpacity onPress={() => onDelete(comment.id)}>
            <Text style={[styles.replyActionText, { color: '#ff6b6b' }]}>Eliminar</Text>
          </TouchableOpacity>
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
              currentUserId={currentUserId}
              expandedCommentIds={expandedCommentIds}
              toggleExpand={toggleExpand}
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

  const [sharedTask, setSharedTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [expandedCommentIds, setExpandedCommentIds] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [liking, setLiking] = useState(null);

  // Modal de likes
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl, setLikesModalUrl] = useState('');

  // Modal de compartir
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare, setTaskToShare] = useState(null);

  const handleShowSharedTaskLikes = () => {
    setLikesModalUrl(`shared-tasks/${sharedTaskId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  const handleShowCommentLikes = (commentId) => {
    setLikesModalUrl(`shared-tasks/comments/${commentId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  useEffect(() => {
    fetchSharedTask();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    try {
      const response = await api.get('users/me/');
      setCurrentUserId(response.data.id);
    } catch (error) {
      console.error('Error getting current user:', error.response?.data || error.message);
    }
  };

  const fetchSharedTask = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const response = await api.get(`shared-tasks/${sharedTaskId}/`);
      setSharedTask(response.data);
    } catch (error) {
      console.error('Error fetching shared task:', error);
    } finally {
      if (showLoader) setLoading(false);
    }
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

      const response = await api.post(`shared-tasks/${sharedTaskId}/comments/`, payload);

      // Auto-expandir el comentario padre si se está respondiendo
      if (replyingTo) {
        setExpandedCommentIds((prev) => [...new Set([...prev, replyingTo.id])]);
      }

      setNewCommentText('');
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
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeMain')}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tarea Compartida</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* INFORMACIÓN DE COMPARTICIÓN */}
        <View style={styles.sharedByCard}>
          <View style={styles.sharedByInfo}>
            <Image
              source={{ uri: getImageUrl(sharedTask.shared_by?.user_image) }}
              style={styles.sharedByAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.sharedByName}>{getUserName(sharedTask.shared_by)}</Text>
              <Text style={styles.sharedByText}>compartió una tarea</Text>
              <Text style={styles.sharedByDate}>{moment(sharedTask.created_at).fromNow()}</Text>
            </View>
          </View>
          {sharedTask.description && (
            <Text style={styles.sharedByDescription}>{sharedTask.description}</Text>
          )}
        </View>

        {/* TARJETA DE TAREA ORIGINAL */}
        <View style={styles.taskCard}>
          <View style={styles.taskAuthorHeader}>
            <Image
              source={{ uri: getImageUrl(task.user?.user_image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) }}
              style={styles.taskAuthorAvatar}
            />
            <View>
              <Text style={styles.taskAuthorName}>{getUserName(task.user) !== 'Usuario' ? getUserName(task.user) : (task.username || 'Anónimo')}</Text>
              <Text style={styles.taskDate}>{moment(task.created_at).fromNow()}</Text>
            </View>
          </View>

          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.taskDescription}>{task.description}</Text>

            {/* ⚡ EXTRAEMOS LA PRIMERA IMAGEN DISPONIBLE */}
            {(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) && (
              <Image
                source={{ uri: getImageUrl(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) }}
                style={styles.taskImage}
              />
            )}
          </View>

          {/* ACCIONES DE TAREA */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={handleLikeSharedTask}
              onLongPress={handleShowSharedTaskLikes}
            >
              <Ionicons
                name={sharedTask.user_has_liked ? 'heart' : 'heart-outline'}
                size={18}
                color={sharedTask.user_has_liked ? '#ff6b6b' : '#666'}
              />
              <Text style={styles.actionBtnText}>{sharedTask.likes_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={18} color="#4dabf7" />
              <Text style={styles.actionBtnText}>{sharedTask.comments_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={openShareModal}>
              <Ionicons name="share-social-outline" size={18} color="#51cf66" />
              <Text style={styles.actionBtnText}>{task?.share_count || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                currentUserId={currentUserId}
                expandedCommentIds={expandedCommentIds}
                toggleExpand={toggleCommentExpansion}
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

      {/* MODAL DE COMPARTIR */}
      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        taskId={taskToShare}
        onShareSuccess={handleShareSuccess}
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

  taskCard: { backgroundColor: '#fff', margin: 12, borderRadius: 12, overflow: 'hidden' },
  taskAuthorHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 0, gap: 10 },
  taskAuthorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  taskAuthorName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  taskDate: { fontSize: 12, color: '#999' },

  taskInfo: { padding: 16 },
  taskTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  taskDescription: { fontSize: 15, color: '#555', lineHeight: 22 },
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

  errorText: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 50 } });

export default SharedTaskDetailScreen;
