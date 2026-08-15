import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { getImageUrl } from '../api';

const resolveFavoriteUserName = (user) => {
  if (!user) return 'Usuario';
  if (user.username) return user.username;
  if (user.first_name || user.last_name) return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (user.email) return user.email.split('@')[0];
  return 'Usuario';
};

const ShareModal = ({
  visible,
  onClose,
  taskId,
  onShareSuccess,
  navigation,
  taskTitle = 'esta publicación',
  taskDescription = '',
  messageTaskId,
  messageTaskType = 'task',
}) => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [error, setError] = useState('');

  const getFavoriteUser = (favorite) => {
    if (!favorite || typeof favorite !== 'object') return null;
    if (favorite.username || favorite.first_name || favorite.last_name || favorite.email) return favorite;
    if (favorite.user && (favorite.user.username || favorite.user.first_name || favorite.user.last_name || favorite.user.email)) return favorite.user;
    if (favorite.profile && (favorite.profile.username || favorite.profile.first_name || favorite.profile.last_name || favorite.profile.email)) return favorite.profile;
    return favorite;
  };

  useEffect(() => {
    if (!visible) return;

    const fetchFavorites = async () => {
      try {
        setLoadingFavorites(true);
        const response = await api.get('pfavoritos/listar/');
        const list = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.results)
            ? response.data.results
            : Array.isArray(response.data?.favoritos)
              ? response.data.favoritos
              : [];
        setFavorites(list);
      } catch (fetchError) {
        setFavorites([]);
      } finally {
        setLoadingFavorites(false);
      }
    };

    fetchFavorites();
  }, [visible]);

  const resetAndClose = () => {
    setDescription('');
    setError('');
    onClose();
  };

  const handleSharePublication = async () => {
    if (!taskId) return;

    setLoading(true);
    setError('');
    try {
      const response = await api.post('shared-tasks/', {
        task_id: taskId,
        description: description.trim(),
      });
      if (onShareSuccess) onShareSuccess(response.data);

      if (navigation?.navigate) {
        try {
          navigation.navigate('TaskDetail', { taskId });
        } catch (navError) {
          // no-op: some screens don't expose that route in the current stack
        }
      }

      resetAndClose();
    } catch (shareError) {
      const backendError = shareError?.response?.data?.detail || shareError?.response?.data?.error || 'No se pudo compartir la publicación.';
      setError(Array.isArray(backendError) ? backendError.join(', ') : String(backendError));
    } finally {
      setLoading(false);
    }
  };

  const handleShareToStory = async () => {
    if (!taskId) return;

    setLoading(true);
    setError('');
    try {
      await api.post('stories/share-task/', {
        task_id: taskId,
        caption: description.trim(),
      });
      resetAndClose();
      Alert.alert('Listo', 'Se compartió en tu historia.');
      if (navigation?.navigate) {
        try {
          navigation.navigate('Stories24h');
        } catch (navError) {
          // no-op: navigation target may be unavailable in some screens
        }
      }
    } catch (shareError) {
      const backendError = shareError?.response?.data?.detail || shareError?.response?.data?.error || 'No se pudo compartir en tu historia.';
      setError(Array.isArray(backendError) ? backendError.join(', ') : String(backendError));
    } finally {
      setLoading(false);
    }
  };

  const handleSendToFavorite = (favoriteUser) => {
    const user = getFavoriteUser(favoriteUser);
    if (!user?.id || !navigation?.navigate) {
      Alert.alert('Error', 'No se pudo abrir la conversación con este favorito.');
      return;
    }

    const messageText = description.trim();
    const chatParams = {
      chatId: user.id,
      type: 'direct',
      title: resolveFavoriteUserName(user),
      avatar: getImageUrl(user.user_image || user.avatar || user.profile_image),
      initialMessage: messageText,
      storyReplyContext: {
        taskId: messageTaskId || taskId,
        taskType: messageTaskType,
        taskTitle,
        taskDescription,
        sourceType: messageTaskType,
      },
    };

    const availableRoutes = navigation.getState?.()?.routeNames || [];
    if (availableRoutes.includes('ChatDetail')) {
      navigation.navigate('ChatDetail', chatParams);
    } else {
      navigation.navigate('HomeTab', {
        screen: 'ChatDetail',
        params: chatParams,
      });
    }

    resetAndClose();
    Alert.alert('Listo', 'Se abrió la conversación para enviarla al favorito.');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : null}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Compartir publicación</Text>
            <TouchableOpacity onPress={resetAndClose} disabled={loading}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Añade un comentario (opcional):</Text>
            <TextInput
              style={styles.input}
              placeholder="¿Qué opinas sobre esto?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              editable={!loading}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.actionGroup}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.storyButton, loading && styles.buttonDisabled]}
                onPress={handleShareToStory}
                disabled={loading}
              >
                <Ionicons name="image-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Compartir en mi historia</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, styles.publishButton, loading && styles.buttonDisabled]}
                onPress={handleSharePublication}
                disabled={loading}
              >
                <Ionicons name="share-social-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Compartir como publicación</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Enviar por mensaje</Text>
            {loadingFavorites ? (
              <View style={styles.favLoading}><ActivityIndicator size="small" color="#4dabf7" /></View>
            ) : favorites.length === 0 ? (
              <Text style={styles.emptyText}>No tienes favoritos aún.</Text>
            ) : (
              <View>
                {favorites.map((favorite) => {
                const user = getFavoriteUser(favorite);
                const username = resolveFavoriteUserName(user);
                const avatar = getImageUrl(user?.user_image || user?.avatar || user?.profile_image);

                return (
                  <TouchableOpacity key={user?.id || favorite?.id || username} style={styles.favoriteRow} onPress={() => handleSendToFavorite(user)}>
                    <Image source={{ uri: avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username) }} style={styles.favoriteAvatar} />
                    <View style={styles.favoriteInfo}>
                      <Text style={styles.favoriteName} numberOfLines={1}>{username}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                  </TouchableOpacity>
                );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    width: '94%',
    maxWidth: 520,
    maxHeight: '84%',
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalScroll: { flexShrink: 1 },
  modalScrollContent: { paddingBottom: 8 },
  modalHandle: {
    alignSelf: 'center',
    width: 46,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#dfe3e8',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 12,
    color: '#222',
  },
  errorText: {
    color: '#d93025',
    fontSize: 12,
    marginBottom: 12,
  },
  actionGroup: {
    gap: 10,
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  storyButton: {
    backgroundColor: '#6c5ce7',
  },
  publishButton: {
    backgroundColor: '#4dabf7',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#efefef',
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  favLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#777',
    paddingVertical: 8,
  },
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  favoriteAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eaeaea',
  },
  favoriteInfo: {
    flex: 1,
    marginLeft: 10,
  },
  favoriteName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
  },
});

export default ShareModal;