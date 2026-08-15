import React, { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { getImageUrl } from '../api';
import { Image } from 'expo-image';
import TouchableUsername from '../components/TouchableUsername';

const TIER_ORDER = ['all', 'verified', 'recommended', 'app', 'sub_red', 'sub_green', 'regular'];

const getTierKey = (user) => {
  const profile = user?.profile || {};
  if (profile.is_verified) return 'verified';
  if (profile.is_recommended) return 'recommended';
  return 'regular';
};

const UsersListModal = ({ visible, onClose, apiUrl, title = "Usuarios", navigation }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [activeTier, setActiveTier] = useState('all');

  useEffect(() => {
    if (visible && apiUrl) {
      fetchUsers();
    } else {
      setUsers([]);
    }
  }, [visible, apiUrl]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get(apiUrl);
      const fetchedUsers = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users for modal:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const tierCounts = useMemo(() => {
    const counts = { all: users.length, verified: 0, recommended: 0, app: 0, sub_red: 0, sub_green: 0, regular: 0 };
    users.forEach(u => {
      const key = getTierKey(u);
      if (counts[key] !== undefined) {
        counts[key]++;
      }
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (activeTier === 'all') return users;
    return users.filter(u => getTierKey(u) === activeTier);
  }, [users, activeTier]);

  const renderUser = ({ item }) => (
    <View style={styles.userRow}>
      <Image source={{ uri: getImageUrl(item.user_image) }} style={styles.avatar} />
      <TouchableUsername
        username={item.username || 'Usuario'}
        userId={item.id}
        userImage={getImageUrl(item.user_image)}
        navigation={navigation}
        style={styles.usernameContainer}
        textStyle={styles.username}
      />
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {TIER_ORDER.map(tierKey => {
        if (tierCounts[tierKey] > 0 || tierKey === 'all') {
          return (
            <TouchableOpacity key={tierKey} style={[styles.tab, activeTier === tierKey && styles.activeTab]} onPress={() => setActiveTier(tierKey)}>
              <Text style={[styles.tabText, activeTier === tierKey && styles.activeTabText]}>
                {tierKey.charAt(0).toUpperCase() + tierKey.slice(1)} ({tierCounts[tierKey]})
              </Text>
            </TouchableOpacity>
          );
        }
        return null;
      })}
    </View>
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#555" /></TouchableOpacity>
          </View>
          {renderTabs()}
          {loading ? <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#4dabf7" /> : <FlatList data={filteredUsers} renderItem={renderUser} keyExtractor={(item) => item.id.toString()} ListEmptyComponent={<Text style={styles.emptyText}>No hay usuarios en esta categoría.</Text>} />}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, borderRadius: 8 },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#4dabf7' },
  tabText: { color: '#555', fontWeight: '600' },
  activeTabText: { color: '#4dabf7' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  usernameContainer: { flex: 1 },
  username: { fontSize: 16, fontWeight: '500' },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },
});

export default UsersListModal;