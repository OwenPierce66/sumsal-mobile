import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import 'moment/locale/es';
import { useFocusEffect } from '@react-navigation/native';
import api, { getImageUrl } from '../api';

moment.locale('es');

const TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'direct', label: 'Directos' },
  { id: 'group', label: 'Grupos' },
];

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const cleanContextPreview = (content) => {
  const value = String(content || '').trim();
  if (!value) return '';

  const lines = value.split(/\r?\n/);
  const firstLine = lines[0] || '';
  const body = lines.slice(1).join(' ').trim();
  if (/^↪️?\s*Respuesta a tu historia:/i.test(firstLine)) {
    const title = firstLine
      .replace(/^↪️?\s*Respuesta a tu historia:/i, '')
      .replace(/\[story:[^\]]+\]/i, '')
      .trim();
    return body || `Respondió a tu historia${title ? `: ${title}` : ''}`;
  }
  if (/^↪️?\s*Publicación compartida:/i.test(firstLine)) {
    const title = firstLine
      .replace(/^↪️?\s*Publicación compartida:/i, '')
      .replace(/\[(?:shared-task|task):[^\]]+\]/i, '')
      .trim();
    return body || `Compartió una publicación${title ? `: ${title}` : ''}`;
  }
  return value.replace(/\s+/g, ' ');
};

const getConversationPreview = (conversation) => {
  const cleanText = cleanContextPreview(conversation.last_message);
  if (cleanText) return cleanText;
  if (conversation.last_message_type === 'image') return '📷 Imagen';
  if (conversation.last_message_type === 'video') return '🎥 Video';
  if (conversation.last_message_type === 'attachment') return '📎 Archivo adjunto';
  return conversation.type === 'group' ? 'Grupo recién creado' : 'Inicia la conversación';
};

const formatConversationTime = (timestamp) => {
  if (!timestamp) return '';
  const date = moment(timestamp);
  if (date.isSame(moment(), 'day')) return date.format('LT');
  if (date.isSame(moment().subtract(1, 'day'), 'day')) return 'Ayer';
  if (date.isAfter(moment().subtract(7, 'days'))) return date.format('ddd');
  return date.format('D MMM');
};

