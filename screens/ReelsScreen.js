﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useCallback, useRef, useEffect, useMemo, useContext } from 'react';
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

const extractVideos = (obj) => {
  if (!obj) return [];
  const bag = [];
  bag.push(obj?.primary_video);
  bag.push(obj?.video);
  bag.push(obj?.task?.video);
  bag.push(obj?.video_url);
  bag.push(obj?.media_url);
  bag.push(obj?.file);
  bag.push(obj?.video2);
  bag.push(obj?.video_2);
  bag.push(obj?.video3);
  bag.push(obj?.video_3);
  if (Array.isArray(obj?.videos)) bag.push(...obj.videos);
  if (Array.isArray(obj?.video_list)) bag.push(...obj.video_list);
  if (Array.isArray(obj?.media_videos)) bag.push(...obj.media_videos);
  return uniq(bag);
};

const getFirstVideoAnywhere = (task) => {
  const subs = (task?.subtasks || []).flatMap((s) => extractVideos(s));
  const facs = (task?.subfactores || []).flatMap((s) => extractVideos(s));
  const fues = (task?.subfuentes || []).flatMap((s) => extractVideos(s));
  const main = extractVideos(task);
  return main[0] || subs[0] || facs[0] || fues[0] || null;
};

const dedupeMainPreferContribution = (entries) => {
  const out = [];
  const idxBySrc = new Map();
  const isSub = (e) => e?.groupIndex != null;
  for (const e of entries) {
    const src = cleanVal(e?.src);
    if (!src) continue;
    const next = { ...e, src };
    const existingIndex = idxBySrc.get(src);
    if (existingIndex == null) {
      idxBySrc.set(src, out.length);
      out.push(next);
      continue;
    }
    const prev = out[existingIndex];
    if (!isSub(prev) && isSub(next)) {
      out[existingIndex] = next;
    }
  }
  return out;
};

const buildPlaylists = (task) => {
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];
  const factores = Array.isArray(task?.subfactores) ? task.subfactores : [];
  const fuentes = Array.isArray(task?.subfuentes) ? task.subfuentes : [];

  const mainEntriesRaw = [];
  const taskVids = extractVideos(task);
  taskVids.forEach((src, li) => {
    mainEntriesRaw.push({ src, kind: "main", item: task, groupIndex: null, groupTotal: null, localIndex: li, localTotal: taskVids.length });
  });

  subtasks.forEach((st, gi) => {
    const vids = extractVideos(st);
    vids.forEach((src, li) => {
      mainEntriesRaw.push({ src, kind: "main", item: st, groupIndex: gi, groupTotal: subtasks.length, localIndex: li, localTotal: vids.length });
    });
  });

  const mainVideos = dedupeMainPreferContribution(mainEntriesRaw);

  const factoresVideos = [];
  factores.forEach((f, gi) => {
    const vids = extractVideos(f);
    vids.forEach((src, li) => {
      factoresVideos.push({ src, kind: "factores", item: f, groupIndex: gi, groupTotal: factores.length, localIndex: li, localTotal: vids.length });
    });
  });

  const fuentesVideos = [];
  fuentes.forEach((fu, gi) => {
    const vids = extractVideos(fu);
    vids.forEach((src, li) => {
      fuentesVideos.push({ src, kind: "fuentes", item: fu, groupIndex: gi, groupTotal: fuentes.length, localIndex: li, localTotal: vids.length });
    });
  });

  return { main: mainVideos, factores: factoresVideos, fuentes: fuentesVideos };
};

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

const getSharedByName = (t) => {
  const direct = cleanVal(t?.shared_byName) || cleanVal(t?.shared_by_name) || cleanVal(t?.sharedByName);
  if (direct) return direct;

  const objName = cleanVal(t?.shared_by?.username) || cleanVal(t?.shared_by?.user?.username) || cleanVal(t?.sharedBy?.username) || cleanVal(t?.sharedBy?.user?.username);
  if (objName) return objName;

  const list = (Array.isArray(t?.shared_by_list) && t.shared_by_list) || (Array.isArray(t?.sharedByList) && t.sharedByList) || [];
  if (list.length) {
    const last = list[list.length - 1];
    const name = cleanVal(last?.username) || cleanVal(last?.user?.username) || cleanVal(last?.user);
    if (name) return name;
  }

  const st = Array.isArray(t?.shared_tasks) ? t.shared_tasks : [];
  if (st.length) {
    const last = st[st.length - 1];
    const name = cleanVal(last?.username) || cleanVal(last?.user?.username) || cleanVal(last?.shared_by?.username);
    if (name) return name;
  }

  return null;
};

