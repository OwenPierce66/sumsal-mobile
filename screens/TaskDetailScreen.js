﻿import React, { useState, useCallback } from 'react';
import { Modal,
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, FlatList, Platform, KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment'; 
import 'moment/locale/es'; 
import api from '../api';
import { Image } from 'expo-image';
import LikesListModal from '../components/LikesListModal';
import ShareModal from '../components/ShareModal';

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
// COMPONENTE RECURSIVO (COMENTARIOS)
// =====================================================================
const CommentItem = ({ comment, depth = 0, onReply, onLike, onLikeLongPress, onDelete, currentUserId, expandedCommentIds, toggleExpand }) => {
  const hasChildren = comment.children && comment.children.length > 0;
  const isExpanded = expandedCommentIds.includes(comment.id);

  const marginLeft = depth > 0 ? 16 : 0;
  const borderLeftWidth = depth > 0 ? 2 : 0;

  // âš¡ HELPER PARA CONTAR TODAS LAS RESPUESTAS ANIDADAS (HIJOS Y NIETOS)
  const countAllReplies = (children = []) => {
    return children.reduce((total, child) => total + 1 + countAllReplies(child.children || []), 0);
  };
  const totalReplies = countAllReplies(comment.children);

  // âš¡ HELPER PARA EXTRAER EL NOMBRE DEL AUTOR DEL COMENTARIO
// âš¡ HELPER PARA EL NOMBRE DEL COMENTARIO (Basado en tu modelo de Django)
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
    return c.username || 'AnÃ³nimo';
  };

  return (
    <View style={[styles.commentWrapper, { marginLeft, borderLeftWidth }]}>
      <View style={styles.commentHeader}>
        <View style={styles.commentUserInfo}>
          <Image
            source={{ uri: getImageUrl(comment.created_by?.user_image || comment.user?.user_image) || 'https://ui-avatars.com/api/?name=Usuario' }}
            style={styles.commentAvatar}
          />
          <View>
            {/* âš¡ APLICAMOS EL HELPER PARA EL NOMBRE DEL COMENTARIO */}
            <Text style={styles.commentAuthor}>
              {getCommentAuthorName(comment)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.commentDate}>
                {moment(comment.created_at).fromNow()}
              </Text>
              
              {/* BOTÃ“N DE ELIMINAR */}
              {(currentUserId === comment.created_by?.id || currentUserId === comment.user?.id) && (
                <TouchableOpacity onPress={() => onDelete(comment.id)} style={{ marginLeft: 10 }}>
                  <Ionicons name="trash-outline" size={14} color="#ff6b6b" />
                </TouchableOpacity>
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
      </View>

      <Text style={styles.commentText}>{comment.text || comment.content}</Text>

      <View style={styles.commentFooter}>
        <TouchableOpacity onPress={() => onReply(comment)}>
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
// PANTALLA PRINCIPAL DE DETALLE
// =====================================================================
const TaskDetailScreen = ({ route, navigation }) => {
  const { taskId } = route.params;
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isCreatingComment, setIsCreatingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState([]);

  // Modal de likes
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl, setLikesModalUrl] = useState('');
  
  // Modal de compartir
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare, setTaskToShare] = useState(null);
  // Modal de acciones
  const [actionModalVisible, setActionModalVisible] = useState(false);

  const handleDeleteTask = async () => {
    const executeDelete = async () => {
      try {
        await api.delete("tasks/" + taskId + "/");
        setActionModalVisible(false);
        if (Platform.OS !== "web") Alert.alert("ï¿½xito", "Tarea eliminada.");
        navigation.goBack();
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("ï¿½Estï¿½s seguro de que deseas eliminar esta tarea permanentemente?")) executeDelete();
    } else {
      Alert.alert("Eliminar Tarea", "ï¿½Estï¿½s seguro de que deseas eliminar esta tarea permanentemente?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: executeDelete }
      ]);
    }
  };

  const handleToggleProfileFavorite = async () => {
    if (!task || !task.user) return;
    try {
      const userObj = typeof task.user === "object" ? task.user : { id: task.user };
      const perfilId = userObj.id;
      const isFav = !userObj.is_favorited;
      
      setTask(prev => ({ ...prev, user: { ...prev.user, is_favorited: isFav } }));
      await api.post("pfavoritos/agregar/", { perfil_id: perfilId });
    } catch (error) {
      console.error("Error toggling profile favorite:", error);
    } finally {
      setActionModalVisible(false);
    }
  };

  const handleGoToForum = () => {
    if (!task || !task.user) return;
    const userObj = task.user;
    setActionModalVisible(false);
    navigation.navigate("UserProfile", { 
      userId: userObj.id, 
      userName: getTaskAuthorName(), 
      userAvatar: getTaskAuthorAvatar() 
    });
  };


  const handleShowTaskLikes = () => {
    setLikesModalUrl(`tasks/${taskId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  const handleShowCommentLikes = (commentId) => {
    setLikesModalUrl(`comments/${commentId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  const toggleCommentExpansion = (commentId) => {
    setExpandedCommentIds((prev) =>
      prev.includes(commentId) ? prev.filter((id) => id !== commentId) : [...prev, commentId]
    );
  };

const fetchComments = useCallback(async () => {
    try {
      const response = await api.get(`tasks/${taskId}/comments/`);
      const allComments = response.data.results ?? response.data ?? [];
      
      // âš¡ LOG DE DEBUGEO: Imprimimos el primer comentario si existe
      if (allComments.length > 0) {
        console.log("ðŸ› DATA DEL PRIMER COMENTARIO:", JSON.stringify(allComments[0], null, 2));
      }

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
      
      // âš¡ LOG DE DEBUGEO: Imprimimos toda la estructura de la tarea
      console.log("ðŸ› DATA DE LA TAREA:", JSON.stringify(response.data, null, 2));

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
      api.get('users/me/')
         .then(res => setCurrentUserId(res.data.id))
         .catch(err => console.error("Error al obtener usuario:", err));

      fetchTaskDetail();
    }, [fetchTaskDetail])
  );

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setIsCreatingComment(true);

    try {
      // âš¡ ENVIAMOS UN JSON EN LUGAR DE FORMDATA
      // Esto evita conflictos con el header 'Content-Type: application/json' predeterminado de Axios
      const payload = {
        text: commentText,
        ...(replyingTo && { parent: replyingTo.id })
      };

      await api.post(`tasks/${taskId}/comments/`, payload);

      setCommentText('');
      if (replyingTo) {
        setExpandedCommentIds((prev) => [...new Set([...prev, replyingTo.id])]);
      }
      setReplyingTo(null);
      
      // âš¡ ACTUALIZACIÃ“N OPTIMISTA: Incrementamos el conteo global al instante
      setTask(prev => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);
      await fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error.response?.data || error.message);
      setTask(prev => prev ? { ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) } : prev); // Revertimos si hay error
      Alert.alert('Error', 'No se pudo publicar el comentario');
    } finally {
      setIsCreatingComment(false);
    }
  };

  const handleLikeTask = async () => {
    // âš¡ ACTUALIZACIÃ“N OPTIMISTA: Cambiamos el corazÃ³n y el conteo al instante
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
      const response = await api.post(`tasks/${taskId}/like/`);
      // Confirmamos con los datos exactos del servidor en segundo plano
      setTask(prev => prev ? { ...prev, user_has_liked: response.data.liked, likes_count: response.data.likes_count } : prev);
    } catch (error) {
      console.error('Error liking task:', error);
      fetchTaskDetail(); // Revertimos descargando de nuevo si fallÃ³
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

    // âš¡ ACTUALIZACIÃ“N OPTIMISTA
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
      // âš¡ ACTUALIZACIÃ“N OPTIMISTA AL BORRAR
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
        await api.delete(`tasks/${taskId}/comments/${commentId}/`);
        if (Platform.OS !== 'web') Alert.alert("Ã‰xito", "Comentario eliminado.");
      } catch (error) {
        console.error("Error eliminando comentario:", error.response?.data || error.message);
        fetchComments(); // Revertir silenciosamente en caso de fallo
        if (Platform.OS !== 'web') Alert.alert("Error", "No se pudo eliminar el comentario.");
        else window.alert("Error: No se pudo eliminar el comentario.");
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Â¿EstÃ¡s seguro de que deseas eliminar este comentario de forma permanente?")) {
        executeDelete();
      }
    } else {
      Alert.alert(
        "Eliminar Comentario",
        "Â¿EstÃ¡s seguro de que deseas eliminar este comentario de forma permanente?",
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

  // âš¡ HELPER PARA EXTRAER EL NOMBRE DEL AUTOR DE LA TAREA PRINCIPAL
// âš¡ HELPER PARA EL NOMBRE DE LA TAREA PRINCIPAL
  const getTaskAuthorName = () => {
    if (!task) return 'AnÃ³nimo';
    
    // 1. Intentamos el nombre real del usuario relacional
    if (task.user?.first_name) {
      return `${task.user.first_name} ${task.user.last_name || ''}`.trim();
    }
    // 2. Intentamos el campo de texto 'username' que tienes en el modelo Task
    if (task.username) {
      return task.username;
    }
    // 3. Fallback al inicio del correo electrÃ³nico
    if (task.user?.email) {
      return task.user.email.split('@')[0];
    }
    
    return 'AnÃ³nimo';
  };

  // âš¡ HELPER PARA EL AVATAR DE LA TAREA PRINCIPAL
  const getTaskAuthorAvatar = () => {
    if (!task) return 'https://ui-avatars.com/api/?name=A';
    
    // SimpleUserSerializer devuelve 'user_image' directamente en el objeto user
    const uri = task.user?.user_image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image;
    return getImageUrl(uri) || 'https://ui-avatars.com/api/?name=' + getTaskAuthorName();
  };

  // âš¡ HELPER PARA EXTRAER EL AVATAR DEL AUTOR DE LA TAREA PRINCIPAL
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
        <TouchableOpacity onPress={() => setActionModalVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* LA TAREA PRINCIPAL */}
        <View style={styles.taskCard}>
          {/* âš¡ AÃ‘ADIMOS EL HEADER CON EL NOMBRE Y AVATAR DEL AUTOR */}
          <View style={styles.taskAuthorHeader}>
            <Image source={{ uri: getTaskAuthorAvatar() }} style={styles.taskAuthorAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.taskAuthorName}>{getTaskAuthorName()}</Text>
              <Text style={styles.taskDate}>{moment(task.created_at).format('LL')}</Text>
            </View>
            
            {/* âš¡ BOTÃ“N PARA ENVIAR MENSAJE DIRECTO AL CREADOR */}
            {task.user?.id && currentUserId !== task.user?.id && (
              <TouchableOpacity 
                style={styles.dmButton}
                onPress={() => navigation.navigate('ChatDetail', { 
                  chatId: task.user.id,
                  type: 'direct',
                  title: getTaskAuthorName(),
                  avatar: getTaskAuthorAvatar()
                })}
              >
                <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
                <Text style={styles.dmButtonText}>Mensaje</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.taskDescription}>{task.description}</Text>

            {task.categories ? (
              <View style={styles.categoriesList}>
                {task.categories.split(',').map((cat, idx) => (
                  <Text key={idx} style={styles.categoryBadge}>{cat.trim()}</Text>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={handleLikeTask}
              onLongPress={handleShowTaskLikes}
            >
              <Ionicons name={task.user_has_liked ? "heart" : "heart-outline"} size={20} color={task.user_has_liked ? "#ff6b6b" : "#999"} />
              <Text style={styles.actionBtnText}>{task.likes_count || 0}</Text>
            </TouchableOpacity>
            <View style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color="#999" />
              {/* âš¡ USAMOS EL CONTEO TOTAL DEL BACKEND QUE INCLUYE HASTA LOS NIETOS */}
              <Text style={styles.actionBtnText}>{task.comments_count || 0}</Text>
            </View>
            <TouchableOpacity style={styles.actionBtn} onPress={openShareModal}>
              <Ionicons name="share-social-outline" size={20} color="#51cf66" />
              <Text style={styles.actionBtnText}>{task.share_count || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECCIÃ“N DE COMENTARIOS */}
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Comentarios</Text>
          {comments.length === 0 ? (
            <Text style={styles.noComments}>No hay comentarios aÃºn. Â¡SÃ© el primero!</Text>
          ) : (
            comments.map(comment => (
              <CommentItem 
                key={comment.id} 
                comment={comment} 
                onReply={onReplyPress} 
                onLike={handleLikeComment}
                onLikeLongPress={handleShowCommentLikes}
                onDelete={handleDeleteComment} 
                currentUserId={currentUserId}
                expandedCommentIds={expandedCommentIds}
                toggleExpand={toggleCommentExpansion}
              />
            ))
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

      {/* MODAL DE LIKES */}
      <LikesListModal 
        visible={likesModalVisible} 
        onClose={() => setLikesModalVisible(false)} 
        apiUrl={likesModalUrl} 
      />

      {/* MODAL DE ACCIONES (3 PUNTOS) */}
      <Modal visible={actionModalVisible} transparent animationType="fade" onRequestClose={() => setActionModalVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setActionModalVisible(false)}>
          <View style={styles.actionModalContainer}>
            <View style={styles.modalDragHandle} />
            {task && (
              <>
                <TouchableOpacity style={styles.actionOption} onPress={() => { setActionModalVisible(false); openShareModal(); }}>
                  <Ionicons name="share-social-outline" size={20} color="#555" />
                  <Text style={styles.actionText}>Compartir</Text>
                </TouchableOpacity>
                {task.user && currentUserId !== (task.user?.id || task.user) && (
                  <>
                    <TouchableOpacity style={styles.actionOption} onPress={() => { setActionModalVisible(false); navigation.navigate("ChatDetail", { chatId: task.user.id, type: "direct", title: getTaskAuthorName(), avatar: getTaskAuthorAvatar() }); }}>
                      <Ionicons name="chatbubbles-outline" size={20} color="#4dabf7" />
                      <Text style={styles.actionText}>Mensaje Directo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionOption} onPress={handleGoToForum}>
                      <Ionicons name="person-outline" size={20} color="#4dabf7" />
                      <Text style={styles.actionText}>Ir a su perfil/foro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionOption} onPress={handleToggleProfileFavorite}>
                      <Ionicons name={(task.user && task.user.is_favorited) ? "heart" : "heart-outline"} size={20} color={(task.user && task.user.is_favorited) ? "#ff0b5a" : "#555"} />
                      <Text style={styles.actionText}>{(task.user && task.user.is_favorited) ? "Eliminar perfil de favoritos" : "Agregar perfil a favoritos"}</Text>
                    </TouchableOpacity>
                  </>
                )}
                {(currentUserId === (task.user?.id || task.user)) && (
                  <TouchableOpacity style={[styles.actionOption, styles.actionOptionDelete]} onPress={handleDeleteTask}>
                    <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                    <Text style={[styles.actionText, { color: "#ff6b6b", fontWeight: "bold" }]}>Eliminar</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE COMPARTIR */}
      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        taskId={taskToShare}
        onShareSuccess={handleShareSuccess}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  content: { flex: 1 },
  
  taskCard: { backgroundColor: '#fff', margin: 12, borderRadius: 12, overflow: 'hidden' },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  actionModalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 40 : 24, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalDragHandle: { width: 40, height: 4, backgroundColor: "#e0e0e0", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  actionOption: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: "#f5f5f5" },
  actionOptionDelete: { backgroundColor: "#ffe3e3" },
  actionText: { fontSize: 16, marginLeft: 14, color: "#333", fontWeight: "500" },
  
  // âš¡ ESTILOS NUEVOS PARA EL AUTOR DE LA TAREA
  taskAuthorHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 0, gap: 10 },
  taskAuthorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee' },
  taskAuthorName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  taskDate: { fontSize: 12, color: '#999' },
  dmButton: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#4dabf7', borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 4 },
  dmButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  
  taskInfo: { padding: 16 },
  taskTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  taskDescription: { fontSize: 15, color: '#555', lineHeight: 22 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  categoryBadge: { backgroundColor: '#e3f2fd', color: '#4dabf7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold' },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#eee', padding: 12, gap: 12 },
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
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' }
});

export default TaskDetailScreen;
