import React, { useState, useCallback, useRef, useEffect, useMemo, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, Dimensions, Platform, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../App'; // ✅ IMPORTAMOS EL CONTEXTO
import SideMenu from '../components/SideMenu';
import api, { getImageUrl, subscribeRelationsChange } from '../api';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS } from 'react-native-reanimated';
import FilterModal from '../components/FilterModal';
import OfflineEmptyState from '../components/OfflineEmptyState';
import { useIsOnline } from '../hooks/useIsOnline';
import { useReelsInfinite } from '../hooks/useApi';
import { buildReelsFromPages } from '../utils/reelsPages';
import TieredLikesModal from './TieredLikesModal';
import { makeTierCounts } from '../utils/likeTiers';
import ReelItem from './ReelItem'; 
import TaskActionsModal from '../components/TaskActionsModal';
import useTaskActions from '../hooks/useTaskActions';
import { optimisticRepost, repostFromResponse, repostSnapshot } from '../utils/repost';

const REELS_VIDEOS_ONLY_KEY = 'reels.videosOnly';

// ✅ FIX: Se mueven las funciones de vuelta aquí para evitar el error de "Module not found".
const cleanVal = (v) => (v ? String(v).trim() : null);

const uniq = (arr) => {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const c = cleanVal(v);
    if (!c) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
};

const { buildPlaylists, getFirstMediaAnywhere } = require('./reelUtils');

// Autor que se ve en el reel: en uno compartido, quien creó el contenido (no quien lo compartió).
const getReelAuthorId = (reel) => (reel?.is_original ? reel?.user?.id : reel?.task?.user?.id) || null;

const { height: windowHeight, width: windowWidth } = Dimensions.get('window');

const getSharedByAvatarSrc = (t) => {
  const pick = (obj) => {
    if (!obj) return null;
    const candidates = [
      obj?.user_image, obj?.user_image_url, obj?.avatar, obj?.avatar_url, obj?.image,
      obj?.image_url, obj?.profile_image, obj?.photo, obj?.picture, obj?.user?.user_image,
      obj?.user?.avatar, obj?.user?.image, obj?.profile?.image, obj?.profile?.avatar,
    ];
    const found = candidates.map(cleanVal).find(Boolean);
    return found ? getImageUrl(found) : null;
  };

  const direct = pick(t?.shared_by) || pick(t?.sharedBy);
  if (direct) return direct;

  const list = (Array.isArray(t?.shared_by_list) && t.shared_by_list) || (Array.isArray(t?.sharedByList) && t.sharedByList) || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const img = pick(list[i]);
    if (img) return img;
  }

  const st = Array.isArray(t?.shared_tasks) ? t.shared_tasks : [];
  for (let i = st.length - 1; i >= 0; i--) {
    const img = pick(st[i]);
    if (img) return img;
  }

  return null;
};

const getSharedByInfo = (t) => {
  const favoriteSharedBy = t?.favorite_shared_by || t?.task?.favorite_shared_by || null;
  const favoriteSharedByList = (Array.isArray(t?.favorite_shared_by_list) && t.favorite_shared_by_list) || (Array.isArray(t?.task?.favorite_shared_by_list) && t.task.favorite_shared_by_list) || [];
  const favoriteSharersCount = t?.favorite_sharers_count ?? t?.task?.favorite_sharers_count ?? favoriteSharedByList.length;

  if (!favoriteSharedBy) {
    return null;
  }

  return {
    userId: favoriteSharedBy?.id || favoriteSharedBy?.user?.id || favoriteSharedBy?.profile?.id || null,
    name: cleanVal(favoriteSharedBy?.username) || cleanVal(favoriteSharedBy?.user?.username) || cleanVal(favoriteSharedBy?.first_name) || 'Usuario',
    description: cleanVal(favoriteSharedBy?.description) || null,
    avatar: getSharedByAvatarSrc({ shared_by_list: [favoriteSharedBy] }),
    favoriteSharersCount,
  };
};