const getSharedByInfo = (t) => {
  const name = getSharedByName(t);
  let description = null;

  const list = (Array.isArray(t?.shared_by_list) && t.shared_by_list) || (Array.isArray(t?.sharedByList) && t.sharedByList) || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const d = cleanVal(list[i]?.description);
    if (d) {
      description = d;
      break;
    }
  }

  if (!description) {
    description = cleanVal(t?.shared_by?.description) || cleanVal(t?.sharedBy?.description) || cleanVal(t?.shared_by_description) || cleanVal(t?.sharedByDescription) || null;
  }

  return name ? { name, description, avatar: getSharedByAvatarSrc(t) } : null;
};

const getUserIdFromTask = (task) => {
  return task?.user?.profile?.id || task?.user?.profile_id || task?.user?.id || task?.user_id || null;
};

const ReelRenderer = ({ item, index, activeIndex, isMuted, paused, setPaused, videoRefs, isUIVisible, playbackStatus, setPlaybackStatus, expandedDescriptions, toggleDescription, viewStateById, sharedOpenById, toggleSharedBy, cycleViewOnly, cycleClipWithinView, navigateClip, toggleLike, toggleProfileLike, likeAnimation, navigation, toggleFavorite, openShareModal, handleRepost, handleShowShares, handleShowLikes, handleShowProfileLikes, openActionModal, taskLikesById, taskSharesById, profileLikesById, handleToggleProfileFavoriteDirect, tema }) => {
  const tapToPause = Gesture.Tap()
    .maxDuration(250)
    .onEnd((event, success) => {
      if (success) {
        const touchX = event.absoluteX;
        const rightSideThreshold = windowWidth - 80;
        if (touchX < rightSideThreshold) {
          runOnJS(setPaused)(p => !p);
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

  const memoizedPlaylists = useMemo(() => buildPlaylists(item), [item]);

  // ✅ LÓGICA CENTRALIZADA: Se mueven aquí para pasarlos como props.
  const contentItem = item.is_original ? item : item.task;
  const userItem = item.is_original ? item.user : item.task?.user;

  // ✅ LÓGICA DE ENRIQUECIMIENTO SIMPLIFICADA Y DIRECTA
  const enrichedItem = useMemo(() => {
    const userId = getUserIdFromTask(item);
    const profileLikesData = profileLikesById[userId];
    const taskId = item.task?.id || item.id;

    const updatedProfile = { ...item.user?.profile };

    // Fusionamos los datos de la API si existen y son válidos
    if (profileLikesData?.status === 'ok') {
      if (profileLikesData.counts?.all !== undefined) updatedProfile.likes_count = profileLikesData.counts.all;
      if (profileLikesData.viewer_has_liked !== undefined) updatedProfile.viewer_has_liked = profileLikesData.viewer_has_liked;
    }

    return {
      ...item,
      user: { ...item.user, profile: updatedProfile },
      // ✅ FIX: Usar siempre el ID de la tarea original para obtener los likes.
      taskLikes: taskLikesById[item.task?.id || item.id],
      taskShares: taskSharesById[item.task?.id || item.id],
      profileLikes: profileLikesData,
    };
  }, [item, taskLikesById, taskSharesById, profileLikesById]);
  
  return (
    <GestureDetector gesture={composedGesture}>
      <ReelItem
        item={item} // Pasamos el item original
        enrichedItem={enrichedItem} // Y el item enriquecido por separado
        contentItem={contentItem}
        userItem={userItem}
        index={index}
        isActive={index === activeIndex}
        isMuted={isMuted}
        paused={paused}
        playlists={memoizedPlaylists}
        setPaused={setPaused}
        videoRefs={videoRefs}
        isUIVisible={isUIVisible}
        playbackStatus={playbackStatus}
        setPlaybackStatus={setPlaybackStatus}
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
        tema={tema}
      />
    </GestureDetector>
  );
};

const ReelsScreen = () => {
  const { user } = useContext(AuthContext);
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
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [viewStateById, setViewStateById] = useState({});
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedActionTask, setSelectedActionTask] = useState(null);
  const [paused, setPaused] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState({});
  const videoRefs = useRef({});
  
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSortBy, setSelectedSortBy] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedFavoritesOnly, setSelectedFavoritesOnly] = useState(false);
  const [selectedFavoriteUsersOnly, setSelectedFavoriteUsersOnly] = useState(false);
  const [selectedVerifiedUsersOnly, setSelectedVerifiedUsersOnly] = useState(false);
  const [selectedRecommendedUsersOnly, setSelectedRecommendedUsersOnly] = useState(false);

  const [sharedOpenById, setSharedOpenById] = useState({});
  const flatListRef = useRef(null);
  const [isUIVisible, setIsUIVisible] = useState(true);

  const [taskLikesById, setTaskLikesById] = useState({});
  const taskLikesCacheRef = useRef({});
  const [taskSharesById, setTaskSharesById] = useState({});
  const taskSharesCacheRef = useRef({});
  const [profileLikesById, setProfileLikesById] = useState({});
  const profileLikesCacheRef = useRef({});

  const fetchReels = async (pageNumber = 1, filters = {}) => {
    try {
      if (pageNumber === 1) {
        setLoading(true);
        setReels([]); // Limpiamos al refrescar o cambiar filtros
      }

      const currentCatFilter = filters.category !== undefined ? filters.category : selectedCategory;
      const primaryCategory = currentCatFilter ? currentCatFilter.split(',')[0].trim() : '';
      
      // ✅ AHORA USAMOS EL ENDPOINT UNIFICADO /api/feed/
      const response = await api.get('feed/', {
        params: { 
          pch: filters.tema || tema, 
          page: pageNumber,
          category: primaryCategory,
          sort_by: filters.sort_by !== undefined ? filters.sort_by : selectedSortBy,
          date_filter: filters.date_filter !== undefined ? filters.date_filter : selectedDateFilter,
          favorites_only: filters.favorites_only !== undefined ? filters.favorites_only : selectedFavoritesOnly,
          favorite_users_only: filters.favorite_users_only !== undefined ? filters.favorite_users_only : selectedFavoriteUsersOnly,
          verified_users_only: filters.verified_users_only !== undefined ? filters.verified_users_only : selectedVerifiedUsersOnly,
          recommended_users_only: filters.recommended_users_only !== undefined ? filters.recommended_users_only : selectedRecommendedUsersOnly
        }
      });
      const data = response.data.results ?? response.data ?? [];

      // ✅ FILTRAMOS PARA MOSTRAR SOLO PUBLICACIONES (originales o compartidas) CON VIDEO
      const validReels = data.map(item => {
        // Si es una tarea compartida, el contenido está en 'item.task'. Si es original, está en 'item'.
        const content = item.is_original ? item : item.task;
        if (!content) return null;

        const anyVideo = getFirstVideoAnywhere(content);
        if (anyVideo) {
            return { ...item, _anyVideo: anyVideo };
        }
        return null;
      }).filter(Boolean);

      setReels(prev => pageNumber === 1 ? validReels : [...prev, ...validReels]);

      setHasMore(!!response.data.next);
      setPage(pageNumber);
    } catch (error) {
      console.error('Error fetching reels:', error);
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
      return () => {};
    }, [tema, selectedCategory, selectedSortBy, selectedDateFilter, selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly])
  );

  const handleTemaChange = (newTema) => {
    setTema(newTema);
    setActiveIndex(0);
    setReels([]);
    fetchReels(1, { tema: newTema });
  };

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
    console.log('[ReelsScreen] Iniciando Repost para taskId:', taskId);
    
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
      console.log('[ReelsScreen] Respuesta de la API:', response.data);
      // Damos feedback al usuario de que la acción fue exitosa.
      Alert.alert('Éxito', '¡Publicación impulsada!');

      // Sync with actual response
      const finalScore = response.data.interaction_score;
      console.log('[ReelsScreen] Sincronizando con score final del servidor:', finalScore);
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

  const toggleDescription = (id) => {
    setExpandedDescriptions(prev => ({...prev, [id]: !prev[id]}));
  };

  const toggleSharedBy = (taskId) => {
    setSharedOpenById(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

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

  const openActionModal = (task) => {
    setSelectedActionTask(task);
    setActionModalVisible(true);
  };

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

  const handleToggleProfileFavoriteDirect = async (task) => {
    if (!task || !task.user) return;
    try {
      const perfilId = task.user.id;
      const isFav = !task.user.is_favorited;
      const increment = isFav ? 1 : -1;
      setReels(prev => prev.map(t => (t.user && t.user.id === perfilId) ? { ...t, user: { ...t.user, is_favorited: isFav, followers_count: (t.user.followers_count || 0) + increment } } : t));
      await api.post("pfavoritos/agregar/", { perfil_id: perfilId });
    } catch (error) {}
  };

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
    if (Platform.OS === 'web') {
      if (window.confirm('¿Deseas eliminar esta tarea?')) executeDelete();
    } else {
      Alert.alert('Eliminar Tarea', '¿Deseas eliminar esta tarea?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: executeDelete }]);
    }
  };

  const toggleFavorite = async (item) => {
    if (!item) return;
    const isFav = !item.is_favorited;
    setReels(prev => prev.map(r => r.id === item.id ? { ...r, is_favorited: isFav } : r));
    try {
      await api.post("favoritos/agregar/", { task_id: item.id });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const openShareModal = (taskId) => {
    // Aseguramos que siempre pasamos solo el ID (string/uuid)
    setTaskToShare(taskId?.task?.id || taskId?.id || taskId);
    setShareModalVisible(true);
  };
  
  const handleShareSuccess = (sharedTaskResponse) => {
    if (!taskToShare) {
      console.error('[ReelsScreen] No hay `taskToShare` para actualizar.');
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
  };

  const handleShowLikes = (taskId, tier = 'all') => {
    const url = `tasks/${taskId}/users-who-liked/`;
    console.log('[ReelsScreen] URL para likes:', url);
    setLikesModalUrl(url);
    setLikesModalTitle('Me gusta');
    setInitialTier(tier);
    setLikesModalVisible(true);
  };

  const handleShowShares = (taskId, tier = 'all') => {
    const url = `tasks/${taskId}/users-who-shared/`;
    console.log('[ReelsScreen] URL para compartidos:', url);
    setLikesModalUrl(url);
    setLikesModalTitle('Compartido por');
    setInitialTier(tier);
    setLikesModalVisible(true);
  };

  const handleShowProfileLikes = (userId, tier = 'all') => {
    setLikesModalUrl(`profiles/${userId}/likes/`);
    setLikesModalTitle('Likes del Perfil');
    setInitialTier(tier);
    setLikesModalVisible(true);
  };

  // ✅ CONTROL DE VISIBILIDAD DE REELS ORIGINAL SÓLIDO (Sin glitches al hacer scroll)
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
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
          <FlatList
            ref={flatListRef}
            data={reels}
            renderItem={({ item, index }) => (
              <ReelRenderer
                item={item}
                index={index}
                activeIndex={activeIndex}
                isMuted={isMuted}
                paused={paused}
                setPaused={setPaused}
                videoRefs={videoRefs}
                isUIVisible={isUIVisible}
                playbackStatus={playbackStatus}
                setPlaybackStatus={setPlaybackStatus}
                expandedDescriptions={expandedDescriptions}
                toggleDescription={toggleDescription}
                viewStateById={viewStateById}
                sharedOpenById={sharedOpenById}
                toggleSharedBy={toggleSharedBy}
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
                handleToggleProfileFavoriteDirect={handleToggleProfileFavoriteDirect}
                tema={tema}
              />
            )}
            // ✅ FIX: Usamos una clave única y consistente. Para un reel compartido, la clave debe ser
            // el ID de la tarea original (`task.id`) prefijado para evitar colisiones con los IDs
            // de las tareas originales que podrían estar en la misma lista.
            keyExtractor={(item) => item.is_original ? item.id.toString() : `shared-${item.task.id}-${item.id}`}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged} // ✅ REPRODUCCIÓN ULTRA FLUIDA NATIVA
            viewabilityConfig={viewabilityConfig} // ✅ CONFIGURACIÓN ORIGINAL SÓLIDA
            onEndReached={() => { if (hasMore && !loading) { fetchReels(page + 1); } }}
            onEndReachedThreshold={0.5}
          />
        )}

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
          onApply={(newFilters) => {
            setSelectedCategory(newFilters.category);
            setSelectedDateFilter(newFilters.date_filter);
            setSelectedSortBy(newFilters.sort_by);
            setSelectedFavoritesOnly(newFilters.favorites_only);
            setSelectedFavoriteUsersOnly(newFilters.favorite_users_only);
            setSelectedVerifiedUsersOnly(newFilters.verified_users_only);
            setSelectedRecommendedUsersOnly(newFilters.recommended_users_only);
            setPage(1);
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
                  <TouchableOpacity style={styles.actionOption} onPress={() => { setActionModalVisible(false); openShareModal(selectedActionTask.id); }}>
                    <Ionicons name='share-social-outline' size={20} color='#555' />
                    <Text style={styles.actionText}>Compartir</Text>
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
