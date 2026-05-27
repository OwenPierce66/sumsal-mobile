import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Platform, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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

const ForumScreen = ({ navigation }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [likingPostId, setLikingPostId] = useState(null);

  const getPostAuthorName = (post) => {
    const userObj = post.user;
    
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

  const countNestedReplies = (replies = []) => {
    return replies.reduce((total, reply) => total + 1 + countNestedReplies(reply.replies || []), 0);
  };

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('posts/');
      const data = response.data.results || response.data || [];
      setPosts(data);
    } catch (error) {
      console.error('Error fetching posts:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudieron cargar los posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchPosts();
  }, [fetchPosts]));

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      Alert.alert('Error', 'Título y contenido son requeridos');
      return;
    }

    setIsCreatingPost(true);
    try {
      await api.post('posts/', {
        title: newPostTitle,
        content: newPostContent });
      setModalVisible(false);
      setNewPostTitle('');
      setNewPostContent('');
      Alert.alert('Éxito', 'Post creado correctamente');
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo crear el post');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handleTogglePostLike = async (postId) => {
    setLikingPostId(postId);
    try {
      const response = await api.post(`posts/${postId}/like/`);
      const updatedPosts = posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              likes_count: response.data.likes_count,
              has_liked: response.data.liked }
          : post
      );
      setPosts(updatedPosts);
    } catch (error) {
      console.error('Error liking post:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo actualizar el like');
    } finally {
      setLikingPostId(null);
    }
  };

  const renderPost = ({ item }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      activeOpacity={0.9}
    >
      <View style={styles.postHeader}>
        <Image
          source={{ uri: getImageUrl(item.user?.user_image) || 'https://via.placeholder.com/40' }}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.postTitle}>{item.title || 'Sin título'}</Text>
          <Text style={styles.postAuthor}>{getPostAuthorName(item)}</Text>
          <Text style={styles.postDate}>{moment(item.created_at).fromNow()}</Text>
        </View>
      </View>
      <Text style={styles.postContent} numberOfLines={2}>{item.content}</Text>
      <View style={styles.postFooter}>
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => handleTogglePostLike(item.id)}
          disabled={likingPostId === item.id}
        >
          <Ionicons
            name={item.has_liked ? 'heart' : 'heart-outline'}
            size={16}
            color={item.has_liked ? '#ff6b6b' : '#999'}
          />
          <Text style={styles.statText}>{item.likes_count || 0}</Text>
        </TouchableOpacity>
        <View style={styles.stat}>
          <Ionicons name="chatbubble-outline" size={16} color="#4dabf7" />
          <Text style={styles.statText}>{countNestedReplies(item.replies) || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Foro</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Ionicons name="chatbox-outline" size={60} color="#ccc" />
              <Text style={{ marginTop: 16, color: '#999' }}>No hay posts aún</Text>
            </View>
          )
        }
      />

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#4dabf7" />
        </View>
      )}

      {modalVisible && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Nuevo Post</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Título del post"
              value={newPostTitle}
              onChangeText={setNewPostTitle}
              placeholderTextColor="#999"
            />

            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder="Contenido del post"
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={[styles.submitBtn, isCreatingPost && { opacity: 0.6 }]}
              onPress={handleCreatePost}
              disabled={isCreatingPost}
            >
              {isCreatingPost ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Crear Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#333' },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  createBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },
  
  listContent: { paddingHorizontal: 12, paddingVertical: 10 },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postCard: { backgroundColor: '#fff', marginBottom: 12, borderRadius: 12, padding: 12, elevation: 2 },
  postHeader: { flexDirection: 'row', marginBottom: 12, gap: 10 },
  avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#eee' },
  postTitle: { fontSize: 16, fontWeight: 'bold', color: '#000', flex: 1 },
  postAuthor: { fontSize: 12, color: '#4dabf7', fontWeight: '600', marginTop: 2 },
  postDate: { fontSize: 11, color: '#999', marginTop: 2 },
  
  postContent: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 10 },
  postFooter: { flexDirection: 'row', gap: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#666', fontWeight: '600' },
  
  loader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)' },
  
  modal: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14, color: '#333' },
  submitBtn: { backgroundColor: '#4dabf7', borderRadius: 8, padding: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 } });

export default ForumScreen;