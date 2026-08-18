﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { getImageUrl } from '../api';
import { Image } from 'expo-image';
import TouchableUsername from '../components/TouchableUsername';

const TIER_ORDER = ['all', 'app', 'recommended', 'sub_red', 'verified', 'sub_green', 'regular'];
const TIER_META = {
  verified: { label: 'Verificados', color: '#4dabf7' },
  recommended: { label: 'Recomendados', color: '#f59f00' },
  app: { label: 'App', color: '#000' },
  sub_red: { label: 'Suscripción +', color: '#ff6b6b' },
  sub_green: { label: 'Suscripción', color: '#51cf66' },
  regular: { label: 'Otros', color: '#868e96' },
  all: { label: 'Todos', color: '#333' },
};

// ✅ Lógica de tiers COMPLETA portada de ReelsPCH.js para consistencia
const getTierKey = (user) => {
  const profile = user?.profile || user || {};
  const username = String(user?.username || user?.user?.username || '').toLowerCase();
  const userId = user?.id || user?.user?.id;
  if (user?.is_app || username === 'app-bot' || username === 'owen' || userId === 1) return 'app';
  if (profile.is_recommended) return 'recommended';
  if (profile.subscriptionActive && parseFloat(profile.subscription_amount || 0) >= 8) return 'sub_red';
  if (profile.is_verified) return 'verified';
  if (profile.subscriptionActive) return 'sub_green';
  return 'regular';
};

const TieredLikesModal = ({ visible, onClose, apiUrl, initialTier = 'all', title = "Usuarios", navigation }) => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [activeTier, setActiveTier] = useState(initialTier);
  const [storyActivityCounts, setStoryActivityCounts] = useState({ views: 0, likes: 0 });
  const isViewersList = String(apiUrl || '').includes('/viewers/');

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
      setStoryActivityCounts({ views: 0, likes: 0 });
    }
  }, [visible, apiUrl, initialTier]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get(apiUrl);
      console.log(`[TieredLikesModal] FETCH SUCCESS - API Response Status: ${response.status}`);
      const fetchedUsers = Array.isArray(response.data)
        ? response.data
        : (response.data.results || response.data.users || []);
      console.log('[TieredLikesModal] FETCH USERS', {
        apiUrl,
        count: fetchedUsers.length,
        userIds: fetchedUsers.map(user => user?.id),
      });
      setUsers(fetchedUsers); 
      if (isViewersList) {
        setStoryActivityCounts({
          views: Number(response.data?.views_count ?? response.data?.count ?? 0),
          likes: Number(response.data?.likes_count ?? 0),
        });
      }
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
    const userObject = item.user || item;
    const tierKey = getTierKey(userObject);
    const tierColor = TIER_META[tierKey]?.color || '#868e96';
    const userName = userObject.username || userObject.name || userObject.user?.username || 'Usuario';
    const userId = userObject.id || userObject.user?.id;
    const userImage = userObject.profile?.user_image || userObject.user_image || userObject.image || userObject.user?.user_image;

    return (
      <View style={styles.userRow}>
        <Image source={{ uri: getImageUrl(userImage) }} style={[styles.avatar, { borderColor: tierColor }]} />
        <TouchableUsername
          username={userName}
          userId={userId}
          userImage={getImageUrl(userImage)}
          navigation={navigation}
          style={styles.userNameCell}
          textStyle={styles.username}
        />
        {tierKey !== 'regular' ? (
          <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
            <Text style={styles.tierBadgeText}>{TIER_META[tierKey].label}</Text>
          </View>
        ) : null}
        {isViewersList ? (
          <View style={styles.storyActivityIcons}>
            {userObject.viewed !== false ? (
              <View style={styles.storyActivityIcon}>
                <Ionicons name="eye" size={17} color="#4dabf7" />
              </View>
            ) : null}
            {userObject.liked ? (
              <View style={[styles.storyActivityIcon, styles.storyLikeIcon]}>
                <Ionicons name="heart" size={16} color="#ff4d6d" />
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.likesCount, { color: tierColor }]}>{userObject.profile?.likes_count || 0} <Ionicons name="heart" size={12} /></Text>
        )}
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
          {isViewersList ? (
            <View style={styles.storyActivitySummary}>
              <View style={styles.storyActivityStat}>
                <Ionicons name="eye-outline" size={19} color="#4dabf7" />
                <Text style={styles.storyActivityStatCount}>{storyActivityCounts.views}</Text>
                <Text style={styles.storyActivityStatLabel}>vistas</Text>
              </View>
              <View style={styles.storyActivityStat}>
                <Ionicons name="heart-outline" size={19} color="#ff4d6d" />
                <Text style={styles.storyActivityStatCount}>{storyActivityCounts.likes}</Text>
                <Text style={styles.storyActivityStatLabel}>me gusta</Text>
              </View>
            </View>
          ) : null}
          {renderTabs()}
          {loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#4dabf7" />
          ) : (
            <FlatList
              data={filteredUsers}
              renderItem={renderUser}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={(
                <Text style={styles.emptyText}>
                  {isViewersList ? 'Nadie ha visto esta historia todavía.' : 'No hay usuarios en esta categoría.'}
                </Text>
              )}
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
  storyActivitySummary: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  storyActivityStat: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 14,
    backgroundColor: '#f5f7fa',
    borderWidth: 1,
    borderColor: '#e8ebef',
  },
  storyActivityStatCount: { fontSize: 17, fontWeight: '800', color: '#2f343a' },
  storyActivityStatLabel: { fontSize: 12, color: '#7a828a' },
  storyActivityIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storyActivityIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7f4ff',
  },
  storyLikeIcon: { backgroundColor: '#ffe9ee' },
  tabContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { paddingVertical: 10, paddingHorizontal: 12, marginRight: 8, borderRadius: 8 },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#4dabf7' },
  tabText: { color: '#555', fontWeight: '600' },
  activeTabText: { color: '#4dabf7', fontWeight: 'bold' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, borderWidth: 2 },
  userNameCell: { flex: 1, marginRight: 8 },
  username: { fontSize: 16, fontWeight: '500', flex: 1 },
  tierBadge: {
    maxWidth: 92,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginRight: 8,
    borderRadius: 10,
  },
  tierBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  likesCount: { fontSize: 14, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#999' },
});

export default TieredLikesModal;
