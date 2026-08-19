import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/es';
import api, { getImageUrl } from '../api';
import { Image } from 'expo-image';
import TouchableUsername from '../components/TouchableUsername';

moment.locale('es');

// COMPONENTE RECURSIVO PARA RENDERIZAR REPLIES ANIDADAS
const ReplyItem = ({ reply, depth = 0, onLike, onReply, onEdit, onDelete, currentUserId, replyingToId, getAuthorName, expandedReplyIds, toggleExpand, navigation }) => {
  const hasChildren = reply.replies && reply.replies.length > 0;
  const isExpanded = expandedReplyIds.includes(reply.id);
  const marginLeft = depth > 0 ? 12 : 0;

  return (
    <View style={{ marginLeft, marginBottom: 12 }}>
      <View style={[styles.replyCard, replyingToId === reply.id && styles.replyCardSelected]}>
        <View style={styles.replyHeader}>
          <View style={styles.replyUserInfo}>
            <Image
              source={{ uri: getImageUrl(reply.user?.user_image) || 'https://ui-avatars.com/api/?name=User&background=random' }}
              style={styles.replyAvatar}
            />
            <View style={{ flex: 1 }}>
              <TouchableUsername
                username={getAuthorName(reply)}
                userId={reply.user?.id || null}
                userImage={getImageUrl(reply.user?.user_image) || null}
                navigation={navigation}
                textStyle={styles.replyAuthor}
                numberOfLines={1}
              />
              <Text style={styles.replyDate}>{moment(reply.created_at).fromNow()}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.replyLikeBtn}
            onPress={() => onLike(reply.id)}
          >
            <Ionicons
              name={reply.has_liked ? 'heart' : 'heart-outline'}
              size={16}
              color={reply.has_liked ? '#ff6b6b' : '#999'}
            />
            <Text style={styles.replyLikeCount}>{reply.likes_count || 0}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.replyContent}>{reply.content}</Text>

        {currentUserId === reply.user?.id && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => onEdit(reply)}><Text style={styles.replyActionText}>Editar</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(reply.id)}><Text style={[styles.replyActionText, { color: '#ff6b6b' }]}>Eliminar</Text></TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.replyActionBtn}
          onPress={() => onReply(reply)}
        >
          <Ionicons name="arrow-redo" size={14} color="#4dabf7" />
          <Text style={styles.replyActionText}>Responder</Text>
        </TouchableOpacity>

        {hasChildren && (
          <TouchableOpacity
            onPress={() => toggleExpand(reply.id)}
            style={styles.toggleChildrenBtn}
          >
            <Text style={styles.toggleChildrenText}>
              {isExpanded ? '▼ Ocultar respuestas' : `▶ Ver respuestas (${reply.replies.length})`}
            </Text>
          </TouchableOpacity>
        )}

        {isExpanded && hasChildren && (
          <View style={styles.childrenContainer}>
            {reply.replies.map(child => (
              <ReplyItem
                key={child.id}
                reply={child}
                depth={depth + 1}
                onLike={onLike}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                currentUserId={currentUserId}
                replyingToId={replyingToId}
                getAuthorName={getAuthorName}
                expandedReplyIds={expandedReplyIds}
                toggleExpand={toggleExpand}
                navigation={navigation}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

const PostDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { postId } = route.params;
  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [expandedReplyIds, setExpandedReplyIds] = useState([]);
  const [newReply, setNewReply] = useState('');
  const [liking, setLiking] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [creatingReply, setCreatingReply] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editingPost, setEditingPost] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState(null);

  const countReplies = (items) => {
    return items.reduce((total, item) => total + 1 + countReplies(item.replies || []), 0);
  };

  const toggleReplyExpansion = (replyId) => {
    setExpandedReplyIds((prev) =>
      prev.includes(replyId) ? prev.filter((id) => id !== replyId) : [...prev, replyId]
    );
  };

  // ⚡ HELPER PARA EXTRAER EL NOMBRE DEL AUTOR
  const getPostAuthorName = (postItem) => {
    const userObj = postItem.user;
    
    if (userObj) {
      if (userObj.first_name) {
        return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
      }
      if (userObj.username) {
        return userObj.username;
      }
      if (userObj.email) {
        return userObj.email.split('@')[0];
      }
    }
    return 'Anónimo';
  };

  useEffect(() => {
    fetchPost();
    api.get('users/me/').then(response => setCurrentUserId(response.data.id)).catch(() => {});
  }, [postId]);

  const fetchPost = async () => {
    try {
      const response = await api.get(`posts/${postId}/`);
      setPost(response.data);
      setReplies(response.data.replies || []);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el post');
    }
  };

  const toggleLike = async () => {
    if (!post) return;
    setLiking(true);
    try {
      const response = await api.post(`posts/${postId}/like/`);
      setPost(prev => ({
        ...prev,
        likes_count: response.data.likes_count,
        has_liked: response.data.liked
      }));
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el like');
    } finally {
      setLiking(false);
    }
  };

  const likeReply = async (replyId) => {
    try {
      const response = await api.post(`posts/${replyId}/like/`);
      
      // Función recursiva para actualizar un reply anidado
      const updateReplyLike = (repliesArr, targetId, likesCount, hasLiked) => {
        return repliesArr.map(reply => {
          if (reply.id === targetId) {
            return { ...reply, likes_count: likesCount, has_liked: hasLiked };
          }
          if (reply.replies && reply.replies.length > 0) {
            return { ...reply, replies: updateReplyLike(reply.replies, targetId, likesCount, hasLiked) };
          }
          return reply;
        });
      };

      setReplies(updateReplyLike(replies, replyId, response.data.likes_count, response.data.liked));
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el like');
    }
  };

  const createReply = async () => {
    if (!newReply.trim()) {
      Alert.alert('Error', 'El comentario no puede estar vacío');
      return;
    }

    setCreatingReply(true);
    try {
      if (editingReplyId) {
        await api.patch(`posts/${editingReplyId}/`, { content: newReply });
      } else {
        await api.post('posts/', { title: '', content: newReply, parent: replyingTo ? replyingTo.id : postId });
      }
      setNewReply('');
      setEditingReplyId(null);
      setExpandedReplyIds((prev) =>
        replyingTo ? [...new Set([...prev, replyingTo.id])] : prev
      );
      setReplyingTo(null);
      await fetchPost(); // Recargar para ver la nueva reply
    } catch (error) {
      console.error('Error creating reply:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo crear el comentario');
    } finally {
      setCreatingReply(false);
    }
  };

  const deletePost = async (id) => {
    try {
      await api.delete(`posts/${id}/`);
      navigation.goBack();
    } catch (error) { Alert.alert('Error', 'No se pudo eliminar el contenido'); }
  };

  const editReply = (reply) => {
    setEditingReplyId(reply.id);
    setNewReply(reply.content || '');
    setReplyingTo(null);
  };

  const savePost = async () => {
    try {
      const response = await api.patch(`posts/${postId}/`, { title: post.title, content: post.content });
      setPost(response.data);
      setEditingPost(false);
    } catch (error) { Alert.alert('Error', 'No se pudo editar el post'); }
  };

  if (!post) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4dabf7" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScrollView style={styles.scrollView}>
        {/* POST PRINCIPAL */}
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ForumMain')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.screenHeaderTitle}>Detalle</Text>
        </View>

        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.postTitle}>{post.title || 'Sin título'}</Text>
              <View style={styles.postMeta}>
                <Image
                  source={{ uri: getImageUrl(post.user?.user_image) || 'https://ui-avatars.com/api/?name=User&background=random' }}
                  style={styles.postAvatar}
                />
                <View style={{ flex: 1 }}>
                  <TouchableUsername
                    username={getPostAuthorName(post)}
                    userId={post.user?.id || null}
                    userImage={getImageUrl(post.user?.user_image) || null}
                    navigation={navigation}
                    textStyle={styles.postAuthor}
                    numberOfLines={1}
                  />
                  <Text style={styles.postDate}>{moment(post.created_at).fromNow()}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              onPress={toggleLike}
              disabled={liking}
              style={styles.postLikeBtn}
            >
              <Ionicons
                name={post.has_liked ? 'heart' : 'heart-outline'}
                size={24}
                color={post.has_liked ? '#ff6b6b' : '#ccc'}
              />
              <Text style={styles.postLikeCount}>{post.likes_count || 0}</Text>
            </TouchableOpacity>
          </View>
          {currentUserId === post.user?.id && (
            <View style={{ flexDirection: 'row', gap: 14, marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setEditingPost(true)}><Ionicons name="pencil-outline" size={18} color="#4dabf7" /></TouchableOpacity>
              <TouchableOpacity onPress={() => deletePost(post.id)}><Ionicons name="trash-outline" size={18} color="#ff6b6b" /></TouchableOpacity>
            </View>
          )}
          {editingPost ? (
            <>
              <TextInput style={styles.input} value={post.title} onChangeText={title => setPost(prev => ({ ...prev, title }))} />
              <TextInput style={[styles.input, { minHeight: 90 }]} value={post.content} onChangeText={content => setPost(prev => ({ ...prev, content }))} multiline />
              <TouchableOpacity style={styles.sendBtn} onPress={savePost}><Ionicons name="checkmark" size={18} color="#fff" /></TouchableOpacity>
            </>
          ) : <Text style={styles.postContent}>{post.content}</Text>}
        </View>

        {/* SECCIÓN DE RESPUESTAS */}
        <View style={styles.repliesSection}>
          <Text style={styles.repliesSectionTitle}>Respuestas ({countReplies(replies)})</Text>
          
          {replies.length === 0 ? (
            <Text style={styles.noReplies}>No hay respuestas aún. ¡Sé el primero!</Text>
          ) : (
            replies.map(reply => (
              <ReplyItem
                key={reply.id}
                reply={reply}
                onLike={likeReply}
                onReply={setReplyingTo}
                onEdit={editReply}
                onDelete={deletePost}
                currentUserId={currentUserId}
                replyingToId={replyingTo?.id}
                getAuthorName={getPostAuthorName}
                expandedReplyIds={expandedReplyIds}
                toggleExpand={toggleReplyExpansion}
                navigation={navigation}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* BANNER DE RESPUESTA A COMENTARIO */}
      {replyingTo && (
        <View style={styles.replyingBanner}>
          <View style={styles.replyingBannerContent}>
            <Ionicons name="arrow-redo" size={16} color="#4dabf7" />
            <Text style={styles.replyingBannerText}>
              Respondiendo a <Text style={{ fontWeight: 'bold' }}>{getPostAuthorName(replyingTo)}</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* INPUT DE RESPUESTA */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={replyingTo ? `Respondiendo a ${getPostAuthorName(replyingTo)}...` : 'Escribe una respuesta...'}
          value={newReply}
          onChangeText={setNewReply}
          multiline
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={[styles.sendBtn, creatingReply && { opacity: 0.6 }]}
          onPress={createReply}
          disabled={creatingReply}
        >
          {creatingReply ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1, padding: 12 },

  // POST
  postCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  postTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee' },
  postAuthor: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  postDate: { fontSize: 11, color: '#999', marginTop: 2 },
  postLikeBtn: { alignItems: 'center', justifyContent: 'center' },
  postLikeCount: { fontSize: 12, color: '#666', fontWeight: 'bold', marginTop: 4 },
  postContent: { fontSize: 15, color: '#444', lineHeight: 22 },
  screenHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 0 },
  screenHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },

  // REPLIES
  repliesSection: { marginBottom: 100 },
  repliesSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  noReplies: { color: '#999', textAlign: 'center', paddingVertical: 20 },

  replyCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#4dabf7' },
  replyCardSelected: { backgroundColor: '#e3f2fd', borderLeftColor: '#2196F3' },
  replyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  replyUserInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  replyAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eee' },
  replyAuthor: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  replyDate: { fontSize: 10, color: '#999', marginTop: 2 },
  replyLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyLikeCount: { fontSize: 11, color: '#666', fontWeight: 'bold' },
  replyContent: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  replyActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 6 },
  replyActionText: { fontSize: 12, color: '#4dabf7', fontWeight: 'bold' },
  toggleChildrenBtn: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  toggleChildrenText: { fontSize: 12, color: '#4dabf7', fontWeight: '600' },
  childrenContainer: { marginTop: 12 },

  // INPUT
  replyingBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e3f2fd', padding: 10, borderTopWidth: 1, borderTopColor: '#90caf9' },
  replyingBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyingBannerText: { fontSize: 13, color: '#333' },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', gap: 8, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#333', maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' } });

export default PostDetailScreen;
