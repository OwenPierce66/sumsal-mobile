import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api, { authHeaders } from '../api';

const TaskDetailScreen = ({ route, navigation }) => {
  const { taskId } = route.params;
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isCreatingComment, setIsCreatingComment] = useState(false);
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const response = await api.get(`tasks/${taskId}/comments/`, { headers });
      setComments(response.data.results ?? response.data ?? []);
    } catch (error) {
      console.error('Error fetching comments:', error.response?.data || error.message);
    }
  }, [taskId]);

  const fetchTaskDetail = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await authHeaders();
      const response = await api.get(`tasks/${taskId}/`, { headers });
      setTask(response.data);
      setUserHasLiked(response.data.user_has_liked ?? false);
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

  const handleLike = async () => {
    try {
      const headers = await authHeaders();
      await api.post(`tasks/${taskId}/like/`, {}, { headers });

      setUserHasLiked((prev) => !prev);
      setTask((prevTask) => ({
        ...prevTask,
        likes_count: userHasLiked
          ? Math.max((prevTask.likes_count || 0) - 1, 0)
          : (prevTask.likes_count || 0) + 1,
      }));
    } catch (error) {
      console.error('Error toggling like:', error.response?.data || error.message);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      Alert.alert('Error', 'El comentario no puede estar vacío');
      return;
    }

    setIsCreatingComment(true);
    try {
      const headers = await authHeaders();
      const formData = new FormData();
      formData.append('text', commentText);

      await api.post(`tasks/${taskId}/comments/`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        },
      });

      setCommentText('');
      await fetchTaskDetail();
    } catch (error) {
      console.error('Error adding comment:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo agregar el comentario');
    } finally {
      setIsCreatingComment(false);
    }
  };

  const handleShare = async () => {
    try {
      const headers = await authHeaders();
      await api.post('shared-tasks/', { task_id: taskId }, { headers });
      Alert.alert('Éxito', 'Tarea compartida correctamente');
      setShowShareModal(false);
      await fetchTaskDetail();
    } catch (error) {
      console.error('Error sharing task:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo compartir la tarea');
    }
  };

  const renderComment = ({ item }) => (
    <View style={styles.comment}>
      <View style={styles.commentHeader}>
        <Text style={styles.commentAuthor}>
          {item.created_by?.first_name || item.created_by?.email || 'Anónimo'}
        </Text>
        <Text style={styles.commentDate}>
          {new Date(item.created_at).toLocaleDateString('es-ES')}
        </Text>
      </View>
      <Text style={styles.commentText}>{item.text}</Text>

      {item.children && item.children.length > 0 && (
        <View style={styles.replies}>
          {item.children.map((reply) => (
            <View key={reply.id} style={styles.reply}>
              <Text style={styles.replyAuthor}>
                {reply.created_by?.first_name || reply.created_by?.email || 'Anónimo'}
              </Text>
              <Text style={styles.replyText}>{reply.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4dabf7" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Tarea no encontrada</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalle</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.taskCard}>
          {task.image && (
            <Image source={{ uri: task.image }} style={styles.taskImage} />
          )}

          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.taskUser}>
              {task.user?.first_name || task.user?.email || 'Anónimo'}
            </Text>
            <View style={styles.temaBadgeContainer}>
              <Text style={styles.temaBadgeSmall}>{task.pch}</Text>
            </View>
          </View>

          <Text style={styles.taskDescription}>{task.description}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, userHasLiked && styles.actionBtnActive]}
              onPress={handleLike}
            >
              <Ionicons
                name={userHasLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={userHasLiked ? '#ff6b6b' : '#999'}
              />
              <Text style={styles.actionBtnText}>{task.likes_count || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color="#999" />
              <Text style={styles.actionBtnText}>{task.comments_count || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setShowShareModal(true)}
            >
              <Ionicons name="share-social-outline" size={20} color="#999" />
              <Text style={styles.actionBtnText}>{task.share_count || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Comentarios ({comments.length})</Text>

          {comments.length === 0 ? (
            <Text style={styles.noComments}>Sin comentarios aún. ¡Sé el primero!</Text>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderComment}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.commentInput}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un comentario..."
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[styles.sendBtn, isCreatingComment && styles.sendBtnDisabled]}
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

      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Compartir tarea</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>
              ¿Deseas compartir esta tarea con otros usuarios?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleShare}
              >
                <Text style={styles.modalBtnText}>Compartir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  taskCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  taskImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#e0e0e0',
  },
  taskInfo: {
    padding: 16,
  },
  taskTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  taskUser: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  temaBadgeContainer: {
    marginBottom: 12,
  },
  temaBadgeSmall: {
    fontSize: 12,
    color: '#4dabf7',
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e3f2fd',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  taskDescription: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    gap: 6,
  },
  actionBtnActive: {
    backgroundColor: '#ffe0e0',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  commentsSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  comment: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4dabf7',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  commentDate: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  replies: {
    marginTop: 12,
    marginLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#e0e0e0',
    paddingLeft: 12,
  },
  reply: {
    marginBottom: 10,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  replyText: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
  },
  noComments: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentInput: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4dabf7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalBtnConfirm: {
    backgroundColor: '#4dabf7',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalBtnCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

export default TaskDetailScreen;