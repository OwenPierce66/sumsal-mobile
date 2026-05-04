import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, TextInput, FlatList, Modal, Platform, KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment'; // Usamos moment igual que en tu web
import 'moment/locale/es'; // Para que las fechas salgan en español
import api from '../api';

moment.locale('es');

// Helper para URLs (el mismo de TasksScreen)
const getImageUrl = (path) => {
  if (!path) return null;
  let cleanPath = path.replace('localhost', '192.168.100.76').replace('127.0.0.1', '192.168.100.76');
  if (cleanPath.startsWith('http')) return cleanPath;
  return `http://192.168.100.76:8001${cleanPath}`;
};

// =====================================================================
// COMPONENTE RECURSIVO: EL CLON DE TU 'NewPeticionComment' WEB
// =====================================================================
const CommentItem = ({ comment, depth = 0, onReply, onLike }) => {
  const [showReplies, setShowReplies] = useState(false);
  const hasChildren = comment.children && comment.children.length > 0;

  // Calculamos el margen izquierdo basado en la profundidad (recursividad)
  const marginLeft = depth > 0 ? 16 : 0;
  const borderLeftWidth = depth > 0 ? 2 : 0;

  return (
    <View style={[styles.commentWrapper, { marginLeft, borderLeftWidth }]}>
      <View style={styles.commentHeader}>
        <View style={styles.commentUserInfo}>
          <Image
            source={{ uri: getImageUrl(comment.created_by?.user_image) || 'https://via.placeholder.com/40' }}
            style={styles.commentAvatar}
          />
          <View>
            <Text style={styles.commentAuthor}>
              {comment.created_by?.username || 'Anónimo'}
            </Text>
            <Text style={styles.commentDate}>
              {moment(comment.created_at).fromNow()}
            </Text>
          </View>
        </View>

        {/* Botón de Like del comentario */}
        <TouchableOpacity style={styles.commentLikeBtn} onPress={() => onLike(comment.id)}>
          <Text style={styles.commentLikeCount}>{comment.likes_count || 0}</Text>
          <Ionicons 
            name={comment.user_has_liked ? "heart" : "heart-outline"} 
            size={16} 
            color={comment.user_has_liked ? "#ff6b6b" : "#999"} 
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.commentText}>{comment.text}</Text>

      {/* Botones de acción del comentario */}
      <View style={styles.commentFooter}>
        <TouchableOpacity onPress={() => onReply(comment)}>
          <Text style={styles.replyActionText}>Responder</Text>
        </TouchableOpacity>

        {hasChildren && (
          <TouchableOpacity onPress={() => setShowReplies(!showReplies)} style={styles.toggleRepliesBtn}>
            <Text style={styles.toggleRepliesText}>
              {showReplies ? "Ocultar respuestas" : `Ver respuestas (${comment.children.length})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* MAGIA RECURSIVA: Se llama a sí mismo si hay hijos y el usuario quiere verlos */}
      {showReplies && hasChildren && (
        <View style={styles.repliesContainer}>
          {comment.children.map(child => (
            <CommentItem 
              key={child.id} 
              comment={child} 
              depth={depth + 1} 
              onReply={onReply} 
              onLike={onLike}
            />
          ))}
        </View>
      )}
    </View>
  );
};


// =====================================================================
// PANTALLA PRINCIPAL: EL CLON DE TU 'NewPeticionPost' WEB
// =====================================================================
const TaskDetailScreen = ({ route, navigation }) => {
  const { taskId } = route.params;
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Lista de comentarios que vienen del backend
  const [comments, setComments] = useState([]);
  
  // Estado para el Input
  const [commentText, setCommentText] = useState('');
  const [isCreatingComment, setIsCreatingComment] = useState(false);
  
  // A quién estamos respondiendo (null si es comentario principal)
  const [replyingTo, setReplyingTo] = useState(null);

  const fetchComments = useCallback(async () => {
    try {
      const response = await api.get(`tasks/${taskId}/comments/`);
      // Filtramos para asegurar que solo renderizamos los padres en la raíz
      const allComments = response.data.results ?? response.data ?? [];
      const parentComments = allComments.filter(c => c.is_parent || !c.parent);
      setComments(parentComments);
    } catch (error) {
      console.error('Error fetching comments:', error.response?.data || error.message);
    }
  }, [taskId]);

  const fetchTaskDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`tasks/${taskId}/`);
      setTask(response.data);
      await fetchComments();
    } catch (error) {
      console.error('Error fetching task:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo cargar la tarea');
    } finally {
      setLoading(false);
    }
  }, [taskId, fetchComments]);

  useFocusEffect(
    useCallback(() => {
      fetchTaskDetail();
    }, [fetchTaskDetail])
  );

const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setIsCreatingComment(true);

    try {
      const formData = new FormData();
      formData.append('text', commentText);
      
      // ⚡ EL FIX: Le decimos a Django a qué tarea pertenece este comentario
      formData.append('post', taskId); 

      if (replyingTo) {
        formData.append('parent', replyingTo.id); // Lógica de respuesta
      }

      const uploadHeaders = Platform.OS === 'web' ? {} : { 'Content-Type': 'multipart/form-data' };
      await api.post(`tasks/${taskId}/comments/`, formData, { headers: uploadHeaders });

      setCommentText('');
      setReplyingTo(null);
      await fetchComments(); // Refrescamos el árbol de comentarios
    } catch (error) {
      console.error('Error adding comment:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo publicar el comentario');
    } finally {
      setIsCreatingComment(false);
    }
  };

  const handleLikeTask = async () => {
    try {
      await api.post(`tasks/${taskId}/like/`, {});
      fetchTaskDetail(); // Refrescamos para ver los likes actualizados
    } catch (error) {
      console.error('Error liking task:', error);
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      await api.post(`tasks/${taskId}/comments/${commentId}/like/`);
      fetchComments(); // Refrescamos los comentarios
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const onReplyPress = (comment) => {
    setReplyingTo(comment);
  };

  if (loading || !task) return <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 50 }} />;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle de Aportación</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* LA TAREA PRINCIPAL */}
        <View style={styles.taskCard}>
          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.taskDescription}>{task.description}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLikeTask}>
              <Ionicons name={task.user_has_liked ? "heart" : "heart-outline"} size={20} color={task.user_has_liked ? "#ff6b6b" : "#999"} />
              <Text style={styles.actionBtnText}>{task.likes_count || 0}</Text>
            </TouchableOpacity>
            <View style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color="#999" />
              <Text style={styles.actionBtnText}>{task.comments_count || 0}</Text>
            </View>
          </View>
        </View>

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
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* BANNER DE RESPUESTA */}
      {replyingTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>
            Respondiendo a: <Text style={{fontWeight: 'bold'}}>{replyingTo.created_by?.username}</Text>
          </Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* INPUT DE COMENTARIO FIJO ABAJO */}
      <View style={styles.commentInputContainer}>
        <TextInput
          style={styles.input}
          placeholder={replyingTo ? "Escribe tu respuesta..." : "Escribe un comentario..."}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendBtn, isCreatingComment && { opacity: 0.5 }]} 
          onPress={handleAddComment}
          disabled={isCreatingComment}
        >
          {isCreatingComment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { flex: 1 },
  
  // Tarea Base
  taskCard: { backgroundColor: '#fff', margin: 12, borderRadius: 12, overflow: 'hidden' },
  taskInfo: { padding: 16 },
  taskTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  taskDescription: { fontSize: 15, color: '#555', lineHeight: 22 },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#eee', padding: 12, gap: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
  actionBtnText: { color: '#666', fontWeight: 'bold' },

  // Comentarios
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

  // Input
  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#e3f2fd', padding: 10, alignItems: 'center', borderTopWidth: 1, borderColor: '#b3e5fc' },
  replyBannerText: { fontSize: 13, color: '#333' },
  commentInputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, minHeight: 45, maxHeight: 100 },
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' }
});

export default TaskDetailScreen;