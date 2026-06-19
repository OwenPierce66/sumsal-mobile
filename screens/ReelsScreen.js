import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Dimensions, Platform, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Alert } from 'react-native';
import { Video, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import api from '../api';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ShareModal from '../components/ShareModal';
import LikesListModal from '../components/LikesListModal';

const { height: windowHeight, width: windowWidth } = Dimensions.get('window');

const getVideoUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') && !path.includes('localhost') && !path.includes('127.0.0.1') && !path.includes('192.168.')) {
    return path;
  }
  const IP = Platform.OS === 'web' ? 'localhost' : '192.168.2.119';
  let cleanPath = path;
  if (cleanPath.startsWith('http')) {
    const urlObj = new URL(path);
    cleanPath = urlObj.pathname;
  }
  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
  return 'http://' + IP + ':8001' + cleanPath;
};

const getImageUrl = getVideoUrl;

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

const ReelsScreen = ({ navigation }) => {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tema, setTema] = useState('consejos');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl, setLikesModalUrl] = useState('');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [taskToShare, setTaskToShare] = useState(null);
  const lastTap = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [viewStateById, setViewStateById] = useState({});
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedActionTask, setSelectedActionTask] = useState(null);
  const [paused, setPaused] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState({});
  const videoRefs = useRef({});
  const flatListRef = useRef(null);

  useEffect(() => {
    api.get('users/me/').then(res => setCurrentUserId(res.data.id)).catch(() => {});
  }, []);

  const fetchReels = async (pageNumber = 1, currentTema = tema) => {
    try {
      if (pageNumber === 1) setLoading(true);
      const response = await api.get('tasks/', {
        params: { pch: currentTema, page: pageNumber }
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

  useFocusEffect(
    useCallback(() => {
      fetchReels(1, tema);
      return () => {};
    }, [tema])
  );

  const handleTemaChange = (newTema) => {
    setTema(newTema);
    setActiveIndex(0);
    setReels([]);
    fetchReels(1, newTema);
  };

  const toggleLike = async (item) => {
    const isLiked = !item.user_has_liked;
    const increment = isLiked ? 1 : -1;
    
    setReels(prev => prev.map(r => r.id === item.id ? { ...r, user_has_liked: isLiked, likes_count: (r.likes_count || 0) + increment } : r));

    try {
      const response = await api.post(`tasks/${item.id}/like/`);
      setReels(prev => prev.map(r => r.id === item.id ? { ...r, user_has_liked: response.data.liked, likes_count: response.data.likes_count } : r));
    } catch (error) {
      console.error('Error liking reel:', error);
    }
  };

  const toggleFavorite = async (item) => {
    const isFav = !item.is_favorited;
    setReels(prev => prev.map(r => r.id === item.id ? { ...r, is_favorited: isFav } : r));
    try {
      await api.post("favoritos/agregar/", { task_id: item.id });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

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
      setReels(prev => prev.map(t => (t.user && t.user.id === perfilId) ? { ...t, user: { ...t.user, is_favorited: isFav } } : t));
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

  const openShareModal = (taskId) => {
    setTaskToShare(taskId);
    setShareModalVisible(true);
  };
  
  const handleShareSuccess = () => {
    if (!taskToShare) return;
    setReels(prev => prev.map(t => t.id === taskToShare ? { ...t, share_count: (t.share_count || 0) + 1 } : t));
    setTaskToShare(null);
  };
  const handleShowLikes = (taskId) => {
    setLikesModalUrl(`tasks/${taskId}/users-who-liked/`);
    setLikesModalVisible(true);
  };

  const handleShowShares = (taskId) => {
    setLikesModalUrl(`tasks/${taskId}/users-who-shared/`);
    setLikesModalVisible(true);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const formatTime = (millis) => {
    if (!millis) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  const scrollToIndex = (index) => {
    if (flatListRef.current && index >= 0 && index < reels.length) {
      flatListRef.current.scrollToIndex({ animated: true, index });
    }
  };

  const renderItem = ({ item, index }) => {
    const isVisible = index === activeIndex;

    const tap = Gesture.Tap()
      .maxDuration(250)
      .onEnd((_event, success) => { // Usamos onEnd para no interferir con el swipe
        if (success) {
          setPaused(p => !p);
        }
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(250)
      .onStart(() => {
        if (!item.user_has_liked) {
          toggleLike(item);
        }
      });

    const pan = Gesture.Pan()
      .onEnd((e) => {
        const { translationX, translationY } = e;

        // Prioridad al swipe vertical para cambiar de reel
        if (Math.abs(translationY) > Math.abs(translationX) && Math.abs(translationY) > 40) {
          if (translationY < 0 && activeIndex < reels.length - 1) { // Swipe hacia arriba
            scrollToIndex(activeIndex + 1);
          } else if (translationY > 0 && activeIndex > 0) { // Swipe hacia abajo
            scrollToIndex(activeIndex - 1);
          }
          return;
        }

        // Swipe horizontal para cambiar de clip dentro del reel
        if (Math.abs(translationX) > Math.abs(translationY) && Math.abs(translationX) > 40) {
          if (translationX < 0) { // Swipe a la izquierda
            navigateClip(item, 1);
          } else { // Swipe a la derecha
            navigateClip(item, -1);
          }
        }
      });

    const composedGesture = Gesture.Race(pan, Gesture.Exclusive(doubleTap, tap));

    const playlists = buildPlaylists(item);
    const rawState = viewStateById[item.id] || { mode: "main", pos: 0 };
    const VIEW_ORDER = ["main", "factores", "fuentes"];
    const fallbackMode = VIEW_ORDER.find((m) => (playlists?.[m]?.length || 0) > 0) || "main";
    const effMode = playlists?.[rawState.mode]?.length ? rawState.mode : fallbackMode;
    const len = playlists?.[effMode]?.length || 0;
    const effPos = len ? Math.min(Math.max(0, rawState.pos || 0), len - 1) : 0;

    const list = playlists[effMode] || [];
    const entry = list[effPos] || null;
    const videoSrc = entry ? entry.src : item._anyVideo;
    
    const extraCount = (playlists.factores?.length > 0 ? 1 : 0) + (playlists.fuentes?.length > 0 ? 1 : 0);
    const badgeCount = extraCount === 0 ? 0 : extraCount === 1 ? 1 : effMode === "main" ? 2 : 1;
    const viewLabel = effMode === "main" ? tema : effMode === "factores" ? "factor" : "fuente";
    const counterLabel = list.length ? `${effPos + 1}/${list.length}` : "—";

    return (
      <GestureDetector gesture={composedGesture}>
        <View style={styles.reelContainer}>
          <Video
            ref={ref => { videoRefs.current[index] = ref; }}
            source={{ uri: getVideoUrl(videoSrc) }}
            style={styles.video}
            resizeMode="cover"
            shouldPlay={isVisible && !paused}
            isLooping
            isMuted={isMuted}
            onPlaybackStatusUpdate={(status) => {
              if (isVisible) {
                setPlaybackStatus(status);
              }
            }}
          />

          <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.bottomSection} pointerEvents="box-none">
                <TouchableOpacity 
                  style={styles.userInfo} 
                  onPress={() => navigation.navigate('UserProfile', { userId: item.user?.id, userName: item.user?.username, userAvatar: getImageUrl(item.user?.user_image) })}
                >
                  <Text style={styles.username}>@{item.user?.username || 'Usuario'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => toggleDescription(item.id)} activeOpacity={0.8}>
                  {effMode !== 'main' && (
                      <Text style={styles.title} numberOfLines={1}>{entry?.item?.title || viewLabel}</Text>
                  )}
                  {effMode === 'main' ? (
                     <>
                       <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                       <Text style={styles.description} numberOfLines={expandedDescriptions[item.id] ? undefined : 2}>
                         {entry?.groupIndex != null && entry?.item?.description ? `${item.description} • ${entry.item.description}` : item.description}
                       </Text>
                     </>
                  ) : (
                     <Text style={styles.description} numberOfLines={expandedDescriptions[item.id] ? undefined : 2}>{entry?.item?.description}</Text>
                  )}
                </TouchableOpacity>
                
                {item.categories ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                    {item.categories.split(',').map((cat, idx) => (
                      <View key={idx} style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{cat.trim()}</Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
              
              <View style={styles.rightSection}>
                <TouchableOpacity 
                  style={styles.avatarContainer}
                  onPress={() => navigation.navigate('UserProfile', { userId: item.user?.id, userName: item.user?.username, userAvatar: getImageUrl(item.user?.user_image) })}
                >
                  <Image source={{ uri: getImageUrl(item.user?.user_image) || 'https://ui-avatars.com/api/?name=User' }} style={styles.avatar} />
                  <TouchableOpacity 
                    style={styles.followBtn}
                    onPress={() => handleToggleProfileFavoriteDirect(item)}
                  >
                    <Ionicons name={item.user?.is_favorited ? "checkmark" : "add"} size={14} color="#fff" />
                  </TouchableOpacity>
                </TouchableOpacity>
    
                <View style={styles.iconButton}>
                  <TouchableOpacity onPress={() => cycleViewOnly(item)}>
                    <View>
                      <Ionicons name="layers" size={32} color="white" />
                      {badgeCount > 0 && (
                        <View style={styles.badgeContainer}><Text style={styles.badgeText}>{badgeCount}</Text></View>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => cycleClipWithinView(item)}>
                    <Text style={styles.iconText}>{viewLabel}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.iconText, { fontSize: 10, marginTop: 0 }]}>{counterLabel}</Text>
                </View>
    
                <TouchableOpacity style={styles.iconButton} onPress={() => toggleLike(item)} onLongPress={() => handleShowLikes(item.id)}>
                  <Ionicons name={item.user_has_liked ? "heart" : "heart"} size={35} color={item.user_has_liked ? "#ff004f" : "white"} />
                  <Text style={styles.iconText}>{item.likes_count || 0}</Text>
                </TouchableOpacity>
    
                <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
                  <Ionicons name="chatbubble-ellipses" size={32} color="white" />
                  <Text style={styles.iconText}>{item.comments_count || 0}</Text>
                </TouchableOpacity>
    
                <TouchableOpacity style={styles.iconButton} onPress={() => toggleFavorite(item)}>
                  <Ionicons name={item.is_favorited ? "bookmark" : "bookmark"} size={30} color={item.is_favorited ? "#f1c40f" : "white"} />
                  <Text style={styles.iconText}>{item.is_favorited ? "Guardado" : "Guardar"}</Text>
                </TouchableOpacity>
    
                <TouchableOpacity style={styles.iconButton} onPress={() => openShareModal(item.id)} onLongPress={() => handleShowShares(item.id)}>
                  <Ionicons name="arrow-redo" size={35} color="white" />
                  <Text style={styles.iconText}>{item.share_count || 0}</Text>
                </TouchableOpacity>
    
                <TouchableOpacity style={styles.iconButton} onPress={() => openActionModal(item)}>
                  <Ionicons name="ellipsis-vertical" size={32} color="white" />
                </TouchableOpacity>
              </View>
          </View>

          <TouchableOpacity style={styles.muteBtn} onPress={() => setIsMuted(!isMuted)}>
            <Ionicons name={isMuted ? "volume-mute" : "volume-medium"} size={22} color="#fff" />
          </TouchableOpacity>

          {/* REPRODUCTOR DE VIDEO CUANDO ESTÁ PAUSADO */}
          {isVisible && paused && (
            <View style={styles.playerContainer} pointerEvents="box-auto">
              <View style={styles.playerTimeContainer}>
                <Text style={styles.playerTimeText}>
                  {formatTime(playbackStatus.positionMillis)} / {formatTime(playbackStatus.durationMillis)}
                </Text>
              </View>
              <View style={styles.playerControls}>
                <TouchableOpacity onPress={() => setPaused(false)} style={styles.playerButton}>
                  <Ionicons name="play" size={22} color="#fff" />
                </TouchableOpacity>
                <Slider
                  style={{ flex: 1 }}
                  minimumValue={0}
                  maximumValue={playbackStatus.durationMillis || 1}
                  value={playbackStatus.positionMillis || 0}
                  onSlidingComplete={async (value) => {
                    const video = videoRefs.current[index];
                    if (video) {
                      await video.setPositionAsync(value);
                    }
                  }}
                  minimumTrackTintColor="#fff"
                  maximumTrackTintColor="rgba(255, 255, 255, 0.5)"
                  thumbTintColor="#fff"
                />
              </View>
            </View>
          )}
        </View>
      </GestureDetector>
    );
  };

  return (
    <View style={styles.container}>
      <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.topBar}>
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
        {loading && reels.length === 0 ? (
          <ActivityIndicator size="large" color="#fff" style={{flex: 1, justifyContent: 'center'}} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={reels}
            keyExtractor={(item, index) => item.id + '-' + index}
            renderItem={renderItem}
            scrollEnabled={false} // Deshabilitamos el scroll nativo
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged} // Asegúrate que onViewableItemsChanged esté definido
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            onEndReached={() => { if (hasMore && !loading) { fetchReels(page + 1, tema); } }}
            onEndReachedThreshold={0.5}
          />
        )}

        {/* Modales */}
        <LikesListModal 
          visible={likesModalVisible} 
          onClose={() => setLikesModalVisible(false)} 
          apiUrl={likesModalUrl} 
        />
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
      </GestureHandlerRootView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  topTab: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '700', marginHorizontal: 12, textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 3 },
  activeTab: { color: '#fff', fontSize: 18, borderBottomWidth: 2, borderBottomColor: '#fff', paddingBottom: 4 },
  muteBtn: { position: 'absolute', right: 20, top: Platform.OS === 'ios' ? 45 : 15, zIndex: 10, padding: 8, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  reelContainer: { width: windowWidth, height: windowHeight },
  video: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: Platform.OS === 'ios' ? 90 : 70, zIndex: 1 },
  bottomSection: { flex: 1, padding: 15, paddingRight: 0, justifyContent: 'flex-end' },
  userInfo: { marginBottom: 10 },
  username: { color: '#fff', fontSize: 16, fontWeight: 'bold', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 4 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 6, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 4 },
  description: { color: '#fff', fontSize: 14, marginBottom: 12, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 4 },
  categoriesScroll: { flexDirection: 'row', marginBottom: 5 },
  categoryBadge: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  categoryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rightSection: { width: 70, paddingBottom: 15, alignItems: 'center', justifyContent: 'flex-end' },
  avatarContainer: { marginBottom: 30, alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: '#fff' },
  followBtn: { position: 'absolute', bottom: -8, backgroundColor: '#ff004f', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  iconButton: { alignItems: 'center', marginBottom: 20 },
  iconText: { color: '#fff', fontSize: 13, marginTop: 4, fontWeight: 'bold', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 4 },
  badgeContainer: { position: 'absolute', top: -5, right: -10, backgroundColor: '#ff004f', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  overlayModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actionModalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 40 : 24, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  modalDragHandle: { width: 40, height: 4, backgroundColor: "#e0e0e0", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  actionOption: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: "#f5f5f5" },
  actionOptionDelete: { backgroundColor: "#ffe3e3" },
  actionText: { fontSize: 16, marginLeft: 14, color: "#333", fontWeight: "500" },  
  playerContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 90 : 70, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 10, zIndex: 20 },
  playerTimeContainer: { width: '100%', alignItems: 'flex-end', marginBottom: 5 },
  playerTimeText: { color: '#fff', fontSize: 12, fontWeight: '600', textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  playerControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playerButton: { padding: 8 },
});

export default ReelsScreen;
