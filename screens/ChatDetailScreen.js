import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Animated, PanResponder, Image as RNImage, Modal, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import api, { getImageUrl, UPLOAD_TIMEOUT_MS } from '@api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import TouchableUsername from '@components/TouchableUsername';
import { useMe } from '@hooks/useApi';
import {
  LIVE_PREVIEW_IDLE,
  LIVE_TRANSLATE_DEBOUNCE_MS,
  LIVE_TRANSLATE_ENDPOINT,
  canTranslateMessage,
  liveTranslateStorageKey,
  livePreviewFromError,
  livePreviewFromResponse,
  livePreviewRequest,
  needsLivePreview,
  sentTranslationFields,
  translationEndpoint,
  translationErrorMessage,
  translationFromResponse,
  translationFromSent,
  translationKey,
  translationLabel,
} from '../utils/translation';

const STORY_REPLY_PREFIX = '↪ Respuesta a tu historia:';
const TASK_SHARE_PREFIX = '↪ Publicación compartida:';

const CHAT_PAGE_SIZE = 30;

const getMediaExtension = (mimeType, fallback = 'bin') => {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  return fallback;
};

const getAssetMimeType = (asset) => {
  const declaredMime = String(asset?.mimeType || '').toLowerCase();
  if (declaredMime) return declaredMime;

  const uriMimeMatch = String(asset?.uri || '').match(/^data:([^;,]+)/i);
  return uriMimeMatch?.[1]?.toLowerCase() || '';
};

const isVideoAsset = (asset) => {
  const uri = String(asset?.uri || '').toLowerCase();
  const name = String(asset?.fileName || asset?.name || '').toLowerCase();
  const mimeType = getAssetMimeType(asset);
  return asset?.type === 'video'
    || mimeType.startsWith('video/')
    || /^video\//.test(String(asset?.type || '').toLowerCase())
    || uri.startsWith('data:video/')
    || /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(name)
    || /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(uri);
};

const buildSharedContentContextLine = (context) => {
  if (!context) return '';
  if (context.taskId) {
    const safeTitle = String(context.taskTitle || 'Publicación').replace(/\s+/g, ' ').trim();
    const markerName = context.taskType === 'shared-task' ? 'shared-task' : 'task';
    return `${TASK_SHARE_PREFIX} ${safeTitle} [${markerName}:${String(context.taskId).trim()}]`;
  }

  const safeTitle = String(context.storyTitle || 'Historia').replace(/\s+/g, ' ').trim();
  const safeId = String(context.storyId || '').trim();
  if (!safeId) return `${STORY_REPLY_PREFIX} ${safeTitle}`;
  return `${STORY_REPLY_PREFIX} ${safeTitle} [story:${safeId}]`;
};

const parseSharedContentFromMessage = (content) => {
  if (!content) return { contentContext: null, bodyText: '' };
  const normalized = String(content);
  const lines = normalized.split('\n');
  const firstLine = (lines[0] || '').trim();

  const isStory = firstLine.startsWith(STORY_REPLY_PREFIX);
  const isTask = firstLine.startsWith(TASK_SHARE_PREFIX);
  if (!isStory && !isTask) {
    return { contentContext: null, bodyText: normalized };
  }

  const prefix = isTask ? TASK_SHARE_PREFIX : STORY_REPLY_PREFIX;
  const markerMatch = isTask
    ? firstLine.match(/\[(shared-task|task):([^\]]+)\]/i)
    : firstLine.match(/\[(story):([^\]]+)\]/i);
  const markerName = markerMatch?.[1]?.toLowerCase() || (isTask ? 'task' : 'story');
  const contentId = markerMatch?.[2] ? String(markerMatch[2]).trim() : null;
  const titlePart = firstLine
    .replace(prefix, '')
    .replace(/\[(?:shared-task|task|story):[^\]]+\]/i, '')
    .trim();
  const bodyText = lines.slice(1).join('\n').trim();

  return {
    contentContext: {
      type: isTask ? markerName : 'story',
      id: contentId,
      title: titlePart || (isTask ? 'Publicación' : 'Historia'),
    },
    bodyText,
  };
};

