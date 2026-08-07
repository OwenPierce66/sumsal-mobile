﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { getImageUrl } from '../api';
import { Image } from 'expo-image';

const TIER_ORDER = ['all', 'verified', 'recommended', 'app', 'sub_red', 'sub_green', 'regular'];
const TIER_META = {
  verified: { label: 'Verificados', color: '#4dabf7' },
  recommended: { label: 'Recomendados', color: '#f59f00' },
  app: { label: 'App', color: '#000' },
  sub_red: { label: 'Sub Rojo', color: '#ff6b6b' },
  sub_green: { label: 'Sub Verde', color: '#51cf66' },
  regular: { label: 'Regular', color: '#868e96' },
  all: { label: 'Todos', color: '#333' },
};

// ✅ Lógica de tiers COMPLETA portada de ReelsPCH.js para consistencia
const getTierKey = (user) => {
  const profile = user?.profile || user || {};
  if (profile.is_verified) return 'verified';
  if (profile.is_recommended) return 'recommended';
  // El ID 1 corresponde al usuario 'owen' o la cuenta principal de la app
  if (profile.id === 1) return 'app';
  if (profile.subscriptionActive) {
    // El umbral de 8 define si un suscriptor es "PLUS" (rojo)
    if (parseFloat(profile.subscription_amount || 0) >= 8) {
      return 'sub_red';
    }
    return 'sub_green';
  }
  return 'regular';
};

const TieredLikesModal = ({ visible, onClose, apiUrl, initialTier = 'all', title = "Usuarios" }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [activeTier, setActiveTier] = useState(initialTier);

  useEffect(() => {
    if (visible) {
      setActiveTier(initialTier); // Reset to initial tier every time it opens
      if (apiUrl) {
        console.log(`[TieredLikesModal] MODAL OPEN - Fetching users from apiUrl: ${apiUrl}`);
        fetchUsers();
      } else {
        console.log('[TieredLikesModal] MODAL OPEN - Missing apiUrl');
      }
    } else {
      console.log('[TieredLikesModal] MODAL CLOSED - Clearing users');
      setUsers([]); // Limpiar al cerrar
    }
  }, [visible, apiUrl, initialTier]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get(apiUrl);
      console.log(`[TieredLikesModal] FETCH SUCCESS - API Response Status: ${response.status}`);
      const fetchedUsers = Array.isArray(response.data) ? response.data : (response.data.results || []);
      console.log('[TieredLikesModal] FETCH USERS', {
        apiUrl,
        count: fetchedUsers.length,
        userIds: fetchedUsers.map(user => user?.id),
      });
      setUsers(fetchedUsers); 
    } catch (error) {
      console.error(`[TieredLikesModal] FETCH ERROR - API call to ${apiUrl} failed:`, error.response?.status, error.response?.data || error);
      console.error("Error fetching users for modal:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const tierCounts = React.useMemo(() => {
    const counts = { all: users.length, verified: 0, recommended: 0, app: 0, sub_red: 0, sub_green: 0, regular: 0 };
    users.forEach(u => {
      const key = getTierKey(u);
      if (counts[key] !== undefined) {
        counts[key]++;
      }
    });
    return counts;
  }, [users]);

  const filteredUsers = React.useMemo(() => {
    if (activeTier === 'all') return users;
    return users.filter(u => getTierKey(u) === activeTier);
  }, [users, activeTier]);

  const renderUser = ({ item }) => {
    // ✅ CORRECCIÓN: La API de likes de perfil devuelve una lista de usuarios,
    // cada uno con su 'profile'. Usamos el objeto raíz para el avatar y nombre.
    const userObject = item.user || item; // Si existe item.user, lo usamos; si no, usamos item.
    const tierKey = getTierKey(userObject);
    const tierColor = TIER_META[tierKey]?.color || '#868e96';
    return (
      <View style={styles.userRow}>
        <Image source={{ uri: getImageUrl(userObject.profile?.user_image || userObject.user_image) }} style={[styles.avatar, { borderColor: tierColor }]} />
        <Text style={styles.username}>{userObject.username || userObject.user?.username}</Text>
        <Text style={[styles.likesCount, { color: tierColor }]}>{userObject.profile?.likes_count || 0} <Ionicons name="heart" size={12} /></Text>
      </View>
    );
  };

  const renderTabs = () => {
    return (
      <View style={styles.tabContainer}>
        {TIER_ORDER.map(tierKey => {
          if (tierCounts[tierKey] > 0 || tierKey === 'all') {
            return (
              <TouchableOpacity
                key={tierKey}
                style={[styles.tab, activeTier === tierKey && styles.activeTab]}
                onPress={() => setActiveTier(tierKey)}
              >
                <Text style={[styles.tabText, activeTier === tierKey && styles.activeTabText]}>
                  {TIER_META[tierKey]?.label || tierKey} ({tierCounts[tierKey]})
                </Text>
              </TouchableOpacity>
            );
          }
          return null;
        })}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>
          {renderTabs()}
          {loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#4dabf7" />
          ) : (
            <FlatList
              data={filteredUsers}
              renderItem={renderUser}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={<Text style={styles.emptyText}>No hay usuarios en esta categoría.</Text>}
            />
          )}
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
  activeTabText: { color: '#4dabf7', fontWeight: 'bold' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, borderWidth: 2 },
  username: { fontSize: 16, fontWeight: '500', flex: 1 },
  likesCount: { fontSize: 14, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },
});

export default TieredLikesModal;
