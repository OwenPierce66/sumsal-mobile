import React, { useState, useCallback, useEffect, useContext, useRef } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions,
  RefreshControl, TextInput, Platform, ActivityIndicator, Modal, Alert, Button, SafeAreaView, useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment'; 
import api, { getImageUrl } from '../api';
import { Image } from 'expo-image'; 
import TieredLikesModal from './TieredLikesModal';
import FilterModal from '../components/FilterModal';
import SavedFiltersModal from '../components/SavedFiltersModal';
import { Video } from 'expo-av';
import ShareModal from '../components/ShareModal';
import { AuthContext } from '../App';
import ShareActionMenu from './ShareActionMenu'; // Importa el nuevo menú
import TouchableUsername from '../components/TouchableUsername';
import CategoryHierarchy from '../components/CategoryHierarchy';
import Slider from '@react-native-community/slider';

const TASK_VIDEO_AUTOPLAY_DELAY_MS = 500;

const TaskVideoPreview = ({ uri, onOpenReel }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const visibleSinceRef = useRef(null);
  const lastVisibilityLogRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState({});

  useEffect(() => {
    setIsReadyToPlay(false);
    if (isVisible) {
      visibleSinceRef.current = Date.now();
      console.log('[TasksScreen][TaskVideoPreview] Video visible, iniciando contador:', uri);
    } else {
      visibleSinceRef.current = null;
      lastVisibilityLogRef.current = null;
      setIsPausedByUser(false);
      console.log('[TasksScreen][TaskVideoPreview] Video fuera de pantalla, contador reiniciado:', uri);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isReadyToPlay || !isVisible) return undefined;

    console.log('[TasksScreen][TaskVideoPreview] Autoplay despues de', TASK_VIDEO_AUTOPLAY_DELAY_MS, 'ms:', uri);
    playerRef.current?.playAsync().catch((error) => {
      console.warn('[TasksScreen][TaskVideoPreview] No se pudo iniciar autoplay:', error);
    });
    return undefined;
  }, [isReadyToPlay, isVisible, uri]);

  const togglePlayback = () => {
    if (playbackStatus.isPlaying) {
      setIsPausedByUser(true);
      playerRef.current?.pauseAsync();
    } else {
      setIsPausedByUser(false);
      playerRef.current?.playAsync();
    }
    setControlsVisible(true);
  };

  const toggleControls = () => setControlsVisible((visible) => !visible);

  useEffect(() => {
    const checkVisibility = () => {
      videoRef.current?.measureInWindow((x, y, width, height) => {
        const viewport = Dimensions.get('window');
        const visible = x + width > 0 && x < viewport.width && y + height > 0 && y < viewport.height;
        setIsVisible((previous) => {
          if (previous !== visible) {
            console.log('[TasksScreen][TaskVideoPreview] Cambio de visibilidad:', { visible, uri });
          }
          return visible;
        });

        if (visible && visibleSinceRef.current) {
          const elapsed = Date.now() - visibleSinceRef.current;
          if (elapsed - (lastVisibilityLogRef.current || 0) >= 350) {
            lastVisibilityLogRef.current = elapsed;
            console.log('[TasksScreen][TaskVideoPreview] Tiempo visible:', `${elapsed} ms`, uri);
          }
          if (elapsed >= TASK_VIDEO_AUTOPLAY_DELAY_MS) {
            setIsReadyToPlay(true);
          }
        }
      });
    };
    const interval = setInterval(checkVisibility, 350);
    checkVisibility();
    return () => clearInterval(interval);
  }, []);

  return (
    <View ref={videoRef} collapsable={false} style={styles.subMediaWrapper}>
      <Video
        ref={playerRef}
        source={{ uri }}
        style={styles.subMedia}
        resizeMode="contain"
        shouldPlay={isReadyToPlay && isVisible && !isPausedByUser}
        isLooping
        onPlaybackStatusUpdate={setPlaybackStatus}
      />
      <TouchableOpacity style={styles.videoTouchSurface} activeOpacity={1} onPress={toggleControls} />
      {controlsVisible && (
        <View style={styles.videoControls} pointerEvents="box-none">
          <TouchableOpacity accessibilityLabel={playbackStatus.isPlaying ? 'Pausar video' : 'Reproducir video'} style={styles.videoControlButton} onPress={togglePlayback}>
            <Ionicons name={playbackStatus.isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
          </TouchableOpacity>
          <Slider
            style={styles.videoProgress}
            minimumValue={0}
            maximumValue={playbackStatus.durationMillis || 1}
            value={playbackStatus.positionMillis || 0}
            onSlidingStart={() => setIsPausedByUser(true)}
            onSlidingComplete={(value) => {
              playerRef.current?.setPositionAsync(value);
              setIsPausedByUser(false);
            }}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="rgba(255,255,255,0.45)"
            thumbTintColor="#fff"
          />
          <TouchableOpacity accessibilityLabel="Abrir video en reels" style={styles.expandVideoButton} onPress={onOpenReel}>
            <Ionicons name="expand-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const TasksScreen = ({ navigation }) => {
  const { width: screenWidth } = useWindowDimensions();
  const carouselWidth = Math.max(280, screenWidth - 56);

  // ✅ OBTENEMOS EL USUARIO Y ADMIN STATUS DEL CONTEXTO GLOBAL
  const { user, isAdmin: isAdminFromContext } = useContext(AuthContext);
  const currentUserId = user?.id;
  // ✅ DEBUG: Muestra en la consola el estado de admin que viene del contexto global
  console.log(`[TasksScreen] isAdmin del Contexto: ${isAdminFromContext}`);

  const [isAdmin, setIsAdmin] = useState(isAdminFromContext);

  const [tasks, setTasks] = useState([]);
  const [sharedTasks, setSharedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [tema, setTema] = useState('consejos');
  const [visibleSections, setVisibleSections] = useState({});
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [savedFiltersModalVisible, setSavedFiltersModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedSortBy, setSelectedSortBy] = useState('all');
  const [selectedFavoritesOnly, setSelectedFavoritesOnly] = useState(false);
  const [selectedFavoriteUsersOnly, setSelectedFavoriteUsersOnly] = useState(false);
  const [selectedVerifiedUsersOnly, setSelectedVerifiedUsersOnly] = useState(false);
  const [selectedRecommendedUsersOnly, setSelectedRecommendedUsersOnly] = useState(false);

  const [availableCategories, setAvailableCategories] = useState([]);
  // Modal de likes
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalTitle, setLikesModalTitle] = useState('Likes');
  const [likesModalUrl, setLikesModalUrl] = useState('');
  
  // Modal de acciones (3 puntos)
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedActionTask, setSelectedActionTask] = useState(null);

  // Estados para el flujo de compartir
  const [isActionMenuVisible, setActionMenuVisible] = useState(false);
  const [isShareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare, setTaskToShare] = useState(null);
  const [taskShareDetails, setTaskShareDetails] = useState(null);

  
  // ✅ SOLUCIÓN: Cargamos las categorías del PCH activo (más las globales).
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('new-categories/', {
          params: { pch: tema, include_approval: 'true' },
        });
        setAvailableCategories(response.data || []);
      } catch (error) {}
    };
    fetchCategories();

    // ✅ FIX: Si el contexto no nos da el estado de admin, lo verificamos aquí.
    const verifyAdminStatus = async () => {
      if (isAdmin === undefined || isAdmin === null) {
        try {
          const response = await api.get("verify-admin/");
          const isAdminResponse = response.data?.is_admin || response.data?.is_staff;
          setIsAdmin(isAdminResponse);
          // ✅ DEBUG: Muestra el resultado de la verificación manual
          console.log(`[TasksScreen] Resultado de la verificación manual de admin: ${isAdminResponse}`);
        } catch (error) {
          console.error("[TasksScreen] Error en la verificación manual de admin:", error);
          setIsAdmin(false);
        }
      }
    };
    verifyAdminStatus();
  }, [tema]);

  // --- Funciones para el nuevo flujo de compartir ---
  const openShareModal = (task) => {
    const sourceTask = task.isSharedTask ? task.task : task;
    const taskId = sourceTask.id;
    setTaskToShare(taskId);
    setTaskShareDetails({
      ...sourceTask,
      messageTaskId: task.id,
      messageTaskType: task.isSharedTask ? 'shared-task' : 'task',
    });
    setShareModalVisible(true);
  };

  const handleOpenTaskMessageShare = () => {
    if (!selectedActionTask) return;
    const task = selectedActionTask;
    handleCloseShareActionMenu();
    openShareModal(task);
  };

  const handleShareSuccess = (sharedTaskResponse) => {
    if (!sharedTaskResponse || !sharedTaskResponse.task) {
      console.error('[TasksScreen] La respuesta del modal no tiene la estructura esperada.');
      return;
    }

    // ✅ FIX: Si la tarea compartida ya existe, la actualizamos; si no, la añadimos.
    // Esto asegura que la descripción se actualice en tiempo real.
    setSharedTasks(prev => {
      const index = prev.findIndex(s => s.id === sharedTaskResponse.id);
      if (index !== -1) {
        const newArr = [...prev];
        newArr[index] = sharedTaskResponse; // Reemplazamos el item viejo por el nuevo
        return newArr;
      }
      return [sharedTaskResponse, ...prev]; // Añadimos el nuevo al principio
    });

    // Sincronizamos los contadores de la tarea original con la respuesta del backend.
    const { id: taskId, share_count, interaction_score: newInteractionScore } = sharedTaskResponse.task;
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, share_count, interaction_score: newInteractionScore } : t
    ));
    // ✅ FIX: Actualizamos también los contadores en OTRAS compartidas de la misma tarea que ya estén en el feed.
    setSharedTasks(prev => prev.map(s => {
      if (s.task?.id === taskId) {
        return { ...s, task: { ...s.task, share_count, interaction_score: newInteractionScore } };
      }
      return s;
    }));
    // Ya no es necesario un onRefresh() que causa parpadeo.
  };

  const handleOpenShareActionMenu = (task) => {
    setSelectedActionTask(task);
    setActionMenuVisible(true);
  };

  const handleCloseShareActionMenu = () => {
    setActionMenuVisible(false);
    setSelectedActionTask(null);
  };

  // Acción para "Repostear ahora"
  const handleRepost = useCallback(async (task) => {
    const taskToRepost = task || selectedActionTask;
    if (!taskToRepost) return;

    const taskId = taskToRepost.isSharedTask ? taskToRepost.task.id : taskToRepost.id;
    if (!task) handleCloseShareActionMenu(); // Solo cerramos el menú si venimos de él

    try {
      // Optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, interaction_score: (t.interaction_score || 0) + 1 } : t));
      setSharedTasks(prev => prev.map(s => {
        if (s.task?.id === taskId) {
          return { ...s, task: { ...s.task, interaction_score: (s.task.interaction_score || 0) + 1 } };
        }
        return s;
      }));

      // Llamada al endpoint de "repost" que solo afecta el score interno, no el share_count.
      const response = await api.post(`/tasks/${taskId}/repost/`);
      Alert.alert('Éxito', '¡Publicación impulsada!'); // Damos feedback al usuario.

      // Sync with actual response
      const finalScore = response.data.interaction_score;
      // ✅ FIX: Solo actualizamos el interaction_score, que es lo único que devuelve este endpoint.
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, interaction_score: finalScore } : t));
      setSharedTasks(prev => prev.map(s => {
        if (s.task?.id === taskId) {
          return { ...s, task: { ...s.task, interaction_score: finalScore } };
        }
        return s;
      }));
    } catch (error) {
      console.error("Error al repostear:", error.response?.data || error);
      alert("Error al repostear. Inténtalo de nuevo."); 
      onRefresh(); // Revert optimistic update on error
    }
  }, [selectedActionTask, tasks, sharedTasks]);

  // Acción para "Compartir con descripción" (abre el modal de descripción)
  const handleOpenShareDescriptionModal = () => {
    if (!selectedActionTask) return;
    handleCloseShareActionMenu(); // Cierra el menú de acciones
    openShareModal(selectedActionTask); // Abre el modal de compartir correcto
  };

  const handleShareToStory = useCallback(async (sourceItem = null) => {
    const taskSource = selectedActionTask;
    if (!taskSource) return;

    const taskId = taskSource.isSharedTask ? taskSource.task?.id : taskSource.id;
    if (!taskId) {
      Alert.alert('Error', 'No se pudo detectar la tarea para compartir a historia.');
      return;
    }

    const payload = { task_id: taskId };
    if (sourceItem) {
      payload.source_item_type = sourceItem.type;
      payload.source_item_id = sourceItem.id;
    }

    try {
      await api.post('stories/share-task/', payload);
      handleCloseShareActionMenu();
      Alert.alert('Éxito', 'Se compartió en tu historia de 24 horas.');
      navigation.navigate('Stories');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'No se pudo compartir esta tarea en historia.';
      Alert.alert('Error', errorMessage);
    }
  }, [selectedActionTask, navigation, handleCloseShareActionMenu]);

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
        ],
      );
    }
  };

  const handleEditTask = () => {
    if (!selectedActionTask) return;
    setActionModalVisible(false);
    if (selectedActionTask.isSharedTask) {
      navigation.navigate('SharedTaskDetail', { sharedTaskId: selectedActionTask.id });
    } else {
      navigation.navigate('CreateTask', { task: selectedActionTask });
    }
  };

  const handleApprovePodcast = () => {
    if (!selectedActionTask || !isAdmin) return;
    const sourceTask = selectedActionTask.isSharedTask
      ? selectedActionTask.task
      : selectedActionTask;
    if (!sourceTask?.id) return;

    const approve = async () => {
      try {
        const response = await api.post(`tasks/${sourceTask.id}/approve/`, { approve: true });
        const approvedCategories = response.data?.categories;
        const updateTask = (task) => (
          task?.id === sourceTask.id
            ? { ...task, categories: approvedCategories || task.categories }
            : task
        );
        setTasks(current => current.map(updateTask));
        setSharedTasks(current => current.map(shared => (
          shared.task?.id === sourceTask.id
            ? { ...shared, task: updateTask(shared.task) }
            : shared
        )));
        setActionModalVisible(false);
        Alert.alert('Podcast aprobado', 'Se notificó al creador y a las personas etiquetadas.');
      } catch (error) {
        Alert.alert('No se pudo aprobar', error.response?.data?.detail || 'Intenta de nuevo.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('¿Aprobar este podcast y notificar a sus involucrados?')) approve();
    } else {
      Alert.alert(
        'Aprobar podcast',
        'Se cambiará Procesando por Aprobada y se notificará al creador y a las personas etiquetadas.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Aprobar', onPress: approve },
        ],
      );
    }
  };

  const selectedTaskOwnerId = selectedActionTask?.isSharedTask
    ? selectedActionTask?.shared_by?.id
    : selectedActionTask?.user?.id || selectedActionTask?.user_id || selectedActionTask?.user;
  const canEditSelectedTask = Boolean(
    selectedActionTask &&
    currentUserId &&
    selectedTaskOwnerId &&
    String(currentUserId) === String(selectedTaskOwnerId)
  );

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
      const is_verified = !(userObj.profile?.is_verified); // El endpoint espera un booleano
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
      const is_recommended = !(userObj.profile?.is_recommended); // El endpoint espera un booleano
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
    const url = `tasks/${taskId}/users-who-liked/`; // ✅ CORRECCIÓN: URL correcta
    setLikesModalUrl(url);
    setLikesModalTitle('Likes');
    setLikesModalVisible(true);
  };

  const handleShowTaskShares = (taskId) => {
    const url = `tasks/${taskId}/users-who-shared/`;
    setLikesModalUrl(url);
    setLikesModalTitle('Compartido por');
    setLikesModalVisible(true);
  };

  const handleShowSharedTaskLikes = (sharedTaskId) => {
    const url = `shared-tasks/${sharedTaskId}/users-who-liked/`;
    setLikesModalUrl(url);
    setLikesModalTitle('Likes');
    setLikesModalVisible(true);
  };

  // ✅ CORRECCIÓN: Se añade la función para mostrar los likes del perfil
  const handleShowProfileLikes = (userId) => {
    setLikesModalUrl(`profiles/${userId}/likes/`);
    setLikesModalTitle('Likes del Perfil');
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

      const currentCatFilter = overrideFilters ? overrideFilters.category : selectedCategory;

      const response = await api.get('tasks/', { 
        params: {
          pch: tema, 
          page: pageNumber,
          category: currentCatFilter,
          status: overrideFilters ? overrideFilters.status : selectedStatus,
          date_filter: overrideFilters ? overrideFilters.date_filter : selectedDateFilter,
          sort_by: overrideFilters ? overrideFilters.sort_by : selectedSortBy,
          favorites_only: overrideFilters ? overrideFilters.favorites_only : selectedFavoritesOnly,
          favorite_users_only: overrideFilters ? overrideFilters.favorite_users_only : selectedFavoriteUsersOnly,
          verified_users_only: overrideFilters ? overrideFilters.verified_users_only : selectedVerifiedUsersOnly,
          recommended_users_only: overrideFilters ? overrideFilters.recommended_users_only : selectedRecommendedUsersOnly,
          _ts: Date.now(),
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
  }, [tema, selectedCategory, selectedStatus, selectedDateFilter, selectedSortBy, selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly]);

  const fetchSharedTasks = useCallback(async (pageNumber = 1, overrideFilters = null) => {
    try {
      const currentCatFilter = overrideFilters ? overrideFilters.category : selectedCategory;

      const response = await api.get('shared-tasks/', { 
        params: {
          page: pageNumber,
          category: currentCatFilter,
          status: overrideFilters ? overrideFilters.status : selectedStatus,
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
  }, [selectedCategory, selectedStatus, selectedDateFilter, selectedSortBy, selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly]);

  // ✅ CORRECCIÓN: Usamos un useEffect que reacciona a los filtros, en lugar de a cada foco.
  // Esto reduce drásticamente las llamadas a la API.
  useFocusEffect(useCallback(() => {
    fetchTasks(1);
    fetchSharedTasks(1);
  }, [tema, selectedCategory, selectedStatus, selectedDateFilter, selectedSortBy, selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly]));

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setSharedPage(1);
    setHasMore(true);
    setSharedHasMore(true);
    Promise.all([fetchTasks(1), fetchSharedTasks(1)]).finally(() => setRefreshing(false));
  };

  // ✅ CORRECCIÓN: Se añade la función para dar "Me gusta" a una tarea original.
  const handleLikeTask = async (task) => {
    if (!task) return;

    // 1. Actualización optimista para una UI fluida.
    const isLiked = !task.user_has_liked;
    const increment = isLiked ? 1 : -1;
    const updatedTask = { ...task, user_has_liked: isLiked, likes_count: (task.likes_count || 0) + increment };

    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    setSharedTasks(prev => prev.map(s => s.task?.id === task.id ? { ...s, task: updatedTask } : s));

    try {
      // 2. Llamada a la API para confirmar el cambio.
      const response = await api.post(`tasks/${task.id}/like/`); // ✅ Endpoint correcto
      const { liked, likes_count } = response.data;

      // 3. Sincronización silenciosa con la respuesta del servidor.
      const finalTask = { ...updatedTask, user_has_liked: liked, likes_count: likes_count };
      setTasks(prev => prev.map(t => t.id === task.id ? finalTask : t));
      setSharedTasks(prev => prev.map(s => s.task?.id === task.id ? { ...s, task: finalTask } : s));
    } catch (error) {
      console.error(`[TasksScreen | handleLikeTask] ERROR - API call failed:`, error.response?.data || error);
      // 4. Reversión en caso de error.
      // Necesitamos el estado original para revertir, que no está directamente disponible aquí.
      // Una solución simple es volver a cargar la tarea o la lista completa.
      console.error('Error liking task:', error);
      onRefresh(); // Revertimos descargando de nuevo si falló
    }
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
      console.error(`[TasksScreen | handleLikeSharedTask] ERROR - API call failed:`, error.response?.data || error.message);
      console.error('Error liking shared task:', error.response?.data || error.message);
      onRefresh(); // Revertir si hay error
    }
  };

  const handleCommentSharedTask = (sharedTaskId) => {
    navigation.navigate('SharedTaskDetail', { sharedTaskId });
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

    switch (selectedSortBy) {
      case 'likes':
        return combined.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      case 'recent':
        return combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'all':
      default:
        // Para 'all', simplemente combinamos y dejamos que el orden de la API (que ya es por fecha) prevalezca.
        // Opcionalmente, se puede re-ordenar por fecha si la combinación desordena.
        return combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
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

    const itemCategories = ((item.feedType === 'shared' ? item.task?.categories : item.categories) || '')
      .split(',').map(category => category.trim().toLowerCase()).filter(Boolean);
    const matchesStatus = !selectedStatus || itemCategories.includes(selectedStatus.toLowerCase()) || (
      selectedStatus.toLowerCase() === 'aprobada' && itemCategories.includes('aprobadas')
    );

    // ⚡ FILTRO INTELIGENTE LOCAL PARA SUBTEMAS
    let matchesCategory = true;
    if (selectedCategory) {
      const requiredTags = selectedCategory.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      const itemCatString = (item.feedType === 'shared' ? item.task?.categories : item.categories) || '';
      const itemTags = itemCatString.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      
      // La tarea debe contener TODOS los tags (categoría principal + subtemas) sin importar el orden
      matchesCategory = requiredTags.every(tag => {
        if (tag === 'aprobada') return itemTags.includes('aprobada') || itemTags.includes('aprobadas');
        return itemTags.includes(tag);
      });
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

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
    // ✅ AÑADIDO: Icono para administradores
    if (userObj.is_staff || userObj.is_superuser) return 'shield-checkmark';
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

  const handleShareSubItemToStory = useCallback(async (task, section, sub) => {
    if (!task || !sub) return;

    try {
      await api.post('stories/share-task/', {
        task_id: task.id,
        source_item_type: section,
        source_item_id: sub.id,
      });
      Alert.alert('Éxito', 'Se compartió la aportación en tu historia de 24 horas.');
      navigation.navigate('Stories');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'No se pudo compartir esta aportación en historia.';
      Alert.alert('Error', errorMessage);
    }
  }, [navigation]);

  const openSubMediaInReels = useCallback((task, sub, section) => {
    if (!task?.id || !sub?.video) return;
    navigation.navigate('Reels', {
      openTaskId: task.id,
      openMediaSrc: sub.video,
      openMediaType: 'video',
      openMediaSection: section,
      openMediaRequestId: Date.now(),
    });
  }, [navigation]);

  const renderSubContent = (task, section) => {
    const content = Array.isArray(task[section]) ? task[section] : [];
    if (content.length === 0) return <Text style={styles.noContent}>Sin datos en esta sección</Text>;

    return (
      <View style={styles.carouselContainer}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          style={{ width: carouselWidth }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ width: carouselWidth * content.length }}
          snapToInterval={carouselWidth}
          snapToAlignment="start"
          decelerationRate="fast"
          directionalLockEnabled
          disableIntervalMomentum
          alwaysBounceHorizontal={content.length > 1}
          scrollEventThrottle={16}
        >
          {content.map((sub, idx) => {
            const finalUri = getImageUrl(sub.image);
            const videoUri = getImageUrl(sub.video);

            return (
              <View key={sub.id || `${section}-${idx}`} style={[styles.subItem, { width: carouselWidth }]}>
                <View style={styles.subItemHeaderRow}>
                  <View style={styles.subItemHeading}>
                    <Text style={styles.subItemEyebrow}>
                      {section === 'subtasks' ? 'PUBLICACIÓN' : section === 'subfactores' ? 'FACTOR' : 'FUENTE'} {idx + 1}
                    </Text>
                    <Text style={styles.subItemTitle}>{sub.title || 'Sin título'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.subShareButton}
                    onPress={() => handleShareSubItemToStory(task, section, sub)}
                  >
                    <Ionicons name="share-social-outline" size={15} color="#51cf66" />
                    <Text style={styles.subShareText}>Historia</Text>
                  </TouchableOpacity>
                </View>

                {sub.description ? (
                  <Text style={styles.subItemDesc}>{sub.description}</Text>
                ) : null}

                {finalUri && (
                  <Image
                    source={{ uri: finalUri }}
                    style={styles.subMedia}
                    contentFit="cover"
                  />
                )}

                {videoUri && (
                  <TaskVideoPreview
                    uri={videoUri}
                    onOpenReel={() => openSubMediaInReels(task, sub, section)}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
        {content.length > 1 && (
          <View style={styles.carouselMeta}>
            <Text style={styles.carouselHint}>Desliza para ver más</Text>
            <View style={styles.carouselDots}>
              {content.map((sub, idx) => <View key={sub.id || idx} style={styles.carouselDot} />)}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderSharedItemCard = (shared) => {
    const task = shared.task || {};

    return (
      <View style={styles.taskCard}>
        <View style={styles.sharedByHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableUsername
                username={getSharerName(shared.shared_by)}
                userId={shared.shared_by?.id}
                userImage={getImageUrl(shared.shared_by?.user_image)}
                navigation={navigation}
                textStyle={styles.sharedByName}
              />
              <Text style={styles.sharedByName}>compartió</Text>
            </View>
            <Text style={styles.sharedDate}>{moment(shared.created_at).fromNow()}</Text>
          </View>
          <TouchableOpacity onPress={() => openActionModal({...shared, isSharedTask: true})}>
            <Ionicons name="ellipsis-vertical" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        {shared.description ? (
          <Text style={styles.sharedDescription}>{shared.description}</Text>
        ) : null}

        <View style={styles.originalTaskCard}>
          <View style={styles.taskHeader}>
            <Image 
              source={{
                uri:
                  getImageUrl(task.user?.user_image) || 'https://ui-avatars.com/api/?name=User&background=random',
              }}
              style={styles.avatar} 
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{task.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TouchableUsername
                    username={getAuthorName(task)}
                    userId={task.user?.id}
                    userImage={getImageUrl(task.user?.user_image)}
                    navigation={navigation}
                    textStyle={[styles.taskUser, { color: getUserStatusColor(task.user) }]}
                  />
                  {/* ✅ AÑADIDO: Mostrar el ícono de admin si corresponde */}
                  {(task.user?.is_staff || task.user?.is_superuser) && (
                    <Ionicons name="shield-checkmark" size={14} color="#4dabf7" style={{ marginLeft: 2 }} />
                  )}
                  {getUserStatusIcon(task.user) && <Ionicons name={getUserStatusIcon(task.user)} size={14} color={getUserStatusColor(task.user)} />}
              </View><Text style={{ fontSize: 12, color: '#999' }}>• {moment(task.created_at).fromNow()}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => openActionModal({ ...task, isSharedTask: false })}>
              <Ionicons name="ellipsis-vertical" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}>
            <Text style={styles.taskDescription}>{task.description}</Text>

            {task.categories ? (
              <View style={styles.categoriesList}>
                {task.categories.split(',').map((cat, idx) => (
                  <Text
                    key={idx}
                    style={[styles.categoryBadge, cat.trim().toLowerCase() === 'aprobada' && styles.categoryBadgeApproved]}
                  >
                    {cat.trim()}
                  </Text>
                ))}
              </View>
            ) : null}

            {Array.isArray(task.tagged_users) && task.tagged_users.length > 0 && (
              <View style={styles.taggedUsersRow}>
                <Ionicons name="pricetag-outline" size={13} color="#845ef7" style={{ marginRight: 4 }} />
                <Text style={styles.taggedUsersLabel}>Con:</Text>
                {task.tagged_users.map((u, idx) => (
                  <View key={u.id || idx} style={{ marginRight: 8 }}>
                    <TouchableUsername
                      username={`@${u.username || u.first_name || 'usuario'}`}
                      userId={u.id}
                      navigation={navigation}
                      textStyle={styles.taggedUserName}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* ⚡ EXTRAEMOS LA PRIMERA IMAGEN DISPONIBLE (SUBTASKS, SUBFACTORES O SUBFUENTES) */}
            {(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) && (
              <Image
                source={{ uri: getImageUrl(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) }}
                style={styles.taskImage}
                contentFit="cover"
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.taskFooter}>
          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.stat} onPress={() => handleRepost({ ...shared, isSharedTask: true })}>
              <Ionicons name="trending-up-outline" size={18} color="#f59f00" />
              <Text style={styles.statText}>{shared.task?.interaction_score || 0}</Text>
            </TouchableOpacity>

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
              <TouchableOpacity onPress={() => handleOpenShareActionMenu({ ...shared, isSharedTask: true })}>
                <Ionicons name="share-social-outline" size={18} color="#51cf66" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleShowTaskShares(shared.task?.id)} style={{marginLeft: 4, padding: 4}}>
                <Text style={styles.statText}>{shared.task?.share_count || 0}</Text>
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
    
    // ✅ DEBUG: Muestra en la consola los datos del usuario de cada tarea
    console.log(`[TasksScreen] Renderizando tarea de: ${item.user?.username}, is_staff: ${item.user?.is_staff}`);

    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <TouchableOpacity onPress={() => handleShowProfileLikes(item.user?.id)}>
            <Image 
              source={{ uri: getImageUrl(item.user?.user_image) || 'https://ui-avatars.com/api/?name=User&background=random' }} 
              style={styles.avatar} 
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TouchableUsername
                  username={getAuthorName(item)}
                  userId={item.user?.id}
                  userImage={getImageUrl(item.user?.user_image)}
                  navigation={navigation}
                  textStyle={[styles.taskUser, { color: getUserStatusColor(item.user) }]}
                />
                {/* ✅ AÑADIDO: Mostrar el ícono de admin si corresponde */}
                {(item.user?.is_staff || item.user?.is_superuser) && (
                  <Ionicons name="shield-checkmark" size={14} color="#4dabf7" style={{ marginLeft: 2 }} />
                )}
                {getUserStatusIcon(item.user) && <Ionicons name={getUserStatusIcon(item.user)} size={14} color={getUserStatusColor(item.user)} />}
              </View><Text style={{ fontSize: 12, color: '#999' }}>• {moment(item.created_at).fromNow()}</Text></View>
            
          </View>
          <TouchableOpacity onPress={() => openActionModal(item)}>
            <Ionicons name="ellipsis-vertical" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
          <Text style={styles.taskDescription}>{item.description}</Text>

          {item.categories ? (
            <View style={styles.categoriesList}>
              {item.categories.split(',').map((cat, idx) => (
                <Text
                  key={idx}
                  style={[styles.categoryBadge, cat.trim().toLowerCase() === 'aprobada' && styles.categoryBadgeApproved]}
                >
                  {cat.trim()}
                </Text>
              ))}
            </View>
          ) : null}

          {Array.isArray(item.tagged_users) && item.tagged_users.length > 0 && (
            <View style={styles.taggedUsersRow}>
              <Ionicons name="pricetag-outline" size={13} color="#845ef7" style={{ marginRight: 4 }} />
              <Text style={styles.taggedUsersLabel}>Con:</Text>
              {item.tagged_users.map((u, idx) => (
                <View key={u.id || idx} style={{ marginRight: 8 }}>
                  <TouchableUsername
                    username={`@${u.username || u.first_name || 'usuario'}`}
                    userId={u.id}
                    navigation={navigation}
                    textStyle={styles.taggedUserName}
                  />
                </View>
              ))}
            </View>
          )}
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
            <TouchableOpacity style={styles.stat} onPress={() => handleRepost(item)}>
              <Ionicons name="trending-up-outline" size={18} color="#f59f00" />
              <Text style={styles.statText}>{item.interaction_score || 0}</Text>
            </TouchableOpacity>

            <View style={styles.stat}>
              {/* ✅ CORRECCIÓN: Botón de like funcional */}
              <TouchableOpacity onPress={() => handleLikeTask(item)}>
                <Ionicons name={item.user_has_liked ? "heart" : "heart-outline"} size={18} color={item.user_has_liked ? "#ff6b6b" : "#999"} />
              </TouchableOpacity>
              {/* El contador abre la lista de usuarios que dieron like */}
              <TouchableOpacity onPress={() => handleShowTaskLikes(item.id)} style={{marginLeft: 4, padding: 4}}>
                <Text style={styles.statText}>{item.likes_count ?? 0}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.stat} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
              <Ionicons name="chatbubble-outline" size={18} color="#4dabf7" />
              <Text style={styles.statText}>{item.comments_count || 0}</Text>
            </TouchableOpacity>
            <View style={styles.stat}>
              <TouchableOpacity onPress={() => handleOpenShareActionMenu(item)}>
                <Ionicons name="share-social-outline" size={18} color="#51cf66" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleShowTaskShares(item.id)} style={{marginLeft: 4, padding: 4}}>
                <Text style={styles.statText}>{item.share_count || 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {searchExpanded ? (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar objetivos..."
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setSearchText(''); setSearchExpanded(false); }}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.headerTitle}>Éxito</Text>
        )}
        <View style={styles.headerActions}>
          {!searchExpanded && (
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setSearchExpanded(true)}>
              <Ionicons name="search-outline" size={24} color="#4dabf7" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="options-outline" size={24} color="#4dabf7" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setSavedFiltersModalVisible(true)}>
            <Ionicons name="bookmarks-outline" size={24} color="#4dabf7" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateTask', { initialPch: tema })}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
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

      <CategoryHierarchy
        availableCategories={availableCategories}
        showDescendants
        onSelect={(category) => {
          setSelectedCategory(category);
          if (category.split(',')[0].trim().toLowerCase() !== 'grabar podcast') {
            setSelectedStatus('');
          }
          setPage(1);
          setHasMore(true);
        }}
      />

      <FlatList
        data={filteredTasks}
        // ✅ FIX: Usamos una clave única y consistente que previene duplicados.
        // Para un item compartido, usamos su propio ID, no el de la tarea anidada.
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderFeedItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        
        // ⚡ LAS PROPS MÁGICAS DE RENDIMIENTO Y SCROLL INFINITO
        onEndReached={loadMoreTasks}
        onEndReachedThreshold={0.7} // Carga más cuando falta el 70% de la pantalla
        removeClippedSubviews={Platform.OS === 'android'} // Mejora el uso de memoria en Android
        maxToRenderPerBatch={10} // Renderiza en lotes más pequeños
        windowSize={11} // Mantiene más items en memoria para un scroll suave
        initialNumToRender={8} // Carga inicial rápida
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 20 }} /> : null
        }
      />

      {/* MODAL DE FILTROS */}
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        currentCategory={selectedCategory}
        currentStatus={selectedStatus}
        currentDateFilter={selectedDateFilter}
        currentSortBy={selectedSortBy}
        currentFavorites={selectedFavoritesOnly}
        currentFavoriteUsers={selectedFavoriteUsersOnly}
        currentVerifiedUsers={selectedVerifiedUsersOnly}
        currentRecommendedUsers={selectedRecommendedUsersOnly}
        // ✅ PASAMOS EL ESTADO DE ADMIN DIRECTAMENTE
        isSuperAdmin={isAdmin}
        // ✅ SOLUCIÓN: Pasamos las categorías como prop.
        availableCategories={availableCategories}
        // ⚡ PCH activo para que el modal muestre/cree categorías de este tema
        currentPch={tema}
        onApply={(filters) => {
          setSelectedCategory(filters.category);
          setSelectedStatus(filters.status || '');
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

      {/* MODAL DE FILTROS GUARDADOS (CRUD propio del perfil) */}
      <SavedFiltersModal
        visible={savedFiltersModalVisible}
        onClose={() => setSavedFiltersModalVisible(false)}
        currentFilters={{
          category: selectedCategory,
          status: selectedStatus,
          date_filter: selectedDateFilter,
          sort_by: selectedSortBy,
          favorites_only: selectedFavoritesOnly,
          favorite_users_only: selectedFavoriteUsersOnly,
          verified_users_only: selectedVerifiedUsersOnly,
          recommended_users_only: selectedRecommendedUsersOnly,
        }}
        onApplyFilter={(filters) => {
          setSelectedCategory(filters.category || '');
          setSelectedStatus(filters.status || '');
          setSelectedDateFilter(filters.date_filter || '');
          setSelectedSortBy(filters.sort_by || 'all');
          setSelectedFavoritesOnly(filters.favorites_only || false);
          setSelectedFavoriteUsersOnly(filters.favorite_users_only || false);
          setSelectedVerifiedUsersOnly(filters.verified_users_only || false);
          setSelectedRecommendedUsersOnly(filters.recommended_users_only || false);
          setPage(1);
          setSharedPage(1);
          setHasMore(true);
          setSharedHasMore(true);
          fetchTasks(1, filters);
          fetchSharedTasks(1, filters);
        }}
      />

      {/* MODAL DE LIKES */}
      <TieredLikesModal 
        visible={likesModalVisible} 
        onClose={() => setLikesModalVisible(false)} 
        apiUrl={likesModalUrl} 
        title={likesModalTitle}
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
                <TouchableOpacity style={styles.actionOption} onPress={() => { setActionModalVisible(false); handleOpenShareActionMenu(selectedActionTask); }}>
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
                {(selectedActionTask && currentUserId && selectedTaskOwnerId && String(currentUserId) === String(selectedTaskOwnerId)) && (
                  <>
                    {canEditSelectedTask && (
                      <TouchableOpacity style={styles.actionOption} onPress={handleEditTask}>
                        <Ionicons name='pencil-outline' size={20} color='#4dabf7' />
                        <Text style={styles.actionText}>Editar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.actionOption, styles.actionOptionDelete]} onPress={handleDeleteTask}>
                      <Ionicons name='trash-outline' size={20} color='#ff6b6b' />
                      <Text style={[styles.actionText, { color: '#ff6b6b', fontWeight: 'bold' }]}>Eliminar</Text>
                    </TouchableOpacity>
                  </>
                )}
                {isAdmin && (
                  // ✅ DEBUG: Si isAdmin es true, esto se imprimirá en la consola
                  console.log(`[TasksScreen] Renderizando botones de admin para la tarea: ${selectedActionTask?.id}`),

                  // 🪵 LOG DE DIAGNÓSTICO: Confirmamos que se intenta renderizar
                  <>
                    {(() => {
                      const sourceTask = selectedActionTask.isSharedTask
                        ? selectedActionTask.task
                        : selectedActionTask;
                      const categories = String(sourceTask?.categories || '')
                        .split(',')
                        .map(category => category.trim().toLowerCase());
                      const isPodcast = categories.includes('grabar podcast');
                      const isApproved = categories.includes('aprobada');
                      return isPodcast ? (
                        <TouchableOpacity style={styles.actionOption} onPress={handleApprovePodcast}>
                          <Ionicons name={isApproved ? 'send-outline' : 'ribbon-outline'} size={20} color='#f59f00' />
                          <Text style={[styles.actionText, { color: '#e67700', fontWeight: '700' }]}>
                            {isApproved ? 'Enviar invitaciones del podcast' : 'Aprobar podcast'}
                          </Text>
                        </TouchableOpacity>
                      ) : null;
                    })()}
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

      {/* Nuevo Menú Modal de Acciones para Compartir */}
      <ShareActionMenu
        isVisible={isActionMenuVisible}
        onClose={handleCloseShareActionMenu}
        onShare={handleOpenShareDescriptionModal} // Abre el modal de descripción
        onSendMessage={handleOpenTaskMessageShare}
        onRepost={handleRepost}
        onShareToStory={handleShareToStory}
      />

      {/* MODAL DE COMPARTIR (el que ya funcionaba) */}
      <ShareModal
        visible={isShareModalVisible}
        onClose={() => setShareModalVisible(false)}
        taskId={taskToShare}
        onShareSuccess={handleShareSuccess}
        navigation={navigation}
        taskTitle={taskShareDetails?.title || 'Publicación'}
        taskDescription={taskShareDetails?.description || ''}
        messageTaskId={taskShareDetails?.messageTaskId}
        messageTaskType={taskShareDetails?.messageTaskType}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#333' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  createBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#f8f9fa', borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  searchInput: { 
    flex: 1, 
    height: 45, 
    marginLeft: 8,
    // ⚡ FIX: Aseguramos que el input sea usable en web
    outlineStyle: 'none',
    borderWidth: 0,
  },
  temaSelector: { flexDirection: 'row', paddingHorizontal: 12, gap: 10, marginBottom: 10 },
  temaBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eee' },
  temaBadgeActive: { backgroundColor: '#333' },
  temaBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  temaBadgeTextActive: { color: '#fff' },
  listContent: { paddingBottom: 100 },
  taskCard: { 
    backgroundColor: '#fff', 
    marginHorizontal: 12, 
    marginBottom: 16, 
    borderRadius: 20, 
    padding: 16, 
    boxShadow: '0px 1px 1.41px rgba(0,0,0,0.2)', // Para la web
    elevation: 2, // Para Android
  },
  taskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 45, height: 45, borderRadius: 22.5, marginRight: 12, backgroundColor: '#eee' },
  taskTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  taskUser: { fontSize: 12, color: '#4dabf7', fontWeight: '600' },
  taskDescription: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15 },
  categoryBadge: { backgroundColor: '#e3f2fd', color: '#4dabf7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 11, fontWeight: '600' },
  categoryBadgeApproved: { backgroundColor: '#d3f9d8', color: '#2b8a3e', borderWidth: 1, borderColor: '#69db7c' },
  taggedUsersRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  taggedUsersLabel: { color: '#868e96', fontSize: 12, marginRight: 4 },
  taggedUserName: { color: '#845ef7', fontSize: 12, fontWeight: '600' },
  sectionTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#4dabf7' },
  tabText: { fontSize: 11, color: '#999', fontWeight: 'bold' },
  tabTextActive: { color: '#4dabf7' },
  dynamicContent: { minHeight: 40 },
  carouselContainer: { width: '100%', overflow: 'hidden' },
  subItem: { marginBottom: 10, paddingHorizontal: 5 },
  subItemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  subItemHeading: { flex: 1, paddingRight: 8 },
  subItemEyebrow: { fontSize: 10, color: '#4dabf7', fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  subItemTitle: { fontSize: 16, color: '#222', fontWeight: '700' },
  subItemDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginTop: 8 },
  subShareButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  subShareText: { fontSize: 11, color: '#1f9d5a', fontWeight: '700' },
  subMediaWrapper: { width: '100%', height: 240, marginTop: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f3f5' },
  subMedia: { width: '100%', height: '100%', backgroundColor: '#f1f3f5' },
  videoTouchSurface: { ...StyleSheet.absoluteFillObject },
  videoControls: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, backgroundColor: 'rgba(0,0,0,0.62)' },
  videoControlButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  videoProgress: { flex: 1, height: 40, marginHorizontal: 4 },
  expandVideoButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  carouselEndSpacer: { width: 1 },
  carouselMeta: { alignItems: 'center', marginTop: 2 },
  carouselHint: { fontSize: 10, color: '#adb5bd', marginBottom: 5 },
  carouselDots: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  carouselDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#cbd5e1' },
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
