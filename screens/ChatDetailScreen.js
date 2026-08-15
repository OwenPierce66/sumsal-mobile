import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Animated, PanResponder, Image as RNImage, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import TouchableUsername from '../components/TouchableUsername';

const STORY_REPLY_PREFIX = '↪ Respuesta a tu historia:';

const buildStoryReplyContextLine = (storyReplyContext) => {
  if (!storyReplyContext) return '';
  const safeTitle = String(storyReplyContext.storyTitle || 'Historia').replace(/\s+/g, ' ').trim();
  const safeId = String(storyReplyContext.storyId || '').trim();
  if (!safeId) return `${STORY_REPLY_PREFIX} ${safeTitle}`;
  return `${STORY_REPLY_PREFIX} ${safeTitle} [story:${safeId}]`;
};

const parseStoryReplyFromContent = (content) => {
  if (!content) return { storyContext: null, bodyText: '' };
  const normalized = String(content);
  const lines = normalized.split('\n');
  const firstLine = (lines[0] || '').trim();
  if (!firstLine.startsWith(STORY_REPLY_PREFIX)) {
    return { storyContext: null, bodyText: normalized };
  }

  const markerMatch = firstLine.match(/\[story:([^\]]+)\]/i);
  const storyId = markerMatch?.[1] ? String(markerMatch[1]).trim() : null;
  const titlePart = firstLine
    .replace(STORY_REPLY_PREFIX, '')
    .replace(/\[story:[^\]]+\]/i, '')
    .trim();
  const bodyText = lines.slice(1).join('\n').trim();

  return {
    storyContext: {
      storyId,
      storyTitle: titlePart || 'Historia',
    },
    bodyText,
  };
};

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') && !path.includes('localhost') && !path.includes('127.0.0.1') && !path.includes('192.168.')) {
    return path;
  }
  const IP = Platform.OS === 'web' ? 'localhost' : '192.168.0.115';
  let cleanPath = path;
  if (cleanPath.startsWith('http')) {
    cleanPath = cleanPath.replace(/^https?:\/\/[^\/]+/, '');
  }
  return `http://${IP}:8001${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
};

const MessageItem = ({ item, isMe, type, msgAvatar, onReply, onDelete, onNavigateToProfile, onOpenStory, navigation }) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const { storyContext, bodyText } = parseStoryReplyFromContent(item?.content || '');
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
        style={{ transform: [{ translateX: pan.x }] }}
      >
        <TouchableOpacity 
          style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}
          onLongPress={() => {
            if (isMe) {
              if (Platform.OS === 'web') {
                if (window.confirm("¿Deseas eliminar este mensaje?")) {
                  onDelete(item.id);
                }
              } else {
                Alert.alert("Opciones", "¿Qué deseas hacer?", [
                  { text: "Eliminar", style: 'destructive', onPress: () => onDelete(item.id) },
                  { text: "Cancelar", style: 'cancel' }
                ]);
              }
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
          {storyContext ? (
            <TouchableOpacity
              style={[styles.storyContextBox, isMe ? styles.storyContextBoxMe : styles.storyContextBoxThem]}
              onPress={() => onOpenStory && onOpenStory(storyContext.storyId)}
              activeOpacity={0.85}
            >
              <Ionicons name="time-outline" size={14} color={isMe ? '#fff' : '#4dabf7'} />
              <Text style={[styles.storyContextText, isMe ? styles.storyContextTextMe : styles.storyContextTextThem]} numberOfLines={1}>
                {storyContext.storyTitle || 'Historia'}
              </Text>
              <Ionicons name="arrow-forward" size={12} color={isMe ? '#fff' : '#4dabf7'} />
            </TouchableOpacity>
          ) : null}

          {bodyText ? (
            <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>
              {bodyText}
            </Text>
          ) : null}
          
          {item.image && (
             <RNImage source={{ uri: getImageUrl(item.image) }} style={styles.messageImage} resizeMode="cover" />
          )}
          {item.video && (
            <View style={styles.videoPlaceholder}>
               <Ionicons name="play-circle" size={40} color="#fff" />
               <Text style={styles.videoText}>Video (Tap to play)</Text>
            </View>
          )}

          <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeThem]}>
            {moment(item.timestamp).format('HH:mm')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const ChatDetailScreen = ({ route, navigation }) => {
  const { chatId, type, title, avatar, storyReplyContext: incomingStoryReplyContext } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
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

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const userRes = await api.get('users/me/');
      setCurrentUser(userRes.data);

      let res;
      if (type === 'direct') {
        res = await api.get(`massaging/messages/?user_id=${chatId}`);
      } else {
        res = await api.get(`massaging/groupss/${chatId}/messages/`);
      }
      
      const msgs = Array.isArray(res.data) ? res.data : [];
      setMessages(msgs);
    } catch (error) {
      console.error('Error fetching messages:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  }, [chatId, type]);

  useFocusEffect(
    useCallback(() => {
      fetchMessages();
    }, [fetchMessages])
  );

  useEffect(() => {
    setStoryReplyContext(incomingStoryReplyContext || null);
  }, [incomingStoryReplyContext]);

  const fetchGroupInfo = async () => {
    if (type !== 'group') return;
    try {
      const res = await api.get('massaging/groupss/');
      const group = res.data.find(g => g.id === chatId);
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
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0]);
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
    if (!newMessage.trim() && !selectedImage) return;
    
    try {
      const formData = new FormData();
      const hasStoryContext = !!storyReplyContext && !replyTo;
      const contextLine = hasStoryContext
        ? buildStoryReplyContextLine(storyReplyContext)
        : '';
      const plainMessage = newMessage.trim();
      const finalMessageContent = hasStoryContext
        ? (plainMessage ? `${contextLine}\n${plainMessage}` : contextLine)
        : plainMessage;
      if (finalMessageContent) formData.append("content", finalMessageContent);

      if (selectedImage) {
        let fileType = 'jpg';
        let isVideo = selectedImage.type === 'video';

        if (selectedImage.fileName) {
          const nameParts = selectedImage.fileName.split('.');
          fileType = nameParts[nameParts.length - 1];
        } else {
          const uriParts = selectedImage.uri.split('.');
          const possibleExt = uriParts[uriParts.length - 1];
          if (possibleExt && possibleExt.length <= 5) {
            fileType = possibleExt;
          }
        }

        if (fileType === 'mp4') isVideo = true;
        const finalType = isVideo ? `video/${fileType}` : `image/${fileType}`;
        
        if (Platform.OS === 'web') {
          const response = await fetch(selectedImage.uri);
          const blob = await response.blob();
          const ext = blob.type.split('/')[1] || fileType;
          formData.append(isVideo ? 'video' : 'image', blob, `media.${ext}`);
        } else {
          formData.append(isVideo ? 'video' : 'image', {
            uri: selectedImage.uri,
            name: `media.${fileType}`,
            type: finalType,
          });
        }
      }

      if (replyTo) {
        formData.append("reply_to", replyTo.id);
      }

      if (type === 'direct') {
        formData.append("receiver", chatId);
        const res = await api.post(`massaging/messages/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setMessages(prev => [res.data, ...prev]);
      } else {
        const res = await api.post(`massaging/groupss/${chatId}/send_message/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setMessages(prev => [res.data, ...prev]);
      }

      setNewMessage('');
      setSelectedImage(null);
      setReplyTo(null);
      setStoryReplyContext(null);
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
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

  const handleOpenStoryFromMessage = useCallback((storyId) => {
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('Stories', { openStoryId: storyId || null });
      return;
    }
    navigation.navigate('Stories', { openStoryId: storyId || null });
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
        onNavigateToProfile={navigateToProfile}
        onOpenStory={handleOpenStoryFromMessage}
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
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4dabf7" style={{ flex: 1, justifyContent: 'center' }} />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messagesList}
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
            <Text style={styles.replyIndicatorSender}>Respondiendo historia</Text>
            <Text style={styles.replyIndicatorContent} numberOfLines={1}>
              {storyReplyContext.storyTitle || 'Historia'} • #{String(storyReplyContext.storyId || '').slice(0, 8)}
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
          <RNImage source={{ uri: selectedImage.uri }} style={styles.selectedImagePreview} />
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close-circle" size={24} color="#ff4444" />
          </TouchableOpacity>
        </View>
      )}

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
          style={[styles.sendBtn, (!newMessage.trim() && !selectedImage) && { backgroundColor: '#ccc' }]} 
          onPress={handleSend}
          disabled={!newMessage.trim() && !selectedImage}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

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
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingTop: Platform.OS === 'ios' ? 50 : 16 },
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
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 20 },
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
  storyContextText: { fontSize: 13, fontWeight: '600', flex: 1 },
  storyContextTextMe: { color: '#fff' },
  storyContextTextThem: { color: '#297fce' },
  messageImage: { width: 180, height: 180, borderRadius: 10, marginTop: 8 },
  messageTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
  messageTimeThem: { color: '#999' },
  
  videoPlaceholder: { width: 180, height: 100, backgroundColor: '#333', borderRadius: 10, marginTop: 8, justifyContent: 'center', alignItems: 'center' },
  videoText: { color: '#fff', fontSize: 12, marginTop: 5 },

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
  removeImageBtn: { position: 'absolute', top: 5, left: 75, backgroundColor: '#fff', borderRadius: 12 },

  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'flex-end', gap: 10 },
  attachBtn: { width: 40, height: 45, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, minHeight: 45, maxHeight: 100, fontSize: 15 },
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },

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
