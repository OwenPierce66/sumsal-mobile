import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Platform, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import 'moment/locale/es';
import { getImageUrl } from '@api';
import { Image } from 'expo-image';
import TouchableUsername from '@components/TouchableUsername';
import FollowHeart from '@components/FollowHeart';
import ContentActionsButton from '@components/ContentActionsMenu';
import { usePostsInfinite, usePostMutations, useMe } from '@hooks/useApi';
import { flattenPosts } from '../utils/postsPages';
import { useIsOnline } from '../hooks/useIsOnline';
import OfflineEmptyState from '../components/OfflineEmptyState';
import { useMessageExtras, MessageExtrasView } from '@components/MessageExtras';
import CategoryFilterBar from '@components/CategoryFilterBar';
import CategoryPicker from '@components/CategoryPicker';
import CategoryChips from '@components/CategoryChips';
import ForumAudiencePicker, { audienceOf } from '@components/ForumAudiencePicker';

moment.locale('es');

const ForumScreen = ({ navigation, route }) => {
  const filterUserId   = route?.params?.userId ?? null;
  const filterUserName = route?.params?.userName ?? null;
  // Foro de un grupo: sus posts y los nuevos se publican ahí.
  const groupId   = route?.params?.groupId ?? null;
  const groupName = route?.params?.groupName ?? null;

  const [modalVisible,   setModalVisible]   = useState(false);
  const [newPostTitle,   setNewPostTitle]   = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [editingPost,    setEditingPost]    = useState(null);
  const [newPostCategories, setNewPostCategories] = useState('');
  // Quién ve el post: todos, seguidores, suscriptores (de paga) o invitados.
  const [newPostVisibility, setNewPostVisibility] = useState('public');
  const [newPostInvited, setNewPostInvited] = useState([]);
  // Filtro por categoría y subcategorías, como el de las tareas ("Tema,Subtema").
  const [category, setCategory] = useState(route?.params?.category || '');
  useEffect(() => {
    if (route?.params?.category !== undefined) setCategory(route.params.category || '');
  }, [route?.params?.category]);

  // ─── React Query ────────────────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePostsInfinite(filterUserId, category, groupId);
  const posts = useMemo(() => flattenPosts(data), [data]);
  const isOnline = useIsOnline();
  const { data: me } = useMe();
  const currentUserId = me?.id ?? null;

  const { createPost, editPost, deletePost, likePost } = usePostMutations();

  // isRefetching también es true mientras se carga la siguiente página;
  // se excluye para que el spinner de pull-to-refresh no aparezca al hacer scroll.
  const refreshing = isRefetching && !isFetchingNextPage;

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getPostAuthorName = (post) => {
    const u = post.user;
    if (!u) return 'Anónimo';
    if (u.first_name) return `${u.first_name} ${u.last_name || ''}`.trim();
    if (u.username)   return u.username;
    if (u.email)      return u.email.split('@')[0];
    return 'Anónimo';
  };

  const countNestedReplies = (replies = []) =>
    replies.reduce((total, reply) => total + 1 + countNestedReplies(reply.replies || []), 0);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || (!newPostContent.trim() && !extras.hasMedia)) {
      Alert.alert('Error', 'Escribe un título y un contenido (o adjunta una foto o video).');
      return;
    }
    if (newPostVisibility === 'invited' && !newPostInvited.length) {
      Alert.alert('Faltan invitados', 'Elige al menos a una persona para invitar.');
      return;
    }
    const audience = {
      visibility: newPostVisibility,
      invited_user_ids: newPostVisibility === 'invited' ? newPostInvited.map((user) => user.id) : undefined,
    };
    try {
      if (editingPost) {
        await editPost.mutateAsync({
          id: editingPost.id, title: newPostTitle, content: newPostContent, categories: newPostCategories, ...audience,
        });
      } else {
        await createPost.mutateAsync(await extras.buildBody({
          title: newPostTitle, content: newPostContent, categories: newPostCategories,
          ...audience,
          group: groupId || undefined,
        }));
      }
      setModalVisible(false);
      setEditingPost(null);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostCategories('');
      setNewPostVisibility('public');
      setNewPostInvited([]);
      extras.reset();
      Alert.alert('Éxito', editingPost ? 'Post actualizado correctamente' : 'Post creado correctamente');
    } catch (error) {
      console.error('Error creating/editing post:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo guardar el post');
    }
  };

  const openEditPost = (post) => {
    setEditingPost(post);
    setNewPostTitle(post.title || '');
    setNewPostContent(post.content || '');
    setNewPostCategories(post.categories || '');
    setNewPostVisibility(post.visibility || 'public');
    setNewPostInvited(post.invited_users || []);
    setModalVisible(true);
  };

  const handleDeletePost = (postId) => {
    const execute = () => deletePost.mutate(postId);
    if (Platform.OS === 'web') {
      if (window.confirm('¿Eliminar este post?')) execute();
    } else {
      Alert.alert('Eliminar post', '¿Deseas eliminarlo?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: execute },
      ]);
    }
  };

  const handleTogglePostLike = (postId) => likePost.mutate(postId);

  // Clip del post nuevo: publicación guardada, etiquetas y foto o video (al editar solo título y texto).
  const extras = useMessageExtras({ currentUserId, allowMedia: !editingPost });

  const isSaving = createPost.isPending || editPost.isPending;

  // ─── Render ──────────────────────────────────────────────────────────────────
  const renderPost = ({ item }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      activeOpacity={0.9}
    >
      <View style={styles.postHeader}>
        <Image
          source={{ uri: getImageUrl(item.user?.user_image) || 'https://ui-avatars.com/api/?name=User&background=random' }}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.postTitle}>{item.title || 'Sin título'}</Text>
          <TouchableUsername
            username={getPostAuthorName(item)}
            userId={item.user?.id || null}
            userImage={getImageUrl(item.user?.user_image) || null}
            navigation={navigation}
            textStyle={styles.postAuthor}
            numberOfLines={1}
          />
          <Text style={styles.postDate}>{moment(item.created_at).fromNow()}</Text>
          {item.visibility && item.visibility !== 'public' ? (
            <View style={styles.audienceBadge}>
              <Ionicons name={audienceOf(item.visibility).icon} size={11} color="#845ef7" />
              <Text style={styles.audienceText}>Solo {audienceOf(item.visibility).label.toLowerCase()}</Text>
            </View>
          ) : null}
        </View>
        <FollowHeart userId={item.user?.id} username={getPostAuthorName(item)} style={styles.followHeart} />
        <ContentActionsButton
          accessibilityLabel="Más opciones del post"
          size={20}
          style={styles.followHeart}
          author={item.user}
          currentUserId={currentUserId}
          navigation={navigation}
          report={{ targetType: 'forum_post', targetId: item.id }}
          editLabel="Editar post"
          deleteLabel="Eliminar post"
          {...(currentUserId === item.user?.id
            ? { onEdit: () => openEditPost(item), onDelete: () => handleDeletePost(item.id) }
            : {})}
        />
      </View>
      {item.content ? <Text style={styles.postContent} numberOfLines={2}>{item.content}</Text> : null}
      <CategoryChips categories={item.categories} onPress={setCategory} />
      <MessageExtrasView item={item} navigation={navigation} compact />
      {currentUserId === item.user?.id && (
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8 }}>
          <TouchableOpacity onPress={() => openEditPost(item)}>
            <Ionicons name="pencil-outline" size={17} color="#4dabf7" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeletePost(item.id)}>
            <Ionicons name="trash-outline" size={17} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.postFooter}>
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => handleTogglePostLike(item.id)}
          disabled={likePost.isPending}
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {groupId
            ? `Foro de ${groupName || 'el grupo'}`
            : filterUserId ? `Foro de ${filterUserName || 'usuario'}` : 'Foro'}
        </Text>
        {filterUserId || groupId ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.setParams({
              userId: undefined, userName: undefined, groupId: undefined, groupName: undefined,
            })}
            accessibilityLabel="Volver al foro general"
          >
            <Ionicons name="close-circle" size={24} color="#999" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)} accessibilityLabel="Crear post">
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <CategoryFilterBar value={category} onChange={setCategory} showStatuses={false} style={styles.filterBar} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 16 }} />
          ) : null
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading && (
            isOnline ? (
              <View style={{ alignItems: 'center', marginTop: 50 }}>
                <Ionicons name="chatbox-outline" size={60} color="#ccc" />
                <Text style={{ marginTop: 16, color: '#999' }}>
                  {category ? 'No hay posts en esta categoría' : 'No hay posts aún'}
                </Text>
              </View>
            ) : (
              <OfflineEmptyState onRetry={refetch} />
            )
          )
        }
      />

      {isLoading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#4dabf7" />
        </View>
      )}

      {modalVisible && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingPost ? 'Editar Post' : 'Crear Nuevo Post'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
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
            {/* Antes de publicar: categorías de la app o las tuyas, con sus subcategorías. */}
            <CategoryPicker value={newPostCategories} onChange={setNewPostCategories} />
            <ForumAudiencePicker
              value={newPostVisibility}
              onChange={setNewPostVisibility}
              invited={newPostInvited}
              onInvitedChange={setNewPostInvited}
              currentUserId={currentUserId}
              inGroup={Boolean(groupId || editingPost?.group)}
            />
            {editingPost ? null : (
              <>
                <View style={styles.extrasRow}>
                  {extras.clip}
                  <Text style={styles.extrasHint}>Publicación guardada, etiquetas o foto/video</Text>
                </View>
                {extras.preview}
              </>
            )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.submitBtn, isSaving && { opacity: 0.6 }]}
              onPress={handleCreatePost}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>{editingPost ? 'Guardar cambios' : 'Crear Post'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
      {extras.pickers}
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FEF6F5' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'android' ? 34 : 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle:  { fontSize: 24, fontWeight: '800', color: '#333' },
  backBtn:      { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  createBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },
  listContent:  { paddingHorizontal: 12, paddingVertical: 10 },
  likeButton:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postCard:     { backgroundColor: '#fff', marginBottom: 12, borderRadius: 12, padding: 12, elevation: 2 },
  postHeader:   { flexDirection: 'row', marginBottom: 12, gap: 10 },
  // Corazón de seguir al otro extremo de la cabecera, separado del nombre.
  followHeart:  { alignSelf: 'flex-start' },
  extrasRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  extrasHint:   { flex: 1, fontSize: 12, color: '#868e96' },
  avatar:       { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#eee' },
  postTitle:    { fontSize: 16, fontWeight: 'bold', color: '#000', flex: 1 },
  postAuthor:   { fontSize: 12, color: '#4dabf7', fontWeight: '600', marginTop: 2 },
  postDate:     { fontSize: 11, color: '#999', marginTop: 2 },
  postContent:  { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 10 },
  postFooter:   { flexDirection: 'row', gap: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  stat:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText:     { fontSize: 12, color: '#666', fontWeight: '600' },
  loader:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)' },
  modal:        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, maxHeight: '90%' },
  modalBody:    { flexGrow: 0, marginBottom: 12 },
  filterBar:    { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  audienceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#f3f0ff' },
  audienceText: { fontSize: 11, fontWeight: '700', color: '#845ef7' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 18, fontWeight: 'bold', color: '#333' },
  input:        { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14, color: '#333' },
  submitBtn:    { backgroundColor: '#4dabf7', borderRadius: 8, padding: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default ForumScreen;