﻿﻿﻿﻿﻿﻿import React, { useState, useCallback, useRef, useEffect, useMemo, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, Dimensions, Platform, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../App'; // ✅ IMPORTAMOS EL CONTEXTO
import api, { getImageUrl } from '../api';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS } from 'react-native-reanimated';
import ShareModal from '../components/ShareModal';
import FilterModal from '../components/FilterModal';
import TieredLikesModal from './TieredLikesModal';
import ReelItem from './ReelItem'; 

const TIER_ORDER = ['app', 'recommended', 'verified', 'sub_red', 'sub_green', 'regular'];

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

const getUserIdFromTask = (task) => {
  return task?.user?.profile?.id || task?.user?.profile_id || task?.user?.id || task?.user_id || null;
};

const makeTierCounts = (usersArr = []) => {
  const counts = TIER_ORDER.reduce((acc, t) => ({ ...acc, [t]: 0 }), { all: usersArr.length });
  (usersArr || []).forEach((u) => {
    const profile = u?.profile || u || {};
    let key = 'regular';
    if (profile.is_verified) {
      key = 'verified';
    } else if (profile.is_recommended) {
      key = 'recommended';
    }
    if (counts[key] !== undefined) {
      counts[key]++;
    }
  });
  return counts;
};
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

const ReelRenderer = React.memo(({ item, index, activeIndex, isMuted, paused, setPaused, selectedReelId, handleReelTap, isUIVisible, expandedDescriptions, toggleDescription, viewStateById, sharedOpenById, toggleSharedBy, getSharedByInfo, cycleViewOnly, cycleClipWithinView, navigateClip, toggleLike, toggleProfileLike, likeAnimation, navigation, toggleFavorite, openShareModal, handleRepost, handleShowShares, handleShowLikes, handleShowProfileLikes, openActionModal, tema, taskLikesById, taskSharesById, profileLikesById }) => {
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
  const enrichedItem = useMemo(() => {
    const userId = getUserIdFromTask(item);
    const profileLikesData = profileLikesById[userId];
    const updatedProfile = { ...item.user?.profile };

    if (profileLikesData?.status === 'ok') {
      if (profileLikesData.counts?.all !== undefined) updatedProfile.likes_count = profileLikesData.counts.all;
      if (profileLikesData.viewer_has_liked !== undefined) updatedProfile.viewer_has_liked = profileLikesData.viewer_has_liked;
    }

    return {
      ...item,
      user: { ...item.user, profile: updatedProfile },
      taskLikes: taskLikesById[item.task?.id || item.id],
      taskShares: taskSharesById[item.task?.id || item.id],
      profileLikes: profileLikesData,
    };
  }, [item, taskLikesById, taskSharesById, profileLikesById]);

  return (
    // ✅ FIX: Se elimina el GestureDetector duplicado que causaba el error de sintaxis.
    <GestureDetector gesture={composedGesture}>
      <View style={{ width: windowWidth, height: windowHeight }}>
      <ReelItem
        item={item}
        enrichedItem={enrichedItem}
        index={index}
        isActive={index === activeIndex}
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
        toggleProfileLike={toggleProfileLike}
        likeAnimation={likeAnimation}
        navigation={navigation}
        toggleFavorite={toggleFavorite}
        handleRepost={handleRepost}
        openShareModal={openShareModal}
        handleShowShares={handleShowShares}
        handleShowLikes={handleShowLikes}
        handleShowProfileLikes={handleShowProfileLikes}
        openActionModal={openActionModal}
        taskLikesById={taskLikesById}
        taskSharesById={taskSharesById}
        profileLikesById={profileLikesById}
        tema={tema}
      />
      </View>
    </GestureDetector>
  );
});

