import React, { useState, useCallback, useEffect, useContext, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet, TouchableOpacity, Dimensions,
  RefreshControl, TextInput, Platform, ActivityIndicator, Modal, Alert, Button, SafeAreaView, useWindowDimensions,
  InteractionManager, AppState, Animated, PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import moment from 'moment';
import api, { getImageUrl } from '@api';
import { Image } from 'expo-image';
import TieredLikesModal from './TieredLikesModal';
import FilterModal from '@components/FilterModal';
import SavedFiltersModal from '@components/SavedFiltersModal';
import { Video } from 'expo-av';
import ShareModal from '@components/ShareModal';
import { AuthContext } from '@app';
import ShareActionMenu from './ShareActionMenu';
import TouchableUsername from '@components/TouchableUsername';
import FollowHeart from '@components/FollowHeart';
import PetitionSupportStat from '@components/PetitionSupportStat';
import CategoryHierarchy from '@components/CategoryHierarchy';
import PersonalCategoryFilter from '@components/PersonalCategoryFilter';
import LinkifiedText from '@components/LinkifiedText';
import Slider from '@react-native-community/slider';
import { useQueryClient } from '@tanstack/react-query';
import { useTasksInfinite, useSharedTasksInfinite, useCategories } from '@hooks/useApi';
import { useIsOnline } from '../hooks/useIsOnline';
import OfflineEmptyState from '../components/OfflineEmptyState';
import TaskPostCard, { FeedVideoVisibilityContext, TaskSections } from '@components/TaskPostCard';
import TaskActionsModal from '@components/TaskActionsModal';
import TaskSharesModal from '@components/TaskSharesModal';
import { getActionTaskInfo } from '@hooks/useTaskActions';
import useTaskSharesFeed from '@hooks/useTaskSharesFeed';
import StoriesBar from '@components/StoriesBar';
import TopicTopSections from '@components/TopicTopSections';
import { dedupeFeedItems } from '../utils/feedItems';


const TasksScreen = ({ navigation, route }) => {
  const isTasksTab = route?.name === 'HomeMain';
  const { width: screenWidth } = useWindowDimensions();
  const carouselWidth = Math.max(280, screenWidth - 56);

  // Obtenemos el estado de admin del contexto global
  const { user, signOut, isAdmin: isAdminFromContext } = useContext(AuthContext);
  const currentUserId = user?.id;

  const [isAdmin, setIsAdmin] = useState(isAdminFromContext);

  const [tasks, setTasks] = useState([]);
  const [sharedTasks, setRawSharedTasks] = useState([]);
  // Modal "Ver compartidas": id de la publicación original cuyas compartidas se muestran.
  const [sharesModalTaskId, setSharesModalTaskId] = useState(null);
  const sharesFeed = useTaskSharesFeed(sharesModalTaskId);
  const setSharesItems = sharesFeed.setItems;
  // Las acciones de las tarjetas (like, impulso, favorito, borrar...) actualizan la lista con
  // funciones; esas mismas actualizaciones se aplican a las tarjetas del modal para que
  // reaccionen igual que las del feed. Las cargas completas del servidor solo reemplazan el feed.
  const setSharedTasks = useCallback((valueOrUpdater) => {
    setRawSharedTasks(valueOrUpdater);
    if (typeof valueOrUpdater === 'function') setSharesItems(valueOrUpdater);
  }, [setSharesItems]);
  const sharesModalItems = useMemo(
    () => sharesFeed.items.filter((shared) => shared.task?.id === sharesModalTaskId),
    [sharesFeed.items, sharesModalTaskId]
  );
  // Al salir de esta pantalla (por ejemplo, a un detalle) el modal se cierra.
  useFocusEffect(useCallback(() => () => setSharesModalTaskId(null), []));
  const repostInFlightRef = useRef(new Set());
  const [searchText, setSearchText] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchTasks, setSearchTasks] = useState([]);
  const [searchSharedTasks, setSearchSharedTasks] = useState([]);
  const [searchDirectoryProfiles, setSearchDirectoryProfiles] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCategory, setSearchCategory] = useState('');
  const [searchScope, setSearchScope] = useState('both');
  const [searchCategoryLevel, setSearchCategoryLevel] = useState(-1);
  const [searchStatus, setSearchStatus] = useState('');
  const [searchHasStarted, setSearchHasStarted] = useState(false);
  const [searchCustomPaths, setSearchCustomPaths] = useState([]);
  const searchCacheRef = useRef(new Map());
  const feedListRef = useRef(null);
  const feedScrollOffsetRef = useRef(0);
  const mainFeedScrollOffsetRef = useRef(0);
  const resetMainFeedOnCloseRef = useRef(false);
  const [visibleFeedIds, setVisibleFeedIds] = useState(() => new Set());
  const onFeedViewableItemsChanged = useRef(({ viewableItems }) => {
    setVisibleFeedIds(new Set((viewableItems || []).map((entry) => String(entry?.item?.id ?? entry?.key))));
  }).current;
  const feedViewabilityConfig = useRef({ itemVisiblePercentThreshold: 20, minimumViewTime: 0 }).current;
  const getFeedListBounds = useCallback((callback) => {
    const list = feedListRef.current;
    const node = list?.getNativeScrollRef ? list.getNativeScrollRef() : list?.getScrollableNode?.();
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, width, height) => callback({ x, y, width, height }));
    } else {
      callback(null);
    }
  }, []);
  const feedVideoVisibility = useMemo(
    () => ({ visibleIds: visibleFeedIds, getListBounds: getFeedListBounds }),
    [visibleFeedIds, getFeedListBounds]
  );
  // Encabezado colapsable: al deslizar hacia abajo se oculta SOLO la zona superior (titulo, historias,
  // pestañas) y el filtro de categorias queda fijo arriba; al deslizar hacia arriba reaparece.
  // El desplazamiento se calcula a mano (sin diffClamp) para que sea predecible.
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const stickyShiftY = useRef(new Animated.Value(0)).current;
  const lastScrollYRef = useRef(0);
  const collapseRef = useRef(0);
  const [titleH, setTitleH] = useState(0);
  const [collapsibleH, setCollapsibleH] = useState(0);
  const [stickyH, setStickyH] = useState(0);
  const STICKY_TOP_GAP = 0;
  const extraRef = useRef(0);
  // Aplica el estado del encabezado: 'collapse' oculta la zona superior (titulo, historias, temas) y
  // 'extra' oculta ademas las categorias (hasta salir por completo de la pantalla).
  const applyHeaderState = useCallback((collapse, extra) => {
    const max = collapsibleH;
    collapseRef.current = collapse;
    extraRef.current = extra;
    headerTranslateY.setValue(-(collapse + extra));
    stickyShiftY.setValue(max > 0 ? (collapse / max) * STICKY_TOP_GAP : 0);
  }, [collapsibleH, headerTranslateY, stickyShiftY]);
  const updateHeaderCollapse = useCallback((offset) => {
    const y = Math.max(0, offset);
    const delta = y - lastScrollYRef.current;
    lastScrollYRef.current = y;
    const max = searchExpanded ? 0 : collapsibleH;
    if (max <= 0) {
      if (collapseRef.current !== 0 || extraRef.current !== 0) applyHeaderState(0, 0);
      return;
    }
    const extraMax = stickyH + STICKY_TOP_GAP + 4;
    let collapse = collapseRef.current;
    let extra = extraRef.current;
    if (delta > 0) {
      // Al deslizar hacia abajo se oculta todo: primero la zona superior y despues las categorias.
      const toTop = Math.min(delta, max - collapse);
      collapse += toTop;
      extra += delta - toTop;
    } else if (delta < 0) {
      // Al deslizar hacia arriba reaparecen SOLO las categorias; la zona superior no vuelve
      // hasta arrastrar desde las categorias o llegar arriba del todo.
      extra += delta;
    }
    // Nunca se oculta mas de lo que se ha desplazado, asi que arriba del todo se ve completo.
    collapse = Math.min(Math.max(collapse, 0), Math.min(max, y));
    extra = collapse < max ? 0 : Math.min(Math.max(extra, 0), extraMax);
    if (collapse === collapseRef.current && extra === extraRef.current) return;
    applyHeaderState(collapse, extra);
  }, [searchExpanded, collapsibleH, stickyH, applyHeaderState]);
  useEffect(() => {
    // Al cambiar la altura o entrar/salir de la busqueda, se muestra el encabezado completo
    applyHeaderState(0, 0);
  }, [searchExpanded, collapsibleH, applyHeaderState]);

  // Arrastrar el filtro hacia abajo muestra la zona superior; hacia arriba la oculta (con ajuste al soltar).
  const collapsibleHRef = useRef(0);
  collapsibleHRef.current = collapsibleH;
  const searchExpandedRef = useRef(false);
  searchExpandedRef.current = searchExpanded;
  const dragStartCollapseRef = useRef(0);
  const applyCollapse = useCallback((value) => {
    const max = collapsibleHRef.current;
    collapseRef.current = value;
    extraRef.current = 0;
    headerTranslateY.setValue(-value);
    stickyShiftY.setValue(max > 0 ? (value / max) * STICKY_TOP_GAP : 0);
  }, [headerTranslateY, stickyShiftY]);
  const filterPanResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => (
      !searchExpandedRef.current && Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5
    ),
    onPanResponderGrant: () => { dragStartCollapseRef.current = collapseRef.current; },
    onPanResponderMove: (_, g) => {
      const max = collapsibleHRef.current;
      applyCollapse(Math.min(Math.max(dragStartCollapseRef.current - g.dy, 0), max));
    },
    onPanResponderRelease: () => {
      const max = collapsibleHRef.current;
      applyCollapse(collapseRef.current > max / 2 ? max : 0);
    },
    onPanResponderTerminate: () => {
      const max = collapsibleHRef.current;
      applyCollapse(collapseRef.current > max / 2 ? max : 0);
    },
  })).current;
  const [tema, setTema] = useState('');
  const [visibleSections, setVisibleSections] = useState({});
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [savedFiltersModalVisible, setSavedFiltersModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedSortBy, setSelectedSortBy] = useState('all');
  const [selectedFavoritesOnly, setSelectedFavoritesOnly] = useState(
    route?.params?.feedMode === 'favorites'
  );
  const [selectedFavoriteUsersOnly, setSelectedFavoriteUsersOnly] = useState(false);
  const [selectedFollowedUsersOnly, setSelectedFollowedUsersOnly] = useState(false);
  const [selectedVerifiedUsersOnly, setSelectedVerifiedUsersOnly] = useState(false);
  const [selectedRecommendedUsersOnly, setSelectedRecommendedUsersOnly] = useState(false);

  const [availableCategories, setAvailableCategories] = useState([]);
  const [showPersonalFilter, setShowPersonalFilter] = useState(false);
  const [favoriteVisibilityVisible, setFavoriteVisibilityVisible] = useState(false);
  const [favoriteProfilesPublic, setFavoriteProfilesPublic] = useState(false);
  const [favoriteTasksPublic, setFavoriteTasksPublic] = useState(false);
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

  useEffect(() => {
    if (route?.params?.openSavedFilters) {
      setSavedFiltersModalVisible(true);
      navigation.setParams({ openSavedFilters: undefined });
    }
    if (route?.params?.openFavoriteVisibility) {
      setFavoriteVisibilityVisible(true);
      navigation.setParams({ openFavoriteVisibility: undefined });
    }
  }, [navigation, route?.params?.openFavoriteVisibility, route?.params?.openSavedFilters]);

  // Load the active PCH categories, or the full catalog when no PCH is selected.
  useEffect(() => {
    let isCurrentRequest = true;
    const fetchCategories = async () => {
      try {
        const params = { include_approval: 'true' };
        if (tema) params.pch = tema;
        const response = await api.get('new-categories/', {
          params,
        });
        if (isCurrentRequest) {
          setAvailableCategories(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        console.error('[TasksScreen] Error cargando categorías:', error.response?.data || error.message);
        if (isCurrentRequest) setAvailableCategories([]);
      }
    };
    fetchCategories();

    // El usuario puede elegir que su filtro personal lo acompañe por toda la app.
    api.get('categories/visibility/')
      .then(res => {
        setShowPersonalFilter(Boolean(res.data?.personal_filter_public));
        setFavoriteProfilesPublic(Boolean(res.data?.favorite_profiles_public));
        setFavoriteTasksPublic(Boolean(res.data?.favorite_tasks_public));
      })
      .catch(error => {
        console.error('[TasksScreen] Error cargando visibilidad de categorías:', error.response?.data || error.message);
        setShowPersonalFilter(false);
      });

    // ✅ FIX: Si el contexto no nos da el estado de admin, lo verificamos aquí.
    const verifyAdminStatus = async () => {
      if (isAdmin === undefined || isAdmin === null) {
        try {
          const response = await api.get("verify-admin/");
          const isAdminResponse = response.data?.is_admin || response.data?.is_staff;
          setIsAdmin(isAdminResponse);
        } catch (error) {
          console.error("[TasksScreen] Error en la verificación de admin:", error);
          setIsAdmin(false);
        }
      }
    };
    verifyAdminStatus();
    return () => {
      isCurrentRequest = false;
    };
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
    if (!taskId || repostInFlightRef.current.has(taskId)) return;
    repostInFlightRef.current.add(taskId);
    const currentTask = taskToRepost.isSharedTask ? taskToRepost.task : taskToRepost;
    const original = {
      user_has_reposted: Boolean(currentTask.user_has_reposted),
      user_has_liked: Boolean(currentTask.user_has_liked),
      likes_count: currentTask.likes_count || 0,
      interaction_score: currentTask.interaction_score || 0,
    };
    const nextReposted = !original.user_has_reposted;
    const updateTask = (userHasReposted, userHasLiked, likesCount, interactionScore) => {
      const update = item => ({
        ...item,
        user_has_reposted: userHasReposted,
        user_has_liked: userHasLiked,
        likes_count: likesCount,
        interaction_score: interactionScore,
      });
      setTasks(prev => prev.map(item => item.id === taskId ? update(item) : item));
      setSearchTasks(prev => prev.map(item => item.id === taskId ? update(item) : item));
      const updateShared = item => item.task?.id === taskId
        ? { ...item, task: update(item.task) }
        : item;
      setSharedTasks(prev => prev.map(updateShared));
      setSearchSharedTasks(prev => prev.map(updateShared));
    };
    const optimisticLiked = original.user_has_liked || nextReposted;
    const optimisticLikesCount = original.likes_count + (!original.user_has_liked && nextReposted ? 1 : 0);

    try {
      updateTask(nextReposted, optimisticLiked, optimisticLikesCount,
        Math.max(0, original.interaction_score + (nextReposted ? 1 : -1)));

      const response = await api.post(`/tasks/${taskId}/repost/`);
      updateTask(
        response.data.user_has_reposted,
        response.data.user_has_liked,
        response.data.likes_count,
        response.data.interaction_score,
      );
      Alert.alert('Éxito', response.data.reposted ? '¡Publicación impulsada!' : 'Se quitó el impulso; el like se conserva.');
    } catch (error) {
      console.error("Error al repostear:", error.response?.data || error);
      alert("Error al repostear. Inténtalo de nuevo."); 
      updateTask(original.user_has_reposted, original.user_has_liked, original.likes_count, original.interaction_score);
    } finally {
      repostInFlightRef.current.delete(taskId);
    }
  }, [selectedActionTask, handleCloseShareActionMenu]);

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

  const handleViewShares = () => {
    const { sourceTask } = getActionTaskInfo(selectedActionTask, currentUserId);
    if (!sourceTask?.id) return;
    setActionModalVisible(false);
    setSharesModalTaskId(sourceTask.id);
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
    const isApproved = String(sourceTask.categories || '')
      .split(',')
      .map(category => category.trim().toLowerCase())
      .some(category => ['aprobada', 'aprobadas', 'aprovada', 'aprovadas'].includes(category));
    const shouldApprove = !isApproved;

    const approve = async () => {
      try {
        const response = await api.post(`tasks/${sourceTask.id}/approve/`, { approve: shouldApprove });
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
        Alert.alert(
          shouldApprove ? 'Aportación aprobada' : 'Aprobación retirada',
          shouldApprove
            ? 'Se notificó al creador y a las personas etiquetadas.'
            : 'La aprobación se retiró correctamente.'
        );
      } catch (error) {
        Alert.alert('No se pudo actualizar la aprobación', error.response?.data?.detail || 'Intenta de nuevo.');
      }
    };

    if (Platform.OS === 'web') {
      const actionText = shouldApprove
        ? '¿Aprobar esta aportación y notificar a sus involucrados?'
        : '¿Retirar la aprobación de esta aportación?';
      if (window.confirm(actionText)) approve();
    } else {
      Alert.alert(
        shouldApprove ? 'Aprobar aportación' : 'Retirar aprobación',
        shouldApprove
          ? 'Se cambiará el estado a Aprobada y se notificará al creador y a las personas etiquetadas.'
          : 'La aportación volverá al estado Procesando.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: shouldApprove ? 'Aprobar' : 'Retirar', onPress: approve },
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

  // "Ir al foro": abre la pestaña del foro
  const handleGoToForum = () => {
    const forumUser = selectedActionTask?.isSharedTask ? selectedActionTask.shared_by : selectedActionTask?.user;
    setActionModalVisible(false);
    navigation.navigate('Forum', {
      screen: 'ForumMain',
      params: forumUser?.id
        ? { userId: forumUser.id, userName: selectedActionTask?.isSharedTask ? getSharerName(forumUser) : getAuthorName(selectedActionTask) }
        : { userId: undefined, userName: undefined },
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

  // ⚡ Like de la App (de peticiones.js en la web): el backend lo da con la cuenta de la App
  // (owen@gmail.com). Solo superadmins, igual que el endpoint.
  const handleToggleAppLike = async () => {
    if (!selectedActionTask) return;
    const sourceTask = selectedActionTask.isSharedTask ? selectedActionTask.task : selectedActionTask;
    if (!sourceTask?.id) return;
    setActionModalVisible(false);

    try {
      const { data } = await api.post(`admin/tasks/${sourceTask.id}/like/`, { liked: !sourceTask.app_has_liked });
      // Si quien administra es la propia cuenta de la App, también cambia su corazón.
      const isAppAccount = String(data.app_account_id) === String(currentUserId);
      const updateTask = (task) => (
        task?.id === sourceTask.id
          ? {
            ...task,
            app_has_liked: data.liked,
            likes_count: data.likes_count,
            ...(isAppAccount && { user_has_liked: data.liked }),
          }
          : task
      );
      setTasks(current => current.map(updateTask));
      setSharedTasks(current => current.map(shared => (
        shared.task?.id === sourceTask.id ? { ...shared, task: updateTask(shared.task) } : shared
      )));
    } catch (error) {
      Alert.alert('No se pudo cambiar el like de la App', error.response?.data?.detail || 'Intenta de nuevo.');
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

  // Aplica `patch` (p. ej. { is_following, is_favorited }) al usuario `perfilId`
  // en cada tarea/compartida que lo muestre, para que todos los menús coincidan.
  const patchUserEverywhere = (perfilId, patch) => {
    const matches = (u) => u && (typeof u === "object" ? String(u.id) === String(perfilId) : String(u) === String(perfilId));
    const patchUser = (u) => (matches(u) && typeof u === "object" ? { ...u, ...patch } : u);
    const patchTask = (t) => {
      if (!t) return t;
      const next = { ...t };
      if (t.user !== undefined) next.user = patchUser(t.user);
      if (t.shared_by !== undefined) next.shared_by = patchUser(t.shared_by);
      return next;
    };
    setTasks(prev => prev.map(patchTask));
    setSharedTasks(prev => prev.map(s => ({ ...patchTask(s), task: patchTask(s.task) })));
  };

  const getActionTargetUser = () => {
    if (!selectedActionTask || (!selectedActionTask.user && !selectedActionTask.shared_by)) return null;
    const targetUser = selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user;
    return typeof targetUser === "object" ? targetUser : { id: targetUser };
  };

  // Seguir -> Favorito -> Anclado: dejar de seguir quita también el favorito.
  const handleToggleFollow = async () => {
    const userObj = getActionTargetUser();
    if (!userObj?.id) return;
    try {
      const wasFollowing = !!userObj.is_following;
      patchUserEverywhere(userObj.id, wasFollowing
        ? { is_following: false, is_favorited: false }
        : { is_following: true });
      if (wasFollowing) {
        await api.delete(`users/${userObj.id}/follow/`);
      } else {
        await api.post(`users/${userObj.id}/follow/`);
      }
      queryClient.invalidateQueries({ queryKey: ['profileSocial'] });
    } catch (error) {
      console.error("Error toggling follow:", error);
      patchUserEverywhere(userObj.id, { is_following: !!userObj.is_following, is_favorited: !!userObj.is_favorited });
    } finally {
      setActionModalVisible(false);
    }
  };

  const handleToggleProfileFavorite = async () => {
    const userObj = getActionTargetUser();
    if (!userObj?.id) return;
    try {
      const isFav = !userObj.is_favorited;
      // Favoritar sigue automáticamente; quitar el favorito no deja de seguir.
      patchUserEverywhere(userObj.id, isFav ? { is_favorited: true, is_following: true } : { is_favorited: false });
      await api.post("pfavoritos/agregar/", { perfil_id: userObj.id });
      queryClient.invalidateQueries({ queryKey: ['profileSocial'] });
    } catch (error) {
      console.error("Error toggling profile favorite:", error);
      patchUserEverywhere(userObj.id, { is_favorited: !!userObj.is_favorited, is_following: !!userObj.is_following });
    } finally {
      setActionModalVisible(false);
    }
  };

  const handlePinFavorite = async (kind) => {
    if (!selectedActionTask) return;
    const target = kind === 'profile'
      ? (selectedActionTask.isSharedTask ? selectedActionTask.shared_by : selectedActionTask.user)
      : (selectedActionTask.isSharedTask ? selectedActionTask.task : selectedActionTask);
    const targetId = typeof target === 'object' ? target?.id : target;
    if (!targetId) return;
    try {
      await api.post('favorites/pin/', { type: kind, target_id: targetId, is_pinned: true });
      // Anclar implica favorito: refleja el cambio en las listas locales.
      if (kind === 'task') {
        setTasks(prev => prev.map(t => (t.id === targetId ? { ...t, is_favorited: true } : t)));
        setSharedTasks(prev => prev.map(s => (
          s.task?.id === targetId ? { ...s, task: { ...s.task, is_favorited: true } } : s
        )));
      } else {
        patchUserEverywhere(targetId, { is_favorited: true, is_following: true });
      }
      Alert.alert('Favorito anclado', 'Se colocó dentro de tus primeros 5 favoritos.');
    } catch (error) {
      const message = error.response?.data?.is_pinned?.[0] || 'No se pudo anclar este favorito.';
      Alert.alert('No se pudo anclar', message);
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

  // ⚡ GESTOR DE CACHÉ TANSTACK QUERY
  const queryClient = useQueryClient();


  // ─── Filtros activos como objeto (para React Query) ───────────────────────
  const activeFilters = useMemo(() => ({
    pch: tema,
    category: selectedCategory,
    status: selectedStatus,
    date_filter: selectedDateFilter,
    sort_by: selectedSortBy,
    favorites_only: selectedFavoritesOnly,
    favorite_users_only: selectedFavoriteUsersOnly,
    followed_users_only: selectedFollowedUsersOnly,
    verified_users_only: selectedVerifiedUsersOnly,
    recommended_users_only: selectedRecommendedUsersOnly,
  }), [tema, selectedCategory, selectedStatus, selectedDateFilter, selectedSortBy,
      selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedFollowedUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly]);

  // ─── React Query: Tareas ─────────────────────────────────────────────────
  const {
    data: tasksQueryData,
    isLoading: tasksQueryLoading,
    isFetchingNextPage: tasksFetchingMore,
    fetchNextPage: tasksFetchNext,
    hasNextPage: tasksHasNext,
    refetch: tasksRefetch,
    isRefetching: tasksRefetching,
  } = useTasksInfinite(activeFilters);

  // ─── React Query: Tareas compartidas ─────────────────────────────────────
  const {
    data: sharedQueryData,
    isFetchingNextPage: sharedFetchingMore,
    fetchNextPage: sharedFetchNext,
    hasNextPage: sharedHasNext,
    refetch: sharedRefetch,
    isRefetching: sharedRefetching,
  } = useSharedTasksInfinite(activeFilters);

  // ─── Estado local derivado de React Query ────────────────────────────────
  // Se mantiene para poder hacer actualizaciones optimistas en mutaciones
  // (like, share, delete, approve, verify) sin esperar round-trip al servidor.
  const freshTasks = useMemo(
    () => tasksQueryData?.pages?.flatMap(p => p.results ?? (Array.isArray(p) ? p : [])) ?? [],
    [tasksQueryData]
  );
  const freshSharedTasks = useMemo(
    () => sharedQueryData?.pages?.flatMap(p => p.results ?? (Array.isArray(p) ? p : [])) ?? [],
    [sharedQueryData]
  );

  // Sincronizar con estado local al recibir datos frescos del servidor
  useEffect(() => {
    setTasks(freshTasks);
    const sections = {};
    freshTasks.forEach(t => { sections[t.id] = visibleSections[t.id] || 'subtasks'; });
    setVisibleSections(prev => ({ ...sections, ...prev }));
  }, [freshTasks]);

  useEffect(() => {
    setSharedTasks(freshSharedTasks);
  }, [freshSharedTasks]);

  // Estado de loading unificado
  const loading = tasksQueryLoading;
  const isOnline = useIsOnline();
  const loadingMore = tasksFetchingMore || sharedFetchingMore;
  const refreshing = tasksRefetching || sharedRefetching;
  const hasMore = tasksHasNext ?? false;
  const sharedHasMore = sharedHasNext ?? false;

  const loadMoreTasks = useCallback(() => {
    if (tasksHasNext && !tasksFetchingMore) tasksFetchNext();
    if (sharedHasNext && !sharedFetchingMore) sharedFetchNext();
  }, [tasksHasNext, tasksFetchingMore, tasksFetchNext, sharedHasNext, sharedFetchingMore, sharedFetchNext]);

  // Refresh al enfocar la pantalla (solo revalida, no spinner)
  useFocusEffect(useCallback(() => {
    tasksRefetch();
    sharedRefetch();
  }, [tema, selectedCategory, selectedStatus, selectedDateFilter, selectedSortBy,
      selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedFollowedUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly]));

  const onRefresh = useCallback(() => {
    tasksRefetch();
    sharedRefetch();
  }, [tasksRefetch, sharedRefetch]);

  // Aplicar filtros del FilterModal — invalida queries para forzar refetch
  const applyFilters = useCallback((newFilters) => {
    setSelectedCategory(newFilters.category ?? '');
    setSelectedStatus(newFilters.status ?? '');
    setSelectedDateFilter(newFilters.date_filter ?? '');
    setSelectedSortBy(newFilters.sort_by ?? 'all');
    setSelectedFavoritesOnly(newFilters.favorites_only ?? false);
    setSelectedFavoriteUsersOnly(newFilters.favorite_users_only ?? false);
    setSelectedFollowedUsersOnly(newFilters.followed_users_only ?? false);
    setSelectedVerifiedUsersOnly(newFilters.verified_users_only ?? false);
    setSelectedRecommendedUsersOnly(newFilters.recommended_users_only ?? false);
    setFilterModalVisible(false);
  }, []);


  const fetchSearchResults = useCallback(async (query) => {
    const normalizedQuery = query.trim();

    const cacheKey = JSON.stringify({
      query: normalizedQuery.toLowerCase(),
      scope: searchScope,
      tema,
      category: searchCategory,
      status: searchStatus,
      dateFilter: selectedDateFilter,
      sortBy: selectedSortBy,
      favoritesOnly: selectedFavoritesOnly,
      favoriteUsersOnly: selectedFavoriteUsersOnly,
      followedUsersOnly: selectedFollowedUsersOnly,
      verifiedUsersOnly: selectedVerifiedUsersOnly,
      recommendedUsersOnly: selectedRecommendedUsersOnly,
    });
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setSearchTasks(cached.tasks);
      setSearchSharedTasks(cached.sharedTasks);
      return;
    }

    setSearchLoading(true);
    try {
      if (searchScope !== 'tasks') {
        const directoryResponse = await api.get('search/directory/', {
          params: { q: normalizedQuery, scope: searchScope },
        });
        setSearchDirectoryProfiles(directoryResponse.data?.profiles || []);
      } else {
        setSearchDirectoryProfiles([]);
      }
      const params = {
        page: 1,
        pch: tema,
        category: searchCategory,
        search: normalizedQuery,
        status: searchStatus,
        date_filter: selectedDateFilter,
        sort_by: selectedSortBy,
        favorites_only: selectedFavoritesOnly,
        favorite_users_only: selectedFavoriteUsersOnly,
        followed_users_only: selectedFollowedUsersOnly,
        verified_users_only: selectedVerifiedUsersOnly,
        recommended_users_only: selectedRecommendedUsersOnly,
      };
      const [tasksResponse, sharedResponse] = searchScope === 'profiles'
        ? [{ data: [] }, { data: [] }]
        : await Promise.all([
          api.get('tasks/', { params }),
          api.get('shared-tasks/', { params }),
        ]);
      const result = {
        tasks: tasksResponse.data.results ?? tasksResponse.data ?? [],
        sharedTasks: sharedResponse.data.results ?? sharedResponse.data ?? [],
      };
      searchCacheRef.current.set(cacheKey, result);
      if (searchCacheRef.current.size > 20) {
        const oldestKey = searchCacheRef.current.keys().next().value;
        searchCacheRef.current.delete(oldestKey);
      }
      setSearchTasks(result.tasks);
      setSearchSharedTasks(result.sharedTasks);
    } catch (error) {
      console.error('[TasksScreen] Error buscando en el feed independiente:', error.response?.data || error.message);
      setSearchTasks([]);
      setSearchSharedTasks([]);
    } finally {
      setSearchLoading(false);
    }
  }, [tema, searchCategory, searchStatus, selectedDateFilter, selectedSortBy, selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedFollowedUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly, searchScope]);

  useEffect(() => {
    if (!searchExpanded || !searchHasStarted) return undefined;
    const timer = setTimeout(() => fetchSearchResults(searchText), 300);
    return () => clearTimeout(timer);
  }, [fetchSearchResults, searchExpanded, searchHasStarted, searchText, searchCategory]);



  const normalizeCategoryValue = (value) => String(value || '').trim().replace(/\s+/g, ' ');
  const searchCategoryPath = searchCategory.split(',').map(normalizeCategoryValue).filter(Boolean);
  const activeCategoryPath = searchExpanded
    ? searchCategoryPath
    : selectedCategory.split(',').map(normalizeCategoryValue).filter(Boolean);
  const categoriesWithSelectedSearchPath = useMemo(() => {
    const source = Array.isArray(availableCategories) ? [...availableCategories] : [];
    const paths = [
      activeCategoryPath,
      ...searchCustomPaths.filter(path => path.join(',').toLowerCase() !== activeCategoryPath.join(',').toLowerCase()),
    ];
    paths.forEach(path => {
      let parentId = null;
      path.forEach((name, level) => {
        const existing = source.find(category => (
          normalizeCategoryValue(category?.name).toLowerCase() === name.toLowerCase() &&
          (category?.parent == null ? null : String(category.parent)) === (parentId == null ? null : String(parentId))
        ));
        if (existing) {
          parentId = existing.id;
          return;
        }

        const customId = `search-category-${level}-${name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
        source.push({
          id: customId,
          name,
          parent: parentId,
          isSearchCategory: true,
          searchPath: path.slice(0, level + 1),
        });
        parentId = customId;
      });
    });
    return source;
  }, [availableCategories, activeCategoryPath.join(','), searchCustomPaths]);
  const applySearchCategory = useCallback((rawValue) => {
    const value = normalizeCategoryValue(rawValue);
    if (!value) return;
    setSearchHasStarted(true);
    const path = searchCategory.split(',').map(normalizeCategoryValue).filter(Boolean);
    const level = searchCategoryPath.length
      ? Math.min(Math.max(searchCategoryLevel, 0), searchCategoryPath.length - 1)
      : -1;
    const base = level >= 0 ? path.slice(0, level + 1) : path;
    const nextPath = base.some(item => item.toLowerCase() === value.toLowerCase())
      ? base
      : [...base, value];
    setSearchCategory(nextPath.join(','));
    setSearchCategoryLevel(nextPath.length - 1);
    setSearchCustomPaths(previous => (
      previous.some(path => path.join(',').toLowerCase() === nextPath.join(',').toLowerCase())
        ? previous
        : [...previous, nextPath]
    ));
  }, [searchCategory, searchCategoryLevel, searchCategoryPath.length]);

  const openSearch = () => {
    mainFeedScrollOffsetRef.current = feedScrollOffsetRef.current;
    const path = selectedCategory.split(',').map(normalizeCategoryValue).filter(Boolean);
    setSearchCategory(path.join(','));
    setSearchCategoryLevel(path.length - 1);
    setSearchStatus(selectedStatus);
    setSearchHasStarted(false);
    setSearchExpanded(true);
  };

  const closeSearch = () => {
    setSearchText('');
    setSearchExpanded(false);
    setSearchCategory('');
    setSearchCategoryLevel(-1);
    setSearchStatus('');
    setSearchHasStarted(false);
    setSearchTasks([]);
    setSearchSharedTasks([]);
  };

  useEffect(() => {
    if (searchExpanded) return undefined;
    const restoreScroll = () => {
      if (resetMainFeedOnCloseRef.current) {
        feedListRef.current?.scrollToOffset({ offset: 0, animated: false });
        feedScrollOffsetRef.current = 0;
        mainFeedScrollOffsetRef.current = 0;
        resetMainFeedOnCloseRef.current = false;
        return;
      }
      feedListRef.current?.scrollToOffset({
        offset: mainFeedScrollOffsetRef.current,
        animated: false,
      });
      feedScrollOffsetRef.current = mainFeedScrollOffsetRef.current;
    };
    const interaction = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      });
    });
    return () => interaction.cancel();
  }, [searchExpanded]);

  const applySearchToMainFilter = () => {
    const nextCategory = searchCategory;
    resetMainFeedOnCloseRef.current = true;
    setSelectedCategory(nextCategory);
    setSelectedStatus(searchStatus);




    closeSearch();
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

      // 3. Sincronización silenciosa con la respuesta del servidor y la caché de TanStack Query.
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
      console.error('[TasksScreen] Error liking shared task:', error.response?.data || error.message);
      onRefresh(); // Revertir si hay error
    }
  };

  const handleCommentSharedTask = (sharedTaskId) => {
    navigation.navigate('SharedTaskDetail', { sharedTaskId });
  };

  const categoryPathRank = (item, categoryPath) => {
    const requested = String(categoryPath || '')
      .split(',')
      .map(value => normalizeCategoryValue(value).toLowerCase())
      .filter(Boolean)
      .join(',');
    if (!requested) return 0;

    const categories = String(
      item.feedType === 'shared' ? item.task?.categories : item.categories
    )
      .split(',')
      .map(value => normalizeCategoryValue(value).toLowerCase())
      .filter(Boolean)
      .join(',');
    if (categories === requested) return 0;
    if (categories.startsWith(`${requested},`)) return 1;
    return 2;
  };

  // Cargar más al llegar al final del feed (delegado a useInfiniteQuery)
  const handleLoadMore = useCallback(() => {
    if (searchExpanded) return;
    loadMoreTasks();
  }, [searchExpanded, loadMoreTasks]);


  const changeSection = (taskId, section) => {
    setVisibleSections(prev => ({ ...prev, [taskId]: section }));
  };

  const feedItems = React.useMemo(() => {
    const plainTasks = tasks.map((task) => ({ ...task, feedType: 'task' }));
    const sharedItems = sharedTasks.map((shared) => ({ ...shared, feedType: 'shared' }));
    const combined = dedupeFeedItems([...plainTasks, ...sharedItems]);

    const categoryOrder = selectedCategory
      ? (a, b) => categoryPathRank(a, selectedCategory) - categoryPathRank(b, selectedCategory)
      : () => 0;
    switch (selectedSortBy) {
      case 'likes':
        return combined.sort((a, b) => (
          categoryOrder(a, b)
          || (b.likes_count || 0) - (a.likes_count || 0)
        ));
      case 'top_day':
      case 'top_week':
      case 'top_month':
        return combined.sort((a, b) => (
          categoryOrder(a, b)
          || (b.period_likes_count || 0) - (a.period_likes_count || 0)
          || new Date(b.created_at) - new Date(a.created_at)
        ));
      case 'recent':
        return combined.sort((a, b) => (
          categoryOrder(a, b)
          || new Date(b.created_at) - new Date(a.created_at)
        ));
      case 'all':
      default:
        // Para 'all', simplemente combinamos y dejamos que el orden de la API (que ya es por fecha) prevalezca.
        // Opcionalmente, se puede re-ordenar por fecha si la combinación desordena.
        return combined.sort((a, b) => (
          categoryOrder(a, b)
          || new Date(b.created_at) - new Date(a.created_at)
        ));
    }
  }, [selectedCategory, selectedSortBy, tasks, sharedTasks]);

  const searchFeedItems = React.useMemo(() => {
    const plainTasks = searchTasks.map(task => ({ ...task, feedType: 'task' }));
    const sharedItems = searchSharedTasks.map(shared => ({ ...shared, feedType: 'shared' }));
    return dedupeFeedItems([...plainTasks, ...sharedItems]).sort((a, b) => (
      categoryPathRank(a, searchCategory)
      || (selectedSortBy === 'likes'
        ? (b.likes_count || 0) - (a.likes_count || 0)
        : ['top_day', 'top_week', 'top_month'].includes(selectedSortBy)
        ? (b.period_likes_count || 0) - (a.period_likes_count || 0)
          || new Date(b.created_at) - new Date(a.created_at)
        : new Date(b.created_at) - new Date(a.created_at))
    ));
  }, [searchCategory, searchSharedTasks, searchTasks, selectedSortBy]);

  const displayedFeedItems = searchExpanded && searchHasStarted ? searchFeedItems : feedItems;
  const showTopicTops = route?.name === 'HomeMain'
    && !searchExpanded
    && !tema
    && !selectedCategory
    && !selectedStatus
    && !selectedDateFilter
    && !selectedFavoriteUsersOnly
    && !selectedFollowedUsersOnly
    && !selectedVerifiedUsersOnly
    && !selectedRecommendedUsersOnly
    && ['all', 'recent'].includes(selectedSortBy);
  const filteredTasks = displayedFeedItems.filter((item) => {
    if (searchExpanded && searchHasStarted) return true;
    const title = item.feedType === 'shared' ? item.task?.title : item.title;
    const description = item.feedType === 'shared'
      ? (item.description || item.task?.description)
      : item.description;

    const matchesSearch = (
      title?.toLowerCase().includes(searchText.toLowerCase()) ||
      description?.toLowerCase().includes(searchText.toLowerCase())
    );

    // Category, status and user/profile filters are authoritative in the
    // backend. Keeping only the local text search avoids divergent behavior
    // between paginated results and profile feeds.
    return matchesSearch;
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
          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('SharedTaskDetail', { sharedTaskId: shared.id })}>
            <LinkifiedText style={styles.sharedDescription} text={shared.description} />
          </TouchableOpacity>
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
                    showHeart={false}
                  />
              </View><Text style={{ fontSize: 12, color: '#999' }}>• {moment(task.created_at).fromNow()}</Text>
              </View>
            </View>
            <FollowHeart userId={task.user?.id} username={getAuthorName(task)} size={20} style={{ marginRight: 10 }} />
            <TouchableOpacity onPress={() => openActionModal({ ...task, isSharedTask: false })}>
              <Ionicons name="ellipsis-vertical" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('SharedTaskDetail', { sharedTaskId: shared.id })}>
            <LinkifiedText style={styles.taskDescription} text={task.description} />

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

          </TouchableOpacity>

          {/* Mismo contenido que una publicación normal (pestañas + carrusel con imágenes y videos).
              feedItemId = id del item en el FlatList (la compartida) para el autoplay por visibilidad. */}
          <TaskSections
            task={task}
            tema={tema}
            carouselWidth={carouselWidth - 28}
            section={visibleSections[shared.id] || 'subtasks'}
            onChangeSection={(nextSection) => changeSection(shared.id, nextSection)}
            feedItemId={shared.id}
            onShareSubItemToStory={handleShareSubItemToStory}
            onOpenSubMediaInReels={openSubMediaInReels}
          />
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

            <PetitionSupportStat task={task} navigation={navigation} />
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

    return (
      <TaskPostCard
        task={item}
        navigation={navigation}
        tema={tema}
        carouselWidth={carouselWidth}
        currentSection={currentSec}
        onChangeSection={changeSection}
        onAvatarPress={handleShowProfileLikes}
        onOpenActions={openActionModal}
        onOpenDetail={(task) => navigation.navigate('TaskDetail', { taskId: task.id })}
        onRepost={handleRepost}
        onLike={handleLikeTask}
        onShowLikes={handleShowTaskLikes}
        onPressComments={(task) => navigation.navigate('TaskDetail', { taskId: task.id })}
        onShare={handleOpenShareActionMenu}
        onShowShares={handleShowTaskShares}
        onShareSubItemToStory={handleShareSubItemToStory}
        onOpenSubMediaInReels={openSubMediaInReels}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.feedRoot}>
      <View style={styles.collapsingHeader} pointerEvents="box-none">
      {/* Titulo fijo: siempre visible (Inicio/Tareas, buscar, filtrar, crear) */}
      <View style={styles.fixedTitle} onLayout={(e) => setTitleH(e.nativeEvent.layout.height)}>
      {searchExpanded ? (
        <View style={styles.searchHeader}>
          <View style={styles.searchHeaderRow}>
            <View style={styles.searchInputHost}>
              <View style={styles.searchContainer}>
                <Ionicons name="search-outline" size={20} color="#666" />
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={value => {
                    setSearchText(value);
                    if (value.trim()) setSearchHasStarted(true);
                  }}
                  autoFocus
                  returnKeyType="search"
                  onSubmitEditing={() => applySearchCategory(searchText)}
                  placeholder="Buscar"
                  placeholderTextColor="#777"
                  accessibilityLabel="Buscar"
                />
                <TouchableOpacity
                  onPress={() => setSearchText('')}
                  accessibilityLabel="Limpiar búsqueda"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color="#777" />
                </TouchableOpacity>
              </View>
              {searchLoading ? <ActivityIndicator style={styles.searchLoading} size="small" color="#4dabf7" /> : null}
            </View>
            <TouchableOpacity style={styles.applySearchButton} onPress={applySearchToMainFilter}>
              <Text style={styles.applySearchButtonText}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.searchCloseButton}
              onPress={closeSearch}
              accessibilityLabel="Salir de la búsqueda"
            >
              <Ionicons name="close" size={25} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchScopeRow}>
            {[
              ['both', 'Ambos'],
              ['tasks', 'Tareas'],
              ['profiles', 'Perfiles'],
            ].map(([scope, label]) => (
              <TouchableOpacity
                key={scope}
                style={[styles.searchScopeButton, searchScope === scope && styles.searchScopeButtonActive]}
                onPress={() => {
                  setSearchScope(scope);
                  setSearchHasStarted(Boolean(searchText.trim()));
                }}
              >
                <Text style={[styles.searchScopeText, searchScope === scope && styles.searchScopeTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {searchScope !== 'tasks' && searchDirectoryProfiles.length > 0 ? (
            <View style={styles.directoryResults}>
              {searchDirectoryProfiles.slice(0, 5).map((profile) => (
                <TouchableOpacity
                  key={profile.id}
                  style={styles.directoryResult}
                  onPress={() => navigation.navigate('UserProfile', {
                    userId: profile.id,
                    userName: profile.username || profile.name,
                    userAvatar: getImageUrl(profile.user_image),
                  })}
                >
                  <Ionicons name="person-circle-outline" size={20} color="#4dabf7" />
                  <Text style={styles.directoryResultText} numberOfLines={1}>
                    {profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Perfil'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerIdentity}>
            <Text style={styles.headerTitle}>
              {isTasksTab ? 'Tareas' : 'Inicio'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={openSearch}>
              <Ionicons name="search-outline" size={24} color="#4dabf7" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setFilterModalVisible(true)}>
              <Ionicons name="options-outline" size={24} color="#4dabf7" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateTask', { initialPch: tema })}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      </View>

      {/* Zona movil: historias, temas y categorias se deslizan por debajo del titulo fijo */}
      <Animated.View style={[styles.movingHeader, { transform: [{ translateY: headerTranslateY }] }]}>
      <View onLayout={(e) => setCollapsibleH(e.nativeEvent.layout.height)}>
      {!searchExpanded ? <StoriesBar navigation={navigation} /> : null}

      <View style={styles.temaSelector}>
        {[
          { value: 'consejos', label: 'CONSEJOS' },
          { value: 'peticiones', label: 'PETICIONES' },
          { value: 'historias', label: 'HISTORIAS' },
        ].map(({ value, label }) => (
          <TouchableOpacity
            key={value || 'all'}
            style={[styles.temaBadge, tema === value && styles.temaBadgeActive]}
            onPress={() => setTema(tema === value ? '' : value)}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.temaBadgeText, tema === value && styles.temaBadgeTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>


      </View>

      {/* Categorias: al deslizar hacia arriba reaparecen solas; arrastrandolas hacia abajo vuelve la zona superior */}
      <Animated.View onLayout={(e) => setStickyH(e.nativeEvent.layout.height)} style={[styles.stickyFilterZone, { transform: [{ translateY: stickyShiftY }] }]} {...filterPanResponder.panHandlers}>
      <CategoryHierarchy
        containerStyle={styles.stickyCategories}
        availableCategories={categoriesWithSelectedSearchPath}
        selectedCategoryPath={activeCategoryPath}
        onRemoveCategory={(value, level) => {
          if (value?.isSearchCategory && Array.isArray(value.searchPath)) {
            const removedPath = value.searchPath.join(',').toLowerCase();
            const isDescendant = path => {
              const normalizedPath = path.join(',').toLowerCase();
              return normalizedPath === removedPath || normalizedPath.startsWith(`${removedPath},`);
            };
            setSearchCustomPaths(previous => previous.filter(path => !isDescendant(path)));
            if (searchExpanded && isDescendant(searchCategoryPath)) {
              const nextPath = searchCategoryPath.slice(0, value.searchPath.length - 1);
              setSearchCategory(nextPath.join(','));
              setSearchCategoryLevel(nextPath.length - 1);
              if (!nextPath.length) setSearchHasStarted(true);
            } else if (!searchExpanded) {
              const selectedPath = selectedCategory.split(',').map(normalizeCategoryValue).filter(Boolean);
              if (isDescendant(selectedPath)) {
                const nextPath = selectedPath.slice(0, value.searchPath.length - 1);
                setSelectedCategory(nextPath.join(','));




              }
            }
            return;
          }
          if (searchExpanded) {
            const nextPath = searchCategoryPath.slice(0, level);
            setSearchCategory(nextPath.join(','));
            setSearchCategoryLevel(nextPath.length - 1);
            if (!nextPath.length) setSearchHasStarted(true);
          }
        }}
        showDescendants
        deselectable
        selectedStatus={searchExpanded ? searchStatus : selectedStatus}
        onStatusSelect={(status) => {
          if (searchExpanded) {
            setSearchStatus(status);
          } else {
            setSelectedStatus(status);




          }
        }}
        onSelect={(category) => {
          if (searchExpanded) {
            setSearchHasStarted(true);
            const nextPath = category.split(',').map(normalizeCategoryValue).filter(Boolean);
            setSearchCategory(nextPath.join(','));
            setSearchCategoryLevel(nextPath.length - 1);
          } else {
            setSelectedCategory(category);
          }
          if (category.split(',')[0].trim().toLowerCase() !== 'grabar podcast') {
            if (searchExpanded) {
              setSearchStatus('');
            } else {
              setSelectedStatus('');
            }
          }
          if (!searchExpanded) {


          }
        }}
      />

      {showPersonalFilter && (
        <PersonalCategoryFilter
          isOwner
          title="Mi filtro"
          excludeNames={availableCategories.map(cat => cat.name)}
          onSelect={(category) => {
            if (searchExpanded) {
              setSearchHasStarted(true);
              const nextPath = category.split(',').map(normalizeCategoryValue).filter(Boolean);
              setSearchCategory(nextPath.join(','));
              setSearchCategoryLevel(nextPath.length - 1);
            } else {
              setSelectedCategory(category);


            }
          }}
        />
      )}
        </Animated.View>
        </Animated.View>
      </View>

      <FeedVideoVisibilityContext.Provider value={feedVideoVisibility}>
      <FlatList
        ref={feedListRef}
        data={filteredTasks}
        // ✅ FIX: Usamos una clave única y consistente que previene duplicados.
        // Para un item compartido, usamos su propio ID, no el de la tarea anidada.
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderFeedItem}
        ListHeaderComponent={showTopicTops ? (
          <TopicTopSections
            navigation={navigation}
            onSelectTopic={(pch) => {
              setTema(pch);
              setSelectedSortBy('top_month');
              feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }}
          />
        ) : null}
        onViewableItemsChanged={onFeedViewableItemsChanged}
        viewabilityConfig={feedViewabilityConfig}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={titleH + collapsibleH + stickyH} />}
        onScroll={event => {
          const offset = event.nativeEvent.contentOffset.y;
          feedScrollOffsetRef.current = offset;
          updateHeaderCollapse(offset);
          if (!searchExpanded) {
            mainFeedScrollOffsetRef.current = offset;
          }
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.listContent, { paddingTop: titleH + collapsibleH + stickyH }]}
        
        // ⚡ LAS PROPS MÁGICAS DE RENDIMIENTO Y SCROLL INFINITO
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.7} // Carga más cuando falta el 70% de la pantalla
        removeClippedSubviews={Platform.OS === 'android'} // Mejora el uso de memoria en Android
        maxToRenderPerBatch={10} // Renderiza en lotes más pequeños
        windowSize={11} // Mantiene más items en memoria para un scroll suave
        initialNumToRender={8} // Carga inicial rápida
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 20 }} /> : null
        }
        ListEmptyComponent={
          loading ? null : isOnline ? (
            <View style={{ alignItems: 'center', marginTop: 50, paddingHorizontal: 24 }}>
              <Text style={{ textAlign: 'center', color: '#999' }}>
                No hay publicaciones para mostrar
              </Text>
            </View>
          ) : (
            <OfflineEmptyState onRetry={onRefresh} />
          )
        }
      />
      </FeedVideoVisibilityContext.Provider>
      </View>

      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        currentCategory={selectedCategory}
        currentStatus={selectedStatus}
        currentDateFilter={selectedDateFilter}
        currentSortBy={selectedSortBy}
        currentFavorites={selectedFavoritesOnly}
        currentFavoriteUsers={selectedFavoriteUsersOnly}
        currentFollowedUsers={selectedFollowedUsersOnly}
        currentVerifiedUsers={selectedVerifiedUsersOnly}
        currentRecommendedUsers={selectedRecommendedUsersOnly}
        // ✅ PASAMOS EL ESTADO DE ADMIN DIRECTAMENTE
        isSuperAdmin={isAdmin}
        // ✅ SOLUCIÓN: Pasamos las categorías como prop.
        availableCategories={availableCategories}
        // ⚡ PCH activo para que el modal muestre/cree categorías de este tema
        currentPch={tema}
        onApply={(filters) => {
          applyFilters(filters);
        }}
      />

      <Modal
        visible={favoriteVisibilityVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFavoriteVisibilityVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setFavoriteVisibilityVisible(false)}
        >
          <View style={styles.visibilityModal}>
            <Text style={styles.visibilityTitle}>Visibilidad de favoritos</Text>
            <Text style={styles.visibilityHint}>Decide qué listas pueden ver otros usuarios.</Text>
            {[
              ['profiles', 'Perfiles favoritos', favoriteProfilesPublic, setFavoriteProfilesPublic],
              ['tasks', 'Tareas favoritas', favoriteTasksPublic, setFavoriteTasksPublic],
            ].map(([type, label, enabled, setEnabled]) => (
              <TouchableOpacity
                key={type}
                style={styles.visibilityRow}
                onPress={async () => {
                  const next = !enabled;
                  setEnabled(next);
                  try {
                    await api.patch('categories/visibility/', {
                      [type === 'profiles' ? 'favorite_profiles_public' : 'favorite_tasks_public']: next,
                    });
                  } catch (error) {
                    setEnabled(enabled);
                    Alert.alert('No se pudo actualizar', 'Intenta nuevamente.');
                  }
                }}
              >
                <Ionicons name={enabled ? 'eye' : 'eye-off'} size={20} color={enabled ? '#1864ab' : '#868e96'} />
                <Text style={styles.visibilityLabel}>{label}</Text>
                <Text style={styles.visibilityValue}>{enabled ? 'Público' : 'Privado'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.visibilityClose}
              onPress={() => setFavoriteVisibilityVisible(false)}
            >
              <Text style={styles.visibilityCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
          followed_users_only: selectedFollowedUsersOnly,
          verified_users_only: selectedVerifiedUsersOnly,
          recommended_users_only: selectedRecommendedUsersOnly,
        }}
        onApplyFilter={applyFilters}
      />

      {/* MODAL DE LIKES */}
      <TieredLikesModal 
        visible={likesModalVisible} 
        onClose={() => setLikesModalVisible(false)} 
        apiUrl={likesModalUrl} 
        title={likesModalTitle}
      />

      {/* MODAL DE ACCIONES (3 PUNTOS): mismo menú completo que usan los detalles */}
      <TaskActionsModal
        visible={actionModalVisible}
        onClose={() => setActionModalVisible(false)}
        actionTask={selectedActionTask}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        canEdit={canEditSelectedTask}
        handlers={{
          toggleFavorite: handleToggleFavorite,
          pinFavorite: handlePinFavorite,
          share: () => { setActionModalVisible(false); handleOpenShareActionMenu(selectedActionTask); },
          viewShares: handleViewShares,
          directMessage: handleDirectMessage,
          goToForum: handleGoToForum,
          toggleFollow: handleToggleFollow,
          toggleProfileFavorite: handleToggleProfileFavorite,
          edit: handleEditTask,
          delete: handleDeleteTask,
          approvePodcast: handleApprovePodcast,
          toggleVerified: handleToggleVerified,
          toggleRecommended: handleToggleRecommended,
          toggleAppLike: handleToggleAppLike,
        }}
      />

      {/* MODAL: todas las veces que se compartió la publicación seleccionada */}
      <TaskSharesModal
        visible={Boolean(sharesModalTaskId)}
        onClose={() => setSharesModalTaskId(null)}
        items={sharesModalItems}
        loading={sharesFeed.loading}
        error={sharesFeed.error}
        onLoadMore={sharesFeed.loadMore}
        onRetry={sharesFeed.retry}
        renderItem={({ item }) => renderSharedItemCard(item)}
      />

      {/* Nuevo Menú Modal de Acciones para Compartir */}
      <ShareActionMenu
        isVisible={isActionMenuVisible}
        onClose={handleCloseShareActionMenu}
        onShare={handleOpenShareDescriptionModal} // Abre el modal de descripción
        onSendMessage={handleOpenTaskMessageShare}
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
  feedRoot: { flex: 1, overflow: 'hidden' },
  stickyFilterZone: { backgroundColor: '#FEF6F5', paddingTop: 6, paddingBottom: 4 },
  stickyCategories: { marginTop: 0, marginBottom: 0 },
  collapsingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  fixedTitle: { zIndex: 2, backgroundColor: '#fff' },
  movingHeader: { zIndex: 1, backgroundColor: '#FEF6F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 34, paddingBottom: 8, backgroundColor: '#fff' },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerMenuButton: { padding: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#333' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  createBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },
  visibilityModal: { width: '88%', maxWidth: 420, padding: 20, borderRadius: 18, backgroundColor: '#fff' },
  visibilityTitle: { color: '#212529', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  visibilityHint: { color: '#868e96', fontSize: 13, marginBottom: 14 },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f3f5', gap: 10 },
  visibilityLabel: { flex: 1, color: '#343a40', fontSize: 14 },
  visibilityValue: { color: '#868e96', fontSize: 12, fontWeight: '600' },
  visibilityClose: { alignSelf: 'flex-end', marginTop: 14, paddingHorizontal: 12, paddingVertical: 8 },
  visibilityCloseText: { color: '#1864ab', fontWeight: '700' },
  searchHeader: { paddingHorizontal: 12, paddingTop: 34, paddingBottom: 12, backgroundColor: '#fff', gap: 8 },
  searchHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInputHost: { flex: 1, minWidth: 0 },
  searchLoading: { position: 'absolute', right: 42, top: 26 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#f8f9fa', borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  searchCloseButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  applySearchButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1864ab' },
  applySearchButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchScopeRow: { flexDirection: 'row', gap: 8 },
  searchScopeButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f1f3f5' },
  searchScopeButtonActive: { backgroundColor: '#d0ebff' },
  searchScopeText: { color: '#495057', fontSize: 12, fontWeight: '600' },
  searchScopeTextActive: { color: '#1864ab' },
  directoryResults: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  directoryResult: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: '#f8f9fa' },
  directoryResultText: { maxWidth: 140, color: '#343a40', fontSize: 12 },
  searchInput: { 
    flex: 1, 
    height: 45, 
    marginLeft: 8,
    // ⚡ FIX: Aseguramos que el input sea usable en web
    outlineStyle: 'none',
    borderWidth: 0,
  },
  temaSelector: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 10 },
  temaBadge: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 12, borderRadius: 22, backgroundColor: '#eee' },
  temaBadgeActive: { backgroundColor: '#333' },
  temaBadgeText: { fontSize: 13, fontWeight: 'bold', color: '#666' },
  temaBadgeTextActive: { color: '#fff' },
  allCategoriesButton: { alignSelf: 'flex-start', marginHorizontal: 16, marginBottom: 6, paddingVertical: 6 },
  allCategoriesText: { color: '#1864ab', fontSize: 13, fontWeight: '600' },
  categorySearchContainer: { paddingHorizontal: 12, marginBottom: 8 },
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
  subImage: { width: '100%', height: 240, marginTop: 12, borderRadius: 14, backgroundColor: '#f1f3f5' },
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
