import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import api, { clearAuthData } from '../api';
import { Image } from 'expo-image'; 
import { getImageUrl } from '../api';
import { useFocusEffect } from '@react-navigation/native';

const ProfileScreen = ({ route, navigation }) => {
  const userId = route?.params?.userId || 'me';
  const initialUserName = route?.params?.userName || '';
  const initialUserAvatar = route?.params?.userAvatar || null;

  const [user, setUser] = useState({ username: initialUserName, profile: { user_image: initialUserAvatar } });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const isCurrentUser = userId === 'me';

  const fetchUserData = async () => {
    try {
      const endpoint = isCurrentUser ? 'users/me/' : `massaging/users/`;
      const response = await api.get(endpoint);
      
      if (isCurrentUser) {
        setUser(response.data);
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
      } else {
        const foundUser = response.data.find(u => u.id === userId);
        if (foundUser) {
           setUser(foundUser);
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      if (isCurrentUser) {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
      }
    }
  };

  const fetchMyTasks = async (pageNumber = 1) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const endpoint = isCurrentUser ? 'users/me/tasks/' : `tasks/?user_id=${userId}&page=${pageNumber}`;
      const response = await api.get(endpoint);
      const newTasks = response.data.results || response.data || [];

      if (pageNumber === 1) {
        setTasks(newTasks);
      } else {
        setTasks(prev => [...prev, ...newTasks]);
      }
      
      setHasMore(!!response.data.next);
      setPage(pageNumber);
    } catch (error) {
      console.error("Error fetching user tasks:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchUserData();
    fetchMyTasks(1);
  }, []));

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
    fetchMyTasks(1);
  };

  const loadMoreTasks = () => {
    if (hasMore && !loadingMore) {
      fetchMyTasks(page + 1);
    }
  };

  const handleLogout = async () => {
    await clearAuthData();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const renderTask = ({ item }) => {
    return (
      <TouchableOpacity 
        style={styles.taskCard} 
        onPress={() => {
          navigation.push('TaskDetail', { taskId: item.id });
        }}
        activeOpacity={0.9}
      >
        <View style={styles.taskHeader}>
          <Image 
            source={{ uri: getImageUrl(user?.profile?.user_image) }} 
            style={styles.avatar} 
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <Text style={styles.taskDate}>{moment(item.created_at).fromNow()}</Text>
          </View>
        </View>

        <Text style={styles.taskDescription} numberOfLines={3}>{item.description}</Text>

        {item.categories ? (
          <View style={styles.categoriesList}>
            {item.categories.split(',').map((cat, idx) => (
              <Text key={idx} style={styles.categoryBadge}>{cat.trim()}</Text>
            ))}
          </View>
        ) : null}

        {(item.image || item.subtasks?.[0]?.image || item.subfactores?.[0]?.image || item.subfuentes?.[0]?.image) && (
          <Image
            source={{ uri: getImageUrl(item.image || item.subtasks?.[0]?.image || item.subfactores?.[0]?.image || item.subfuentes?.[0]?.image) }}
            style={styles.taskImage}
          />
        )}

        <View style={styles.taskFooter}>
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons name="heart" size={16} color="#ff6b6b" />
              <Text style={styles.statText}>{item.likes_count ?? 0}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="chatbubble" size={16} color="#4dabf7" />
              <Text style={styles.statText}>{item.comments_count || 0}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="share-social" size={16} color="#51cf66" />
              <Text style={styles.statText}>{item.share_count ?? 0}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.profileInfoContainer}>
        <Image 
          source={{ uri: getImageUrl(user?.profile?.user_image) }} 
          style={styles.profileAvatar} 
        />
        <View style={styles.profileTextContainer}>
          <Text style={styles.profileName}>
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username || 'Usuario'}
          </Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>
      </View>
      
      {isCurrentUser && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color="#ff6b6b" />
            <Text style={styles.actionBtnTextLogout}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>{isCurrentUser ? 'Mis Publicaciones' : `Publicaciones de ${user?.username || ''}`}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        {(navigation.canGoBack() || !isCurrentUser) && (
          <TouchableOpacity 
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeMain')} 
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.topBarTitle}>Perfil</Text>
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTask}
          ListHeaderComponent={renderHeader}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMoreTasks}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aún no has publicado nada.</Text>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 20 }} /> : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  topBar: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 16 },
  backBtn: { position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 50 : 16, zIndex: 10 },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#333' },
  
  profileHeader: { padding: 20, backgroundColor: '#fff', marginBottom: 10 },
  profileInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  profileAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#eee', marginRight: 15 },
  profileTextContainer: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  profileEmail: { fontSize: 14, color: '#666', marginTop: 4 },
  
  actionButtons: { flexDirection: 'row', justifyContent: 'flex-start' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#ffe3e3' },
  actionBtnTextLogout: { color: '#ff6b6b', fontWeight: 'bold', marginLeft: 5, fontSize: 14 },
  
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  
  listContent: { paddingBottom: 30 },
  
  taskCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 15, borderRadius: 16, padding: 16, elevation: 2 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#eee' },
  taskTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  taskDate: { fontSize: 12, color: '#999', marginTop: 2 },
  taskDescription: { fontSize: 14, color: '#555', lineHeight: 20 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 10 },
  categoryBadge: { backgroundColor: '#e3f2fd', color: '#4dabf7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 11, fontWeight: '600' },
  taskImage: { width: '100%', height: 150, borderRadius: 10, marginTop: 8, backgroundColor: '#f0f0f0' },
  
  taskFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  statsContainer: { flexDirection: 'row', gap: 20 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, color: '#666', fontWeight: '600' },
  
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30, fontSize: 15, fontStyle: 'italic' }
});

export default ProfileScreen;
