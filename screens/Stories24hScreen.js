import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image as RNImage,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getImageUrl } from '../api';
import TieredLikesModal from './TieredLikesModal';
import TouchableUsername from '../components/TouchableUsername';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const IMAGE_DURATION_MS = 6500;
const STORY_WINDOW_MS = 24 * 60 * 60 * 1000;

const cleanVal = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseCreatedAtMs = (story) => {
  const raw = story?.created_at || story?.createdAt || null;
  if (!raw) return null;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : null;
};

const getStoryMedia = (story) => {
  const videoPath =
    cleanVal(story?.video) ||
    cleanVal(story?.primary_video) ||
    cleanVal(story?.video_url) ||
    cleanVal(story?.media_url) ||
    cleanVal(story?.source_item_video) ||
    cleanVal(story?.source_task_video) ||
    cleanVal(story?.subtasks?.[0]?.video) ||
    cleanVal(story?.subfactores?.[0]?.video) ||
    cleanVal(story?.subfuentes?.[0]?.video);

  if (videoPath) {
    return { type: 'video', src: getImageUrl(videoPath) };
  }

  const imagePath =
    cleanVal(story?.image) ||
    cleanVal(story?.image_url) ||
    cleanVal(story?.photo) ||
    cleanVal(story?.picture) ||
    cleanVal(story?.source_item_image) ||
    cleanVal(story?.source_task_image) ||
    cleanVal(story?.subtasks?.[0]?.image) ||
    cleanVal(story?.subfactores?.[0]?.image) ||
    cleanVal(story?.subfuentes?.[0]?.image);

  if (imagePath) {
    return { type: 'image', src: getImageUrl(imagePath) };
  }

  return null;
};

