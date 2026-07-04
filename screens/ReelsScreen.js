﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Dimensions, Platform, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Esta línea ya está bien, pero la revisamos.
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import api, { getImageUrl } from '../api';// ✅ 1. IMPORTACIONES NECESARIAS PARA GESTOS
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';import ShareModal from '../components/ShareModal';
import FilterModal from '../components/FilterModal';
import TieredLikesModal from './TieredLikesModal';
import ReelItem from './ReelItem'; // Esta línea ya está bien, pero la revisamos.
 
const TIER_ORDER = ['app', 'recommended', 'verified', 'sub_red', 'sub_green', 'regular'];

const makeTierCounts = (usersArr = []) => {
  const counts = TIER_ORDER.reduce((acc, t) => ({ ...acc, [t]: 0 }), { all: usersArr.length });
  (usersArr || []).forEach((u) => {
    const profile = u?.profile || u || {}; // Busca en el perfil o en el objeto raíz
    let key = 'regular';
    if (profile.is_verified) {
      key = 'verified';
    } else if (profile.is_recommended) {
      key = 'recommended';
    }
    // Aquí puedes añadir más lógica para otros tiers si los tienes en el backend
    // como sub_red, sub_green, etc.
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
  // ⚡ AÑADIMOS 'video' a la lista de campos a buscar
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

// =====================================================================
// ⚡️ 2. HELPERS PARA "COMPARTIDO POR" (Portado de la web)
// =====================================================================
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

const ReelsScreen = () => {
  const navigation = useNavigation();
  const getVideoUrl = getImageUrl;
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tema, setTema] = useState('consejos');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl, setLikesModalUrl] = useState('');
  const [likesModalTitle, setLikesModalTitle] = useState('Usuarios');
  const [initialTier, setInitialTier] = useState('all');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare, setTaskToShare] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [viewStateById, setViewStateById] = useState({});
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedActionTask, setSelectedActionTask] = useState(null);
  const [paused, setPaused] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState({});
  const videoRefs = useRef({});
  // Estados para los filtros
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSortBy, setSelectedSortBy] = useState('recent');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [selectedFavoritesOnly, setSelectedFavoritesOnly] = useState(false);
  const [selectedFavoriteUsersOnly, setSelectedFavoriteUsersOnly] = useState(false);
  const [selectedVerifiedUsersOnly, setSelectedVerifiedUsersOnly] = useState(false);
  const [selectedRecommendedUsersOnly, setSelectedRecommendedUsersOnly] = useState(false);

  const [sharedOpenById, setSharedOpenById] = useState({});
  const flatListRef = useRef(null);
  const [isUIVisible, setIsUIVisible] = useState(true);

  // ✅ LÓGICA DE CACHÉ DE CONTADORES (PORTADA DE ReelsPCH.js)
  // ✅ ZONA SEGURA: Almacena el layout de la barra de acciones para ignorar toques.
  const safeAreaLayout = useSharedValue(null);

  const [taskLikesById, setTaskLikesById] = useState({});
  const taskLikesCacheRef = useRef({});
  const [taskSharesById, setTaskSharesById] = useState({});
  const taskSharesCacheRef = useRef({});
  // ✅ CORRECCIÓN: Renombrado de followers a likes para el perfil.
  const [profileLikesById, setProfileLikesById] = useState({});
  const profileLikesCacheRef = useRef({});



  useEffect(() => {
    api.get('users/me/').then(res => setCurrentUserId(res.data.id)).catch(() => {});
  }, []);

  const fetchReels = async (pageNumber = 1, filters = {}) => {
    try {
      if (pageNumber === 1) setLoading(true);
      const currentCatFilter = filters.category !== undefined ? filters.category : selectedCategory;
      const primaryCategory = currentCatFilter ? currentCatFilter.split(',')[0].trim() : '';

      const response = await api.get('tasks/', {
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
      const validReels = data.map(task => {
        const anyVideo = getFirstVideoAnywhere(task);
        if (anyVideo) {
            return { ...task, _anyVideo: anyVideo };
        }
        return null;
      }).filter(Boolean);

      if (pageNumber === 1) {
        setReels(validReels);
      } else {
        setReels(prev => [...prev, ...validReels]);
      }
      setHasMore(!!response.data.next);
      setPage(pageNumber);
    } catch (error) {
      console.error('Error fetching reels:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FETCH DE LIKES POR TIER (PORTADO DE ReelsPCH.js)
  const fetchTaskLikesSummary = useCallback(async (taskId) => {
    if (!taskId || taskLikesCacheRef.current[taskId]?.status) return;

    taskLikesCacheRef.current[taskId] = { status: "loading" };
    setTaskLikesById(prev => ({ ...prev, [taskId]: { status: "loading", counts: prev[taskId]?.counts || null } }));

    try {
      const { data } = await api.get(`tasks/${taskId}/users-who-liked/`);
      const normalized = Array.isArray(data) ? data : data.results || [];
      const counts = makeTierCounts(normalized);
      taskLikesCacheRef.current[taskId] = { status: "ok" };
      setTaskLikesById(prev => ({ ...prev, [taskId]: { status: "ok", counts } }));
    } catch (err) {
      taskLikesCacheRef.current[taskId] = { status: "error" };
      setTaskLikesById(prev => ({ ...prev, [taskId]: { status: "error", counts: null } }));
    }
  }, []);

  // ✅ FETCH DE SHARES POR TIER (PORTADO DE ReelsPCH.js)
  const fetchTaskSharesSummary = useCallback(async (taskId, force = false) => {
    if (!taskId || (taskSharesCacheRef.current[taskId]?.status === 'ok' && !force)) return;

    taskSharesCacheRef.current[taskId] = { status: "loading" };
    setTaskSharesById(prev => ({ ...prev, [taskId]: { status: "loading", counts: prev[taskId]?.counts || null } }));

    try {
      // NOTA: El endpoint en ReelsPCH era 'shared-users'. Lo he ajustado a 'users-who-shared' que es el que usamos en el modal.
      // Si el endpoint correcto es otro, hay que cambiarlo aquí.
      const { data } = await api.get(`tasks/${taskId}/users-who-shared/`);
      const normalized = Array.isArray(data) ? data : data.results || [];
      const counts = makeTierCounts(normalized);
      taskSharesCacheRef.current[taskId] = { status: "ok" };
      setTaskSharesById(prev => ({ ...prev, [taskId]: { status: "ok", counts } }));
    } catch (err) {
      taskSharesCacheRef.current[taskId] = { status: "error" };
      setTaskSharesById(prev => ({ ...prev, [taskId]: { status: "error", counts: null } }));
    }
  }, []);

  // ✅ FETCH DE LIKES DE PERFIL POR TIER (Lógica portada de ReelsPCH.js)
  const fetchProfileLikesSummary = useCallback(async (profileId, force = false) => {
    if (!profileId || (profileLikesCacheRef.current[profileId]?.status === 'ok' && !force)) return;

    profileLikesCacheRef.current[profileId] = { status: "loading" };
    setProfileLikesById(prev => ({ ...prev, [profileId]: { status: "loading", counts: prev[profileId]?.counts || null } }));

    try {
      // ✅ CORRECCIÓN: Usamos el endpoint correcto para los likes del perfil.
      const { data } = await api.get(`profiles/${profileId}/likes/`);
      const normalized = Array.isArray(data) ? data : data.results || [];
      const counts = makeTierCounts(normalized);
      profileLikesCacheRef.current[profileId] = { status: "ok" };
      setProfileLikesById(prev => ({ ...prev, [profileId]: { status: "ok", counts } }));
    } catch (err) {
      profileLikesCacheRef.current[profileId] = { status: "error" };
      setProfileLikesById(prev => ({ ...prev, [profileId]: { status: "error", counts: null } }));
    }
  }, []);

  const getUserIdFromTask = (task) => {
    return task?.user?.id || task?.user_id || null;
  }

  // ✅ EFECTO PARA PRE-CARGAR DATOS DE TIER (PORTADO DE ReelsPCH.js)
  useEffect(() => {
    const currentReel = reels[activeIndex];
    const nextReel = reels[activeIndex + 1];

    if (currentReel?.id) {
      fetchTaskLikesSummary(currentReel.id);
      fetchTaskSharesSummary(currentReel.id);
      const currentUserId = getUserIdFromTask(currentReel);
      // ✅ CORRECCIÓN: Llamamos a la función de likes de perfil.
      if (currentUserId) fetchProfileLikesSummary(currentUserId);
    }
    if (nextReel?.id) {
      fetchTaskLikesSummary(nextReel.id);
      fetchTaskSharesSummary(nextReel.id);
      const nextUserId = getUserIdFromTask(nextReel);
      // ✅ CORRECCIÓN: Llamamos a la función de likes de perfil.
      if (nextUserId) fetchProfileLikesSummary(nextUserId);
    }
  // Dependemos de activeIndex y la lista de reels.
  // Los fetchers son estables gracias a useCallback.
  }, [activeIndex, reels, fetchTaskLikesSummary, fetchTaskSharesSummary, fetchProfileLikesSummary]);


  useFocusEffect(
    useCallback(() => {
      // ✅ CORRECCIÓN: Se vuelve a cargar el contenido cuando cambian los filtros o el tema.
      fetchReels(1);
      return () => {}; // Cleanup
    }, [tema, selectedCategory, selectedSortBy, selectedDateFilter, selectedFavoritesOnly, selectedFavoriteUsersOnly, selectedVerifiedUsersOnly, selectedRecommendedUsersOnly])
  );

  const handleTemaChange = (newTema) => {
    setTema(newTema);
    setActiveIndex(0);
    setReels([]);
    fetchReels(1, { tema: newTema });
  };

  const likeAnimation = useSharedValue(0);
  const likeAnimationTimeout = useRef(null);

  const toggleLike = useCallback(async (item) => {
    const originalItem = reels.find(r => r.id === item.id);
    if (!originalItem) return;

    const wasLiked = originalItem.user_has_liked;
    const newLikedState = !wasLiked;
    const increment = newLikedState ? 1 : -1;

    // 1. Actualización optimista: cambia la UI al instante.
    setReels(prev => prev.map(r => 
      r.id === item.id 
        ? { ...r, user_has_liked: newLikedState, likes_count: (r.likes_count || 0) + increment } 
        : r
    ));

    try {
      const response = await api.post(`tasks/${item.id}/like/`);
      // 3. Sincronización silenciosa con la respuesta del servidor.
      setReels(prev => prev.map(r => 
        r.id === item.id 
          ? { ...r, user_has_liked: response.data.liked, likes_count: response.data.likes_count } 
          : r
      ));
      // ✅ SOLUCIÓN: Invalidamos la caché y forzamos la recarga DESPUÉS de la respuesta exitosa.
      delete taskLikesCacheRef.current[item.id];
      // Forzamos la recarga de los contadores de tier.
      fetchTaskLikesSummary(item.id, true);
    } catch (error) {
      // 3. Reversión en caso de error.
      setReels(prev => prev.map(r => r.id === item.id ? originalItem : r));
    }
  }, [reels, fetchTaskLikesSummary]);

  const toggleProfileLike = useCallback(async (task) => {
    const userId = getUserIdFromTask(task);
    if (!userId) return;

    // Actualización optimista para una UI instantánea
    const originalTask = reels.find(r => getUserIdFromTask(r) === userId);
    if (!originalTask) return;

    const wasLiked = originalTask.user?.profile?.viewer_has_liked;
    const newLikedState = !wasLiked;
    const increment = newLikedState ? 1 : -1;

    setReels(prev => prev.map(r => {
      if (getUserIdFromTask(r) === userId) {
        // ✅ SOLUCIÓN: Se crea un objeto de reel completamente nuevo para forzar la renderización.
        // Esto garantiza que React detecte el cambio y actualice la UI permanentemente.
        return {
          ...r,
          user: { 
            ...r.user, 
            profile: { 
              ...(r.user?.profile || {}), 
              viewer_has_liked: newLikedState, 
              likes_count: ((r.user?.profile?.likes_count || 0) + increment) 
            }
          }
        };
      }
      return r;
    }));

    try {
      const response = await api.post(`profiles/${userId}/like/`);
      const serverData = response.data;

      setReels(prev => prev.map(r => {
        if (getUserIdFromTask(r) === userId) {
          // Se sincroniza de la misma manera, creando un nuevo objeto.
          return {
            ...r,
            user: { 
              ...r.user,
              profile: { 
                ...(r.user?.profile || {}), 
                viewer_has_liked: serverData.liked, 
                likes_count: serverData.likes_count 
              }
            }
          };
        }
        return r;
      }));

      delete profileLikesCacheRef.current[userId]; // Invalidar caché
      fetchProfileLikesSummary(userId, true);

    } catch (error) {
      setReels(prev => prev.map(r => getUserIdFromTask(r) === userId ? originalTask : r));
    }
  }, [reels, fetchProfileLikesSummary, getUserIdFromTask]);

  // Controlar la reproducción del video manualmente cuando el estado 'paused' o 'activeIndex' cambian
  useEffect(() => {
    const video = videoRefs.current[activeIndex];
    if (!video) return;

    if (paused) {
      video.pauseAsync();
    } else {
      video.playAsync();
    }
  }, [paused, activeIndex]);


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

      if (currentLength <= 1) return prev; // No hacer nada si no hay a dónde ir

      const currentPos = current.pos || 0;
      const nextPos = (currentPos + 1) % currentLength; // Va al siguiente y vuelve al inicio

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
      // No es necesario un re-fetch o actualizar desde la respuesta si la API solo confirma la acción. La UI ya está actualizada.
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

  // ✅ CORRECCIÓN: Se añade la función toggleFavorite que faltaba.
  const toggleFavorite = async (item) => {
    if (!item) return;
    const isFav = !item.is_favorited;
    // Actualización optimista de la UI
    setReels(prev => prev.map(r => r.id === item.id ? { ...r, is_favorited: isFav } : r));
    try {
      // Llamada a la API para confirmar
      await api.post("favoritos/agregar/", { task_id: item.id });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const openShareModal = (taskId) => {
    setTaskToShare(taskId);
    setShareModalVisible(true);
  };
  
  const handleShareSuccess = () => {
    if (!taskToShare) return;
    setReels(prev => prev.map(t => t.id === taskToShare ? { ...t, share_count: (t.share_count || 0) + 1 } : t));
    // Opcional: Invalidar y recargar el contador de tiers para shares
    if (taskSharesCacheRef.current[taskToShare]) {
      delete taskSharesCacheRef.current[taskToShare];
    }
    fetchTaskSharesSummary(taskToShare);
    setTaskToShare(null); 
  };
  const handleShowLikes = (taskId, tier = 'all') => {
    setLikesModalUrl(`tasks/${taskId}/users-who-liked/`);
    setLikesModalTitle('Me gusta');
    setInitialTier(tier);
    setLikesModalVisible(true);
  };

  const handleShowShares = (taskId, tier = 'all') => {
    setLikesModalUrl(`tasks/${taskId}/users-who-shared/`); // Asegúrate que este endpoint exista y funcione
    setLikesModalTitle('Compartido por');
    setInitialTier(tier);
    setLikesModalVisible(true);
  };

  const handleShowProfileLikes = (userId, tier = 'all') => {
    // ✅ CORRECCIÓN: Se elimina el prefijo 'api/' para evitar duplicados en la URL.
    setLikesModalUrl(`profiles/${userId}/likes/`);
    setLikesModalTitle('Likes del Perfil');
    setInitialTier(tier);
    setLikesModalVisible(true);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const onScroll = useCallback((event) => {
    const { contentOffset } = event.nativeEvent;
    const index = Math.round(contentOffset.y / windowHeight);
    setActiveIndex(index);
  }, []);
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
        {/* El botón de filtro ahora solo aparece cuando el video está pausado */}
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
            renderItem={({ item, index }) => {
              // ✅ 2. DEFINICIÓN DE GESTOS
              const tapToPause = Gesture.Tap()
                .maxDuration(250)
                .onEnd((event, success) => {
                  if (success) {
                    // Ignorar toques en la zona de botones (aprox. los últimos 80px a la derecha)
                    const touchX = event.absoluteX;
                    const rightSideThreshold = windowWidth - 80;
                    if (touchX < rightSideThreshold) {
                      runOnJS(setPaused)(p => !p);
                    }
                  }
                });

              const flingLeft = Gesture.Fling()
                .direction(Directions.LEFT)
                .onEnd(() => {
                  runOnJS(cycleViewOnly)(item);
                });

              const composedGesture = Gesture.Race(tapToPause, flingLeft);

              return (
                <GestureDetector gesture={composedGesture}>
                  <ReelItem
                    item={item}
                    index={index}
                    isActive={index === activeIndex}
                    isMuted={isMuted}
                    paused={paused}
                    playlists={buildPlaylists(item)}
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
                    openShareModal={openShareModal}
                    handleShowShares={handleShowShares}
                    handleShowLikes={handleShowLikes}
                    handleShowProfileLikes={handleShowProfileLikes}
                    openActionModal={openActionModal}
                    taskLikes={taskLikesById[item.id]}
                    taskShares={taskSharesById[item.id]}
                    profileLikes={profileLikesById[getUserIdFromTask(item)]}
                    handleToggleProfileFavoriteDirect={handleToggleProfileFavoriteDirect}
                    tema={tema}
                  />
                </GestureDetector>
              );
            }}
            keyExtractor={(item) => item.id.toString()}
            pagingEnabled
            onScroll={onScroll}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
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
        {/* Este es el modal que se abrirá con el nuevo botón */}

        {/* Modales */}
        <ShareModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          taskId={taskToShare}
          onShareSuccess={handleShareSuccess}
        />
        
        {/* Modal Acciones 3 puntos */}
        <Modal visible={actionModalVisible} transparent animationType='fade' onRequestClose={() => setActionModalVisible(false)}>
          <TouchableOpacity style={styles.overlayModal} activeOpacity={1} onPress={() => setActionModalVisible(false)}>
            <View style={styles.actionModalContainer}>
              <View style={styles.modalDragHandle} />
              {selectedActionTask && (
                <>
                  {/* ⚡ AÑADIMOS LA OPCIÓN PARA OCULTAR/MOSTRAR LA INTERFAZ */}
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