const ReelsScreen = ({ route }) => {
  const { user, isAdmin: isAdminFromContext } = useContext(AuthContext);
  const [isAdmin, setIsAdmin] = useState(isAdminFromContext);
  const currentUserId = user?.id;
  const navigation = useNavigation();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tema, setTema] = useState('consejos');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted] = useState(false);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl, setLikesModalUrl] = useState('');
  const [likesModalTitle, setLikesModalTitle] = useState('Usuarios');
  const [initialTier, setInitialTier] = useState('all');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare, setTaskToShare] = useState(null);
  const [taskShareDetails, setTaskShareDetails] = useState(null);
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
  const [selectedVerifiedUsersOnly, setSelectedVerifiedUsersOnly] = useState(false);
  const [selectedRecommendedUsersOnly, setSelectedRecommendedUsersOnly] = useState(false);

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
  const [taskSharesById, setTaskSharesById] = useState({});
  const taskSharesCacheRef = useRef({});
  const [profileLikesById, setProfileLikesById] = useState({});
  const profileLikesCacheRef = useRef({});
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

  const fetchReels = async (pageNumber = 1, filters = {}) => {
    try {
      if (pageNumber === 1) {
        setLoading(true);
        setReels([]); // Limpiamos al refrescar o cambiar filtros
      }

      const currentCatFilter = filters.category !== undefined ? filters.category : selectedCategory;
      
      // ✅ REVERSIÓN: Volvemos a usar el endpoint de /api/tasks/ para obtener solo tareas originales.
      const response = await api.get('tasks/', {
        params: { 
          pch: filters.tema || tema, 
          page: pageNumber,
          category: currentCatFilter,
          date_filter: filters.date_filter !== undefined ? filters.date_filter : selectedDateFilter,
          sort_by: filters.sort_by !== undefined ? filters.sort_by : selectedSortBy,
          favorites_only: filters.favorites_only !== undefined ? filters.favorites_only : selectedFavoritesOnly,
          favorite_users_only: filters.favorite_users_only !== undefined ? filters.favorite_users_only : selectedFavoriteUsersOnly,
          verified_users_only: filters.verified_users_only !== undefined ? filters.verified_users_only : selectedVerifiedUsersOnly,
          recommended_users_only: filters.recommended_users_only !== undefined ? filters.recommended_users_only : selectedRecommendedUsersOnly
        }
      });
      const data = response.data.results ?? response.data ?? [];

      // ✅ FILTRAMOS PARA MOSTRAR SOLO PUBLICACIONES (originales o compartidas) CON VIDEO
      const validReels = data.map(item => {        
        // Como ahora solo vienen tareas, el contenido siempre es 'item'.
        const content = item.is_original ? item : item.task;
        if (!content) return null;

        const anyMedia = getFirstMediaAnywhere(content);
        if (anyMedia) {
          return { ...item, _anyMedia: anyMedia };
        }
        return null;
      }).filter(Boolean);

      setReels(prev => pageNumber === 1 ? validReels : [...prev, ...validReels]);

      setHasMore(!!response.data.next);
      setPage(pageNumber);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

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

  const fetchTaskSharesSummary = useCallback(async (taskId, force = false) => {
    if (!taskId || (taskSharesCacheRef.current[taskId]?.status === 'ok' && !force)) return;
    taskSharesCacheRef.current[taskId] = { status: "loading" };
    setTaskSharesById(prev => ({ ...prev, [taskId]: { status: "loading", counts: prev[taskId]?.counts || null, viewer_has_liked: prev[taskId]?.viewer_has_liked } }));
    try {
      const { data } = await api.get(`tasks/${taskId}/users-who-shared/`);
      const normalized = Array.isArray(data) ? data : data.results || [];
      const counts = makeTierCounts(normalized);
      taskSharesCacheRef.current[taskId] = { status: "ok" };
      setTaskSharesById(prev => ({ ...prev, [taskId]: { status: "ok", counts } }));
    } catch (error) {
      taskSharesCacheRef.current[taskId] = { status: "error" };
      setTaskSharesById(prev => ({ ...prev, [taskId]: { status: "error", counts: null, viewer_has_liked: prev[taskId]?.viewer_has_liked } }));
    }
  }, []);

  const fetchProfileLikesSummary = useCallback(async (profileId, force = false) => {
    if (!profileId || (profileLikesCacheRef.current[profileId]?.status === 'ok' && !force)) return;
    profileLikesCacheRef.current[profileId] = { status: "loading" };
    setProfileLikesById(prev => ({ ...prev, [profileId]: { ...prev[profileId], status: "loading" } }));
    try {
      const { data } = await api.get(`profiles/${profileId}/likes/`);
      const normalized = Array.isArray(data) ? data : data.results || [];
      const counts = makeTierCounts(normalized);
      const viewerHasLiked = data.viewer_has_liked === true;
      profileLikesCacheRef.current[profileId] = { status: "ok" };
      setProfileLikesById(prev => ({ ...prev, [profileId]: { status: "ok", counts, viewer_has_liked: viewerHasLiked } }));
    } catch (error) {
      profileLikesCacheRef.current[profileId] = { status: "error" };
      setProfileLikesById(prev => ({ ...prev, [profileId]: { status: "error", counts: null } }));
    }
  }, []);

  useEffect(() => {
    const prefetchDataForReel = (reel) => {
      if (!reel) return;
      const taskId = reel.task?.id || reel.id;
      if (taskId) {
        fetchTaskLikesSummary(taskId);
        fetchTaskSharesSummary(reel.id);
      }
      const userId = getUserIdFromTask(reel);
      if (userId) {
        fetchProfileLikesSummary(userId);
      }
    };
    prefetchDataForReel(reels[activeIndex]);
    prefetchDataForReel(reels[activeIndex + 1]);
  }, [activeIndex, reels.length, fetchTaskLikesSummary, fetchTaskSharesSummary, fetchProfileLikesSummary]);

  useFocusEffect(
    useCallback(() => {
      fetchReels(1);
      return () => { };
    }, [tema, selectedCategory, selectedSortBy, selectedDateFilter, selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly])
  );

  const handleTemaChange = useCallback((newTema) => { // ✅ Estabilizamos la función
    setTema(newTema);
    setActiveIndex(0);
    setReels([]);
    fetchReels(1, { tema: newTema, sort_by: selectedSortBy, category: selectedCategory, date_filter: selectedDateFilter, favorites_only: selectedFavoritesOnly, favorite_users_only: selectedFavoriteUsersOnly, verified_users_only: selectedVerifiedUsersOnly, recommended_users_only: selectedRecommendedUsersOnly });
  }, [fetchReels, tema]);

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

  const toggleProfileLike = useCallback(async (item) => {
    const userId = getUserIdFromTask(item);
    if (!userId) return;

    // Guardamos el estado original para poder revertir en caso de error
    const originalReels = [...reels];
    const wasLiked = item.user?.profile?.viewer_has_liked ?? false;
    const newLikedState = !wasLiked;
    const increment = newLikedState ? 1 : -1;

    // 1. Actualización Optimista: Modificamos el estado local al instante.
    setReels(prevReels => prevReels.map(r => {
      if (getUserIdFromTask(r) === userId) {
        // Aseguramos que profile exista antes de intentar modificarlo
        const profile = r.user?.profile || {};
        const currentLikes = profile.likes_count ?? 0;
        return { 
          ...r, 
          user: { 
            ...r.user, 
            profile: { 
              ...profile,
              viewer_has_liked: newLikedState, 
              likes_count: currentLikes + increment 
            } 
          } 
        };
      }
      return r;
    }));

    // 2. Llamada a la API en segundo plano.
    try {
      const response = await api.post(`profiles/${userId}/like/`);
      const { liked, likes_count } = response.data;

      // 3. Sincronización Silenciosa: Actualizamos con los datos reales del servidor.
      setReels(prevReels => prevReels.map(r => {
        if (getUserIdFromTask(r) === userId) {
          const profile = r.user?.profile || {};
          return { ...r, user: { ...r.user, profile: { ...profile, viewer_has_liked: liked, likes_count: likes_count } } };
        }
        return r;
      }));

      // Forzamos la actualización del cache para consistencia en otras pantallas.
      delete profileLikesCacheRef.current[userId];
      fetchProfileLikesSummary(userId, true);
    } catch (error) {
      // 4. Reversión: Si la API falla, restauramos el estado original.
      setReels(originalReels);
    }
  }, [reels, fetchProfileLikesSummary]);

  const handleRepost = useCallback(async (item) => {
    const taskId = item.task?.id || item.id;
    const contentItem = item.is_original ? item : item.task;

    if (!taskId) return; // Salimos si no hay ID
    
    // Optimistic update
    setReels(prevReels => prevReels.map(r => {
      const currentContent = r.is_original ? r : r.task;
      if (currentContent && currentContent.id === taskId) {
        return r.is_original ? { ...r, interaction_score: (r.interaction_score || 0) + 1 } : { ...r, task: { ...r.task, interaction_score: (r.task.interaction_score || 0) + 1 } };
      }
      return r;
    }));

    try {
      // Llamada al endpoint de "repost" que solo afecta el score interno.
      const response = await api.post(`tasks/${taskId}/repost/`);
      // Damos feedback al usuario de que la acción fue exitosa.
      Alert.alert('Éxito', '¡Publicación impulsada!');

      // Sync with actual response
      const finalScore = response.data.interaction_score;
      setReels(prevReels => prevReels.map(r => {
        const currentContent = r.is_original ? r : r.task;
        if (currentContent && currentContent.id === taskId) {
          return r.is_original ? { ...r, interaction_score: finalScore } : { ...r, task: { ...r.task, interaction_score: finalScore } };
        }
        return r;
      }));
    } catch (error) {
      console.error('Error reposting task:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo impulsar la publicación.');
      // En caso de error, podrías recargar para revertir el cambio optimista.
      // fetchReels(1); 
    }
  }, [reels]);

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
    setSelectedActionTask(task);
    setActionModalVisible(true);
  }, [setSelectedActionTask, setActionModalVisible]);

  const handleToggleTaskFavorite = async () => {
    if (!selectedActionTask) return;
    const isFav = !selectedActionTask.is_favorited;
    setReels(prev => prev.map(r => r.id === selectedActionTask.id ? { ...r, is_favorited: isFav } : r));
    try {
      await api.post("favoritos/agregar/", { task_id: selectedActionTask.id });
    } catch (error) {}
    setActionModalVisible(false);
  };

  const handleDirectMessage = () => {
    if (!selectedActionTask || !selectedActionTask.user) return;
    setActionModalVisible(false);
    navigation.navigate('ChatDetail', { 
      chatId: selectedActionTask.user.id, type: 'direct', title: selectedActionTask.user.username, avatar: getImageUrl(selectedActionTask.user.user_image)
    });
  };

  const handleGoToForum = () => {
    if (!selectedActionTask || !selectedActionTask.user) return;
    setActionModalVisible(false);
    navigation.navigate('UserProfile', { 
      userId: selectedActionTask.user.id, userName: selectedActionTask.user.username, userAvatar: getImageUrl(selectedActionTask.user.user_image) 
    });
  };

  const updateReelUserProfile = (userId, profileChanges) => {
    setReels(prev => prev.map(reel => (
      reel.user?.id === userId
        ? { ...reel, user: { ...reel.user, profile: { ...reel.user.profile, ...profileChanges } } }
        : reel
    )));
  };

  const handleToggleVerified = async () => {
    const userObj = selectedActionTask?.user;
    if (!userObj) return;

    const is_verified = !userObj.profile?.is_verified;
    try {
      await api.post(`admin/users/${userObj.id}/verify/`, { is_verified });
      updateReelUserProfile(userObj.id, { is_verified });
      setActionModalVisible(false);
    } catch (error) {
      console.error('[ReelsScreen] Error actualizando verificación:', error.response?.data || error);
    }
  };

  const handleToggleRecommended = async () => {
    const userObj = selectedActionTask?.user;
    if (!userObj) return;

    const is_recommended = !userObj.profile?.is_recommended;
    try {
      await api.post(`admin/users/${userObj.id}/recommend/`, { is_recommended });
      updateReelUserProfile(userObj.id, { is_recommended });
      setActionModalVisible(false);
    } catch (error) {
      console.error('[ReelsScreen] Error actualizando recomendación:', error.response?.data || error);
    }
  };

  const handleToggleProfileFavoriteDirect = useCallback(async (task) => {
    if (!task || !task.user) return;
    try {
      const perfilId = task.user.id;
      const isFav = !task.user.is_favorited;
      const increment = isFav ? 1 : -1;
      setReels(prev => prev.map(t => (t.user && t.user.id === perfilId) ? { ...t, user: { ...t.user, is_favorited: isFav, followers_count: (t.user.followers_count || 0) + increment } } : t));
      await api.post("pfavoritos/agregar/", { perfil_id: perfilId });
    } catch (error) {}
  }, []);

  const handleDeleteTask = async () => {
    if (!selectedActionTask) return;
    const taskId = selectedActionTask.id;
    const executeDelete = async () => {
      try {
        await api.delete(`tasks/${taskId}/`);
        setReels(prev => prev.filter(t => t.id !== taskId));
        setActionModalVisible(false);
      } catch (error) {}
    };
      if (window.confirm('¿Deseas eliminar esta tarea?')) executeDelete();
    if (Platform.OS === 'web') {
    } else {
      Alert.alert('Eliminar Tarea', '¿Deseas eliminar esta tarea?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: executeDelete }]);
    }
  };

  const toggleFavorite = useCallback(async (item) => {
    if (!item) return;
    const isFav = !item.is_favorited;
    setReels(prev => prev.map(r => r.id === item.id ? { ...r, is_favorited: isFav } : r));
    try {
      await api.post("favoritos/agregar/", { task_id: item.id });
    } catch (error) {}
  }, []);

  const openShareModal = useCallback((taskOrId) => {
    const reelItem = typeof taskOrId === 'object'
      ? taskOrId
      : reels.find((item) => String(item.id) === String(taskOrId));
    const sourceTask = reelItem?.task || reelItem || null;
    setTaskToShare(sourceTask?.id || taskOrId);
    setTaskShareDetails(sourceTask);
    setShareModalVisible(true);
  }, [reels]);
  
  const handleShareSuccess = useCallback((sharedTaskResponse) => {
    if (!taskToShare) {
      return;
    }

    const taskId = taskToShare; // El ID ya está guardado
    
    // Actualizamos el estado de reels para reflejar el nuevo contador.
    setReels(prevReels => prevReels.map(reel => {
      const contentItem = reel.is_original ? reel : reel.task;
      if (contentItem && contentItem.id === taskId) {
        // ✅ FIX: Usamos los valores que vienen del servidor para máxima consistencia
        const newShareCount = sharedTaskResponse.task.share_count;
        const newInteractionScore = sharedTaskResponse.task.interaction_score;

        return reel.is_original
          ? { ...reel, share_count: newShareCount, interaction_score: newInteractionScore }
          : { ...reel, task: { ...reel.task, share_count: newShareCount, interaction_score: newInteractionScore } };
      }
      return reel;
    }));

    if (taskSharesCacheRef.current[taskId]) {
      delete taskSharesCacheRef.current[taskId];
    }
    fetchTaskSharesSummary(taskId, true); // Forzamos la recarga del resumen de compartidos.
    setTaskToShare(null); 
  }, [taskToShare, fetchTaskSharesSummary]);

  const handleShowLikes = useCallback((taskId, tier = 'all') => {
    const url = `tasks/${taskId}/users-who-liked/`;
    setLikesModalUrl(url);
    setLikesModalTitle('Me gusta');
    setInitialTier(tier);
    setLikesModalVisible(true);
  }, []);

  const handleShowShares = useCallback((taskId, tier = 'all') => {
    const url = `tasks/${taskId}/users-who-shared/`;
    setLikesModalUrl(url);
    setLikesModalTitle('Compartido por');
    setInitialTier(tier);
    setLikesModalVisible(true);
  }, []);

  const handleShowProfileLikes = useCallback((userId, tier = 'all') => {
    setLikesModalUrl(`profiles/${userId}/likes/`);
    setLikesModalTitle('Likes del Perfil');
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
  const getItemLayout = useCallback((data, index) => ({ length: windowHeight, offset: windowHeight * index, index }), []);
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flex: 1, position: 'relative' }}>
        {isUIVisible && (
          <View style={styles.topBar}>
            <View style={styles.topBarLeft} />
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
        {paused && (
          <TouchableOpacity style={styles.pausedFilterButton} onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="options-outline" size={28} color="#fff" />
          </TouchableOpacity>
        )}
        {loading && reels.length === 0 ? (
          <ActivityIndicator size="large" color="#fff" style={{flex: 1, justifyContent: 'center'}} />
        ) : (
          // ✅ FIX: Usamos un solo View con flex: 1 para contener una única FlatList.
          // Esto asegura que la lista ocupe el espacio correcto y la virtualización funcione.
          <View
            style={{ flex: 1, height: windowHeight }} // Explicitly set height to windowHeight
          >
            <FlatList
              data={reels}
              ref={flatListRef}
              renderItem={({ item, index }) => ( <ReelRenderer item={item} index={index} activeIndex={activeIndex} isMuted={isMuted} paused={paused} setPaused={setPaused} selectedReelId={selectedReelId} handleReelTap={handleReelTap} isUIVisible={isUIVisible} expandedDescriptions={expandedDescriptions} toggleDescription={toggleDescription} viewStateById={viewStateById} sharedOpenById={sharedOpenById} toggleSharedBy={toggleSharedBy} getSharedByInfo={stableGetSharedByInfo} cycleViewOnly={cycleViewOnly} cycleClipWithinView={cycleClipWithinView} navigateClip={navigateClip} toggleLike={toggleLike} toggleProfileLike={toggleProfileLike} likeAnimation={likeAnimation} navigation={navigation} toggleFavorite={toggleFavorite} handleRepost={handleRepost} openShareModal={openShareModal} handleShowShares={handleShowShares} handleShowLikes={handleShowLikes} handleShowProfileLikes={handleShowProfileLikes} openActionModal={openActionModal} tema={tema} taskLikesById={taskLikesById} taskSharesById={taskSharesById} profileLikesById={profileLikesById} /> )}
              keyExtractor={(item) => item.id.toString()}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={getItemLayout}
              style={{ flex: 1 }} // Ensure FlatList itself takes all available vertical space
              onEndReached={() => { if (hasMore && !loading) { fetchReels(page + 1); } }}
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
          currentVerifiedUsers={selectedVerifiedUsersOnly}
          currentRecommendedUsers={selectedRecommendedUsersOnly}
          isSuperAdmin={isAdmin}
          onApply={(newFilters) => {
            setSelectedCategory(newFilters.category);
            setSelectedDateFilter(newFilters.date_filter);
            setSelectedSortBy(newFilters.sort_by);
            setSelectedFavoritesOnly(newFilters.favorites_only);
            setSelectedFavoriteUsersOnly(newFilters.favorite_users_only);
            setSelectedVerifiedUsersOnly(newFilters.verified_users_only);
            setSelectedRecommendedUsersOnly(newFilters.recommended_users_only);
            setPage(1);
            // ✅ FIX: Si la lista se reordena, nos aseguramos de que el scroll vuelva al inicio
            // y el reel activo sea el primero.
            if (flatListRef.current) {
              flatListRef.current.scrollToOffset({ animated: false, offset: 0 });
            }
            setActiveIndex(0);
            fetchReels(1, newFilters);
          }}
        />

        <TieredLikesModal 
          visible={likesModalVisible} 
          onClose={() => setLikesModalVisible(false)} 
          apiUrl={likesModalUrl} 
          title={likesModalTitle}
          initialTier={initialTier}
        />

        <ShareModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          taskId={taskToShare}
          onShareSuccess={handleShareSuccess}
          navigation={navigation}
          taskTitle={taskShareDetails?.title || 'Publicación'}
          taskDescription={taskShareDetails?.description || ''}
        />
        
        <Modal visible={actionModalVisible} transparent animationType='fade' onRequestClose={() => setActionModalVisible(false)}>
          <TouchableOpacity style={styles.overlayModal} activeOpacity={1} onPress={() => setActionModalVisible(false)}>
            <View style={styles.actionModalContainer}>
              <View style={styles.modalDragHandle} />
              {selectedActionTask && (
                <>
                  <TouchableOpacity style={styles.actionOption} onPress={() => { setIsUIVisible(v => !v); setActionModalVisible(false); }}>
                    <Ionicons name={isUIVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color='#555' />
                    <Text style={styles.actionText}>{isUIVisible ? 'Ocultar Interfaz' : 'Mostrar Interfaz'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionOption} onPress={handleToggleTaskFavorite}>
                    <Ionicons name={selectedActionTask.is_favorited ? "bookmark" : "bookmark-outline"} size={20} color={selectedActionTask.is_favorited ? "#f1c40f" : "#555"} />
                    <Text style={styles.actionText}>{selectedActionTask.is_favorited ? "Quitar de guardados" : "Guardar"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionOption} onPress={() => { setActionModalVisible(false); openShareModal(selectedActionTask); }}>
                    <Ionicons name='paper-plane-outline' size={20} color='#555' />
                    <Text style={styles.actionText}>Enviar o compartir</Text>
                  </TouchableOpacity>
                  {selectedActionTask.user && currentUserId !== selectedActionTask.user.id && (
                    <>
                      <TouchableOpacity style={styles.actionOption} onPress={handleDirectMessage}>
                        <Ionicons name='chatbubbles-outline' size={20} color='#4dabf7' />
                        <Text style={styles.actionText}>Mensaje Directo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionOption} onPress={handleGoToForum}>
                        <Ionicons name='person-outline' size={20} color='#4dabf7' />
                        <Text style={styles.actionText}>Ir a su perfil/foro</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionOption} onPress={() => { handleToggleProfileFavoriteDirect(selectedActionTask); setActionModalVisible(false); }}>
                        <Ionicons name={selectedActionTask.user.is_favorited ? "heart" : "heart-outline"} size={20} color={selectedActionTask.user.is_favorited ? "#ff0b5a" : "#555"} />
                        <Text style={styles.actionText}>{selectedActionTask.user.is_favorited ? "Eliminar perfil de favoritos" : "Agregar perfil a favoritos"}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {currentUserId === selectedActionTask.user?.id && (
                    <TouchableOpacity style={[styles.actionOption, styles.actionOptionDelete]} onPress={handleDeleteTask}>
                      <Ionicons name='trash-outline' size={20} color='#ff6b6b' />
                      <Text style={[styles.actionText, { color: '#ff6b6b', fontWeight: 'bold' }]}>Eliminar</Text>
                    </TouchableOpacity>
                  )}
                  {isAdmin && selectedActionTask.user && (
                    <>
                      <TouchableOpacity style={styles.actionOption} onPress={handleToggleVerified}>
                        <Ionicons
                          name={selectedActionTask.user.profile?.is_verified ? 'checkmark-circle' : 'checkmark-circle-outline'}
                          size={20}
                          color={selectedActionTask.user.profile?.is_verified ? '#4dabf7' : '#555'}
                        />
                        <Text style={styles.actionText}>
                          {selectedActionTask.user.profile?.is_verified ? 'Quitar Verificación' : 'Verificar Perfil'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionOption} onPress={handleToggleRecommended}>
                        <Ionicons
                          name={selectedActionTask.user.profile?.is_recommended ? 'ribbon' : 'ribbon-outline'}
                          size={20}
                          color={selectedActionTask.user.profile?.is_recommended ? '#f59f00' : '#555'}
                        />
                        <Text style={styles.actionText}>
                          {selectedActionTask.user.profile?.is_recommended ? 'Quitar Recomendación' : 'Recomendar Perfil'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, paddingHorizontal: 15, pointerEvents: 'box-none' },
  topBarLeft: { flex: 1 },
  topBarCenter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flex: 3 },
  topBarRight: { flex: 1, alignItems: 'flex-end' },
  topTab: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '700', marginHorizontal: 12, textShadow: '1px 1px 3px rgba(0, 0, 0, 0.5)' },
  activeTab: { color: '#fff', fontSize: 17 },
  pausedFilterButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, right: 15, zIndex: 11, padding: 5 },
  overlayModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionModalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 40 : 24, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalDragHandle: { width: 40, height: 4, backgroundColor: "#e0e0e0", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  actionOption: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: "#f5f5f5" },
  actionOptionDelete: { backgroundColor: "#ffe3e3" },
  actionText: { fontSize: 16, marginLeft: 14, color: "#333", fontWeight: "500" },
});

export default ReelsScreen;
