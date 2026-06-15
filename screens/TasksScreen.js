import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Platform, ActivityIndicator, Modal, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import api from '../api';
import { Image } from 'expo-image';
import LikesListModal from '../components/LikesListModal';
import ShareModal from '../components/ShareModal';
import FilterModal from '../components/FilterModal';

const TasksScreen = ({ navigation }) => {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    api.get('users/me/').then(res => setCurrentUserId(res.data.id)).catch(() => {});
    api.get('verify-admin/').then(res => setIsAdmin(res.data?.is_admin || res.data?.is_staff)).catch(() => {});
  }, []);
  const [tasks, setTasks] = useState([]);
  const [sharedTasks, setSharedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tema, setTema] = useState('consejos');
  const [visibleSections, setVisibleSections] = useState({});
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedSortBy, setSelectedSortBy] = useState('recent');
  const [selectedFavoritesOnly, setSelectedFavoritesOnly] = useState(false);
  const [selectedFavoriteUsersOnly, setSelectedFavoriteUsersOnly] = useState(false);
  const [selectedVerifiedUsersOnly, setSelectedVerifiedUsersOnly] = useState(false);
  const [selectedRecommendedUsersOnly, setSelectedRecommendedUsersOnly] = useState(false);

  // Modal de likes
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl, setLikesModalUrl] = useState('');

  // Modal de compartir
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare, setTaskToShare] = useState(null);

  // Modal de acciones (3 puntos)
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedActionTask, setSelectedActionTask] = useState(null);
  
  const openActionModal = (task) => {
    setSelectedActionTask(task);
    setActionModalVisible(true);
  };

  const handleDeleteTask = async () => {
    if (!selectedActionTask) return;
    const taskId = selectedActionTask.id;
    
    const executeDelete = async () => {
      try {
        if (selectedActionTask.isSharedTask) {
          await api.delete("shared-tasks/" + taskId + "/");
          setSharedTasks(prev => prev.filter(s => s.id !== taskId));
        } else {
          await api.delete("tasks/" + taskId + "/");
          setTasks(prev => prev.filter(t => t.id !== taskId));
          setSharedTasks(prev => prev.filter(s => s.task?.id !== taskId));
        }
        setActionModalVisible(false);
      } catch (error) {
        console.error('Error deleting task:', error);
        if (Platform.OS !== 'web') Alert.alert('Error', 'No se pudo eliminar la tarea.');
        else window.alert('Error: No se pudo eliminar la tarea.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que deseas eliminar esta tarea permanentemente?')) {
        executeDelete();
      }
    } else {
      Alert.alert(
        'Eliminar Tarea',
        '¿Estás seguro de que deseas eliminar esta tarea permanentemente?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: executeDelete }
        ]
      );
    }
  };

  const handleDirectMessage = () => {
    if (!selectedActionTask) return;
    const userObj = selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user;
    if (!userObj) return;
    setActionModalVisible(false);
    navigation.navigate('ChatDetail', { 
      chatId: userObj.id,
      type: 'direct',
      title: selectedActionTask.isSharedTask ? getSharerName(userObj) : getAuthorName(selectedActionTask),
      avatar: getImageUrl(userObj.user_image)
    });
  };

  const handleGoToForum = () => {
    if (!selectedActionTask) return;
    const userObj = selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user;
    if (!userObj) return;
    setActionModalVisible(false);
    navigation.navigate('UserProfile', { 
      userId: userObj.id, 
      userName: selectedActionTask.isSharedTask ? getSharerName(userObj) : getAuthorName(selectedActionTask), 
      userAvatar: getImageUrl(userObj.user_image) 
    });
  };

  const handleToggleVerified = async () => {
    if (!selectedActionTask) return;
    const userObj = selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user;
    if (!userObj) return;

    try {
      const is_verified = !(userObj.profile?.is_verified);
      await api.post(`admin/users/${userObj.id}/verify/`, { is_verified });
      setActionModalVisible(false);
      
      const updateTasks = (tasksList) =>
        tasksList.map(t => {
          if (t.user?.id === userObj.id) {
            return { ...t, user: { ...t.user, profile: { ...t.user.profile, is_verified } } };
          }
          if (t.shared_by?.id === userObj.id) {
            return { ...t, shared_by: { ...t.shared_by, profile: { ...t.shared_by.profile, is_verified } } };
          }
          return t;
        });

      setTasks(prev => updateTasks(prev));
      setSharedTasks(prev => updateTasks(prev));
    } catch (error) {
      console.error("Error toggling verified:", error);
    }
  };

  const handleToggleRecommended = async () => {
    if (!selectedActionTask) return;
    const userObj = selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user;
    if (!userObj) return;

    try {
      const is_recommended = !(userObj.profile?.is_recommended);
      await api.post(`admin/users/${userObj.id}/recommend/`, { is_recommended });
      setActionModalVisible(false);

      const updateTasks = (tasksList) =>
        tasksList.map(t => {
          if (t.user?.id === userObj.id) {
            return { ...t, user: { ...t.user, profile: { ...t.user.profile, is_recommended } } };
          }
          if (t.shared_by?.id === userObj.id) {
            return { ...t, shared_by: { ...t.shared_by, profile: { ...t.shared_by.profile, is_recommended } } };
          }
          return t;
        });

      setTasks(prev => updateTasks(prev));
      setSharedTasks(prev => updateTasks(prev));
    } catch (error) {
      console.error("Error toggling recommended:", error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!selectedActionTask) return;
    try {
      const taskId = selectedActionTask.isSharedTask ? selectedActionTask.task.id : selectedActionTask.id;
      const isFav = selectedActionTask.isSharedTask ? !selectedActionTask.task.is_favorited : !selectedActionTask.is_favorited;
      
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_favorited: isFav } : t));
      setSharedTasks(prev => prev.map(s => s.task?.id === taskId ? { ...s, task: { ...s.task, is_favorited: isFav } } : s));
      
      await api.post("favoritos/agregar/", { task_id: taskId });
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setActionModalVisible(false);
    }
  };

  const handleToggleProfileFavorite = async () => {
    if (!selectedActionTask || (!selectedActionTask.user && !selectedActionTask.shared_by)) return;
    try {
      const targetUser = selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user;
      const userObj = typeof targetUser === "object" ? targetUser : { id: targetUser };
      const perfilId = userObj.id;
      const isFav = !userObj.is_favorited;

      const updateTasksWithNewUserFav = (tasksList) => 
        tasksList.map(t => {
          if (t.user && (t.user.id === perfilId || t.user === perfilId)) {
             return { ...t, user: typeof t.user === "object" ? { ...t.user, is_favorited: isFav } : t.user };
          }
          if (t.shared_by && (t.shared_by.id === perfilId || t.shared_by === perfilId)) {
             return { ...t, shared_by: typeof t.shared_by === "object" ? { ...t.shared_by, is_favorited: isFav } : t.shared_by };
          }
          return t;
        });

      setTasks(prev => updateTasksWithNewUserFav(prev));
      setSharedTasks(prev => prev.map(s => {
        if (s.task) {
           return { ...s, task: updateTasksWithNewUserFav([s.task])[0] };
        }
        return s;
      }));
      
      await api.post("pfavoritos/agregar/", { perfil_id: perfilId });
    } catch (error) {
      console.error("Error toggling profile favorite:", error);
    } finally {
      setActionModalVisible(false);
    }
  };


  const handleShowTaskLikes = (taskId) => {
    setLikesModalUrl(`tasks/${taskId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  const handleShowTaskShares = (taskId) => {
    setLikesModalUrl('tasks/' + taskId + '/users-who-shared/');
    setLikesModalVisible(true);
  };

  const handleShowSharedTaskLikes = (sharedTaskId) => {
    setLikesModalUrl(`shared-tasks/${sharedTaskId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  // ⚡ NUEVOS ESTADOS PARA EL INFINITE SCROLL
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sharedPage, setSharedPage] = useState(1);
  const [sharedHasMore, setSharedHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modificamos fetchTasks para que acepte el número de página
  const fetchTasks = useCallback(async (pageNumber = 1, overrideFilters = null) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      // ⚡ EXTRAEMOS SOLO LA CATEGORÍA PRINCIPAL PARA EL BACKEND
      const currentCatFilter = overrideFilters ? overrideFilters.category : selectedCategory;
      const primaryCategory = currentCatFilter ? currentCatFilter.split(',')[0].trim() : '';

      const response = await api.get('tasks/', { 
        params: { 
          pch: tema, 
          page: pageNumber,
          category: primaryCategory,
          date_filter: overrideFilters ? overrideFilters.date_filter : selectedDateFilter,
          sort_by: overrideFilters ? overrideFilters.sort_by : selectedSortBy,
          favorites_only: overrideFilters ? overrideFilters.favorites_only : selectedFavoritesOnly,
          favorite_users_only: overrideFilters ? overrideFilters.favorite_users_only : selectedFavoriteUsersOnly,
          verified_users_only: overrideFilters ? overrideFilters.verified_users_only : selectedVerifiedUsersOnly,
          recommended_users_only: overrideFilters ? overrideFilters.recommended_users_only : selectedRecommendedUsersOnly,
        } 
      });
      const data = response.data.results ?? response.data ?? [];

      if (pageNumber === 1) {
        setTasks(data);
      } else {
        setTasks(prev => [...prev, ...data]);
      }

      setPage(pageNumber);
      setHasMore(!!response.data.next);

      const sections = {};
      data.forEach(t => { sections[t.id] = 'subtasks'; });
      setVisibleSections(prev => pageNumber === 1 ? sections : { ...prev, ...sections });

    } catch (error) {
      if (error.response && error.response.status === 404) {
        setHasMore(false);
        return;
      }
      console.error('Error fetching tasks:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [tema, selectedCategory, selectedDateFilter, selectedSortBy, selectedFavoritesOnly, selectedFavoriteUsersOnly]);

  const fetchSharedTasks = useCallback(async (pageNumber = 1, overrideFilters = null) => {
    try {
      // ⚡ EXTRAEMOS SOLO LA CATEGORÍA PRINCIPAL PARA EL BACKEND
      const currentCatFilter = overrideFilters ? overrideFilters.category : selectedCategory;
      const primaryCategory = currentCatFilter ? currentCatFilter.split(',')[0].trim() : '';

      const response = await api.get('shared-tasks/', { 
        params: { 
          page: pageNumber,
          category: primaryCategory,
          date_filter: overrideFilters ? overrideFilters.date_filter : selectedDateFilter,
          sort_by: overrideFilters ? overrideFilters.sort_by : selectedSortBy,
          favorites_only: overrideFilters ? overrideFilters.favorites_only : selectedFavoritesOnly,
          favorite_users_only: overrideFilters ? overrideFilters.favorite_users_only : selectedFavoriteUsersOnly,
          verified_users_only: overrideFilters ? overrideFilters.verified_users_only : selectedVerifiedUsersOnly,
          recommended_users_only: overrideFilters ? overrideFilters.recommended_users_only : selectedRecommendedUsersOnly,
        }
      });
      const data = response.data.results ?? response.data ?? [];

      if (pageNumber === 1) {
        setSharedTasks(data);
      } else {
        setSharedTasks(prev => [...prev, ...data]);
      }

      setSharedHasMore(!!response.data.next);
      setSharedPage(pageNumber);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        setSharedHasMore(false);
        return;
      }
      console.error('Error fetching shared tasks:', error.response?.data || error.message);
    }
  }, [selectedCategory, selectedDateFilter, selectedSortBy, selectedFavoritesOnly, selectedFavoriteUsersOnly]);

  useFocusEffect(useCallback(() => {
    // Only fetch on initial focus, subsequent fetches are handled by useEffect when filters change
    fetchTasks(1);
    fetchSharedTasks(1);
  }, [fetchTasks, fetchSharedTasks]));

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setSharedPage(1);
    setHasMore(true);
    setSharedHasMore(true);
    Promise.all([fetchTasks(1), fetchSharedTasks(1)]).finally(() => setRefreshing(false));
  };

  const openShareModal = (taskId) => {
    if (!taskId) return;
    setTaskToShare(taskId);
    setShareModalVisible(true);
  };

  const handleShareSuccess = () => {
    if (!taskToShare) return;
    const taskId = taskToShare;
    
    // ⚡ ACTUALIZACIÓN OPTIMISTA
    setTasks((prev) => prev.map(t => t.id === taskId ? { ...t, share_count: (t.share_count || 0) + 1 } : t));
    setSharedTasks((prev) => prev.map(s => s.task?.id === taskId ? { ...s, task: { ...s.task, share_count: (s.task.share_count || 0) + 1 } } : s));

    fetchSharedTasks(1);
    setTaskToShare(null);
  };

  const handleLikeSharedTask = async (sharedTaskId) => {
    // ⚡ 1. Buscamos la tarea original asociada a esta publicación compartida
    const sharedItem = sharedTasks.find(s => s.id === sharedTaskId);
    const originalTaskId = sharedItem?.task?.id;
    const isLiked = !sharedItem?.user_has_liked;

    // ⚡ 2. ACTUALIZACIÓN OPTIMISTA - En Compartidas
    setSharedTasks((prev) => prev.map((item) => {
      if (item.id === sharedTaskId) {
        return { ...item, user_has_liked: isLiked, likes_count: (item.likes_count || 0) + (isLiked ? 1 : -1) };
      }
      return item;
    }));

    // ⚡ 3. ACTUALIZACIÓN OPTIMISTA - En Originales (Si la tarea original está visible en el feed al mismo tiempo)
    if (originalTaskId) {
      setTasks((prev) => prev.map((t) => {
        if (t.id === originalTaskId) {
          return { ...t, user_has_liked: isLiked, likes_count: (t.likes_count || 0) + (isLiked ? 1 : -1) };
        }
        return t;
      }));
    }

    try {
      // ⚡ 4. Confirmar con el servidor en segundo plano
      const response = await api.post(`shared-tasks/${sharedTaskId}/like/`);
      const { liked, likes_count_shared, likes_count_original } = response.data;

      setSharedTasks((prev) => prev.map((item) => {
        if (item.id !== sharedTaskId) return item;
        return { ...item, likes_count: likes_count_shared, user_has_liked: liked };
      }));

      if (originalTaskId) {
        setTasks((prev) => prev.map((t) => {
          if (t.id === originalTaskId) {
            return { ...t, user_has_liked: liked, likes_count: likes_count_original };
          }
          return t;
        }));
      }
    } catch (error) {
      console.error('Error liking shared task:', error.response?.data || error.message);
    }
  };

  const handleCommentSharedTask = (sharedTaskId) => {
    navigation.navigate('SharedTaskDetail', { sharedTaskId });
  };

  const handleShareSharedTask = async (taskId) => {
    if (!taskId) return;

    // ⚡ ACTUALIZACIÓN OPTIMISTA
    setTasks((prev) => prev.map(t => t.id === taskId ? { ...t, share_count: (t.share_count || 0) + 1 } : t));
    setSharedTasks((prev) => prev.map(s => s.task?.id === taskId ? { ...s, task: { ...s.task, share_count: (s.task.share_count || 0) + 1 } } : s));

    try {
      await api.post('shared-tasks/', { task_id: taskId, description: '' });
      fetchSharedTasks(1);
    } catch (error) {
      console.error('Error sharing task:', error.response?.data || error.message);
    }
  };

  // ⚡ FUNCIÓN PARA CARGAR MÁS DATOS AL BAJAR
  const loadMoreTasks = () => {
    if (!loadingMore && (hasMore || sharedHasMore)) {
      setLoadingMore(true);
      const promises = [];

      if (hasMore) promises.push(fetchTasks(page + 1));
      if (sharedHasMore) promises.push(fetchSharedTasks(sharedPage + 1));

      Promise.all(promises).finally(() => setLoadingMore(false));
    }
  };

  const changeSection = (taskId, section) => {
    setVisibleSections(prev => ({ ...prev, [taskId]: section }));
  };

  const feedItems = React.useMemo(() => {
    const plainTasks = tasks.map((task) => ({ ...task, feedType: 'task' }));
    const sharedItems = sharedTasks.map((shared) => ({ ...shared, feedType: 'shared' }));
    const combined = [...plainTasks, ...sharedItems];

    if (selectedSortBy === 'likes') {
      return combined.sort((a, b) => {
        const likesA = a.likes_count || 0;
        const likesB = b.likes_count || 0;
        if (likesB !== likesA) return likesB - likesA;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }

    return combined.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }, [tasks, sharedTasks, selectedSortBy]);

  const filteredTasks = feedItems.filter((item) => {
    const title = item.feedType === 'shared' ? item.task?.title : item.title;
    const description = item.feedType === 'shared'
      ? (item.description || item.task?.description)
      : item.description;

    const matchesSearch = (
      title?.toLowerCase().includes(searchText.toLowerCase()) ||
      description?.toLowerCase().includes(searchText.toLowerCase())
    );

    // ⚡ FILTRO INTELIGENTE LOCAL PARA SUBTEMAS
    let matchesCategory = true;
    if (selectedCategory) {
      const requiredTags = selectedCategory.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      const itemCatString = (item.feedType === 'shared' ? item.task?.categories : item.categories) || '';
      const itemTags = itemCatString.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      
      // La tarea debe contener TODOS los tags (categoría principal + subtemas) sin importar el orden
      matchesCategory = requiredTags.every(tag => itemTags.includes(tag));
    }

    return matchesSearch && matchesCategory;
  });

  // HELPER INFALIBLE CON LA IP ACTUAL
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

  // ⚡ HELPER PARA COLORES Y ICONOS DE STATUS
  const getUserStatusColor = (userObj) => {
    if (!userObj) return '#555';
    const profile = userObj.profile || {};
    if (profile.is_verified) return '#4dabf7'; 
    if (profile.subscriptionActive && parseFloat(profile.subscription_amount || 0) >= 8) return '#ff6b6b';
    if (profile.subscriptionActive) return '#51cf66';
    if (profile.is_recommended) return '#000';
    return '#555';
  };

  const getUserStatusIcon = (userObj) => {
    if (!userObj) return null;
    const profile = userObj.profile || {};
    if (profile.is_verified) return 'checkmark-circle';
    if (profile.subscriptionActive && parseFloat(profile.subscription_amount || 0) >= 8) return 'star';
    if (profile.subscriptionActive) return 'star-half';
    if (profile.is_recommended) return 'medal';
    return null;
  };

  // ⚡ HELPER PARA EXTRAER EL NOMBRE DEL AUTOR DE LA TAREA
  const getAuthorName = (item) => {
    const userObj = item.user;
    
    if (userObj) {
      // 1. Intentamos usar el nombre y apellido real
      if (userObj.first_name) {
        return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
      }
      // 2. Usamos username si existe
      if (userObj.username) {
        return userObj.username;
      }
      // 3. Si no ha puesto nombre, usamos la primera parte de su email
      if (userObj.email) {
        return userObj.email.split('@')[0];
      }
    }
    // 4. Fallback final
    return item.username || 'Anónimo';
  };

  // ⚡ HELPER PARA EXTRAER EL NOMBRE DE QUIEN COMPARTE
  const getSharerName = (userObj) => {
    if (!userObj) return 'Usuario';
    if (userObj.first_name) return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
    if (userObj.username) return userObj.username;
    if (userObj.email) return userObj.email.split('@')[0];
    return 'Usuario';
  };

  // ⚡ HELPER PARA CONTAR COMENTARIOS ANIDADOS
  const countNestedComments = (comments = []) => {
    return comments.reduce((total, comment) => total + 1 + countNestedComments(comment.children || []), 0);
  };

  const renderSubContent = (task, section) => {
    const content = task[section] || []; 
    if (content.length === 0) return <Text style={styles.noContent}>Sin datos en esta sección</Text>;

    return content.map((sub, idx) => {
      const finalUri = getImageUrl(sub.image);

      return (
        <View key={idx} style={styles.subItem}>
          <Text style={styles.subItemTitle}>• {sub.title}</Text>
          
          {sub.description ? (
            <Text style={styles.subItemDesc}>{sub.description}</Text>
          ) : null}

          {/* RENDERIZAMOS CON LA URI PROCESADA Y FIX PARA WEB */}
          {finalUri && (
            <Image 
              source={{ uri: finalUri }} 
              style={styles.subImage} 
              contentFit="cover" 
            />
          )}
        </View>
      );
    });
  };

  const renderSharedItemCard = (shared) => {
    const task = shared.task || {};

    return (
      <View style={styles.taskCard}>
        <View style={styles.sharedByHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <Text style={styles.sharedByName}>{getSharerName(shared.shared_by)} compartió</Text>
            <Text style={styles.sharedDate}>{moment(shared.created_at).fromNow()}</Text>
          </View>
          <TouchableOpacity onPress={() => openActionModal({...shared, isSharedTask: true})}>
            <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {shared.description ? (
          <Text style={styles.sharedDescription}>{shared.description}</Text>
        ) : null}

        <View style={styles.originalTaskCard}>
          <View style={styles.taskHeader}>
            <Image 
              source={{ uri: getImageUrl(task.user?.user_image) || 'https://ui-avatars.com/api/?name=User&background=random' }} 
              style={styles.avatar} 
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.taskUser, { color: getUserStatusColor(task.user) }]}>{getAuthorName(task)}</Text>
                  {getUserStatusIcon(task.user) && <Ionicons name={getUserStatusIcon(task.user)} size={14} color={getUserStatusColor(task.user)} />}
                </View>
                <Text style={{ fontSize: 12, color: '#999' }}>• {moment(task.created_at).fromNow()}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => openActionModal({...task, isSharedTask: false})}>
              <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}>
            <Text style={styles.taskDescription}>{task.description}</Text>

            {task.categories ? (
              <View style={styles.categoriesList}>
                {task.categories.split(',').map((cat, idx) => (
                  <Text key={idx} style={styles.categoryBadge}>{cat.trim()}</Text>
                ))}
              </View>
            ) : null}

            {/* ⚡ EXTRAEMOS LA PRIMERA IMAGEN DISPONIBLE (SUBTASKS, SUBFACTORES O SUBFUENTES) */}
            {(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) && (
              <Image
                source={{ uri: getImageUrl(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) }}
                style={styles.taskImage}
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.taskFooter}>
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <TouchableOpacity onPress={() => handleLikeSharedTask(shared.id)}>
                <Ionicons
                  name={shared.user_has_liked ? "heart" : "heart-outline"}
                  size={18}
                  color={shared.user_has_liked ? "#ff6b6b" : "#999"}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleShowSharedTaskLikes(shared.id)} style={{marginLeft: 4, padding: 4}}>
                <Text style={styles.statText}>{shared.likes_count ?? 0}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.stat}
              onPress={() => handleCommentSharedTask(shared.id)}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#4dabf7" />
              <Text style={styles.statText}>{shared.comments_count || 0}</Text>
            </TouchableOpacity>

            <View style={styles.stat}>
              <TouchableOpacity onPress={() => handleShareSharedTask(shared.task?.id)}>
                <Ionicons name="share-social-outline" size={18} color="#51cf66" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleShowTaskShares(shared.task?.id)} style={{marginLeft: 4, padding: 4}}>
                <Text style={styles.statText}>{shared.task?.share_count ?? 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderFeedItem = ({ item }) => {
    if (item.feedType === 'shared') {
      return renderSharedItemCard(item);
    }
    const currentSec = visibleSections[item.id] || 'subtasks';

    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Image 
            source={{ uri: getImageUrl(item.user?.user_image) || 'https://ui-avatars.com/api/?name=User&background=random' }} 
            style={styles.avatar} 
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.taskUser, { color: getUserStatusColor(item.user) }]}>{getAuthorName(item)}</Text>
                {getUserStatusIcon(item.user) && <Ionicons name={getUserStatusIcon(item.user)} size={14} color={getUserStatusColor(item.user)} />}
              </View>
              <Text style={{ fontSize: 12, color: '#999' }}>• {moment(item.created_at).fromNow()}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => openActionModal(item)}>
            <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
          <Text style={styles.taskDescription}>{item.description}</Text>

          {item.categories ? (
            <View style={styles.categoriesList}>
              {item.categories.split(',').map((cat, idx) => (
                <Text key={idx} style={styles.categoryBadge}>{cat.trim()}</Text>
              ))}
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={styles.sectionTabs}>
          {['subtasks', 'subfactores', 'subfuentes'].map((s) => (
            <TouchableOpacity 
              key={s} 
              onPress={() => changeSection(item.id, s)}
              style={[styles.tab, currentSec === s && styles.tabActive]}
            >
              <Text style={[styles.tabText, currentSec === s && styles.tabTextActive]}>
                {s === 'subtasks' ? (tema.charAt(0).toUpperCase() + tema.slice(1)) : s.replace('sub', '')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dynamicContent}>
          {renderSubContent(item, currentSec)}
        </View>

        <View style={styles.taskFooter}>
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <TouchableOpacity onPress={() => navigation.navigate("TaskDetail", { taskId: item.id })}>
                <Ionicons name="heart-outline" size={18} color="#ff6b6b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleShowTaskLikes(item.id)} style={{marginLeft: 4, padding: 4}}>
                <Text style={styles.statText}>{item.likes_count ?? 0}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.stat} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
              <Ionicons name="chatbubble-outline" size={18} color="#4dabf7" />
              <Text style={styles.statText}>{item.comments_count || 0}</Text>
            </TouchableOpacity>
            <View style={styles.stat}>
              <TouchableOpacity onPress={() => openShareModal(item.id)}>
                <Ionicons name="share-social-outline" size={18} color="#51cf66" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleShowTaskShares(item.id)} style={{marginLeft: 4, padding: 4}}>
                <Text style={styles.statText}>{item.share_count ?? 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Éxito</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateTask')}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar objetivos..."
          value={searchText}
          onChangeText={setSearchText}
        />
        <TouchableOpacity onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="options-outline" size={24} color="#4dabf7" />
        </TouchableOpacity>
      </View>

      <View style={styles.temaSelector}>
        {['consejos', 'peticiones', 'historias'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.temaBadge, tema === t && styles.temaBadgeActive]}
            onPress={() => {
              // Si cambian de pestaña, forzamos la página a 1
              setPage(1);
              setHasMore(true);
              setTema(t);
            }}
          >
            <Text style={[styles.temaBadgeText, tema === t && styles.temaBadgeTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => `${item.feedType}-${item.id}`}
        renderItem={renderFeedItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        
        // ⚡ LAS PROPS MÁGICAS DE RENDIMIENTO Y SCROLL INFINITO
        onEndReached={loadMoreTasks}
        onEndReachedThreshold={0.5} // Ejecuta loadMoreTasks cuando falte media pantalla para llegar al final
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 20 }} /> : null
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
      />

      {/* MODAL DE FILTROS */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        currentCategory={selectedCategory}
        currentDateFilter={selectedDateFilter}
        currentSortBy={selectedSortBy}
        currentFavorites={selectedFavoritesOnly}
        currentFavoriteUsers={selectedFavoriteUsersOnly}
        currentVerifiedUsers={selectedVerifiedUsersOnly}
        currentRecommendedUsers={selectedRecommendedUsersOnly}
        onApply={(filters) => {
          setSelectedCategory(filters.category);
          setSelectedDateFilter(filters.date_filter);
          setSelectedSortBy(filters.sort_by);
          setSelectedFavoritesOnly(filters.favorites_only);
          setSelectedFavoriteUsersOnly(filters.favorite_users_only);
          setSelectedVerifiedUsersOnly(filters.verified_users_only);
          setSelectedRecommendedUsersOnly(filters.recommended_users_only);
          setPage(1);
          setSharedPage(1);
          setHasMore(true);
          setSharedHasMore(true);
          fetchTasks(1, filters);
          fetchSharedTasks(1, filters);
        }}
      />

      {/* MODAL DE LIKES */}
      <LikesListModal 
        visible={likesModalVisible} 
        onClose={() => setLikesModalVisible(false)} 
        apiUrl={likesModalUrl} 
      />

      {/* MODAL DE ACCIONES (3 PUNTOS) */}
      <Modal visible={actionModalVisible} transparent animationType='fade' onRequestClose={() => setActionModalVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setActionModalVisible(false)}>
          <View style={styles.actionModalContainer}>
            <View style={styles.modalDragHandle} />
            {selectedActionTask && (
              <>
                <TouchableOpacity style={styles.actionOption} onPress={handleToggleFavorite}>
                  <Ionicons name={selectedActionTask.is_favorited ? 'star' : 'star-outline'} size={20} color={selectedActionTask.is_favorited ? '#f59f00' : '#555'} />
                  <Text style={styles.actionText}>{selectedActionTask.is_favorited ? 'Eliminar de favoritos' : 'Agregar a favoritos'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionOption} onPress={() => { setActionModalVisible(false); openShareModal(selectedActionTask.id); }}>
                  <Ionicons name='share-social-outline' size={20} color='#555' />
                  <Text style={styles.actionText}>Compartir</Text>
                </TouchableOpacity>
                {(selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user) && currentUserId !== ((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.id || (selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)) && (
                  <>
                    <TouchableOpacity style={styles.actionOption} onPress={handleDirectMessage}>
                      <Ionicons name='chatbubbles-outline' size={20} color='#4dabf7' />
                      <Text style={styles.actionText}>Mensaje Directo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionOption} onPress={handleGoToForum}>
                      <Ionicons name='person-outline' size={20} color='#4dabf7' />
                      <Text style={styles.actionText}>Ir a su perfil/foro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionOption} onPress={handleToggleProfileFavorite}>
                      <Ionicons name={((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.is_favorited) ? "heart" : "heart-outline"} size={20} color={((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.is_favorited) ? "#ff0b5a" : "#555"} />
                      <Text style={styles.actionText}>{((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.is_favorited) ? "Eliminar perfil de favoritos" : "Agregar perfil a favoritos"}</Text>
                    </TouchableOpacity>
                  </>
                )}
                {(currentUserId === ((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.id || (selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user))) && (
                  <TouchableOpacity style={[styles.actionOption, styles.actionOptionDelete]} onPress={handleDeleteTask}>
                    <Ionicons name='trash-outline' size={20} color='#ff6b6b' />
                    <Text style={[styles.actionText, { color: '#ff6b6b', fontWeight: 'bold' }]}>Eliminar</Text>
                  </TouchableOpacity>
                )}
                {isAdmin && (
                  <>
                    <TouchableOpacity style={styles.actionOption} onPress={handleToggleVerified}>
                      <Ionicons name={((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.profile?.is_verified) ? "checkmark-circle" : "checkmark-circle-outline"} size={20} color={((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.profile?.is_verified) ? "#4dabf7" : "#555"} />
                      <Text style={styles.actionText}>{((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.profile?.is_verified) ? "Quitar Verificación" : "Verificar Perfil"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionOption} onPress={handleToggleRecommended}>
                      <Ionicons name={((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.profile?.is_recommended) ? "ribbon" : "ribbon-outline"} size={20} color={((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.profile?.is_recommended) ? "#f59f00" : "#555"} />
                      <Text style={styles.actionText}>{((selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)?.profile?.is_recommended) ? "Quitar Recomendación" : "Recomendar Perfil"}</Text>
                    </TouchableOpacity>
                  </>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#333' },
  createBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 12, elevation: 2 },
  searchInput: { flex: 1, height: 45, marginLeft: 8 },
  temaSelector: { flexDirection: 'row', paddingHorizontal: 12, gap: 10, marginBottom: 10 },
  temaBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eee' },
  temaBadgeActive: { backgroundColor: '#333' },
  temaBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  temaBadgeTextActive: { color: '#fff' },
  listContent: { paddingBottom: 100 },
  taskCard: { backgroundColor: 'rgba(0, 0, 0, 0.1)', marginHorizontal: 12, marginBottom: 16, borderRadius: 20, padding: 16, elevation: 4 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 45, height: 45, borderRadius: 22.5, marginRight: 12, backgroundColor: '#eee' },
  taskTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  taskUser: { fontSize: 12, color: '#4dabf7', fontWeight: '600' },
  taskDescription: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15 },
  categoryBadge: { backgroundColor: '#e3f2fd', color: '#4dabf7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 11, fontWeight: '600' },
  sectionTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#4dabf7' },
  tabText: { fontSize: 11, color: '#999', fontWeight: 'bold' },
  tabTextActive: { color: '#4dabf7' },
  dynamicContent: { minHeight: 40 },
  subItem: { marginBottom: 10, paddingLeft: 5 },
  subItemTitle: { fontSize: 14, color: '#333', fontWeight: '500' },
  subItemDesc: { fontSize: 14, color: '#666', marginTop: 4, paddingLeft: 10 },
  subImage: { width: '100%', height: 150, borderRadius: 12, marginTop: 8 },
  noContent: { fontSize: 12, color: '#bbb', fontStyle: 'italic', textAlign: 'center' },
  taskFooter: { marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  statsContainer: { flexDirection: 'row', gap: 20 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 13, color: '#666', fontWeight: '600' },
  sharedByHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sharedByName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  sharedDate: { fontSize: 12, color: '#999' },
  sharedDescription: { fontSize: 13, color: '#555', marginBottom: 10 },
  originalTaskCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#4dabf7', marginBottom: 10 },
  taskImage: { width: '100%', height: 200, borderRadius: 10, marginTop: 12, backgroundColor: '#e0e0e0' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionModalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 40 : 24, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalDragHandle: { width: 40, height: 4, backgroundColor: "#e0e0e0", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  actionOption: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: "#f5f5f5" },
  actionOptionDelete: { backgroundColor: "#ffe3e3" },
  actionText: { fontSize: 16, marginLeft: 14, color: "#333", fontWeight: "500" }
});

export default TasksScreen;