const ReelRenderer = React.memo(({ item, index, activeIndex, isFocused, isMuted, paused, setPaused, selectedReelId, handleReelTap, isUIVisible, expandedDescriptions, toggleDescription, viewStateById, sharedOpenById, toggleSharedBy, getSharedByInfo, cycleViewOnly, cycleClipWithinView, navigateClip, toggleLike, likeAnimation, navigation, toggleFavorite, handleRepost, handleShowLikes, handleShowFollowers, openActionModal, tema, taskLikesById, followersById, pageHeight }) => {
  const tapToPause = Gesture.Tap()
    .maxDuration(250)
    .onEnd((event, success) => {
      if (success) {
        const touchX = event.absoluteX;
        const rightSideThreshold = windowWidth - 80;
        if (touchX < rightSideThreshold) {
          runOnJS(handleReelTap)(item);
        }
      }
    });

  const flingRight = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => {
    runOnJS(navigateClip)(item, -1);
  });

  const flingLeft = Gesture.Fling().direction(Directions.LEFT).onEnd(() => {
    runOnJS(navigateClip)(item, 1);
  });

  const composedGesture = Gesture.Exclusive(
    Gesture.Race(flingLeft, flingRight),
    tapToPause
  );

  // ✅ LÓGICA DE ENRIQUECIMIENTO: Se mueve aquí para que cada item se actualice correctamente.
  const enrichedItem = useMemo(() => ({
    ...item,
    taskLikes: taskLikesById[item.task?.id || item.id],
    followers: followersById[getReelAuthorId(item)],
  }), [item, taskLikesById, followersById]);

  return (
    // ✅ FIX: Se elimina el GestureDetector duplicado que causaba el error de sintaxis.
    <GestureDetector gesture={composedGesture}>
      <View style={{ width: windowWidth, height: pageHeight }}>
      <ReelItem
        item={item}
        enrichedItem={enrichedItem}
        index={index}
        isActive={isFocused && index === activeIndex}
        isMuted={isMuted}
        paused={paused}
        setPaused={setPaused}
        selectedReelId={selectedReelId}
        isUIVisible={isUIVisible}
        expandedDescriptions={expandedDescriptions}
        toggleDescription={toggleDescription}
        viewStateById={viewStateById}
        sharedOpenById={sharedOpenById}
        toggleSharedBy={toggleSharedBy}
        getSharedByInfo={getSharedByInfo}
        cycleViewOnly={cycleViewOnly}
        cycleClipWithinView={cycleClipWithinView}
        navigateClip={navigateClip}
        toggleLike={toggleLike}
        likeAnimation={likeAnimation}
        navigation={navigation}
        toggleFavorite={toggleFavorite}
        handleRepost={handleRepost}
        handleShowLikes={handleShowLikes}
        handleShowFollowers={handleShowFollowers}
        openActionModal={openActionModal}
        taskLikesById={taskLikesById}
        tema={tema}
      />
      </View>
    </GestureDetector>
  );
});

