import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import api from '../api';
import { useFocusEffect } from '@react-navigation/native';

const getImageUrl = (path) => {
  if (!path) return null;
  const IP = Platform.OS === 'web' ? '127.0.0.1' : '192.168.0.115';
  let cleanPath = path.replace('localhost', IP).replace('127.0.0.1', IP).replace('192.168.0.115', IP);
  if (cleanPath.startsWith('http')) return cleanPath;
  return `http://${IP}:8001${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
};

const ChatDetailScreen = ({ route, navigation }) => {
  const { chatId, type, title, avatar } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

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
      setMessages(msgs.reverse());
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

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    
    try {
      const formData = new FormData();
      formData.append("content", newMessage);

      if (type === 'direct') {
        formData.append("receiver", chatId);
        const res = await api.post(`massaging/messages/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setMessages(prev => [res.data, ...prev]);
      } else {
        const res = await api.post(`massaging/groupss/${chatId}/send_message/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setMessages(prev => [res.data, ...prev]);
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = currentUser && item.sender?.id === currentUser.id;
    const msgAvatar = getImageUrl(item.sender?.user_image) || `https://ui-avatars.com/api/?name=${item.sender?.username || 'U'}`;
    
    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
        {!isMe && type === 'group' && (
          <Image source={{ uri: msgAvatar }} style={styles.messageAvatar} />
        )}
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
          {!isMe && type === 'group' && (
            <Text style={styles.messageSenderName}>{item.sender?.username}</Text>
          )}
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>
            {item.content}
          </Text>
          {item.image && (
             <Image source={{ uri: getImageUrl(item.image) }} style={styles.messageImage} contentFit="cover" />
          )}
          <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeThem]}>
            {moment(item.timestamp).format('HH:mm')}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ENCABEZADO DEL CHAT */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Image source={{ uri: avatar }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{title}</Text>
          <Text style={styles.headerUsername}>{type === 'group' ? 'Grupo' : 'Mensaje Directo'}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons name="information-circle-outline" size={26} color="#333" />
        </TouchableOpacity>
      </View>

      {/* LISTA DE MENSAJES */}
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

      {/* INPUT PARA ESCRIBIR */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendBtn, !newMessage.trim() && { backgroundColor: '#ccc' }]} 
          onPress={handleSend}
          disabled={!newMessage.trim()}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
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
  messageSenderName: { fontSize: 11, color: '#4dabf7', fontWeight: 'bold', marginBottom: 2 },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageTextMe: { color: '#fff' },
  messageTextThem: { color: '#333' },
  messageImage: { width: 180, height: 180, borderRadius: 10, marginTop: 8 },
  messageTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
  messageTimeThem: { color: '#999' },
  
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, minHeight: 45, maxHeight: 100, fontSize: 15 },
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' }
});

export default ChatDetailScreen;