const ChatListScreen = ({ navigation }) => {
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [isUsersModalVisible, setIsUsersModalVisible] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const fetchConversations = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await api.get('massaging/conversations/');
      setConversations(normalizeList(response.data));
    } catch (requestError) {
      console.error('[ChatList] Error al cargar conversaciones:', requestError.response?.data || requestError.message);
      setError('No se pudo cargar tu bandeja de mensajes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const [usersResponse, meResponse] = await Promise.all([
        api.get('massaging/users/'),
        api.get('users/me/'),
      ]);
      setUsers(normalizeList(usersResponse.data));
      setCurrentUserId(meResponse.data?.id || null);
    } catch (requestError) {
      console.error('[ChatList] Error al cargar usuarios:', requestError.response?.data || requestError.message);
      Alert.alert('Error', 'No se pudieron cargar los usuarios.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const openNewMessage = useCallback(() => {
    setUserSearchText('');
    setIsUsersModalVisible(true);
    fetchUsers();
  }, [fetchUsers]);

  const openCreateGroup = useCallback(() => {
    setNewGroupName('');
    setSelectedMemberIds([]);
    setIsGroupModalVisible(true);
    fetchUsers();
  }, [fetchUsers]);

  const startDirectChat = useCallback((targetUser) => {
    const username = targetUser.username || targetUser.name || targetUser.email || 'Usuario';
    const avatar = getImageUrl(targetUser.user_image || targetUser.image)
      || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=4dabf7&color=fff`;
    setIsUsersModalVisible(false);
    navigation.navigate('ChatDetail', {
      chatId: targetUser.id,
      type: 'direct',
      title: username,
      avatar,
    });
  }, [navigation]);

  const toggleMember = useCallback((userId) => {
    setSelectedMemberIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ));
  }, []);

  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para el grupo.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      Alert.alert('Selecciona miembros', 'Agrega al menos una persona al grupo.');
      return;
    }

    setCreatingGroup(true);
    try {
      const response = await api.post('massaging/groupss/create/', {
        name,
        members: selectedMemberIds,
      });
      const group = response.data;
      setIsGroupModalVisible(false);
      await fetchConversations();
      navigation.navigate('ChatDetail', {
        chatId: group.id,
        type: 'group',
        title: group.name || name,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name || name)}&background=845ef7&color=fff`,
      });
    } catch (requestError) {
      const backendError = requestError.response?.data?.error || 'No se pudo crear el grupo.';
      Alert.alert('Error', Array.isArray(backendError) ? backendError.join(', ') : String(backendError));
    } finally {
      setCreatingGroup(false);
    }
  }, [newGroupName, selectedMemberIds, fetchConversations, navigation]);

  const visibleUsers = useMemo(() => {
    const query = userSearchText.trim().toLowerCase();
    return users.filter((user) => {
      if (String(user.id) === String(currentUserId)) return false;
      const name = String(user.username || user.name || user.email || '').toLowerCase();
      return !query || name.includes(query);
    });
  }, [users, currentUserId, userSearchText]);

  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (activeTab !== 'all' && conversation.type !== activeTab) return false;
      if (!query) return true;
      return String(conversation.title || '').toLowerCase().includes(query)
        || getConversationPreview(conversation).toLowerCase().includes(query);
    });
  }, [conversations, activeTab, searchText]);

  const groupCount = conversations.filter((item) => item.type === 'group').length;
  const directCount = conversations.filter((item) => item.type === 'direct').length;

  const renderConversation = ({ item }) => {
    const isGroup = item.type === 'group';
    const unreadCount = Number(item.unread_count || 0);
    const title = item.title || (isGroup ? 'Grupo' : 'Usuario');
    const avatar = getImageUrl(item.image)
      || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=${isGroup ? '845ef7' : '4dabf7'}&color=fff`;
    const preview = getConversationPreview(item);
    const senderPrefix = isGroup && item.last_sender_name
      ? `${item.last_sender_name}: `
      : '';

    return (
      <TouchableOpacity
        style={[styles.chatCard, unreadCount > 0 && styles.chatCardUnread]}
        onPress={() => navigation.navigate('ChatDetail', {
          chatId: item.id,
          type: item.type,
          title,
          avatar,
        })}
        activeOpacity={0.82}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          {isGroup ? (
            <View style={styles.groupIndicator}>
              <Ionicons name="people" size={11} color="#fff" />
            </View>
          ) : null}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <View style={styles.chatTitleRow}>
              <Text style={[styles.chatName, unreadCount > 0 && styles.chatNameUnread]} numberOfLines={1}>
                {title}
              </Text>
              {isGroup ? <Text style={styles.groupLabel}>Grupo</Text> : null}
            </View>
            <Text style={[styles.chatTime, unreadCount > 0 && styles.chatTimeUnread]}>
              {formatConversationTime(item.last_timestamp)}
            </Text>
          </View>

          <View style={styles.chatFooter}>
            <Text
              style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]}
              numberOfLines={1}
            >
              {senderPrefix}{preview}
            </Text>
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </View>

          {isGroup && item.member_count ? (
            <Text style={styles.memberCount}>{item.member_count} miembros</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const emptyCopy = activeTab === 'group'
    ? 'Todavía no perteneces a ningún grupo.'
    : activeTab === 'direct'
      ? 'Todavía no tienes conversaciones directas.'
      : 'Tu bandeja está vacía.';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Mensajes</Text>
          <Text style={styles.headerSubtitle}>{directCount} directos · {groupCount} grupos</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openCreateGroup} style={styles.headerButton}>
            <Ionicons name="people-outline" size={25} color="#845ef7" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openNewMessage} style={styles.headerButton}>
            <Ionicons name="create-outline" size={25} color="#228be6" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={19} color="#8b949e" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar mensajes o personas"
          placeholderTextColor="#8b949e"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')}>
            <Ionicons name="close-circle" size={19} color="#adb5bd" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4dabf7" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={44} color="#adb5bd" />
          <Text style={styles.emptyTitle}>{error}</Text>
          <TouchableOpacity style={styles.primaryAction} onPress={() => fetchConversations()}>
            <Text style={styles.primaryActionText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderConversation}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchConversations({ refresh: true })}
              tintColor="#4dabf7"
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            filteredConversations.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={(
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={activeTab === 'group' ? 'people-outline' : 'chatbubbles-outline'}
                  size={38}
                  color="#8b949e"
                />
              </View>
              <Text style={styles.emptyTitle}>{emptyCopy}</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'group'
                  ? 'Crea un grupo y elige sus miembros para comenzar.'
                  : 'Busca una persona y envíale tu primer mensaje.'}
              </Text>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={activeTab === 'group' ? openCreateGroup : openNewMessage}
              >
                <Text style={styles.primaryActionText}>
                  {activeTab === 'group' ? 'Crear grupo' : 'Nuevo mensaje'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal
        visible={isUsersModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsUsersModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Nuevo mensaje</Text>
                <Text style={styles.modalSubtitle}>Elige con quién quieres hablar</Text>
              </View>
              <TouchableOpacity onPress={() => setIsUsersModalVisible(false)} style={styles.headerButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearch}>
              <Ionicons name="search" size={18} color="#8b949e" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar usuario"
                value={userSearchText}
                onChangeText={setUserSearchText}
              />
            </View>

            {loadingUsers ? (
              <ActivityIndicator size="large" color="#4dabf7" style={styles.modalLoader} />
            ) : (
              <FlatList
                data={visibleUsers}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const name = item.username || item.name || item.email || 'Usuario';
                  const avatar = getImageUrl(item.user_image || item.image)
                    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
                  return (
                    <TouchableOpacity style={styles.userRow} onPress={() => startDirectChat(item)}>
                      <Image source={{ uri: avatar }} style={styles.userAvatar} contentFit="cover" />
                      <Text style={styles.userName}>{name}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#adb5bd" />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text style={styles.modalEmpty}>No se encontraron usuarios.</Text>}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={isGroupModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsGroupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Crear grupo</Text>
                <Text style={styles.modalSubtitle}>Ponle nombre y elige sus miembros</Text>
              </View>
              <TouchableOpacity onPress={() => setIsGroupModalVisible(false)} style={styles.headerButton}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.groupNameInput}
              placeholder="Nombre del grupo"
              value={newGroupName}
              onChangeText={setNewGroupName}
              maxLength={255}
            />

            <View style={styles.groupMembersHeader}>
              <Text style={styles.groupMembersTitle}>Miembros</Text>
              <Text style={styles.selectedCount}>{selectedMemberIds.length} seleccionados</Text>
            </View>

            <View style={styles.modalSearch}>
              <Ionicons name="search" size={18} color="#8b949e" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar miembros"
                value={userSearchText}
                onChangeText={setUserSearchText}
              />
            </View>

            {loadingUsers ? (
              <ActivityIndicator size="large" color="#845ef7" style={styles.modalLoader} />
            ) : (
              <FlatList
                data={visibleUsers}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const selected = selectedMemberIds.includes(item.id);
                  const name = item.username || item.name || item.email || 'Usuario';
                  const avatar = getImageUrl(item.user_image || item.image)
                    || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
                  return (
                    <TouchableOpacity style={styles.userRow} onPress={() => toggleMember(item.id)}>
                      <Image source={{ uri: avatar }} style={styles.userAvatar} contentFit="cover" />
                      <Text style={styles.userName}>{name}</Text>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={selected ? '#845ef7' : '#ced4da'}
                      />
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={[
                styles.createGroupButton,
                (!newGroupName.trim() || selectedMemberIds.length === 0 || creatingGroup)
                  && styles.createGroupButtonDisabled,
              ]}
              onPress={handleCreateGroup}
              disabled={!newGroupName.trim() || selectedMemberIds.length === 0 || creatingGroup}
            >
              {creatingGroup ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="people" size={19} color="#fff" />
                  <Text style={styles.createGroupText}>Crear grupo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f2',
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 2 },
  headerTitle: { fontSize: 21, fontWeight: '800', color: '#202124' },
  headerSubtitle: { fontSize: 11, color: '#8b949e', marginTop: 1 },
  headerActions: { flexDirection: 'row' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 13,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#222' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 11 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: '#e9ecef' },
  tabActive: { backgroundColor: '#dff1ff' },
  tabText: { fontSize: 13, color: '#6c757d', fontWeight: '700' },
  tabTextActive: { color: '#1971c2' },
  listContent: { paddingHorizontal: 12, paddingBottom: 28 },
  emptyListContent: { flexGrow: 1 },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#edf0f2',
  },
  chatCardUnread: { backgroundColor: '#eef7ff', borderColor: '#d8ebff' },
  avatarContainer: { width: 54, height: 54, position: 'relative' },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#e9ecef' },
  groupIndicator: {
    position: 'absolute',
    right: -2,
    bottom: -1,
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#845ef7',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatInfo: { flex: 1, marginLeft: 12 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatName: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: '#343a40' },
  chatNameUnread: { fontWeight: '800', color: '#1c2b3a' },
  groupLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7048e8',
    backgroundColor: '#ede9ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
  },
  chatTime: { fontSize: 11, color: '#adb5bd', marginLeft: 8 },
  chatTimeUnread: { color: '#228be6', fontWeight: '700' },
  chatFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  lastMessage: { flex: 1, fontSize: 13, color: '#7b838a', paddingRight: 8 },
  lastMessageUnread: { color: '#343a40', fontWeight: '600' },
  unreadBadge: {
    minWidth: 21,
    height: 21,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#228be6',
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  memberCount: { fontSize: 10, color: '#adb5bd', marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#edf0f2',
  },
  emptyTitle: { marginTop: 14, fontSize: 16, fontWeight: '700', color: '#495057', textAlign: 'center' },
  emptySubtitle: { marginTop: 5, fontSize: 13, lineHeight: 18, color: '#8b949e', textAlign: 'center' },
  primaryAction: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#4dabf7' },
  primaryActionText: { color: '#fff', fontWeight: '800' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  modalContent: {
    height: '84%',
    paddingHorizontal: 18,
    paddingBottom: 22,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#d9dde1', alignSelf: 'center', marginTop: 9, marginBottom: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#202124' },
  modalSubtitle: { fontSize: 12, color: '#8b949e', marginTop: 2 },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 13,
    backgroundColor: '#f1f3f5',
  },
  modalSearchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  modalLoader: { marginTop: 50 },
  modalEmpty: { textAlign: 'center', color: '#8b949e', marginTop: 35 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  userAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: '#e9ecef' },
  userName: { flex: 1, fontSize: 15, color: '#343a40', fontWeight: '600' },
  groupNameInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 13,
    paddingHorizontal: 13,
    fontSize: 16,
    marginBottom: 16,
  },
  groupMembersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  groupMembersTitle: { fontSize: 15, fontWeight: '800', color: '#343a40' },
  selectedCount: { fontSize: 12, color: '#845ef7', fontWeight: '700' },
  createGroupButton: {
    height: 48,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#845ef7',
    marginTop: 12,
  },
  createGroupButtonDisabled: { opacity: 0.45 },
  createGroupText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

export default ChatListScreen;