const formatAgo = (ms, nowMs) => {
  if (!ms) return '';
  const diff = Math.max(0, nowMs - ms);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const getExtensionFromMime = (mimeType, fallback = 'bin') => {
  if (!mimeType) return fallback;
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  return fallback;
};

const looksLikeVideoName = (name) => {
  if (!name) return false;
  return /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(String(name));
};

const isLikelyVideoFile = (file, fallbackType, uri) => {
  const mime = file?.type || '';
  const name = file?.name || '';
  const rawUri = String(uri || '').toLowerCase();
  const uriLooksVideo =
    rawUri.startsWith('data:video/')
    || rawUri.includes('video/mp4')
    || rawUri.includes('video/webm')
    || /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(rawUri);
  return mime.startsWith('video/') || looksLikeVideoName(name) || uriLooksVideo || fallbackType === 'video';
};

const Stories24hScreen = ({ route }) => {
  const navigation = useNavigation();
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());
  const [currentUserId, setCurrentUserId] = useState(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeUserIndex, setActiveUserIndex] = useState(0);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [sourcePromptVisible, setSourcePromptVisible] = useState(false);
  const [sourcePromptPosition, setSourcePromptPosition] = useState({ left: 12, top: 12 });
  const [storyReplyText, setStoryReplyText] = useState('');
  const [sendingStoryReply, setSendingStoryReply] = useState(false);

  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalUrl, setLikesModalUrl] = useState('');
  const [likesModalTitle, setLikesModalTitle] = useState('Usuarios');

  const [shareSourceTaskId, setShareSourceTaskId] = useState(null);
  const [shareToStoryCaption, setShareToStoryCaption] = useState('');
  const [sharingToStory, setSharingToStory] = useState(false);
  const [shareToStoryError, setShareToStoryError] = useState('');
  const [sharedStories, setSharedStories] = useState({});
  const [shareActionModalVisible, setShareActionModalVisible] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadUri, setUploadUri] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadError, setUploadError] = useState('');

  const imageTimerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const lastFinishedStoryIdRef = useRef(null);
  const pausedBeforeSourcePromptRef = useRef(false);
  const sharedStoryCardSizeRef = useRef({ width: 0, height: 0 });
  const viewerVideoRef = useRef(null);
  const pausedBeforeReplyRef = useRef(false);
  const storyReplyInputRef = useRef(null);

  const resetUploadState = useCallback(() => {
    if (Platform.OS === 'web' && uploadUri && uploadUri.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(uploadUri);
      } catch (error) {}
    }
    setUploadUri(null);
    setUploadFile(null);
    setUploadType(null);
    setUploadCaption('');
    setUploadError('');
  }, [uploadUri]);

  useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && uploadUri && uploadUri.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(uploadUri);
        } catch (error) {}
      }
    };
  }, [uploadUri]);

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const resolveCurrentUser = async () => {
      try {
        const meResponse = await api.get('users/me/');
        const meId = meResponse?.data?.id || null;
        if (meId) {
          setCurrentUserId(meId);
          fetchFavorites(meId);
          return;
        }
      } catch (error) {}

      try {
        const fallbackId = await AsyncStorage.getItem('userId');
        if (fallbackId) {
          setCurrentUserId(fallbackId);
          fetchFavorites(fallbackId);
        }
      } catch (error) {}
    };

    resolveCurrentUser();
  }, []);

  const fetchFavorites = useCallback(async (userId) => {
    try {
      // Obtener lista de perfiles favoritos del usuario actual
      const response = await api.get('pfavoritos/listar/');
      
      console.log('[Stories24hScreen] fetchFavorites RAW response:', response.data);
      
      // El endpoint retorna un array directo de usuarios (SimpleUserSerializer)
      let data = response.data;
      if (data?.results) {
        data = data.results;
      }
      
      console.log('[Stories24hScreen] fetchFavorites parsed data:', data);
      
      const favoritesList = Array.isArray(data)
        ? data.map(item => {
            console.log('[Stories24hScreen] favorite item:', item);
            return {
              id: item.id,
              username: item.username || 'Usuario',
              user_image: item.user_image,
            };
          })
        : [];
      
      console.log('[Stories24hScreen] fetchFavorites loaded', favoritesList.length, 'favorites:', favoritesList);
      setFavorites(favoritesList);
    } catch (error) {
      console.log('[Stories24hScreen] fetchFavorites error:', error.message);
    }
  }, []);

  const fetchStories = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('stories/', {
        params: { limit: 60, offset: 0 },
      });
      const rawItems = Array.isArray(response.data?.results) ? response.data.results : [];
      const sharedMetaMap = JSON.parse((await AsyncStorage.getItem('sharedStoriesMetadata')) || '{}');
      const mappedStories = rawItems
        .map((story) => {
          const createdMs = parseCreatedAtMs(story);
          const media = getStoryMedia(story);
          const storyMeta = sharedMetaMap[String(story.id)] || {};
          return {
            ...story,
            ...storyMeta,
            _createdMs: createdMs,
            _storyMedia: media,
          };
        })
        .filter((story) => !!story._storyMedia && (story._createdMs ? nowMs - story._createdMs <= STORY_WINDOW_MS : true));
      setStories(mappedStories);
      
      // Load shared stories metadata
      const sharedMetadata = await AsyncStorage.getItem('sharedStoriesMetadata');
      if (sharedMetadata) {
        setSharedStories(JSON.parse(sharedMetadata));
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las historias.');
      setStories([]);
    } finally {
      setIsLoading(false);
    }
  }, [nowMs]);

  useFocusEffect(
    useCallback(() => {
      fetchStories();
    }, [fetchStories])
  );

  const storyUsers = useMemo(() => {
    const grouped = new Map();
    stories.forEach((story) => {
      const userId = story?.user?.id || story?.user_id;
      if (!userId) return;
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          userId,
          username: cleanVal(story?.user?.username) || cleanVal(story?.username) || 'Usuario',
          avatar: getImageUrl(story?.user?.user_image),
          latestMs: story._createdMs || 0,
          stories: [],
        });
      }
      const current = grouped.get(userId);
      current.stories.push(story);
      current.latestMs = Math.max(current.latestMs, story._createdMs || 0);
    });

    const users = Array.from(grouped.values()).map((entry) => ({
      ...entry,
      stories: [...entry.stories].sort((a, b) => (a._createdMs || 0) - (b._createdMs || 0)),
    }));

    users.sort((a, b) => (b.latestMs || 0) - (a.latestMs || 0));
    return users;
  }, [stories]);

  const activeUser = storyUsers[activeUserIndex] || null;
  const activeStory = activeUser?.stories?.[activeStoryIndex] || null;
  const activeMedia = activeStory?._storyMedia || null;
  const activeStoryOwnerId = activeStory?.user?.id || activeStory?.user_id || null;
  const activeStoryOwnerUsername = cleanVal(activeStory?.user?.username);
  const activeStoryOriginalUsername = cleanVal(activeStory?.username);
  const activeSourceMeta = activeStory ? (sharedStories[activeStory.id] || {}) : {};
  const originalAuthorName =
    cleanVal(activeSourceMeta.source_task_user)
    || activeStoryOriginalUsername
    || activeStoryOwnerUsername;
  const originalAuthorId = activeSourceMeta.source_task_user_id || activeStory?.user?.id || null;
  const originalTitle = cleanVal(activeSourceMeta.source_task_title) || cleanVal(activeStory?.title);
  const sourceItemTitle = cleanVal(activeSourceMeta.source_item_title);
  const sourceDescription =
    cleanVal(activeSourceMeta.source_item_description)
    || cleanVal(activeSourceMeta.source_task_description)
    || cleanVal(activeStory?.description);
  const originalTaskId =
    activeSourceMeta.source_task_id
    || activeStory?.source_task_id
    || activeStory?.story_source_task
    || null;
  const isSharedStoryPreview = !!(
    activeStory && (
      sharedStories[activeStory.id]
      || activeStory.story_is_shared
      || activeStory.story_source_task
      || activeStory.source_task_id
      || activeStory.source_task_title
      || activeStory.source_task_user
      || activeStory.source_item_title
      || activeStory.source_item_description
      || activeStory.source_task_description
      || (
        activeStoryOriginalUsername
        && activeStoryOwnerUsername
        && activeStoryOriginalUsername !== activeStoryOwnerUsername
      )
    )
  );
  const isOwnActiveStory = !!(currentUserId && activeStoryOwnerId && String(currentUserId) === String(activeStoryOwnerId));
  const isUploadVideo = useMemo(
    () => isLikelyVideoFile(uploadFile, uploadType, uploadUri),
    [uploadFile, uploadType, uploadUri]
  );

  const clearStoryTimers = useCallback(() => {
    if (imageTimerRef.current) {
      clearTimeout(imageTimerRef.current);
      imageTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const closeViewer = useCallback(() => {
    clearStoryTimers();
    setSourcePromptVisible(false);
    setViewerOpen(false);
    setPaused(false);
    setProgress(0);
    setActiveUserIndex(0);
    setActiveStoryIndex(0);
  }, [clearStoryTimers]);

  const showSharedStorySourcePrompt = useCallback((event) => {
    event?.stopPropagation?.();
    if (!originalTaskId) return;

    const { locationX, locationY } = event?.nativeEvent || {};
    const { width, height } = sharedStoryCardSizeRef.current;
    const promptWidth = 42;
    const promptHeight = 30;
    const edgeGap = 8;
    const tapX = Number.isFinite(locationX) ? locationX : width / 2;
    const tapY = Number.isFinite(locationY) ? locationY : height / 2;

    setSourcePromptPosition({
      left: Math.max(edgeGap, Math.min(tapX - (promptWidth / 2), width - promptWidth - edgeGap)),
      top: Math.max(edgeGap, Math.min(tapY - promptHeight - 12, height - promptHeight - edgeGap)),
    });
    pausedBeforeSourcePromptRef.current = paused;
    setPaused(true);
    setSourcePromptVisible(true);
  }, [originalTaskId, paused]);

  const dismissSharedStorySourcePrompt = useCallback((event) => {
    event?.stopPropagation?.();
    setSourcePromptVisible(false);
    setPaused(pausedBeforeSourcePromptRef.current);
  }, []);

  const openSharedStorySource = useCallback((event) => {
    event?.stopPropagation?.();
    if (!originalTaskId) return;

    setSourcePromptVisible(false);
    closeViewer();
    navigation.navigate('Tasks', {
      screen: 'TaskDetail',
      params: { taskId: String(originalTaskId) },
    });
  }, [originalTaskId, closeViewer, navigation]);

  const openViewerFor = useCallback((userIndex) => {
    if (userIndex < 0 || userIndex >= storyUsers.length) return;
    clearStoryTimers();
    setActiveUserIndex(userIndex);
    setActiveStoryIndex(0);
    setPaused(false);
    setProgress(0);
    setViewerOpen(true);
  }, [clearStoryTimers, storyUsers.length]);

  useEffect(() => {
    const targetStoryId = route?.params?.openStoryId;
    if (!targetStoryId || storyUsers.length === 0) return;

    const targetUserIndex = storyUsers.findIndex((userItem) =>
      (userItem.stories || []).some((story) => String(story.id) === String(targetStoryId))
    );

    if (targetUserIndex < 0) {
      navigation.setParams?.({ openStoryId: undefined });
      return;
    }

    const targetStoryIndex = (storyUsers[targetUserIndex]?.stories || []).findIndex(
      (story) => String(story.id) === String(targetStoryId)
    );

    clearStoryTimers();
    setActiveUserIndex(targetUserIndex);
    setActiveStoryIndex(Math.max(0, targetStoryIndex));
    setPaused(false);
    setProgress(0);
    setViewerOpen(true);
    navigation.setParams?.({ openStoryId: undefined });
  }, [route?.params?.openStoryId, storyUsers, clearStoryTimers, navigation]);

  useEffect(() => {
    setStoryReplyText('');
  }, [activeStory?.id]);

  const goNextUser = useCallback(() => {
    if (activeUserIndex < storyUsers.length - 1) {
      setActiveUserIndex((prev) => prev + 1);
      setActiveStoryIndex(0);
      setProgress(0);
      setPaused(false);
      return true;
    }
    return false;
  }, [activeUserIndex, storyUsers.length]);

  const goPrevUser = useCallback(() => {
    if (activeUserIndex > 0) {
      setActiveUserIndex((prev) => prev - 1);
      const prevStories = storyUsers[activeUserIndex - 1]?.stories?.length || 1;
      setActiveStoryIndex(Math.max(0, prevStories - 1));
      setProgress(0);
      setPaused(false);
      return true;
    }
    return false;
  }, [activeUserIndex, storyUsers]);

  const nextStory = useCallback(() => {
    if (!activeUser) return;
    if (activeStoryIndex < (activeUser.stories.length - 1)) {
      setActiveStoryIndex((prev) => prev + 1);
      setProgress(0);
      setPaused(false);
      return;
    }
    const moved = goNextUser();
    if (!moved) closeViewer();
  }, [activeUser, activeStoryIndex, goNextUser, closeViewer, activeUserIndex, activeStory?.id]);

  const prevStory = useCallback(() => {
    if (!activeUser) return;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((prev) => prev - 1);
      setProgress(0);
      setPaused(false);
      return;
    }
    const moved = goPrevUser();
    if (!moved) closeViewer();
  }, [activeUser, activeStoryIndex, goPrevUser, closeViewer]);

  useEffect(() => {
    clearStoryTimers();
    if (!viewerOpen || !activeStory || !activeMedia || paused) return undefined;

    if (activeMedia.type === 'image') {
      const startMs = Date.now();
      progressTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startMs;
        setProgress(Math.min(1, elapsed / IMAGE_DURATION_MS));
      }, 60);

      imageTimerRef.current = setTimeout(() => {
        setProgress(1);
        nextStory();
      }, IMAGE_DURATION_MS);
    }

    return () => clearStoryTimers();
  }, [viewerOpen, activeStory?.id, activeMedia?.type, paused, nextStory, clearStoryTimers, activeUserIndex, activeStoryIndex]);

  useEffect(() => {
    if (!viewerOpen || activeMedia?.type !== 'video' || !viewerVideoRef.current) return;

    const syncVideoPlayback = async () => {
      try {
        if (paused) {
          await viewerVideoRef.current.pauseAsync();
        } else {
          await viewerVideoRef.current.playAsync();
        }
      } catch (error) {
        console.warn('[Stories24hScreen] No se pudo sincronizar la pausa del video:', error);
      }
    };

    syncVideoPlayback();
  }, [viewerOpen, activeStory?.id, activeMedia?.type, paused]);

  const updateStoryById = useCallback((storyId, updater) => {
    setStories((prev) => prev.map((story) => {
      if (String(story.id) !== String(storyId)) return story;
      return updater(story);
    }));
  }, []);

  useEffect(() => {
    lastFinishedStoryIdRef.current = null;
    setSourcePromptVisible(false);
    setStoryReplyText('');
  }, [activeStory?.id]);

  useEffect(() => {
    if (!viewerOpen) return;

    if (storyUsers.length === 0) {
      closeViewer();
      return;
    }

    if (activeUserIndex >= storyUsers.length) {
      const fixedUserIndex = Math.max(0, storyUsers.length - 1);
      setActiveUserIndex(fixedUserIndex);
      setActiveStoryIndex(0);
      return;
    }

    const currentStories = storyUsers[activeUserIndex]?.stories || [];
    if (currentStories.length === 0) {
      if (activeUserIndex < storyUsers.length - 1) {
        setActiveUserIndex((prev) => Math.min(prev + 1, storyUsers.length - 1));
        setActiveStoryIndex(0);
      } else {
        closeViewer();
      }
      return;
    }

    if (activeStoryIndex >= currentStories.length) {
      const fixedStoryIndex = Math.max(0, currentStories.length - 1);
      setActiveStoryIndex(fixedStoryIndex);
    }
  }, [viewerOpen, storyUsers, activeUserIndex, activeStoryIndex, closeViewer]);

  useEffect(() => {
    if (!viewerOpen) return;
  }, [viewerOpen, activeUserIndex, activeStoryIndex, activeUser?.userId, activeStory?.id, activeMedia]);

  useEffect(() => {
    if (!viewerOpen || !activeStory?.id || !currentUserId || isOwnActiveStory) return;

    api.post(`stories/${activeStory.id}/view/`).catch((error) => {
      console.error(
        '[Stories24hScreen] No se pudo registrar la visualización:',
        error.response?.data || error.message
      );
    });
  }, [viewerOpen, activeStory?.id, currentUserId, isOwnActiveStory]);

  const handleToggleLike = useCallback(async () => {
    if (!activeStory) return;
    const storyId = activeStory.id;
    const liked = !!activeStory.user_has_liked;

    updateStoryById(storyId, (story) => ({
      ...story,
      user_has_liked: !liked,
      likes_count: (story.likes_count || 0) + (liked ? -1 : 1),
    }));

    try {
      const response = await api.post(`tasks/${storyId}/like/`);
      const finalLiked = !!response.data?.liked;
      const finalCount = response.data?.likes_count ?? 0;
      updateStoryById(storyId, (story) => ({
        ...story,
        user_has_liked: finalLiked,
        likes_count: finalCount,
      }));
    } catch (error) {
      updateStoryById(storyId, (story) => ({
        ...story,
        user_has_liked: liked,
        likes_count: (story.likes_count || 0) + (liked ? 1 : -1),
      }));
      Alert.alert('Error', 'No se pudo actualizar el like.');
    }
  }, [activeStory, updateStoryById]);

  const handleToggleFavorite = useCallback(async () => {
    if (!activeStory) return;
    const storyId = activeStory.id;
    const isFavorited = !!activeStory.is_favorited;

    updateStoryById(storyId, (story) => ({ ...story, is_favorited: !isFavorited }));
    try {
      await api.post('favoritos/agregar/', { task_id: storyId });
    } catch (error) {
      updateStoryById(storyId, (story) => ({ ...story, is_favorited: isFavorited }));
      Alert.alert('Error', 'No se pudo actualizar favorito.');
    }
  }, [activeStory, updateStoryById]);

  const handleShowLikes = useCallback((storyId) => {
    setPaused(true);
    setLikesModalTitle('Me gusta');
    setLikesModalUrl(`tasks/${storyId}/users-who-liked/`);
    setLikesModalVisible(true);
  }, []);

  const handleShowShares = useCallback((storyId) => {
    setPaused(true);
    setLikesModalTitle('Compartido por');
    setLikesModalUrl(`tasks/${storyId}/users-who-shared/`);
    setLikesModalVisible(true);
  }, []);

  const handleShowViewers = useCallback((storyId) => {
    setPaused(true);
    setLikesModalTitle('Actividad de la historia');
    setLikesModalUrl(`stories/${storyId}/viewers/`);
    setLikesModalVisible(true);
  }, []);

  const openShareModal = useCallback((storyId) => {
    if (!activeStory) return;
    setShareSourceTaskId(storyId);
    setShareToStoryCaption('');
    setShareToStoryError('');
    setPaused(true);
    setShareActionModalVisible(true);
  }, [activeStory]);

  const closeShareModal = useCallback(() => {
    setShareActionModalVisible(false);
    setPaused(false);
  }, []);

  const handleShareStoryIntoMyStory = useCallback(async () => {
   if (!shareSourceTaskId) return;
   setSharingToStory(true);
   setShareToStoryError('');
   try {
     const response = await api.post('stories/share-task/', {
       task_id: shareSourceTaskId,
       caption: shareToStoryCaption.trim(),
     });
      
     // Store source task info for display in AsyncStorage
     if (response.data?.id) {
       const sharedInfo = {
         source_task_id: response.data.source_task_id,
         source_task_title: response.data.source_task_title || response.data.title || '',
         source_task_user: response.data.source_task_user,
         source_task_user_id: response.data.source_task_user_id || null,
         source_task_description: response.data.source_task_description || '',
         source_task_share_count: response.data.source_task_share_count || 0,
         source_item_type: response.data.source_item_type || null,
         source_item_id: response.data.source_item_id || null,
         source_item_title: response.data.source_item_title || '',
         source_item_description: response.data.source_item_description || '',
         source_item_image: response.data.source_item_image || null,
         source_item_video: response.data.source_item_video || null,
       };
         
       const existingShared = await AsyncStorage.getItem('sharedStoriesMetadata');
       const sharedMap = existingShared ? JSON.parse(existingShared) : {};
       sharedMap[response.data.id] = sharedInfo;
       await AsyncStorage.setItem('sharedStoriesMetadata', JSON.stringify(sharedMap));
         
       setSharedStories(prev => ({
         ...prev,
         [response.data.id]: sharedInfo
       }));
     }
      
     closeShareModal();
     setShareSourceTaskId(null);
     setShareToStoryCaption('');
     fetchStories();
     Alert.alert('Listo', 'Historia compartida en tu historia.');
    } catch (error) {
      const backendError =
        error?.response?.data?.error
        || error?.response?.data?.detail
        || 'No se pudo compartir esta historia en tu historia.';
      setShareToStoryError(
        Array.isArray(backendError) ? backendError.join(', ') : String(backendError)
      );
    } finally {
      setSharingToStory(false);
    }
  }, [shareSourceTaskId, shareToStoryCaption, fetchStories]);

  const pickStoryMedia = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: Platform.OS !== 'web',
      quality: 0.8,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    if (Platform.OS === 'web' && uploadUri && uploadUri.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(uploadUri);
      } catch (error) {}
    }

    const pickedFile = asset.file || null;
    const pickedMimeType = pickedFile?.type || '';
    const assetMimeType = asset.mimeType || '';
    const filenameHint = `${asset.fileName || pickedFile?.name || ''}`.toLowerCase();
    const mediaType = (
      asset.type === 'video'
      || assetMimeType.startsWith('video/')
      || pickedMimeType.startsWith('video/')
      || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(filenameHint)
      || (typeof asset.duration === 'number' && asset.duration > 0)
      || String(asset.uri || '').toLowerCase().startsWith('data:video/')
    ) ? 'video' : 'image';

    const previewUri = (Platform.OS === 'web' && pickedFile)
      ? URL.createObjectURL(pickedFile)
      : asset.uri;

    setUploadUri(previewUri);
    setUploadFile(pickedFile);
    setUploadType(mediaType);
  }, [uploadUri]);

  const submitStory = useCallback(async () => {
    if (!uploadUri || !uploadType) {
      setUploadError('Selecciona una imagen o video.');
      return;
    }

    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('caption', uploadCaption.trim());

    try {
      if (Platform.OS === 'web') {
        const blob = uploadFile || (await (await fetch(uploadUri)).blob());
        const blobMimeType = blob?.type || '';
        const originalName = uploadFile?.name || '';
        const isVideoBlob = isLikelyVideoFile(
          { type: blobMimeType, name: originalName },
          uploadType,
          uploadUri
        );

        const fieldName = isVideoBlob ? 'video' : 'image';
        const fallbackExtension = isVideoBlob ? 'mp4' : 'jpg';
        const extension = getExtensionFromMime(blobMimeType, fallbackExtension);
        const filename = uploadFile?.name || `story.${extension}`;
        formData.append(fieldName, blob, filename);
      } else {
        const extension = uploadType === 'video' ? 'mp4' : 'jpg';
        const mimeType = uploadType === 'video' ? 'video/mp4' : 'image/jpeg';
        const fieldName = uploadType === 'video' ? 'video' : 'image';
        formData.append(fieldName, {
          uri: uploadUri,
          name: `story.${extension}`,
          type: mimeType,
        });
      }

      await api.post('stories/', formData);
      setUploadVisible(false);
      resetUploadState();
      fetchStories();
    } catch (error) {
      const backendError =
        error?.response?.data?.caption
        || error?.response?.data?.image
        || error?.response?.data?.video
        || error?.response?.data?.detail
        || error?.response?.data?.error;
      setUploadError(
        Array.isArray(backendError)
          ? backendError.join(', ')
          : (backendError || 'No se pudo subir la historia.')
      );
    } finally {
      setUploading(false);
    }
  }, [uploadUri, uploadFile, uploadType, uploadCaption, fetchStories, resetUploadState]);


  const onVideoStatusUpdate = useCallback((status) => {
    if (!viewerOpen || !activeMedia || activeMedia.type !== 'video') return;
    if (!status?.isLoaded) return;
    if (status.durationMillis && status.positionMillis >= 0) {
      setProgress(Math.min(1, status.positionMillis / status.durationMillis));
    }
    if (status.didJustFinish) {
      const currentStoryId = activeStory?.id ? String(activeStory.id) : null;
      if (!currentStoryId) return;
      if (lastFinishedStoryIdRef.current === currentStoryId) return;
      lastFinishedStoryIdRef.current = currentStoryId;
      setProgress(1);
      nextStory();
    }
  }, [viewerOpen, activeMedia, nextStory, activeStory?.id, activeUserIndex, activeStoryIndex]);

  const handleSendToFavorite = useCallback(async (favoriteUserId) => {
    if (!activeStory?.id) return;
    
    try {
      // Construir el contenido del mensaje con el contexto de la historia
      const STORY_REPLY_PREFIX = '↪ Respuesta a tu historia:';
      const storyTitle = activeStory.title || 'Historia';
      const userMessage = shareToStoryCaption.trim();
      
      // Formato: "↪ Respuesta a tu historia: TITULO [story:ID]\nMensaje opcional"
      let messageContent = `${STORY_REPLY_PREFIX} ${storyTitle} [story:${activeStory.id}]`;
      if (userMessage) {
        messageContent = `${messageContent}\n${userMessage}`;
      }
      
      const formData = new FormData();
      formData.append('content', messageContent);
      formData.append('receiver', favoriteUserId);
      
      // Enviar el mensaje directo al favorito seleccionado
      console.log('[Stories24hScreen] Sending DM to favorite', favoriteUserId, 'with content:', messageContent);
      
      const response = await api.post('massaging/messages/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('[Stories24hScreen] DM sent successfully', response.data);
      
      // Cerrar el modal y limpiar
      closeShareModal();
      setShareToStoryCaption('');
      setShareSourceTaskId(null);
      
      Alert.alert('Enviado', 'Historia enviada al favorito');
    } catch (error) {
      console.log('[Stories24hScreen] Error sending DM:', error.message);
      console.log('[Stories24hScreen] Error response:', error.response?.data);
      Alert.alert('Error', 'No se pudo enviar el mensaje: ' + (error.response?.data?.detail || error.message));
    }
  }, [activeStory, shareToStoryCaption, closeShareModal]);

  const handleStoryReplyFocus = useCallback(() => {
    pausedBeforeReplyRef.current = paused;
    setPaused(true);
  }, [paused]);

  const handleStoryReplyBlur = useCallback(() => {
    if (!sendingStoryReply && !sourcePromptVisible) {
      setPaused(pausedBeforeReplyRef.current);
    }
  }, [sendingStoryReply, sourcePromptVisible]);

  const handleSendStoryReply = useCallback(async () => {
    const receiverId = activeStory?.user?.id || activeStory?.user_id;
    const message = storyReplyText.trim();
    if (!receiverId || !activeStory?.id || !message || sendingStoryReply) return;

    setSendingStoryReply(true);
    try {
      const storyTitle = String(activeStory.title || 'Historia').replace(/\s+/g, ' ').trim();
      const formData = new FormData();
      formData.append(
        'content',
        `↪ Respuesta a tu historia: ${storyTitle} [story:${activeStory.id}]\n${message}`
      );
      formData.append('receiver', receiverId);

      await api.post('massaging/messages/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setStoryReplyText('');
      storyReplyInputRef.current?.blur?.();
      setPaused(pausedBeforeReplyRef.current);
    } catch (error) {
      const backendError =
        error?.response?.data?.detail
        || error?.response?.data?.error
        || 'No se pudo enviar la respuesta.';
      Alert.alert('Error', String(backendError));
    } finally {
      setSendingStoryReply(false);
    }
  }, [activeStory, storyReplyText, sendingStoryReply]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Historias (24h)</Text>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.topBtn} onPress={fetchStories}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.topBtn} onPress={() => {
            setPaused(true);
            setUploadVisible(true);
          }}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 24 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          <TouchableOpacity style={styles.addStoryBubble} onPress={() => {
            setPaused(true);
            setUploadVisible(true);
          }}>
            <View style={styles.addStoryAvatar}>
              <Ionicons name="add" size={24} color="#fff" />
            </View>
            <Text style={styles.bubbleName}>Tu historia</Text>
          </TouchableOpacity>

          {storyUsers.map((userItem, index) => (
            <View key={`story-user-${userItem.userId}`} style={styles.storyBubble}>
              <Pressable onPress={() => openViewerFor(index)}>
                <View style={styles.storyAvatarRing}>
                  {userItem.avatar ? (
                    <Image source={{ uri: userItem.avatar }} style={styles.storyAvatarImage} contentFit="cover" />
                  ) : (
                    <View style={styles.storyAvatarFallback}>
                      <Ionicons name="person" size={20} color="#ddd" />
                    </View>
                  )}
                </View>
              </Pressable>
              <TouchableUsername
                username={userItem.username}
                userId={userItem.userId}
                userImage={userItem.avatar || null}
                navigation={navigation}
                style={styles.bubbleNameWrap}
                textStyle={styles.bubbleName}
                numberOfLines={1}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {!isLoading && storyUsers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No hay historias activas</Text>
          <Text style={styles.emptySubtitle}>Publica una historia con el botón +.</Text>
        </View>
      ) : null}

      <Modal visible={viewerOpen} animationType="fade" onRequestClose={closeViewer}>
        <View style={styles.viewerRoot}>
          {activeStory && activeMedia ? (
            <>
              <View style={styles.progressBarWrap}>
                {(activeUser?.stories || []).map((storyItem, index) => {
                  const done = index < activeStoryIndex;
                  const active = index === activeStoryIndex;
                  const segmentProgress = done ? 1 : active ? progress : 0;
                  return (
                    <View key={`segment-${storyItem.id}`} style={styles.progressSegment}>
                      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, segmentProgress)) * 100}%` }]} />
                    </View>
                  );
                })}
              </View>

              <View style={styles.viewerHeader}>
                <TouchableOpacity style={styles.headerBtn} onPress={closeViewer}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.viewerUserMeta}>
                  <TouchableUsername
                    username={activeUser?.username || 'Usuario'}
                    userId={activeUser?.userId}
                    userImage={activeUser?.avatar || null}
                    navigation={navigation}
                    style={styles.viewerUsernameWrap}
                    textStyle={styles.viewerUsername}
                  />
                  <Text style={styles.viewerTime}>{formatAgo(activeStory._createdMs, nowMs)}</Text>
                </View>
                <TouchableOpacity style={styles.headerBtn} onPress={() => setMuted((prev) => !prev)}>
                  <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={[styles.mediaWrap, isSharedStoryPreview && styles.sharedStoryMediaWrap]}>
                {isSharedStoryPreview ? (
                  <View style={styles.sharedStoryCardGroup}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.sharedStoryCard,
                        pressed && styles.sharedStoryCardPressed,
                      ]}
                      onLayout={(event) => {
                        const { width, height } = event.nativeEvent.layout;
                        sharedStoryCardSizeRef.current = { width, height };
                      }}
                      onPress={(event) => {
                        event?.stopPropagation?.();
                        if (sourcePromptVisible) dismissSharedStorySourcePrompt(event);
                      }}
                      onLongPress={showSharedStorySourcePrompt}
                      delayLongPress={450}
                      disabled={!originalTaskId}
                      accessibilityRole="button"
                      accessibilityLabel="Mantén presionado para abrir la publicación original"
                    >
                      <View style={styles.sharedStoryMediaFrame}>
                        {activeMedia.type === 'video' ? (
                          <Video
                            ref={viewerVideoRef}
                            key={`viewer-video-${activeStory.id}`}
                            source={{ uri: activeMedia.src }}
                            style={styles.sharedStoryMediaVideo}
                            resizeMode="cover"
                            isMuted={muted}
                            shouldPlay={!paused}
                            isLooping={false}
                            onPlaybackStatusUpdate={onVideoStatusUpdate}
                          />
                        ) : (
                          <Image source={{ uri: activeMedia.src }} style={styles.sharedStoryMediaVideo} contentFit="cover" />
                        )}
                      </View>

                      <View style={styles.sharedStoryDetails}>
                        {originalTitle ? (
                          <Text style={styles.sharedStoryTitle} numberOfLines={2}>{originalTitle}</Text>
                        ) : null}
                        {sourceItemTitle ? (
                          <Text style={styles.sharedStoryItemTitle} numberOfLines={1}>{sourceItemTitle}</Text>
                        ) : null}
                        {sourceDescription ? (
                          <Text style={styles.sharedStoryDescription} numberOfLines={2}>{sourceDescription}</Text>
                        ) : null}
                      </View>
                    </Pressable>

                    {sourcePromptVisible && originalTaskId ? (
                      <View style={[styles.sharedStorySourcePrompt, sourcePromptPosition]}>
                        <TouchableOpacity
                          style={styles.sharedStorySourcePromptButton}
                          onPress={openSharedStorySource}
                        >
                          <Text style={styles.sharedStorySourcePromptButtonText}>Ir</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {originalAuthorName ? (
                      <View style={styles.sharedStoryAuthorRow}>
                        <TouchableUsername
                          username={originalAuthorName}
                          userId={originalAuthorId}
                          navigation={navigation}
                          textStyle={styles.sharedStoryAuthorName}
                          style={styles.sharedByNameWrapper}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <>
                    {activeMedia.type === 'video' ? (
                      <Video
                        ref={viewerVideoRef}
                        key={`viewer-video-${activeStory.id}`}
                        source={{ uri: activeMedia.src }}
                        style={styles.media}
                        resizeMode="cover"
                        isMuted={muted}
                        shouldPlay={!paused}
                        isLooping={false}
                        onPlaybackStatusUpdate={onVideoStatusUpdate}
                      />
                    ) : (
                      <Image source={{ uri: activeMedia.src }} style={styles.media} contentFit="cover" />
                    )}
                  </>
                )}
                <View style={styles.tapZones}>
                  <Pressable style={styles.tapZone} onPress={prevStory} />
                  <Pressable style={styles.tapZone} onPress={nextStory} />
                </View>
              </View>

              {!isSharedStoryPreview && activeStory.description ? (
                <View style={[
                  styles.storyDescription,
                  !isOwnActiveStory && styles.storyDescriptionWithReply,
                ]}>
                  <Text style={styles.storyDescriptionText} numberOfLines={4}>{activeStory.description}</Text>
                </View>
              ) : null}

              <KeyboardAvoidingView
                style={styles.viewerFooter}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                <View style={[styles.viewerActions, !isOwnActiveStory && styles.viewerUtilityActions]}>
                  {isOwnActiveStory ? (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleShowViewers(activeStory.id)}>
                      <Ionicons name="eye-outline" size={22} color="#fff" />
                      <Text style={styles.actionCount}>{activeStory.views_count || 0}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.actionBtn}>
                    <TouchableOpacity style={styles.actionIconButton} onPress={() => openShareModal(activeStory.id)}>
                      <Ionicons name="share-social-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionCountButton}
                      onPress={() => handleShowShares(activeStory.id)}
                      disabled={!isOwnActiveStory}
                    >
                      <Text style={[styles.actionCount, isOwnActiveStory && styles.actionCountInteractive]}>
                        {activeStory.share_count || 0}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => setPaused((prev) => !prev)}>
                    <Ionicons name={paused ? 'play' : 'pause'} size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                {!isOwnActiveStory ? (
                  <View style={styles.storyReplyRow}>
                    <TouchableOpacity
                      style={styles.storyReplyLike}
                      onPress={handleToggleLike}
                    >
                      <Ionicons
                        name={activeStory.user_has_liked ? 'heart' : 'heart-outline'}
                        size={23}
                        color={activeStory.user_has_liked ? '#ff4d6d' : '#fff'}
                      />
                    </TouchableOpacity>
                    <View style={styles.storyReplyComposer}>
                      <TextInput
                        ref={storyReplyInputRef}
                        value={storyReplyText}
                        onChangeText={setStoryReplyText}
                        onFocus={handleStoryReplyFocus}
                        onBlur={handleStoryReplyBlur}
                        onSubmitEditing={handleSendStoryReply}
                        editable={!sendingStoryReply}
                        placeholder="Responder a esta historia..."
                        placeholderTextColor="rgba(255,255,255,0.62)"
                        returnKeyType="send"
                        blurOnSubmit={false}
                        style={styles.storyReplyInput}
                      />
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.storyReplySend,
                        (!storyReplyText.trim() || sendingStoryReply) && styles.storyReplySendDisabled,
                      ]}
                      onPress={handleSendStoryReply}
                      disabled={!storyReplyText.trim() || sendingStoryReply}
                    >
                      {sendingStoryReply ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="send" size={18} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </KeyboardAvoidingView>
            </>
          ) : (
            <View style={styles.viewerLoading}>
              <ActivityIndicator size="large" color="#4dabf7" />
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={uploadVisible} transparent animationType="slide" onRequestClose={() => !uploading && setUploadVisible(false)}>
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadModal}>
            <View style={styles.uploadHeader}>
              <Text style={styles.uploadTitle}>Subir historia (24h)</Text>
              <TouchableOpacity disabled={uploading} onPress={() => { setUploadVisible(false); setPaused(false); resetUploadState(); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.uploadPicker} onPress={pickStoryMedia} disabled={uploading}>
              {uploadUri ? (
                isUploadVideo ? (
                  Platform.OS === 'web' ? (
                    <video
                      src={uploadUri}
                      controls
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
                    />
                  ) : (
                    <Video source={{ uri: uploadUri }} style={styles.uploadPreview} useNativeControls resizeMode="contain" />
                  )
                ) : (
                  <RNImage source={{ uri: uploadUri }} style={styles.uploadPreview} resizeMode="cover" />
                )
              ) : (
                <Text style={styles.uploadPlaceholder}>Selecciona una imagen o video</Text>
              )}
            </TouchableOpacity>

            <TextInput
              value={uploadCaption}
              onChangeText={setUploadCaption}
              placeholder="Texto (opcional)"
              placeholderTextColor="#999"
              multiline
              editable={!uploading}
              style={styles.uploadInput}
            />

            {!!uploadError && <Text style={styles.uploadError}>{uploadError}</Text>}

            <View style={styles.uploadActions}>
              <TouchableOpacity disabled={uploading} style={styles.uploadCancel} onPress={() => { setUploadVisible(false); setPaused(false); resetUploadState(); }}>
                <Text style={styles.uploadCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={uploading} style={styles.uploadSubmit} onPress={submitStory}>
                <Text style={styles.uploadSubmitText}>{uploading ? 'Subiendo…' : 'Publicar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={shareActionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeShareModal}
      >
        <View style={styles.shareOptionsOverlay}>
          <View style={styles.shareOptionsModal}>
            <View style={styles.shareOptionsHandle} />
            <View style={styles.shareOptionsHeader}>
              <Text style={styles.shareOptionsTitle}>Compartir historia</Text>
              <TouchableOpacity disabled={sharingToStory} onPress={closeShareModal}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {activeStory && (activeStory.user?.id === currentUserId || activeStory.user_id === currentUserId) ? (
              // Si es TU historia: solo "Enviar a alguien más"
              <>
                <Text style={styles.shareOptionsSubtitle}>Enviar a un favorito</Text>
                <TextInput
                  value={shareToStoryCaption}
                  onChangeText={setShareToStoryCaption}
                  placeholder="Mensaje opcional para acompañar la historia"
                  placeholderTextColor="#9a9a9a"
                  style={styles.shareStoryInput}
                />
                {favorites && favorites.length > 0 ? (
                  <ScrollView 
                    style={styles.favoritesListContainer}
                    scrollEnabled={false}
                  >
                    {favorites.map((favorite) => (
                      <View
                        key={favorite.id}
                        style={styles.favoriteItem}
                      >
                        {favorite.user_image ? (
                          <RNImage
                            source={{ uri: getImageUrl(favorite.user_image) }}
                            style={styles.favoriteAvatar}
                          />
                        ) : (
                          <View style={[styles.favoriteAvatar, { backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="person" size={24} color="#fff" />
                          </View>
                        )}
                        <View style={styles.favoriteInfo}>
                          <TouchableUsername
                            username={favorite.username || 'Usuario'}
                            userId={favorite.id}
                            userImage={favorite.user_image ? getImageUrl(favorite.user_image) : null}
                            navigation={navigation}
                            textStyle={{ color: '#fff', fontSize: 14, fontWeight: '600' }}
                            style={styles.favoriteNameWrapper}
                          />
                        </View>
                        <TouchableOpacity onPress={() => handleSendToFavorite(favorite.id)}>
                          <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.noFavoritesContainer}>
                    <Ionicons name="heart-outline" size={48} color="#999" />
                    <Text style={styles.noFavoritesText}>No tienes favoritos aún</Text>
                  </View>
                )}
              </>
            ) : (
              // Si NO es tu historia: "Compartir en mi historia" + "Enviar a alguien más"
              <>
                <View style={styles.shareStoryCard}>
                  <Text style={styles.shareStoryCardTitle}>Compartir esta historia en tu historia</Text>
                  <TextInput
                    value={shareToStoryCaption}
                    onChangeText={setShareToStoryCaption}
                    placeholder="Comentario opcional"
                    placeholderTextColor="#9a9a9a"
                    editable={!sharingToStory}
                    style={styles.shareStoryInput}
                  />
                  {!!shareToStoryError && <Text style={styles.shareStoryError}>{shareToStoryError}</Text>}
                  <TouchableOpacity
                    style={[styles.shareStorySubmit, sharingToStory && { opacity: 0.7 }]}
                    onPress={handleShareStoryIntoMyStory}
                    disabled={sharingToStory}
                  >
                    <Text style={styles.shareStorySubmitText}>{sharingToStory ? 'Compartiendo…' : 'Compartir en mi historia'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.shareOptionsSubtitle}>O enviar a un favorito</Text>
                {favorites && favorites.length > 0 ? (
                  <ScrollView 
                    style={[styles.favoritesListContainer, { maxHeight: 200 }]}
                    scrollEnabled={false}
                  >
                    {favorites.map((favorite) => (
                      <View
                        key={favorite.id}
                        style={styles.favoriteItem}
                      >
                        {favorite.user_image ? (
                          <RNImage
                            source={{ uri: getImageUrl(favorite.user_image) }}
                            style={styles.favoriteAvatar}
                          />
                        ) : (
                          <View style={[styles.favoriteAvatar, { backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="person" size={24} color="#fff" />
                          </View>
                        )}
                        <View style={styles.favoriteInfo}>
                          <TouchableUsername
                            username={favorite.username || 'Usuario'}
                            userId={favorite.id}
                            userImage={favorite.user_image ? getImageUrl(favorite.user_image) : null}
                            navigation={navigation}
                            textStyle={{ color: '#fff', fontSize: 14, fontWeight: '600' }}
                            style={styles.favoriteNameWrapper}
                          />
                        </View>
                        <TouchableOpacity onPress={() => handleSendToFavorite(favorite.id)}>
                          <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.noFavoritesContainer}>
                    <Ionicons name="heart-outline" size={48} color="#999" />
                    <Text style={styles.noFavoritesText}>No tienes favoritos aún</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      <TieredLikesModal
        visible={likesModalVisible}
        onClose={() => {
          setLikesModalVisible(false);
          setPaused(false);
        }}
        apiUrl={likesModalUrl}
        title={likesModalTitle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    paddingTop: 52,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  topActions: { flexDirection: 'row', gap: 10 },
  topBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1f1f1f', alignItems: 'center', justifyContent: 'center' },
  strip: { paddingHorizontal: 12, paddingBottom: 10, gap: 12 },
  storyBubble: { width: 74, alignItems: 'center' },
  addStoryBubble: { width: 74, alignItems: 'center' },
  storyAvatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: '#4dabf7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  addStoryAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: '#51cf66',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
    marginBottom: 6,
  },
  storyAvatarImage: { width: 58, height: 58, borderRadius: 29 },
  storyAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleNameWrap: { maxWidth: 74 },
  bubbleName: { color: '#ddd', fontSize: 12 },
  emptyWrap: { marginTop: 24, alignItems: 'center', paddingHorizontal: 16 },
  emptyTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 6 },
  emptySubtitle: { color: '#999', fontSize: 13, textAlign: 'center' },
  viewerRoot: { flex: 1, backgroundColor: '#000' },
  progressBarWrap: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 10 : 30,
    left: 8,
    right: 8,
    zIndex: 10,
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: { flex: 1, height: 3, backgroundColor: '#2d2d2d', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  viewerHeader: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 40,
    left: 8,
    right: 8,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerUserMeta: {
    flex: 1,
    marginHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  viewerUsernameWrap: { maxWidth: 180 },
  viewerUsername: { color: '#fff', fontWeight: '700', fontSize: 13 },
  viewerTime: { color: '#ccc', fontSize: 12, marginTop: 2 },
  mediaWrap: { flex: 1 },
  sharedStoryMediaWrap: {
    paddingTop: Platform.OS === 'web' ? 30 : 48,
    paddingBottom: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  media: { width: windowWidth, height: windowHeight },
  sharedStoryCardGroup: {
    width: '85%',
    height: '90%',
    maxWidth: 380,
    maxHeight: 620,
    minHeight: 430,
    zIndex: 2,
  },
  sharedStoryCard: {
    width: '100%',
    height: '100%',
    position: 'relative',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  sharedStoryCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  sharedStorySourcePrompt: {
    position: 'absolute',
    width: 42,
    height: 30,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    overflow: 'hidden',
  },
  sharedStorySourcePromptButton: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#4dabf7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedStorySourcePromptButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  sharedStoryMediaFrame: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  sharedStoryMediaVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  sharedStoryDetails: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: 'rgba(8,8,8,0.32)',
    borderTopWidth: 0,
  },
  sharedStoryAuthorRow: {
    position: 'absolute',
    left: 10,
    bottom: -30,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 3,
  },
  sharedStoryAuthorName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  sharedStoryTitle: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  sharedStoryItemTitle: {
    color: '#dfe9ff',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    marginTop: 3,
  },
  sharedStoryDescription: {
    color: '#c8c8c8',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 1,
  },
  tapZone: { flex: 1 },
  storyDescription: {
   position: 'absolute',
   bottom: 76,
   left: '50%',
   width: '60%',
   maxWidth: 220,
   minWidth: 180,
   zIndex: 11,
   backgroundColor: 'rgba(0,0,0,0.68)',
   borderRadius: 14,
   paddingVertical: 7,
   paddingHorizontal: 9,
   borderWidth: 1,
   borderColor: 'rgba(255,255,255,0.12)',
   shadowColor: '#000',
   shadowOpacity: 0.28,
   shadowRadius: 8,
   shadowOffset: { width: 0, height: 4 },
   elevation: 6,
   transform: [{ translateX: -110 }],
   overflow: 'hidden',
  },
  storyDescriptionWithReply: {
   bottom: 128,
  },
  storyDescriptionText: { color: '#fff', fontSize: 10.5, lineHeight: 14.5 },
  sharedByNameWrapper: { marginLeft: 0 },
  viewerFooter: {
    position: 'absolute',
    bottom: 18,
    left: 12,
    right: 12,
    zIndex: 12,
    gap: 9,
  },
  viewerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
  },
  viewerUtilityActions: {
    alignSelf: 'flex-end',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 42,
    minHeight: 42,
    paddingHorizontal: 5,
    borderRadius: 999,
  },
  actionIconButton: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCountButton: {
    minWidth: 28,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 5,
  },
  actionCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actionCountInteractive: {
    color: '#8ec5ff',
    textDecorationLine: 'underline',
  },
  storyReplyComposer: {
    flex: 1,
    minHeight: 48,
    paddingLeft: 16,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  storyReplyRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storyReplyLike: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  storyReplyInput: {
    flex: 1,
    minWidth: 0,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 11,
    paddingRight: 8,
  },
  storyReplySend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4dabf7',
  },
  storyReplySendDisabled: {
    opacity: 0.42,
  },
  viewerLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  uploadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    padding: 14,
  },
  uploadModal: {
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  uploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#232323',
  },
  uploadTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  uploadPicker: {
    margin: 14,
    height: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#060606',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPreview: { width: '100%', height: '100%' },
  uploadPlaceholder: { color: '#aaa', fontSize: 13 },
  uploadInput: {
    marginHorizontal: 14,
    marginBottom: 10,
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: '#181818',
    textAlignVertical: 'top',
  },
  uploadError: { color: '#ff8f8f', marginHorizontal: 14, marginBottom: 8, fontSize: 12 },
  uploadActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#232323',
  },
  uploadCancel: {
    backgroundColor: '#212121',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  uploadCancelText: { color: '#fff', fontWeight: '600' },
  uploadSubmit: {
    backgroundColor: '#4dabf7',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  uploadSubmitText: { color: '#fff', fontWeight: '700' },
  shareOptionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    padding: 0,
  },
  shareOptionsModal: {
    backgroundColor: '#111',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
    width: '76%',
    alignSelf: 'center',
    marginBottom: 18,
    maxHeight: '48%',
  },
  shareOptionsHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#4a4a4a',
    alignSelf: 'center',
    marginBottom: 8,
  },
  shareOptionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareOptionsTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  shareOptionsSubtitle: { color: '#bbb', fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 8 },
  shareOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  shareOptionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  shareStoryCard: {
    borderWidth: 1,
    borderColor: '#2d2d2d',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#161616',
    gap: 10,
  },
  shareStoryCardTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  shareStoryInput: {
    borderWidth: 1,
    borderColor: '#343434',
    borderRadius: 10,
    backgroundColor: '#1e1e1e',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  shareStoryError: { color: '#ff8f8f', fontSize: 12 },
  shareStorySubmit: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4dabf7',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  shareStorySubmitText: { color: '#fff', fontWeight: '700' },
  favoritesListContainer: {
    maxHeight: 400,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  favoriteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  favoriteInfo: {
    flex: 1,
  },
  favoriteName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  favoriteHandle: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  noFavoritesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  noFavoritesText: {
    color: '#999',
    fontSize: 14,
  },
});

export default Stories24hScreen;
