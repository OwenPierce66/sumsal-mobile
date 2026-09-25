import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import api, { getImageUrl } from '../api';

const getName = (user) => (
  user?.username
  || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
  || 'Perfil'
);

const FavoritesScreen = ({ navigation, route }) => {
  const userId = route?.params?.userId;
  const organize = route?.params?.mode === 'organize';
  const [collection, setCollection] = useState({ profiles: [], tasks: [], visibility: {} });
  const [activeType, setActiveType] = useState('profiles');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCollection = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const endpoint = userId ? `favorites/collection/${userId}/` : 'favorites/collection/';
      const response = await api.get(endpoint);
      setCollection({
        profiles: Array.isArray(response.data?.profiles) ? response.data.profiles : [],
        tasks: Array.isArray(response.data?.tasks) ? response.data.tasks : [],
        visibility: response.data?.visibility || {},
      });
    } catch (error) {
      console.error('[FavoritesScreen] No se pudo cargar la colección:', error.response?.data || error.message);
      Alert.alert('No se pudo cargar', 'Intenta nuevamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    fetchCollection();
  }, [fetchCollection]));

  const items = collection[activeType] || [];
  const isOwner = !userId;

  const persistOrder = async (nextItems) => {
    const normalizedItems = nextItems.map((item, index) => ({
      ...item,
      is_pinned: index < 5,
      position: index,
    }));
    setCollection((current) => ({ ...current, [activeType]: normalizedItems }));
    if (!isOwner) return;
    try {
      await api.patch('favorites/collection/', {
        type: activeType,
        order: normalizedItems.map((item) => item.id),
      });
    } catch (error) {
      console.error('[FavoritesScreen] No se pudo guardar el orden:', error.response?.data || error.message);
      fetchCollection({ refresh: true });
      Alert.alert('No se pudo ordenar', 'Intenta nuevamente.');
    }
  };

  const moveItem = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const nextItems = [...items];
    [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
    persistOrder(nextItems);
  };

  const isInTopFive = (index) => index < 5;

  const togglePin = async (item) => {
    if (!isOwner) return;
    try {
      await api.post('favorites/pin/', {
        type: activeType === 'profiles' ? 'profile' : 'task',
        id: item.id,
        is_pinned: !item.is_pinned,
      });
      fetchCollection({ refresh: true });
    } catch (error) {
      const message = error.response?.data?.is_pinned?.[0] || 'No se pudo actualizar el anclaje.';
      Alert.alert('No se pudo actualizar', message);
    }
  };

  const renderProfile = (item, index) => {
    const profile = item.profile || {};
    return (
      <View key={item.id} style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => navigation.navigate('UserProfile', {
            userId: profile.id,
            userName: getName(profile),
            userAvatar: getImageUrl(profile.user_image),
          })}
        >
          <Image source={{ uri: getImageUrl(profile.user_image) }} style={styles.avatar} />
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{getName(profile)}</Text>
            <Text style={styles.cardSubtitle}>
              Perfil favorito · {isInTopFive(index) ? `Puesto ${index + 1} de 5` : 'Fuera del top 5'}
            </Text>
          </View>
        </TouchableOpacity>
        {isOwner ? (
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => moveItem(index, -1)} disabled={index === 0}>
              <Ionicons name="chevron-up" size={20} color={index === 0 ? '#ced4da' : '#4dabf7'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => moveItem(index, 1)} disabled={index === items.length - 1}>
              <Ionicons name="chevron-down" size={20} color={index === items.length - 1 ? '#ced4da' : '#4dabf7'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => togglePin(item)}>
              <Ionicons name={isInTopFive(index) ? 'pin' : 'pin-outline'} size={20} color="#845ef7" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderTask = (item, index) => {
    const task = item.task || {};
    return (
      <View key={item.id} style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
        >
          <View style={styles.taskIcon}>
            <Ionicons name="document-text-outline" size={22} color="#4dabf7" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle} numberOfLines={1}>{task.title || 'Tarea'}</Text>
            <Text style={styles.creatorText}>Creada por {getName(task.user)}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={2}>
              {task.description || 'Sin descripción'} · {isInTopFive(index) ? `Puesto ${index + 1} de 5` : 'Fuera del top 5'}
            </Text>
          </View>
        </TouchableOpacity>
        {isOwner ? (
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => moveItem(index, -1)} disabled={index === 0}>
              <Ionicons name="chevron-up" size={20} color={index === 0 ? '#ced4da' : '#4dabf7'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => moveItem(index, 1)} disabled={index === items.length - 1}>
              <Ionicons name="chevron-down" size={20} color={index === items.length - 1 ? '#ced4da' : '#4dabf7'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => togglePin(item)}>
              <Ionicons name={isInTopFive(index) ? 'pin' : 'pin-outline'} size={20} color="#845ef7" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderFeedTask = (item) => {
    const task = item.task || {};
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.feedCard}
        onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
        activeOpacity={0.9}
      >
        <View style={styles.feedHeader}>
          <View style={styles.taskIcon}>
            <Ionicons name="document-text-outline" size={22} color="#4dabf7" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{task.title || 'Tarea'}</Text>
            <Text style={styles.cardSubtitle}>{task.created_at ? new Date(task.created_at).toLocaleDateString() : ''}</Text>
          </View>
          {item.is_pinned ? <Ionicons name="pin" size={18} color="#845ef7" /> : null}
        </View>
        <Text style={styles.creatorText}>
          Creada por {getName(task.user)}
        </Text>
        <Text style={styles.feedDescription} numberOfLines={4}>{task.description || 'Sin descripción'}</Text>
        {task.categories ? (
          <View style={styles.feedCategories}>
            {String(task.categories).split(',').map((category) => (
              <Text key={category} style={styles.feedCategory}>{category.trim()}</Text>
            ))}
          </View>
        ) : null}
        <View style={styles.feedStats}>
          <Text style={styles.feedStat}>♥ {task.likes_count || 0}</Text>
          <Text style={styles.feedStat}>▢ {task.comments_count || 0}</Text>
          <Text style={styles.feedStat}>↗ {task.share_count || 0}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{organize ? 'Ordenar favoritos' : (isOwner ? 'Mis favoritos' : 'Favoritos')}</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={styles.tabs}>
        {[
          ['profiles', 'Perfiles', 'people-outline'],
          ['tasks', 'Tareas', 'document-text-outline'],
        ].map(([type, label, icon]) => (
          <TouchableOpacity
            key={type}
            style={[styles.tab, activeType === type && styles.tabActive]}
            onPress={() => setActiveType(type)}
          >
            <Ionicons name={icon} size={17} color={activeType === type ? '#fff' : '#4dabf7'} />
            <Text style={[styles.tabText, activeType === type && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {isOwner && organize ? (
        <Text style={styles.helper}>
          Usa las flechas para ordenar y el pin para colocar hasta 5 elementos al inicio.
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator size="large" color="#4dabf7" style={styles.loader} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCollection({ refresh: true })} />}
          contentContainerStyle={styles.list}
        >
          {items.length === 0 ? (
            <Text style={styles.empty}>No hay favoritos visibles en esta lista.</Text>
          ) : activeType === 'profiles' ? items.map(renderProfile) : (
            organize ? items.map(renderTask) : items.map(renderFeedTask)
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff' },
  backButton: { width: 32 },
  headerTitle: { color: '#212529', fontSize: 18, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#e7f5ff' },
  tabActive: { backgroundColor: '#4dabf7' },
  tabText: { color: '#1864ab', fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  helper: { paddingHorizontal: 14, paddingVertical: 10, color: '#868e96', fontSize: 12 },
  list: { padding: 12, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 8 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e9ecef' },
  taskIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7f5ff' },
  cardText: { flex: 1 },
  cardTitle: { color: '#212529', fontSize: 15, fontWeight: '700' },
  creatorText: { color: '#4dabf7', fontSize: 12, marginTop: 3 },
  cardSubtitle: { color: '#868e96', fontSize: 12, marginTop: 3 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', color: '#868e96', marginTop: 40 },
  feedCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 4 },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  feedDescription: { color: '#495057', fontSize: 14, lineHeight: 20 },
  feedCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  feedCategory: { color: '#1864ab', backgroundColor: '#e7f5ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12 },
  feedStats: { flexDirection: 'row', gap: 18, marginTop: 14 },
  feedStat: { color: '#868e96', fontSize: 12 },
});

export default FavoritesScreen;
