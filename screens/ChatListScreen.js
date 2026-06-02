import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import 'moment/locale/es';
import api from '../api';
import { useFocusEffect } from '@react-navigation/native';

moment.locale('es');

const getImageUrl = (path) => {
  if (!path) return null;
  const IP = Platform.OS === 'web' ? '127.0.0.1' : '192.168.0.115';
  let cleanPath = path.replace('localhost', IP).replace('127.0.0.1', IP).replace('192.168.0.115', IP);
  if (cleanPath.startsWith('http')) return cleanPath;
  return `http://${IP}:8001${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
};

const ChatListScreen = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal para iniciar nuevo chat
  const [users, setUsers] = useState([]);
  const [isUsersModalVisible, setIsUsersModalVisible] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('massaging/conversations/');
      setConversations(res.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const fetchUsers = async () => {
    try {
      const res = await api.get('massaging/users/');
      setUsers(res.data || []);
      setIsUsersModalVisible(true);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const filteredChats = conversations.filter(conv => 
    (conv.title || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    (u.username || '').toLowerCase().includes(userSearchText.toLowerCase())
  );

  const renderChatItem = ({ item }) => {
    const avatarUri = item.type === 'group' 
      ? 'https://ui-avatars.com/api/?name=G&background=999&color=fff' 
      : (getImageUrl(item.image) || `https://ui-avatars.com/api/?name=${item.title}&background=4dabf7&color=fff`);

    return (
      <TouchableOpacity 
        style={styles.chatCard}
        onPress={() => navigation.navigate('ChatDetail', { 
          chatId: item.id, 
          type: item.type,
          title: item.title,
          avatar: avatarUri
        })}
      >
        <View style={styles.avatarContainer}>
          {item.type === 'group' ? (
            <View style={styles.groupAvatar}>
              <Ionicons name="people" size={24} color="#fff" />
            </View>
          ) : (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          )}
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {item.title} {item.type === 'group' ? '(Grupo)' : ''}
            </Text>
            <Text style={styles.chatTime}>
              {item.last_timestamp ? moment(item.last_timestamp).format('LT') : ''}
            </Text>
          </View>
          
          <View style={styles.chatFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.last_message || 'Inicia una conversación...'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mensajes</Text>
        <TouchableOpacity onPress={fetchUsers}>
          <Ionicons name="add-circle-outline" size={26} color="#4dabf7" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conversaciones..."
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tienes mensajes aún.</Text>
          }
        />
      )}

      {/* MODAL PARA BUSCAR USUARIOS Y CREAR CHAT */}
      <Modal visible={isUsersModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Mensaje</Text>
              <TouchableOpacity onPress={() => setIsUsersModalVisible(false)}>
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
                  onPress={() => {
                    setIsUsersModalVisible(false);
                    navigation.navigate('ChatDetail', { 
                      chatId: item.id, 
                      type: 'direct',
                      title: item.username,
                      avatar: getImageUrl(item.user_image) || `https://ui-avatars.com/api/?name=${item.username}`
                    });
                  }}
                >
                  <Image 
                    source={{ uri: getImageUrl(item.user_image) || `https://ui-avatars.com/api/?name=${item.username}` }} 
                    style={styles.userAvatar} 
                  />
                  <Text style={styles.userName}>{item.username}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#333' },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, backgroundColor: '#f5f5f5', borderRadius: 12, height: 45 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  
  listContent: { paddingBottom: 20 },
  
  chatCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
  groupAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#999', justifyContent: 'center', alignItems: 'center' },
  
  chatInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 },
  chatTime: { fontSize: 12, color: '#999', marginLeft: 8 },
  
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: '#666', flex: 1, paddingRight: 10 },
  lastMessageUnread: { color: '#333', fontWeight: '600' },
  
  unreadBadge: { backgroundColor: '#ff6b6b', borderRadius: 12, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
  
  // Estilos del Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalSearchInput: { backgroundColor: '#f0f0f0', borderRadius: 10, padding: 10, marginBottom: 15, fontSize: 15 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  userName: { fontSize: 16, color: '#333', fontWeight: '500' }
});

export default ChatListScreen;