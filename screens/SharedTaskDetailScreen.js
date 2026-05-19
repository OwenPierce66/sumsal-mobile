import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import moment from 'moment';
import api from '../api';

moment.locale('es');

const getImageUrl = (path) => {
  if (!path) return 'https://via.placeholder.com/40';
  let cleanPath = path.replace('localhost', '192.168.0.103').replace('127.0.0.1', '192.168.0.103');
  if (cleanPath.startsWith('http')) return cleanPath;
  return `http://192.168.0.103:8001${cleanPath}`;
};

// =====================================================================
// COMPONENTE RECURSIVO PARA COMENTARIOS DE TAREAS COMPARTIDAS
// =====================================================================
const SharedCommentItem = ({
  comment,
  depth = 0,
  onReply,
  onLike,
  onDelete,
  currentUserId,
  expandedCommentIds,
  toggleExpand,
}) => {
  const hasChildren = comment.children && comment.children.length > 0;
  const isExpanded = expandedCommentIds.includes(comment.id);
  const marginLeft = depth > 0 ? 16 : 0;
  const borderLeftWidth = depth > 0 ? 2 : 0;

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
              {isExpanded ? '−' : '+'} {comment.children?.length || 0}
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

  const fetchSharedTask = async () => {
    try {
      setLoading(true);
      const response = await api.get(`shared-tasks/${sharedTaskId}/`);
      setSharedTask(response.data);
    } catch (error) {
      console.error('Error fetching shared task:', error.response?.data || error.message);
    } finally {
      setLoading(false);
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
        parent: replyingTo?.id || null,
      };

      const response = await api.post(`shared-tasks/${sharedTaskId}/comments/`, payload);

      // Auto-expandir el comentario padre si se está respondiendo
      if (replyingTo) {
        setExpandedCommentIds((prev) => [...new Set([...prev, replyingTo.id])]);
      }

      setNewCommentText('');
      setReplyingTo(null);

      // Recargar comentarios
      fetchSharedTask();
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      setLiking(commentId);
      await api.post(`shared-tasks/${sharedTaskId}/comments/${commentId}/like/`);
      fetchSharedTask();
    } catch (error) {
      console.error('Error liking comment:', error);
    } finally {
      setLiking(null);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`shared-tasks/${sharedTaskId}/comments/${commentId}/`);
      fetchSharedTask();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleLikeSharedTask = async () => {
    try {
      await api.post(`shared-tasks/${sharedTaskId}/like/`);
      fetchSharedTask();
    } catch (error) {
      console.error('Error liking shared task:', error.response?.data || error.message);
    }
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

  return (
    <View style={styles.container}>
      {/* ENCABEZADO CON BOTÓN ATRÁS */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
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
              source={{ uri: getImageUrl(sharedTask.shared_by?.profile?.user_image) }}
              style={styles.sharedByAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.sharedByName}>{sharedTask.shared_by?.first_name || 'Usuario'}</Text>
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
              source={{ uri: getImageUrl(task.user?.profile?.user_image) }}
              style={styles.taskAuthorAvatar}
            />
            <View>
              <Text style={styles.taskAuthorName}>{task.user?.first_name || 'Usuario'}</Text>
              <Text style={styles.taskDate}>{moment(task.created_at).fromNow()}</Text>
            </View>
          </View>

          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.taskDescription}>{task.description}</Text>
          </View>

          {/* ACCIONES DE TAREA */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLikeSharedTask}>
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
    borderColor: '#eee',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { flexGrow: 1 },

  sharedByCard: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4dabf7',
  },
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

  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: '#eee',
    padding: 12,
    gap: 12,
  },
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

  errorText: { fontSize: 16, color: '#999', textAlign: 'center', marginTop: 50 },
});

export default SharedTaskDetailScreen;