const MessageItem = ({ item, isMe, type, msgAvatar, onReply, onDelete, onEdit, onOpenMessageMenu, onNavigateToProfile, onOpenContent, translation, onToggleTranslation, navigation }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const { contentContext, bodyText } = parseSharedContentFromMessage(item?.content || '');
  const canToggleTranslation = canTranslateMessage(item);
  const translationOpen = translation?.status === 'done' && !!translation.open;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dx > 30 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx < 100) {
          pan.setValue({ x: gestureState.dx, y: 0 });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 50) {
          onReply(item);
        }
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }).start();
      }
    })
  ).current;

  return (
    <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
      {!isMe && type === 'group' && (
        <TouchableOpacity onPress={() => onNavigateToProfile(item.sender)}>
          <RNImage source={{ uri: msgAvatar }} style={styles.messageAvatar} />
        </TouchableOpacity>
      )}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          contentContext ? styles.sharedContentMessageContainer : null,
          { transform: [{ translateX: pan.x }] },
        ]}
      >
        <TouchableOpacity 
          style={[
            styles.messageBubble,
            contentContext ? styles.sharedContentMessageBubble : null,
            isMe ? styles.messageBubbleMe : styles.messageBubbleThem,
          ]}
          onPress={() => canToggleTranslation && onToggleTranslation && onToggleTranslation(item)}
          onLongPress={() => {
            if (isMe) {
              onOpenMessageMenu(item);
            }
          }}
          activeOpacity={0.9}
        >
          {item.replied_to && (
            <View style={[styles.repliedToContainer, isMe ? styles.repliedToMe : styles.repliedToThem]}>
              <Text style={[styles.repliedToSender, isMe ? styles.repliedToTextMe : styles.repliedToTextThem]}>
                <Ionicons name="arrow-undo" size={10} /> {item.replied_to.sender?.username || 'Usuario'}
              </Text>
              <Text style={[styles.repliedToText, isMe ? styles.repliedToTextMe : styles.repliedToTextThem]} numberOfLines={1}>
                {item.replied_to.content || 'Adjunto'}
              </Text>
            </View>
          )}

          {!isMe && type === 'group' && (
            <TouchableUsername
              username={item.sender?.username || 'Usuario'}
              userId={item.sender?.id}
              userImage={item.sender?.user_image ? getImageUrl(item.sender.user_image) : undefined}
              navigation={navigation}
              style={styles.messageSenderNameWrap}
              textStyle={styles.messageSenderName}
            />
          )}
          {contentContext ? (
            <TouchableOpacity
              style={[styles.storyContextBox, isMe ? styles.storyContextBoxMe : styles.storyContextBoxThem]}
              onPress={() => onOpenContent && onOpenContent(contentContext)}
              activeOpacity={0.85}
            >
              <Ionicons name={contentContext.type !== 'story' ? 'document-text-outline' : 'time-outline'} size={15} color={isMe ? '#fff' : '#4dabf7'} />
              <View style={styles.storyContextCopy}>
                <Text style={[styles.storyContextLabel, isMe ? styles.storyContextTextMe : styles.storyContextTextThem]}>
                  {contentContext.type !== 'story' ? 'Publicación' : 'Historia'}
                </Text>
                <Text style={[styles.storyContextText, isMe ? styles.storyContextTextMe : styles.storyContextTextThem]} numberOfLines={2}>
                  {contentContext.title}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={12} color={isMe ? '#fff' : '#4dabf7'} />
            </TouchableOpacity>
          ) : null}

          {bodyText ? (
            <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>
              {bodyText}
            </Text>
          ) : null}
          {translation?.status === 'loading' ? (
            <Text style={[styles.translationNote, isMe ? styles.translationNoteMe : styles.translationNoteThem]}>
              Traduciendo…
            </Text>
          ) : null}
          {translationOpen ? (
            <View style={[styles.translationPanel, isMe ? styles.translationPanelMe : styles.translationPanelThem]}>
              <Text style={[styles.translationLabel, isMe ? styles.translationLabelMe : styles.translationLabelThem]}>
                {translationLabel(translation)}
              </Text>
              {!translation.sameLanguage ? (
                <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>
                  {translation.text}
                </Text>
              ) : null}
            </View>
          ) : null}
          
          {item.image && (
             <RNImage source={{ uri: getImageUrl(item.image) }} style={styles.messageImage} resizeMode="cover" />
          )}
          {item.video && (
            <Video
              source={{ uri: getImageUrl(item.video) }}
              style={styles.messageVideo}
              useNativeControls
              resizeMode="contain"
              shouldPlay={false}
              onError={(error) => console.error('[ChatDetail] Error reproduciendo video:', {
                messageId: item.id,
                rawVideo: item.video,
                videoUrl: getImageUrl(item.video),
                error,
              })}
            />
          )}

          <View style={styles.messageFooter}>
            {canToggleTranslation ? (
              <Ionicons
                name={translationOpen ? 'language' : 'language-outline'}
                size={13}
                color={isMe ? 'rgba(255,255,255,0.85)' : '#7048e8'}
              />
            ) : null}
            <Text style={[styles.messageTime, styles.messageFooterTime, isMe ? styles.messageTimeMe : styles.messageTimeThem]}>
              {moment(item.timestamp).format('HH:mm')}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const ChatDetailScreen = ({ route, navigation }) => {
  const {
    chatId,
    type,
    title,
    avatar,
    initialMessage = '',
    storyReplyContext: incomingStoryReplyContext,
  } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [selectedMessageForMenu, setSelectedMessageForMenu] = useState(null);
  const [isMessageMenuVisible, setIsMessageMenuVisible] = useState(false);
  // Traducciones por mensaje: { 'direct:12': { status, text, sourceLang, targetLang, sameLanguage, open } }
  const [translations, setTranslations] = useState({});
  const translationsRef = useRef({});
  translationsRef.current = translations;
  // "Hablar traducido": traducción en vivo (español → inglés) mientras escribes.
  const [isChatMenuVisible, setIsChatMenuVisible] = useState(false);
  const [liveTranslateOn, setLiveTranslateOn] = useState(false);
  const [livePreview, setLivePreview] = useState(LIVE_PREVIEW_IDLE);
  const livePreviewRef = useRef(LIVE_PREVIEW_IDLE);
  livePreviewRef.current = livePreview;
  const previewSeqRef = useRef(0);

  // Recuerda si "Hablar traducido" estaba activo en esta conversación.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(liveTranslateStorageKey(type, chatId))
      .then((stored) => { if (active) setLiveTranslateOn(stored === '1'); })
      .catch(() => {});
    return () => { active = false; };
  }, [type, chatId]);

  // Vista previa en vivo: espera una pausa al escribir y descarta respuestas viejas.
  useEffect(() => {
    if (!liveTranslateOn || editingMessageId) return undefined;
    const text = newMessage.trim();
    if (!text) {
      // Borrador vacío: descarta lo pendiente para que no quede "Traduciendo…" pegado.
      previewSeqRef.current += 1;
      if (livePreviewRef.current.status === 'loading') setLivePreview(LIVE_PREVIEW_IDLE);
      return undefined;
    }
    if (!needsLivePreview(text, livePreviewRef.current)) return undefined;
    const seq = ++previewSeqRef.current;
    setLivePreview((prev) => ({ ...prev, status: 'loading' }));
    const timer = setTimeout(async () => {
      try {
        const res = await api.post(LIVE_TRANSLATE_ENDPOINT, livePreviewRequest(text));
        if (seq === previewSeqRef.current) setLivePreview(livePreviewFromResponse(text, res.data));
      } catch (error) {
        if (seq === previewSeqRef.current) {
          setLivePreview(livePreviewFromError(text, translationErrorMessage(error)));
        }
      }
    }, LIVE_TRANSLATE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [newMessage, liveTranslateOn, editingMessageId]);
  const [loading,     setLoading]     = useState(true);
  // currentUser ahora viene de React Query en lugar de api.get('users/me/')
  const { data: currentUser } = useMe();
  
  // Secondary features state
  const [selectedImage, setSelectedImage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [storyReplyContext, setStoryReplyContext] = useState(incomingStoryReplyContext || null);

  // Group Info state
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupCreatorId, setGroupCreatorId] = useState(null);
  
  // Add Member state
  const [isAddMemberModalVisible, setIsAddMemberModalVisible] = useState(false);
  const [users, setUsers] = useState([]);
  const [userSearchText, setUserSearchText] = useState('');

  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const generationRef = useRef(0);

  const messagesUrl = useCallback((page) => (
    type === 'direct'
      ? `massaging/messages/?user_id=${chatId}&page=${page}&page_size=${CHAT_PAGE_SIZE}`
      : `massaging/groupss/${chatId}/messages/?page=${page}&page_size=${CHAT_PAGE_SIZE}`
  ), [chatId, type]);

  const fetchMessages = useCallback(async () => {
    const generation = ++generationRef.current;
    try {
      setLoading(true);
      const res = await api.get(messagesUrl(1));
      if (generation !== generationRef.current) return;
      const msgs = Array.isArray(res.data) ? res.data : [];
      pageRef.current = 1;
      hasMoreRef.current = msgs.length >= CHAT_PAGE_SIZE;
      setMessages(msgs);
    } catch (error) {
      console.error('Error fetching messages:', error.response?.data || error.message);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [messagesUrl]);

  // Mensajes más antiguos: se dispara al llegar al final de la lista invertida.
  const loadOlderMessages = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    const generation = generationRef.current;
    const nextPage = pageRef.current + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await api.get(messagesUrl(nextPage));
      if (generation !== generationRef.current) return;
      const older = Array.isArray(res.data) ? res.data : [];
      pageRef.current = nextPage;
      hasMoreRef.current = older.length >= CHAT_PAGE_SIZE;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...older.filter((m) => !seen.has(m.id))];
      });
    } catch (error) {
      console.error('Error loading older messages:', error.response?.data || error.message);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [messagesUrl]);

  useFocusEffect(
    useCallback(() => {
      fetchMessages();
    }, [fetchMessages])
  );

  useEffect(() => {
    setStoryReplyContext(incomingStoryReplyContext || null);
    setNewMessage(initialMessage || '');
  }, [incomingStoryReplyContext, initialMessage]);

  const fetchGroupInfo = async () => {
    if (type !== 'group') return;
    try {
      const res = await api.get('massaging/groupss/');
      const group = res.data.find((item) => String(item.id) === String(chatId));
      if (group) {
        setGroupMembers(group.members || []);
        setGroupCreatorId(group.created_by);
      }
    } catch (err) {
      console.error('Error fetching group info:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('massaging/users/');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleOpenGroupInfo = () => {
    if (type === 'group') {
      fetchGroupInfo();
      setIsGroupModalVisible(true);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await api.post(`massaging/groupss/${chatId}/remove_member/`, { user_id: userId });
      fetchGroupInfo(); // Refresh members
    } catch (err) {
      console.error('Error removing member:', err.response?.data || err.message);
      Alert.alert('Error', 'No se pudo eliminar al miembro. Asegúrate de ser administrador.');
    }
  };

  const confirmRemoveMember = (userId) => {
    if (Platform.OS === 'web') {
      if (window.confirm("¿Seguro que deseas eliminar a este miembro del grupo?")) {
        handleRemoveMember(userId);
      }
    } else {
      Alert.alert("Eliminar miembro", "¿Seguro que deseas eliminar a este miembro del grupo?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => handleRemoveMember(userId) }
      ]);
    }
  };

  const handleMakeAdmin = async (userId) => {
    try {
      await api.post(`massaging/groupss/${chatId}/make_admin/`, { user_id: userId });
      fetchGroupInfo(); // Refresh members
      Alert.alert('Éxito', 'Rol de administrador actualizado.');
    } catch (err) {
      console.error('Error making admin:', err.response?.data || err.message);
      Alert.alert('Error', err.response?.data?.error || 'No se pudo actualizar el rol. Verifica que seas administrador.');
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await api.post(`massaging/groupss/${chatId}/delete/`);
      setIsGroupModalVisible(false);
      navigation.goBack();
    } catch (err) {
      console.error('Error deleting group:', err.response?.data || err.message);
      Alert.alert('Error', 'No se pudo eliminar el grupo.');
    }
  };

  const confirmDeleteGroup = () => {
    if (Platform.OS === 'web') {
      if (window.confirm("¿Seguro que quieres eliminar este grupo? Esta acción no se puede deshacer.")) {
        handleDeleteGroup();
      }
    } else {
      Alert.alert("Eliminar grupo", "¿Seguro que quieres eliminar este grupo? Esta acción no se puede deshacer.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => handleDeleteGroup() }
      ]);
    }
  };

  const handleAddMember = async (userId) => {
    try {
      await api.post(`massaging/groupss/${chatId}/add_member/`, { user_id: userId });
      setIsAddMemberModalVisible(false);
      fetchGroupInfo();
      Alert.alert('Éxito', 'Miembro añadido correctamente');
    } catch (err) {
      console.error('Error adding member:', err.response?.data || err.message);
      Alert.alert('Error', 'No se pudo agregar al miembro.');
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedImage(asset);
    }
  };

  const handleDeleteMessage = (msgId) => {
    if (Platform.OS === 'web') {
      if (window.confirm("¿Estás seguro de que deseas eliminar este mensaje?")) {
        executeDelete(msgId);
      }
    } else {
      Alert.alert(
        "Eliminar mensaje",
        "¿Estás seguro de que deseas eliminar este mensaje?",
        [
          { text: "Cancelar", style: "cancel" },
          { 
            text: "Eliminar", 
            style: "destructive",
            onPress: () => executeDelete(msgId)
          }
        ]
      );
    }
  };

  const openMessageMenu = useCallback((message) => {
    setSelectedMessageForMenu(message);
    setIsMessageMenuVisible(true);
  }, []);

  const closeMessageMenu = useCallback(() => {
    setIsMessageMenuVisible(false);
    setSelectedMessageForMenu(null);
  }, []);

  const handleMenuEdit = () => {
    if (!selectedMessageForMenu) return;
    const message = selectedMessageForMenu;
    closeMessageMenu();
    handleEditMessage(message);
  };

  const handleMenuDelete = () => {
    if (!selectedMessageForMenu) return;
    const messageId = selectedMessageForMenu.id;
    closeMessageMenu();
    handleDeleteMessage(messageId);
  };

  // --- Traductor ---
  // Leer: tocar un mensaje muestra u oculta su traducción. Si el autor la envió con
  // el mensaje se usa esa; si no, se pide al servidor en tu idioma.
  const showTranslationError = (message) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Traducción', message);
    }
  };

  const requestTranslation = async (message) => {
    const key = translationKey(type, message.id);
    setTranslations((prev) => ({ ...prev, [key]: { status: 'loading' } }));
    try {
      const res = await api.post(translationEndpoint(type, message.id), {});
      setTranslations((prev) => ({ ...prev, [key]: translationFromResponse(res.data) }));
    } catch (error) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      showTranslationError(translationErrorMessage(error));
    }
  };

  const handleToggleTranslation = (message) => {
    if (!canTranslateMessage(message)) return;
    const key = translationKey(type, message.id);
    const current = translationsRef.current[key];
    if (current?.status === 'loading') return;
    if (current?.status === 'done') {
      setTranslations((prev) => ({ ...prev, [key]: { ...current, open: !current.open } }));
      return;
    }
    if (message.sent_translation?.text) {
      setTranslations((prev) => ({ ...prev, [key]: translationFromSent(message.sent_translation) }));
      return;
    }
    requestTranslation(message);
  };

  // Escribir: "Hablar traducido" (español → inglés) con vista previa en vivo.
  const handleToggleLiveTranslate = (next) => {
    const value = !!next;
    setLiveTranslateOn(value);
    AsyncStorage.setItem(liveTranslateStorageKey(type, chatId), value ? '1' : '0').catch(() => {});
    if (!value) {
      previewSeqRef.current += 1;
      setLivePreview(LIVE_PREVIEW_IDLE);
    }
  };

  const confirmSendWithoutTranslation = (reason) => new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(`${reason}\n\n¿Enviar el mensaje sin traducción?`));
      return;
    }
    Alert.alert(
      'No se pudo traducir',
      `${reason}\n\n¿Enviar el mensaje sin traducción?`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Enviar sin traducción', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

  // Devuelve los campos de traducción a enviar, null (enviar sin traducción) o 'cancel'.
  const resolveSentTranslation = async (text) => {
    const current = livePreviewRef.current;
    const ready = sentTranslationFields(text, current);
    if (ready) return ready;
    if (current.status === 'done' && current.forText === text && current.sameLanguage) return null;
    try {
      const res = await api.post(LIVE_TRANSLATE_ENDPOINT, livePreviewRequest(text));
      return sentTranslationFields(text, livePreviewFromResponse(text, res.data));
    } catch (error) {
      const proceed = await confirmSendWithoutTranslation(translationErrorMessage(error));
      return proceed ? null : 'cancel';
    }
  };

  const handleEditMessage = (message) => {
    setEditingMessageId(message.id);
    setNewMessage(message.content || '');
    setReplyTo(null);
  };

  const executeDelete = async (msgId) => {
    try {
      if (type === 'group') {
        await api.delete(`massaging/group_messages/${msgId}/delete/`);
      } else {
        await api.delete(`massaging/messages/${msgId}/delete/`);
      }
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (e) {
      console.error('Error deleting message', e);
      if (Platform.OS === 'web') {
        window.alert("Error: No se pudo eliminar el mensaje");
      } else {
        Alert.alert("Error", "No se pudo eliminar el mensaje");
      }
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() && !selectedImage && !storyReplyContext) return;
    
    try {
      if (editingMessageId) {
        const updatePath = type === 'group'
          ? `massaging/group_messages/${editingMessageId}/`
          : `massaging/messages/${editingMessageId}/`;
        const response = await api.patch(updatePath, { content: newMessage.trim() });
        setMessages(prev => prev.map(message => message.id === editingMessageId ? response.data : message));
        const editedKey = translationKey(type, editingMessageId);
        setTranslations(prev => {
          if (!prev[editedKey]) return prev;
          const next = { ...prev };
          delete next[editedKey];
          return next;
        });
        setEditingMessageId(null);
        setNewMessage('');
        return;
      }

      const formData = new FormData();
      const hasSharedContentContext = !!storyReplyContext && !replyTo;
      const contextLine = hasSharedContentContext
        ? buildSharedContentContextLine(storyReplyContext)
        : '';
      const plainMessage = newMessage.trim();
      const finalMessageContent = hasSharedContentContext
        ? (plainMessage ? `${contextLine}\n${plainMessage}` : contextLine)
        : plainMessage;
      if (finalMessageContent) formData.append('content', finalMessageContent);

      if (selectedImage) {
        const isVideo = isVideoAsset(selectedImage);
        const sourceMimeType = getAssetMimeType(selectedImage);
        const fileName = selectedImage.fileName || selectedImage.name || '';
        const nameExtension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
        const fileType = getMediaExtension(sourceMimeType, nameExtension || (isVideo ? 'mp4' : 'jpg'));
        const finalType = sourceMimeType.startsWith(isVideo ? 'video/' : 'image/')
          ? sourceMimeType
          : (isVideo ? 'video/mp4' : 'image/jpeg');
        
        if (Platform.OS === 'web') {
          const response = await fetch(selectedImage.uri);
          const blob = await response.blob();
          const blobMimeType = blob.type || finalType;
          const ext = getMediaExtension(blobMimeType, fileType);
          formData.append(isVideo ? 'video' : 'image', blob, `media.${ext}`);
        } else {
          formData.append(isVideo ? 'video' : 'image', {
            uri: selectedImage.uri,
            name: `media.${fileType}`,
            type: finalType,
          });
        }
      }

      if (replyTo) formData.append('reply_to', replyTo.id);

      // "Hablar traducido": la traducción que viste en vivo viaja con el mensaje.
      if (liveTranslateOn && plainMessage) {
        const translationFields = await resolveSentTranslation(plainMessage);
        if (translationFields === 'cancel') return;
        if (translationFields) {
          Object.entries(translationFields).forEach(([name, value]) => formData.append(name, value));
        }
      }

      if (type === 'direct') {
        formData.append('receiver', chatId);
        const res = await api.post('massaging/messages/', formData, {
          timeout: UPLOAD_TIMEOUT_MS,
        });
        setMessages(prev => [res.data, ...prev]);
      } else {
        const res = await api.post(`massaging/groupss/${chatId}/send_message/`, formData, {
          timeout: UPLOAD_TIMEOUT_MS,
        });
        setMessages(prev => [res.data, ...prev]);
      }

      setNewMessage('');
      setSelectedImage(null);
      setReplyTo(null);
      setStoryReplyContext(null);
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.error || 'No se pudo enviar el archivo.');
    }
  };

  const navigateToProfile = (userOrId) => {
    if (!userOrId) return;
    const userId = userOrId.id || userOrId;
    
    // Close modals if they are open
    setIsGroupModalVisible(false);
    setIsAddMemberModalVisible(false);

    navigation.navigate('UserProfile', { 
      userId, 
      userName: userOrId.username || 'Usuario', 
      userAvatar: getImageUrl(userOrId.user_image || userOrId.image) 
    });
  };

  const handleOpenContentFromMessage = useCallback((context) => {
    if (!context?.id) return;
    if (context.type === 'shared-task') {
      const parentNavigation = navigation.getParent();
      const targetNavigation = parentNavigation || navigation;
      targetNavigation.navigate('Tasks', {
        screen: 'SharedTaskDetail',
        params: { sharedTaskId: context.id },
      });
      return;
    }

    if (context.type === 'task') {
      const parentNavigation = navigation.getParent();
      const targetNavigation = parentNavigation || navigation;
      targetNavigation.navigate('Tasks', {
        screen: 'TaskDetail',
        params: { taskId: context.id },
      });
      return;
    }

    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('Stories', { openStoryId: context.id });
      return;
    }
    navigation.navigate('Stories', { openStoryId: context.id });
  }, [navigation]);

  const renderMessage = ({ item }) => {
    const isMe = currentUser && item.sender?.id === currentUser.id;
    const msgAvatar = getImageUrl(item.sender?.user_image) || `https://ui-avatars.com/api/?name=${item.sender?.username || 'U'}`;
    
    return (
      <MessageItem 
        item={item} 
        isMe={isMe} 
        type={type} 
        msgAvatar={msgAvatar} 
        onReply={setReplyTo} 
        onDelete={handleDeleteMessage} 
        onEdit={handleEditMessage}
        onOpenMessageMenu={openMessageMenu}
        onNavigateToProfile={navigateToProfile}
        onOpenContent={handleOpenContentFromMessage}
        translation={translations[translationKey(type, item.id)]}
        onToggleTranslation={handleToggleTranslation}
        navigation={navigation}
      />
    );
  };

  const filteredUsers = users.filter(u => 
    (u.username || '').toLowerCase().includes(userSearchText.toLowerCase())
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ChatList')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <RNImage source={{ uri: avatar }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{title}</Text>
          <Text style={styles.headerUsername}>{type === 'group' ? 'Grupo' : 'Mensaje Directo'}</Text>
        </View>
        {type === 'group' && (
          <TouchableOpacity onPress={handleOpenGroupInfo}>
            <Ionicons name="information-circle-outline" size={26} color="#333" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => setIsChatMenuVisible(true)}
          style={styles.chatMenuButton}
          accessibilityLabel="Opciones del chat"
        >
          <Ionicons name="ellipsis-vertical" size={22} color={liveTranslateOn ? '#7048e8' : '#333'} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4dabf7" style={{ flex: 1, justifyContent: 'center' }} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          extraData={translations}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messagesList}
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 12 }} /> : null
          }
        />
      )}

      {/* Reply To Indicator */}
      {replyTo && (
        <View style={styles.replyIndicatorContainer}>
          <View style={styles.replyIndicatorTextContainer}>
            <Text style={styles.replyIndicatorSender}>Respondiendo a {replyTo.sender?.username}</Text>
            <Text style={styles.replyIndicatorContent} numberOfLines={1}>{replyTo.content || 'Adjunto'}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close-circle" size={24} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {storyReplyContext && !replyTo && (
        <View style={styles.replyIndicatorContainer}>
          <View style={styles.replyIndicatorTextContainer}>
            <Text style={styles.replyIndicatorSender}>
              {storyReplyContext.taskId ? 'Compartiendo publicación' : 'Respondiendo historia'}
            </Text>
            <Text style={styles.replyIndicatorContent} numberOfLines={1}>
              {storyReplyContext.taskTitle || storyReplyContext.storyTitle || 'Contenido'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setStoryReplyContext(null)}>
            <Ionicons name="close-circle" size={24} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* Selected Image Indicator */}
      {selectedImage && (
        <View style={styles.selectedImageContainer}>
          {isVideoAsset(selectedImage) ? (
            <Video
              source={{ uri: selectedImage.uri }}
              style={styles.selectedVideoPreview}
              useNativeControls
              resizeMode="contain"
              shouldPlay={false}
              onError={(error) => console.error('[ChatDetail] Error en preview de video:', {
                uri: selectedImage.uri,
                mimeType: selectedImage.mimeType,
                type: selectedImage.type,
                error,
              })}
            />
          ) : (
            <RNImage source={{ uri: selectedImage.uri }} style={styles.selectedImagePreview} />
          )}
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close-circle" size={24} color="#ff4444" />
          </TouchableOpacity>
        </View>
      )}

      {liveTranslateOn && !editingMessageId && newMessage.trim() ? (() => {
        const resolved = livePreview.forText === newMessage.trim();
        const isError = livePreview.status === 'error' && resolved;
        const hidden = livePreview.sameLanguage && resolved;
        if (hidden || (!livePreview.text && !isError && livePreview.status !== 'loading')) return null;
        return (
          <View style={styles.liveTranslateBox}>
            {isError ? (
              <Text style={styles.liveTranslateError}>{livePreview.error}</Text>
            ) : livePreview.text ? (
              <Text style={resolved ? styles.liveTranslateText : styles.liveTranslateTextDim}>{livePreview.text}</Text>
            ) : (
              <ActivityIndicator size="small" color="#999" style={styles.liveTranslateSpinner} />
            )}
          </View>
        );
      })() : null}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachBtn} onPress={pickImage}>
          <Ionicons name="add" size={24} color="#4dabf7" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendBtn, (!newMessage.trim() && !selectedImage && !storyReplyContext) && { backgroundColor: '#ccc' }]} 
          onPress={handleSend}
          disabled={!newMessage.trim() && !selectedImage && !storyReplyContext}
        >
          <Ionicons name="send" size={18} color="#fff" />

      <Modal
        visible={isMessageMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMessageMenu}
      >
        <TouchableOpacity style={styles.messageMenuOverlay} activeOpacity={1} onPress={closeMessageMenu}>
          <View style={styles.messageMenu}>
            <View style={styles.messageMenuHandle} />
            <Text style={styles.messageMenuTitle}>Opciones del mensaje</Text>
            {selectedMessageForMenu?.content ? (
              <Text style={styles.messageMenuPreview} numberOfLines={2}>
                {selectedMessageForMenu.content}
              </Text>
            ) : null}
            {selectedMessageForMenu?.content ? (
              <TouchableOpacity style={styles.messageMenuOption} onPress={handleMenuEdit}>
                <Ionicons name="pencil-outline" size={21} color="#228be6" />
                <Text style={styles.messageMenuOptionText}>Editar mensaje</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.messageMenuOption} onPress={handleMenuDelete}>
              <Ionicons name="trash-outline" size={21} color="#e03131" />
              <Text style={[styles.messageMenuOptionText, styles.messageMenuDeleteText]}>Eliminar mensaje</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.messageMenuCancel} onPress={closeMessageMenu}>
              <Text style={styles.messageMenuCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
        </TouchableOpacity>
      </View>

      {/* MENÚ DEL CHAT (3 puntos): hablar traducido */}
      <Modal
        visible={isChatMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsChatMenuVisible(false)}
      >
        <TouchableOpacity style={styles.messageMenuOverlay} activeOpacity={1} onPress={() => setIsChatMenuVisible(false)}>
          <View style={styles.messageMenu} onStartShouldSetResponder={() => true}>
            <View style={styles.messageMenuHandle} />
            <Text style={styles.messageMenuTitle}>Opciones del chat</Text>
            <View style={styles.chatMenuToggleRow}>
              <Ionicons name="language-outline" size={22} color="#7048e8" />
              <View style={styles.chatMenuToggleCopy}>
                <Text style={styles.chatMenuToggleTitle}>Hablar traducido</Text>
                <Text style={styles.chatMenuToggleDesc}>
                  Escribes en español, ves la traducción al inglés en vivo y se envía junto con tu mensaje.
                </Text>
              </View>
              <Switch
                value={liveTranslateOn}
                onValueChange={handleToggleLiveTranslate}
                trackColor={{ false: '#ddd', true: '#b197fc' }}
                thumbColor={liveTranslateOn ? '#7048e8' : '#f4f3f4'}
              />
            </View>
            <TouchableOpacity style={styles.messageMenuCancel} onPress={() => setIsChatMenuVisible(false)}>
              <Text style={styles.messageMenuCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE INFORMACIÓN DEL GRUPO */}
      <Modal visible={isGroupModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Info del Grupo</Text>
              <TouchableOpacity onPress={() => setIsGroupModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.groupInfoSubtitle}>Miembros ({groupMembers.length})</Text>
            <FlatList
              data={groupMembers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => {
                // currentUser may be admin if they are creator OR they have is_admin true
                const isCurrentUserCreator = currentUser && groupCreatorId === currentUser.id;
                const isCurrentUserAdmin = currentUser && groupMembers.some(m => m.id === currentUser.id && m.is_admin);
                const canManage = isCurrentUserCreator || isCurrentUserAdmin;

                return (
                <View style={styles.userRow}>
                  <TouchableOpacity onPress={() => navigateToProfile(item)}>
                    <RNImage 
                      source={{ uri: getImageUrl(item.user_image) || `https://ui-avatars.com/api/?name=${item.username}` }} 
                      style={styles.userAvatar} 
                    />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <TouchableUsername
                      username={`${item.username}${item.is_admin ? ' (Admin)' : ''}`}
                      userId={item.id}
                      userImage={getImageUrl(item.user_image) || `https://ui-avatars.com/api/?name=${item.username}`}
                      navigation={navigation}
                      style={styles.memberNameWrap}
                      textStyle={styles.userName}
                    />
                  </View>
                  
                  {canManage && item.id !== currentUser.id && (
                    <View style={{flexDirection: 'row', gap: 5}}>
                      {!item.is_admin && (
                        <TouchableOpacity onPress={() => handleMakeAdmin(item.id)} style={styles.adminBtn}>
                          <Text style={styles.adminBtnText}>Admin</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => confirmRemoveMember(item.id)} style={styles.removeBtn}>
                        <Text style={styles.removeBtnText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}}
            />
            {currentUser && (groupCreatorId === currentUser.id || groupMembers.some(m => m.id === currentUser.id && m.is_admin)) && (
              <TouchableOpacity 
                style={styles.addMemberBtn}
                onPress={() => {
                  fetchUsers();
                  setIsAddMemberModalVisible(true);
                }}
              >
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.addMemberBtnText}>Agregar Miembro</Text>
              </TouchableOpacity>
            )}
            {currentUser && (groupCreatorId === currentUser.id) && (
              <TouchableOpacity 
                style={[styles.addMemberBtn, {backgroundColor: '#ff4444', marginTop: 10}]}
                onPress={confirmDeleteGroup}
              >
                <Ionicons name="trash" size={20} color="#fff" />
                <Text style={styles.addMemberBtnText}>Eliminar Grupo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL PARA BUSCAR Y AGREGAR MIEMBROS */}
      <Modal visible={isAddMemberModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Añadir Miembro</Text>
              <TouchableOpacity onPress={() => setIsAddMemberModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Buscar usuario..."
              value={userSearchText}
              onChangeText={setUserSearchText}
            />
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.userRow}
                  onPress={() => handleAddMember(item.id)}
                >
                  <RNImage 
                    source={{ uri: getImageUrl(item.user_image) || `https://ui-avatars.com/api/?name=${item.username}` }} 
                    style={styles.userAvatar} 
                  />
                  <TouchableUsername
                    username={item.username}
                    userId={item.id}
                    userImage={getImageUrl(item.user_image) || `https://ui-avatars.com/api/?name=${item.username}`}
                    navigation={navigation}
                    style={styles.memberNameWrap}
                    textStyle={styles.userName}
                  />
                  <Ionicons name="add-circle" size={24} color="#4dabf7" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingTop: Platform.OS === 'ios' ? 50 : 34 },
  backBtn: { marginRight: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', marginRight: 12 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  headerUsername: { fontSize: 12, color: '#999' },
  
  messagesList: { paddingHorizontal: 16, paddingVertical: 10 },
  
  messageWrapper: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  messageWrapperMe: { justifyContent: 'flex-end' },
  messageWrapperThem: { justifyContent: 'flex-start' },
  messageAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, marginBottom: 4 },
  messageBubble: { maxWidth: '75%', minWidth: 88, padding: 12, borderRadius: 20 },
  sharedContentMessageContainer: { width: '50%' },
  sharedContentMessageBubble: { width: '100%', maxWidth: '100%' },
  messageBubbleMe: { backgroundColor: '#4dabf7', borderBottomRightRadius: 4 },
  messageBubbleThem: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#eee' },
  messageSenderNameWrap: { marginBottom: 2 },
  messageSenderNameWrap: { marginBottom: 2 },
  messageSenderName: { fontSize: 11, color: '#4dabf7', fontWeight: 'bold' },
  memberNameWrap: { flex: 1 },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageTextMe: { color: '#fff' },
  messageTextThem: { color: '#333' },
  storyContextBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
    borderWidth: 1,
  },
  storyContextBoxMe: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  storyContextBoxThem: {
    backgroundColor: '#f3f8ff',
    borderColor: '#d6e9ff',
  },
  storyContextCopy: { flex: 1 },
  storyContextLabel: { fontSize: 10, fontWeight: '700', opacity: 0.78, marginBottom: 1 },
  storyContextText: { fontSize: 13, fontWeight: '600' },
  storyContextTextMe: { color: '#fff' },
  storyContextTextThem: { color: '#297fce' },
  messageImage: { width: 180, height: 180, borderRadius: 10, marginTop: 8 },
  messageTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
  messageTimeThem: { color: '#999' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4, gap: 4 },
  messageFooterTime: { marginTop: 0, alignSelf: 'auto' },
  translationNote: { fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  translationNoteMe: { color: 'rgba(255,255,255,0.85)' },
  translationNoteThem: { color: '#7048e8' },
  translationPanel: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderLeftWidth: 3, borderRadius: 8 },
  translationPanelMe: { backgroundColor: 'rgba(255,255,255,0.18)', borderLeftColor: '#fff' },
  translationPanelThem: { backgroundColor: '#f3f0ff', borderLeftColor: '#7048e8' },
  translationLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 },
  translationLabelMe: { color: 'rgba(255,255,255,0.9)' },
  translationLabelThem: { color: '#7048e8' },
  liveTranslateBox: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', paddingHorizontal: 16, paddingVertical: 8 },
  liveTranslateText: { fontSize: 15, color: '#333' },
  liveTranslateTextDim: { fontSize: 15, color: '#aaa' },
  liveTranslateSpinner: { alignSelf: 'flex-start' },
  liveTranslateError: { fontSize: 13, color: '#e03131' },
  chatMenuToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  chatMenuButton: { paddingLeft: 12, paddingVertical: 4 },
  chatMenuToggleCopy: { flex: 1 },
  chatMenuToggleTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  chatMenuToggleDesc: { fontSize: 12, color: '#777', marginTop: 2 },
  messageVideo: { width: 220, height: 150, borderRadius: 10, marginTop: 8, backgroundColor: '#222' },

  repliedToContainer: { padding: 8, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3 },
  repliedToMe: { backgroundColor: 'rgba(255,255,255,0.2)', borderLeftColor: '#fff' },
  repliedToThem: { backgroundColor: '#f0f0f0', borderLeftColor: '#4dabf7' },
  repliedToSender: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  repliedToText: { fontSize: 13 },
  repliedToTextMe: { color: '#fff' },
  repliedToTextThem: { color: '#555' },

  replyIndicatorContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#eee', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#ddd' },
  replyIndicatorTextContainer: { flex: 1, borderLeftWidth: 3, borderLeftColor: '#4dabf7', paddingLeft: 8 },
  replyIndicatorSender: { fontSize: 12, fontWeight: 'bold', color: '#4dabf7' },
  replyIndicatorContent: { fontSize: 13, color: '#555' },

  selectedImageContainer: { padding: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: '#eee' },
  selectedImagePreview: { width: 80, height: 80, borderRadius: 8 },
  selectedVideoPreview: { width: 140, height: 80, borderRadius: 8, backgroundColor: '#222' },
  removeImageBtn: { position: 'absolute', top: 5, left: 75, backgroundColor: '#fff', borderRadius: 12 },

  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'flex-end', gap: 10 },
  attachBtn: { width: 40, height: 45, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, minHeight: 45, maxHeight: 100, fontSize: 15 },
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },

  messageMenuOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  messageMenu: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  messageMenuHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#d9dde1', alignSelf: 'center', marginBottom: 16 },
  messageMenuTitle: { fontSize: 18, fontWeight: '800', color: '#222', marginBottom: 6 },
  messageMenuPreview: { fontSize: 13, color: '#777', lineHeight: 18, marginBottom: 12 },
  messageMenuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#f1f3f5', gap: 12 },
  messageMenuOptionText: { fontSize: 16, color: '#228be6', fontWeight: '700' },
  messageMenuDeleteText: { color: '#e03131' },
  messageMenuCancel: { alignItems: 'center', marginTop: 5, paddingVertical: 13, borderRadius: 12, backgroundColor: '#f1f3f5' },
  messageMenuCancelText: { fontSize: 15, color: '#495057', fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', padding: 20, boxShadow: '0px -2px 10px rgba(0,0,0,0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  groupInfoSubtitle: { fontSize: 16, fontWeight: '600', color: '#666', marginBottom: 10 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  userName: { fontSize: 16, color: '#333', fontWeight: '500', flex: 1 },
  removeBtn: { backgroundColor: '#ffecec', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  removeBtnText: { color: '#ff4444', fontSize: 12, fontWeight: 'bold' },
  adminBtn: { backgroundColor: '#e6f7ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  adminBtnText: { color: '#4dabf7', fontSize: 12, fontWeight: 'bold' },
  addMemberBtn: { flexDirection: 'row', backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center', padding: 14, borderRadius: 12, marginTop: 20 },
  addMemberBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  modalSearchInput: { backgroundColor: '#f0f0f0', borderRadius: 10, padding: 10, marginBottom: 15, fontSize: 15 },
});

export default ChatDetailScreen;