const ReelsScreen = ({ route }) => {
  const { user, signOut, isAdmin: isAdminFromContext } = useContext(AuthContext);
  const [isAdmin, setIsAdmin] = useState(isAdminFromContext);
  const currentUserId = user?.id;
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const isOnline = useIsOnline();
  const [reels, setReels] = useState([]);
  const repostInFlightRef = useRef(new Set());
  const [tema, setTema] = useState('consejos');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted] = useState(false);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl, setLikesModalUrl] = useState('');
  const [likesModalTitle, setLikesModalTitle] = useState('Usuarios');
  const [initialTier, setInitialTier] = useState('all');
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [viewStateById, setViewStateById] = useState({});
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedActionTask, setSelectedActionTask] = useState(null);
  const [paused, setPaused] = useState(false);
  const [selectedReelId, setSelectedReelId] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSortBy, setSelectedSortBy] = useState('recent');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedFavoritesOnly, setSelectedFavoritesOnly] = useState(false);
  const [selectedFavoriteUsersOnly, setSelectedFavoriteUsersOnly] = useState(false);
  const [selectedFollowedUsersOnly, setSelectedFollowedUsersOnly] = useState(false);
  const [selectedVerifiedUsersOnly, setSelectedVerifiedUsersOnly] = useState(false);
  const [selectedRecommendedUsersOnly, setSelectedRecommendedUsersOnly] = useState(false);
  const [selectedVideosOnly, setSelectedVideosOnly] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(REELS_VIDEOS_ONLY_KEY)
      .then((value) => {
        if (mounted) setSelectedVideosOnly(value === null ? true : value === 'true');
      })
      .catch((error) => {
        console.error('[ReelsScreen] No se pudo cargar la preferencia de solo videos:', error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isAdminFromContext !== undefined && isAdminFromContext !== null) {
      setIsAdmin(isAdminFromContext);
      return;
    }

    const verifyAdminStatus = async () => {
      try {
        const response = await api.get('verify-admin/');
        setIsAdmin(Boolean(response.data?.is_admin || response.data?.is_staff));
      } catch (error) {
        console.error('[ReelsScreen] Error verificando permisos de administrador:', error.response?.data || error);
        setIsAdmin(false);
      }
    };

    verifyAdminStatus();
  }, [isAdminFromContext]);

  const [sharedOpenById, setSharedOpenById] = useState({});
  const flatListRef = useRef(null);
  const [isUIVisible, setIsUIVisible] = useState(true);

  const [taskLikesById, setTaskLikesById] = useState({});
  const taskLikesCacheRef = useRef({});
  const [followersById, setFollowersById] = useState({});
  const followersCacheRef = useRef({});
  const handledMediaRequestRef = useRef(null);
  const getReelTaskId = useCallback((reel) => reel?.task?.id || reel?.id || null, []);

  useEffect(() => {
    const targetTaskId = route?.params?.openTaskId;
    const targetMediaSrc = route?.params?.openMediaSrc;
    const requestId = route?.params?.openMediaRequestId;
    if (!targetTaskId || !targetMediaSrc || !requestId || reels.length === 0) return;
    if (handledMediaRequestRef.current === requestId) return;

    const targetIndex = reels.findIndex((reel) => String(getReelTaskId(reel)) === String(targetTaskId));
    if (targetIndex < 0) return;

    const targetContent = reels[targetIndex].is_original ? reels[targetIndex] : reels[targetIndex].task;
    const targetPlaylist = buildPlaylists(targetContent).main;
    const targetPosition = targetPlaylist.findIndex((entry) => (
      String(getImageUrl(entry.src)) === String(getImageUrl(targetMediaSrc))
    ));
    if (targetPosition < 0) return;

    setActiveIndex(targetIndex);
    setViewStateById((previous) => ({
      ...previous,
      [reels[targetIndex].id]: { mode: 'main', pos: targetPosition },
    }));
    handledMediaRequestRef.current = requestId;
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({ index: targetIndex, animated: false });
    });
  }, [route?.params?.openTaskId, route?.params?.openMediaSrc, route?.params?.openMediaRequestId, reels, getReelTaskId]);

  // ── Feed de reels (React Query) ────────────────────────────────────────────
  // La clave de la query incluye tema y filtros: cambiarlos dispara la carga
  // solo (y deja en caché cada combinación). Los reels se mantienen además en
  // estado local (`reels`) porque las acciones optimistas (like, favorito,
  // borrar…) los modifican directamente; el servidor es la fuente de verdad
  // cada vez que llegan datos nuevos.
  const reelsParams = useMemo(() => ({
    pch: tema,
    category: selectedCategory,
    date_filter: selectedDateFilter,
    sort_by: selectedSortBy,
    favorites_only: selectedFavoritesOnly,
    favorite_users_only: selectedFavoriteUsersOnly,
    followed_users_only: selectedFollowedUsersOnly,
    verified_users_only: selectedVerifiedUsersOnly,
    recommended_users_only: selectedRecommendedUsersOnly,
  }), [tema, selectedCategory, selectedDateFilter, selectedSortBy, selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedFollowedUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly]);

  const reelsQuery = useReelsInfinite(reelsParams);
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchReels,
  } = reelsQuery;
  const loading = reelsQuery.isLoading;
  const loadError = reelsQuery.isError && !reelsQuery.data;

  // ✅ Solo publicaciones (originales o compartidas) con algún medio.
  const serverReels = useMemo(
    () => buildReelsFromPages(
      reelsQuery.data,
      getFirstMediaAnywhere,
      selectedVideosOnly
        ? (content) => buildPlaylists(content).main.some((entry) => entry.type === 'video')
        : undefined
    ),
    [reelsQuery.data, selectedVideosOnly]
  );
  useEffect(() => {
    setReels(serverReels);
  }, [serverReels]);

  const fetchTaskLikesSummary = useCallback(async (taskId) => {
    if (!taskId || taskLikesCacheRef.current[taskId]?.status) return;
    taskLikesCacheRef.current[taskId] = { status: "loading" };
    setTaskLikesById(prev => ({ ...prev, [taskId]: { status: "loading", counts: prev[taskId]?.counts || null, viewer_has_liked: prev[taskId]?.viewer_has_liked } }));
    try {
      // El endpoint para likes de tareas es /tasks/{id}/users-who-liked/
      const { data } = await api.get(`tasks/${taskId}/users-who-liked/`);
      const normalized = Array.isArray(data) ? data : data.results || [];
      const counts = makeTierCounts(normalized);
      taskLikesCacheRef.current[taskId] = { status: "ok" };
      setTaskLikesById(prev => ({ ...prev, [taskId]: { status: "ok", counts } }));
    } catch (error) {
      taskLikesCacheRef.current[taskId] = { status: "error" };
      setTaskLikesById(prev => ({ ...prev, [taskId]: { status: "error", counts: null, viewer_has_liked: prev[taskId]?.viewer_has_liked } }));
    }
  }, []);

  // Seguidores del autor por insignia (como los likes de la tarea): el total real y los números
  // de colores. Mientras se recarga se conservan los anteriores para que no parpadeen.
  const fetchFollowersSummary = useCallback(async (userId, force = false) => {
    if (!userId || (followersCacheRef.current[userId]?.status && !force)) return;
    followersCacheRef.current[userId] = { status: "loading" };
    setFollowersById(prev => ({ ...prev, [userId]: { ...prev[userId], status: "loading" } }));
    try {
      const { data } = await api.get(`users/${userId}/followers/`);
      const users = Array.isArray(data?.users) ? data.users : [];
      // La lista llega recortada en perfiles muy seguidos: el total sale de `count`.
      const counts = { ...makeTierCounts(users), all: data?.count ?? users.length };
      followersCacheRef.current[userId] = { status: "ok" };
      setFollowersById(prev => ({ ...prev, [userId]: { status: "ok", counts, viewerFollows: Boolean(data?.viewer_follows) } }));
    } catch (error) {
      followersCacheRef.current[userId] = { status: "error" };
      setFollowersById(prev => ({ ...prev, [userId]: { ...prev[userId], status: "error" } }));
    }
  }, []);

  useEffect(() => {
    const prefetchDataForReel = (reel) => {
      if (!reel) return;
      const taskId = reel.task?.id || reel.id;
      if (taskId) {
        fetchTaskLikesSummary(taskId);
      }
      fetchFollowersSummary(getReelAuthorId(reel));
    };
    prefetchDataForReel(reels[activeIndex]);
    prefetchDataForReel(reels[activeIndex + 1]);
  }, [activeIndex, reels.length, fetchTaskLikesSummary, fetchFollowersSummary]);

  // Seguir / dejar de seguir (desde el corazón del reel, el menú o cualquier pantalla) recarga los
  // seguidores por insignia, igual que dar like recarga los de la tarea. Los demás reels se
  // vuelven a pedir cuando aparezcan.
  const refreshFollowersRef = useRef(null);
  refreshFollowersRef.current = () => {
    followersCacheRef.current = {};
    [reels[activeIndex], reels[activeIndex + 1]].forEach((reel) => fetchFollowersSummary(getReelAuthorId(reel), true));
  };
  useEffect(() => subscribeRelationsChange(() => refreshFollowersRef.current?.()), []);

  // Refresco en segundo plano al volver a la pantalla: solo si los datos están
  // viejos y no hay una carga en curso. Se usa un ref para que el callback sea
  // estable y no se re-dispare cada vez que cambia el estado de la query.
  const reelsQueryRef = useRef(reelsQuery);
  reelsQueryRef.current = reelsQuery;
  useFocusEffect(
    useCallback(() => {
      const q = reelsQueryRef.current;
      if (q.isStale && !q.isFetching) {
        q.refetch({ cancelRefetch: false });
      }
      return () => { };
    }, [])
  );

  const handleTemaChange = useCallback((newTema) => { // ✅ Estabilizamos la función
    setTema(newTema);
    setActiveIndex(0);
  }, []);

  const likeAnimation = useSharedValue(0);

  const toggleLike = useCallback(async (item) => {
    const taskId = item.task?.id || item.id;
    const originalItem = reels.find(r => (r.task?.id || r.id) === taskId);
    if (!originalItem) return;

    const wasLiked = originalItem.user_has_liked;
    const newLikedState = !wasLiked;
    const increment = newLikedState ? 1 : -1;

    setReels(prev => prev.map(r =>
      (r.task?.id || r.id) === taskId
        ? { ...r, user_has_liked: newLikedState, likes_count: (r.likes_count || 0) + increment } 
        : r
    ));

    try {
      const response = await api.post(`tasks/${taskId}/like/`);
      setReels(prev => prev.map(r =>
        (r.task?.id || r.id) === taskId
          ? { ...r, user_has_liked: response.data.liked, likes_count: response.data.likes_count } 
          : r
      ));
      delete taskLikesCacheRef.current[taskId];
      fetchTaskLikesSummary(taskId, true);
    } catch (error) {
      setReels(prev => prev.map(r => r.id === item.id ? originalItem : r));
    }
  }, [reels, fetchTaskLikesSummary]);

  const handleRepost = useCallback(async (item) => {
    const taskId = item.task?.id || item.id;
    const contentItem = item.is_original ? item : item.task;

    if (!taskId) return; // Salimos si no hay ID
    if (repostInFlightRef.current.has(taskId)) return;
    repostInFlightRef.current.add(taskId);
    const original = repostSnapshot(contentItem);
    // La tarea puede venir sola o dentro de una compartida.
    const updateTask = (patch) => {
      setReels(prevReels => prevReels.map(reel => {
        const current = reel.is_original ? reel : reel.task;
        if (!current || current.id !== taskId) return reel;
        const updated = { ...current, ...patch };
        return reel.is_original ? updated : { ...reel, task: updated };
      }));
    };
    updateTask(optimisticRepost(original));

    try {
      const response = await api.post(`tasks/${taskId}/repost/`);
      updateTask(repostFromResponse(response.data));
    } catch (error) {
      console.error('Error al impulsar:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo impulsar la publicación.');
      updateTask(original);
    } finally {
      repostInFlightRef.current.delete(taskId);
    }
  }, []);

  const toggleDescription = useCallback((id) => {
    setExpandedDescriptions(prev => ({...prev, [id]: !prev[id]}));
  }, []);

  const toggleSharedBy = useCallback((taskId) => {
    if (!taskId) return;
    if (String(selectedReelId) !== String(taskId)) {
      setSelectedReelId(taskId);
      setPaused(true);
      setSharedOpenById(prev => ({ ...prev, [taskId]: true }));
      return;
    }
    if (!paused) {
      setPaused(true);
    }
    setSharedOpenById(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  }, [selectedReelId, paused]);

  const handleReelTap = useCallback((reelItem) => {
    const taskId = getReelTaskId(reelItem);
    if (!taskId) return;

    const isSameReel = String(selectedReelId) === String(taskId);
    if (!isSameReel) {
      setSelectedReelId(taskId);
      setPaused(true);
      return;
    }

    if (paused) {
      setPaused(false);
      setSelectedReelId(null);
      setSharedOpenById(prev => ({ ...prev, [taskId]: false }));
      return;
    }

    setPaused(true);
    setSelectedReelId(taskId);
  }, [getReelTaskId, selectedReelId, paused]);

  const cycleViewOnly = useCallback((task) => {
    const playlists = buildPlaylists(task);
    const VIEW_ORDER = ["main", "factores", "fuentes"];

    setViewStateById((prev) => {
      const current = prev?.[task.id] || { mode: "main", pos: 0 };
      const fallbackMode = VIEW_ORDER.find((m) => (playlists?.[m]?.length || 0) > 0) || "main";
      const effMode = playlists?.[current.mode]?.length ? current.mode : fallbackMode;
      const len = playlists?.[effMode]?.length || 0;
      const effPos = len ? Math.min(Math.max(0, current.pos || 0), len - 1) : 0;
      const startIdx = VIEW_ORDER.indexOf(effMode);

      for (let step = 1; step <= VIEW_ORDER.length; step++) {
        const nextMode = VIEW_ORDER[(startIdx + step) % VIEW_ORDER.length];
        const nextLen = playlists?.[nextMode]?.length || 0;
        if (nextLen > 0) {
          return { ...prev, [task.id]: { mode: nextMode, pos: 0 } };
        }
      }
      return { ...prev, [task.id]: { mode: effMode, pos: effPos } };
    });
  }, []);

  const cycleClipWithinView = useCallback((task) => {
    const playlists = buildPlaylists(task);
    setViewStateById((prev) => {
      const current = prev?.[task.id] || { mode: "main", pos: 0 };
      const currentMode = current.mode || "main";
      const currentList = playlists[currentMode] || [];
      const currentLength = currentList.length;
      if (currentLength <= 1) return prev;
      const currentPos = current.pos || 0;
      const nextPos = (currentPos + 1) % currentLength;
      return { ...prev, [task.id]: { mode: currentMode, pos: nextPos } };
    });
  }, []);

  const navigateClip = useCallback((task, direction) => {
    const playlists = buildPlaylists(task);
    setViewStateById((prev) => {
      const current = prev?.[task.id] || { mode: "main", pos: 0 };
      const currentMode = current.mode || "main";
      const currentList = playlists[currentMode] || [];
      const currentLength = currentList.length;
      const currentPos = current.pos || 0;
      const nextPos = currentPos + direction;
      if (nextPos >= 0 && nextPos < currentLength) {
        return { ...prev, [task.id]: { mode: currentMode, pos: nextPos } };
      }
      return prev;
    });
  }, []);

  const openActionModal = useCallback((task) => {
    // Un reel compartido trae el contenido en `task`: se marca como compartido para el menu completo
    // Seguir / favoritos / top 5 apuntan a quien se ve en el reel: el autor del contenido.
    setSelectedActionTask(task && !task.is_original && task.task
      ? { ...task, isSharedTask: true, menuProfileUser: task.task.user || task.user }
      : task);
    setActionModalVisible(true);
  }, [setSelectedActionTask, setActionModalVisible]);

  // Menu de 3 puntos: mismo menu completo que el feed (componente + handlers compartidos)
  const taskActions = useTaskActions({
    navigation,
    actionTask: selectedActionTask,
    currentUserId,
    close: () => setActionModalVisible(false),
    refresh: () => refetchReels(),
    onDeleted: (a) => {
      setReels(prev => prev.filter(t => t.id !== a?.id));
      refetchReels();
    },
  });

  const toggleFavorite = useCallback(async (item) => {
    if (!item) return;
    const isFav = !item.is_favorited;
    setReels(prev => prev.map(r => r.id === item.id ? { ...r, is_favorited: isFav } : r));
    try {
      await api.post("favoritos/agregar/", { task_id: item.id });
    } catch (error) {}
  }, []);

  const handleShowLikes = useCallback((taskId, tier = 'all') => {
    const url = `tasks/${taskId}/users-who-liked/`;
    setLikesModalUrl(url);
    setLikesModalTitle('Me gusta');
    setInitialTier(tier);
    setLikesModalVisible(true);
  }, []);

  const handleShowFollowers = useCallback((userId, tier = 'all') => {
    if (!userId) return;
    setLikesModalUrl(`users/${userId}/followers/`);
    setLikesModalTitle('Seguidores');
    setInitialTier(tier);
    setLikesModalVisible(true);
  }, []);

  // ✅ CONTROL DE VISIBILIDAD DE REELS ORIGINAL SÓLIDO (Sin glitches al hacer scroll)
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    // Solo actualizamos si hay un elemento visible y es diferente al actual
    if (viewableItems.length > 0) {
      const newActiveIndex = viewableItems[0].index;
      // ✅ FIX: Comparamos el nuevo índice con el actual para evitar re-renders innecesarios
      // y asegurar que el cambio de estado se propague correctamente.
      setActiveIndex(prevActiveIndex => {
        if (newActiveIndex !== prevActiveIndex) {
          return newActiveIndex;
        }
        return prevActiveIndex;
      });
    }
  }, []); // ✅ El array de dependencias vacío es intencional y correcto gracias a la actualización funcional.

  useEffect(() => {
    if (!paused) {
      if (selectedReelId !== null) {
        setSelectedReelId(null);
      }
      return;
    }

    const activeTaskId = getReelTaskId(reels[activeIndex]);
    if (activeTaskId && String(selectedReelId) !== String(activeTaskId)) {
      setSelectedReelId(activeTaskId);
    }
  }, [paused, selectedReelId, activeIndex, reels, getReelTaskId]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const stableGetSharedByInfo = useCallback((task) => getSharedByInfo(task), []);
  
  // ✅ FIX DEFINITIVO: Proporcionamos el layout de cada item para que FlatList funcione correctamente.
  const [pageHeight, setPageHeight] = useState(windowHeight);
  const getItemLayout = useCallback((data, index) => ({ length: pageHeight, offset: pageHeight * index, index }), [pageHeight]);
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flex: 1, position: 'relative' }}>
        {isUIVisible && (
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              {paused ? (
                <SideMenu
                  navigation={navigation}
                  signOut={signOut}
                  user={user}
                  buttonStyle={styles.reelsMenuButton}
                />
              ) : null}
            </View>
            <View style={styles.topBarCenter}>
              <TouchableOpacity onPress={() => handleTemaChange('consejos')}>
                  <Text style={[styles.topTab, tema === 'consejos' && styles.activeTab]}>Consejos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleTemaChange('peticiones')}>
                  <Text style={[styles.topTab, tema === 'peticiones' && styles.activeTab]}>Peticiones</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleTemaChange('historias')}>
                  <Text style={[styles.topTab, tema === 'historias' && styles.activeTab]}>Historias</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.topBarRight} />
          </View>
        )}
        {isUIVisible && paused && (
          <TouchableOpacity
            style={styles.pausedFilterButton}
            onPress={() => {
              setPaused(true);
              setFilterModalVisible(true);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros de Reels"
          >
            <Ionicons name="options-outline" size={28} color="#fff" style={styles.filterButtonIcon} />
          </TouchableOpacity>
        )}
        {loading && reels.length === 0 ? (
          <ActivityIndicator size="large" color="#fff" style={{flex: 1, justifyContent: 'center'}} />
        ) : loadError && reels.length === 0 ? (
          <OfflineEmptyState
            dark
            offline={!isOnline}
            onRetry={() => refetchReels()}
            message={isOnline ? 'No se pudieron cargar los reels. Inténtalo de nuevo.' : undefined}
          />
        ) : (
          // ✅ FIX: Usamos un solo View con flex: 1 para contener una única FlatList.
          // Esto asegura que la lista ocupe el espacio correcto y la virtualización funcione.
          <View
            style={{ flex: 1 }}
            onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (h > 0 && h !== pageHeight) setPageHeight(h); }}
          >
            <FlatList
              data={reels}
              ref={flatListRef}
              renderItem={({ item, index }) => ( <ReelRenderer item={item} index={index} activeIndex={activeIndex} isFocused={isFocused} isMuted={isMuted} paused={paused} setPaused={setPaused} selectedReelId={selectedReelId} handleReelTap={handleReelTap} isUIVisible={isUIVisible} expandedDescriptions={expandedDescriptions} toggleDescription={toggleDescription} viewStateById={viewStateById} sharedOpenById={sharedOpenById} toggleSharedBy={toggleSharedBy} getSharedByInfo={stableGetSharedByInfo} cycleViewOnly={cycleViewOnly} cycleClipWithinView={cycleClipWithinView} navigateClip={navigateClip} toggleLike={toggleLike} likeAnimation={likeAnimation} navigation={navigation} toggleFavorite={toggleFavorite} handleRepost={handleRepost} handleShowLikes={handleShowLikes} handleShowFollowers={handleShowFollowers} openActionModal={openActionModal} tema={tema} taskLikesById={taskLikesById} followersById={followersById} pageHeight={pageHeight} /> )}
              keyExtractor={(item) => item.id.toString()}
              pagingEnabled
              snapToInterval={pageHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              windowSize={3}
              removeClippedSubviews
              extraData={pageHeight}
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={getItemLayout}
              style={{ flex: 1 }} // Ensure FlatList itself takes all available vertical space
              onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
              onEndReachedThreshold={0.5}
            />
          </View>
        )}

        <FilterModal
          visible={filterModalVisible}
          onClose={() => setFilterModalVisible(false)}
          currentCategory={selectedCategory} // ✅ Se elimina la opción 'all' de los filtros
          currentDateFilter={selectedDateFilter}
          currentSortBy={selectedSortBy}
          currentFavorites={selectedFavoritesOnly}
          currentFavoriteUsers={selectedFavoriteUsersOnly}
          currentFollowedUsers={selectedFollowedUsersOnly}
          currentVerifiedUsers={selectedVerifiedUsersOnly}
          currentRecommendedUsers={selectedRecommendedUsersOnly}
          currentVideosOnly={selectedVideosOnly}
          showVideoOnlyFilter
          isSuperAdmin={isAdmin}
          onApply={(newFilters) => {
            setSelectedCategory(newFilters.category);
            setSelectedDateFilter(newFilters.date_filter);
            setSelectedSortBy(newFilters.sort_by);
            setSelectedFavoritesOnly(newFilters.favorites_only);
            setSelectedFavoriteUsersOnly(newFilters.favorite_users_only);
            setSelectedFollowedUsersOnly(newFilters.followed_users_only ?? false);
            setSelectedVerifiedUsersOnly(newFilters.verified_users_only);
            setSelectedRecommendedUsersOnly(newFilters.recommended_users_only);
            if (newFilters.videos_only !== selectedVideosOnly) {
              const previousVideosOnly = selectedVideosOnly;
              const nextVideosOnly = Boolean(newFilters.videos_only);
              setSelectedVideosOnly(nextVideosOnly);
              AsyncStorage.setItem(REELS_VIDEOS_ONLY_KEY, String(newFilters.videos_only))
                .catch((error) => {
                  setSelectedVideosOnly(previousVideosOnly);
                  console.error('[ReelsScreen] No se pudo guardar la preferencia de solo videos:', error);
                  Alert.alert('No se guardó la preferencia', 'Inténtalo de nuevo.');
                });
            }
            // ✅ FIX: Si la lista se reordena, nos aseguramos de que el scroll vuelva al inicio
            // y el reel activo sea el primero. La carga la dispara el cambio de clave de la query.
            if (flatListRef.current) {
              flatListRef.current.scrollToOffset({ animated: false, offset: 0 });
            }
            setActiveIndex(0);
          }}
        />

        <TieredLikesModal 
          visible={likesModalVisible} 
          onClose={() => setLikesModalVisible(false)} 
          apiUrl={likesModalUrl} 
          title={likesModalTitle}
          initialTier={initialTier}
        />

        <TaskActionsModal
          visible={actionModalVisible}
          onClose={() => setActionModalVisible(false)}
          actionTask={selectedActionTask}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          handlers={taskActions}
          extraOptions={(
            <TouchableOpacity style={styles.actionOption} onPress={() => { setIsUIVisible(v => !v); setActionModalVisible(false); }}>
              <Ionicons name={isUIVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color='#555' />
              <Text style={styles.actionText}>{isUIVisible ? 'Ocultar Interfaz' : 'Mostrar Interfaz'}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 42, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, paddingHorizontal: 15, pointerEvents: 'box-none' },
  topBarLeft: { flex: 1, minHeight: 36, justifyContent: 'center', alignItems: 'flex-start' },
  reelsMenuButton: { padding: 4 },
  topBarCenter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 3 },
  topBarRight: { flex: 1, alignItems: 'flex-end' },
  topTab: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '700', marginHorizontal: 12, textShadow: '1px 1px 3px rgba(0, 0, 0, 0.5)' },
  activeTab: { color: '#fff', fontSize: 17 },
  pausedFilterButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 42, right: 15, zIndex: 11, padding: 4 },
  filterButtonIcon: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  emptyReels: { minHeight: 240, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyReelsText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  loadMoreVideosButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#4dabf7' },
  loadMoreVideosText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  overlayModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionModalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 40 : 24, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalDragHandle: { width: 40, height: 4, backgroundColor: "#e0e0e0", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  actionOption: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: "#f5f5f5" },
  actionOptionDelete: { backgroundColor: "#ffe3e3" },
  actionText: { fontSize: 16, marginLeft: 14, color: "#333", fontWeight: "500" },
});

export default ReelsScreen;
