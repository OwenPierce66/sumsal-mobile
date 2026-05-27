import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/es';
import api from '../api';
import { Image } from 'expo-image';

moment.locale('es');

const getImageUrl = (path) => {
  if (!path) return null;
  let cleanPath = path.replace('localhost', '192.168.0.115').replace('127.0.0.1', '192.168.0.115');
  if (cleanPath.startsWith('http')) return cleanPath;
  return `http://192.168.0.115:8001${cleanPath}`;
};

// COMPONENTE RECURSIVO PARA RENDERIZAR REPLIES ANIDADAS
const ReplyItem = ({ reply, depth = 0, onLike, onReply, replyingToId, getAuthorName, expandedReplyIds, toggleExpand }) => {
  const hasChildren = reply.replies && reply.replies.length > 0;
  const isExpanded = expandedReplyIds.includes(reply.id);
  const marginLeft = depth > 0 ? 12 : 0;

  return (
    <View style={{ marginLeft, marginBottom: 12 }}>
      <View style={[styles.replyCard, replyingToId === reply.id && styles.replyCardSelected]}>
        <View style={styles.replyHeader}>
          <View style={styles.replyUserInfo}>
            <Image
              source={{ uri: getImageUrl(reply.user?.user_image) || 'https://via.placeholder.com/32' }}
              style={styles.replyAvatar}
            />
            <View>
              <Text style={styles.replyAuthor}>{getAuthorName(reply)}</Text>
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
                replyingToId={replyingToId}
                getAuthorName={getAuthorName}
                expandedReplyIds={expandedReplyIds}
                toggleExpand={toggleExpand}
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
      await api.post('posts/', {
        title: '',
        content: newReply,
        parent: replyingTo ? replyingTo.id : postId });
      setNewReply('');
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
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
                  source={{ uri: getImageUrl(post.user?.user_image) || 'https://via.placeholder.com/40' }}
                  style={styles.postAvatar}
                />
                <View>
                  <Text style={styles.postAuthor}>{getPostAuthorName(post)}</Text>
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
          <Text style={styles.postContent}>{post.content}</Text>
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
                replyingToId={replyingTo?.id}
                getAuthorName={getPostAuthorName}
                expandedReplyIds={expandedReplyIds}
                toggleExpand={toggleReplyExpansion}
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