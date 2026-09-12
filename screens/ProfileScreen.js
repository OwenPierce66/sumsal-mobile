import React, { useEffect, useState, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Platform, Modal, Alert, ScrollView, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import api from '../api';
import { Image } from 'expo-image'; 
import { getImageUrl } from '../api';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../App';
import PersonalCategoryFilter from '../components/PersonalCategoryFilter';
import CategoryHierarchy from '../components/CategoryHierarchy';

const ProfileScreen = ({ route, navigation }) => {
  const { refreshCurrentUser, signOut } = useContext(AuthContext);
  const { width: screenWidth } = useWindowDimensions();
  const detailItemWidth = Math.max(240, screenWidth - 80);
  const userId = route?.params?.userId || 'me';
  const initialUserName = route?.params?.userName || '';
  const initialUserAvatar = route?.params?.userAvatar || null;

  const [user, setUser] = useState({ username: initialUserName, user_image: initialUserAvatar });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [profileCategories, setProfileCategories] = useState([]);
  const [appCategories, setAppCategories] = useState([]);
  const [personalFilterPublic, setPersonalFilterPublic] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [viewMode, setViewMode] = useState('compact');
  const [visibleSections, setVisibleSections] = useState({});

  const isCurrentUser = userId === 'me';

  const fetchUserData = async () => {
    try {
      const endpoint = isCurrentUser ? 'users/me/' : `massaging/users/`;
      const response = isCurrentUser
        ? { data: await refreshCurrentUser() }
        : await api.get(endpoint);
      
      // ✅ DEBUG: Muestra en la consola de la app los datos que llegan del backend
      console.log('[ProfileScreen] Datos recibidos en fetchUserData:', JSON.stringify(response.data, null, 2));

      if (isCurrentUser) {
        setUser(response.data);
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
        return response.data?.id;
      } else {
        const foundUser = response.data.find(u => u.id === userId);
        if (foundUser) {
           setUser(foundUser);
           return foundUser.id;
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      if (isCurrentUser) {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const stored = JSON.parse(storedUser);
          setUser(stored);
          return stored?.id;
        }
      }
    }
    return null;
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

  const fetchProfileAndAppCategories = async (ownerId = null) => {
    try {
      const profileEndpoint = isCurrentUser ? 'categories/' : `categories/user/${userId}/`;
      const taskOwnerId = ownerId || (isCurrentUser ? user?.id : userId);
      if (!taskOwnerId) return;
      const requests = [
        api.get(profileEndpoint),
        api.get('new-categories/', {
          params: { include_approval: 'true', profile_user_id: taskOwnerId },
        }),
      ];
      if (isCurrentUser) requests.push(api.get('categories/visibility/'));
      const [profileResponse, appResponse, visibilityResponse] = await Promise.all(requests);
      setProfileCategories(Array.isArray(profileResponse.data) ? profileResponse.data : []);
      setAppCategories(Array.isArray(appResponse.data) ? appResponse.data : []);
      if (isCurrentUser) setPersonalFilterPublic(Boolean(visibilityResponse?.data?.personal_filter_public));
    } catch (error) {
      console.error('[ProfileScreen] Error cargando filtros del perfil:', error.response?.data || error.message);
    }
  };

  const togglePersonalFilterVisibility = async () => {
    const nextValue = !personalFilterPublic;
    try {
      const response = await api.patch('categories/visibility/', {
        personal_filter_public: nextValue,
      });
      setPersonalFilterPublic(Boolean(response.data?.personal_filter_public));
      setProfileMenuVisible(false);
      Alert.alert(
        'Mi filtro',
        nextValue
          ? 'Ahora aparece en toda la app, debajo del filtro de la app.'
          : 'Ahora solo aparece en tu perfil.'
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar la visibilidad del filtro.');
    }
  };

  useFocusEffect(useCallback(() => {
    let active = true;
    const loadProfile = async () => {
      const ownerId = await fetchUserData();
      if (!active) return;
      await Promise.all([
        fetchMyTasks(1),
        fetchProfileAndAppCategories(ownerId || (isCurrentUser ? userId : userId)),
      ]);
    };
    loadProfile();
    return () => { active = false; };
  }, [isCurrentUser, userId]));

  const onRefresh = () => {
    setRefreshing(true);
    const refreshProfile = async () => {
      const ownerId = await fetchUserData();
      await Promise.all([
        fetchMyTasks(1),
        fetchProfileAndAppCategories(ownerId || userId),
      ]);
    };
    refreshProfile();
  };

  const loadMoreTasks = () => {
    if (hasMore && !loadingMore) {
      fetchMyTasks(page + 1);
    }
  };

  // ⚡ Filtro personal: igual criterio que TasksScreen (todas las etiquetas requeridas presentes)
  const filteredTasks = React.useMemo(() => {
    if (!selectedCategory) return tasks;
    const requiredTags = selectedCategory.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
    return tasks.filter(task => {
      const itemTags = (task.categories || '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      return requiredTags.every(tag => itemTags.includes(tag));
    });
  }, [tasks, selectedCategory]);

  // El backend ya devuelve solo las categorías de la app presentes en este perfil.
  const appCategoryNames = React.useMemo(
    () => appCategories.map(category => String(category.name || '').trim()).filter(Boolean),
    [appCategories]
  );

  const handleLogout = async () => {
    await signOut();
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
            source={{ uri: getImageUrl(user?.user_image || user?.profile?.user_image) }} 
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

  const changeSection = (taskId, section) => {
    setVisibleSections(prev => ({ ...prev, [taskId]: section }));
  };

  // Vista detallada: misma estructura de tarjeta que TasksScreen (secciones + carrusel).
  const renderDetailedTask = ({ item }) => {
    const currentSec = visibleSections[item.id] || 'subtasks';
    const content = Array.isArray(item[currentSec]) ? item[currentSec] : [];

    return (
      <View style={styles.detailedCard}>
        <View style={styles.taskHeader}>
          <Image
            source={{ uri: getImageUrl(user?.user_image || user?.profile?.user_image) }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <Text style={styles.taskDate}>{moment(item.created_at).fromNow()}</Text>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.push('TaskDetail', { taskId: item.id })}>
          <Text style={styles.taskDescription}>{item.description}</Text>

          {item.categories ? (
            <View style={styles.categoriesList}>
              {item.categories.split(',').map((cat, idx) => (
                <Text key={idx} style={styles.categoryBadge}>{cat.trim()}</Text>
              ))}
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={styles.sectionTabs}>
          {['subtasks', 'subfactores', 'subfuentes'].map(section => (
            <TouchableOpacity
              key={section}
              onPress={() => changeSection(item.id, section)}
              style={[styles.tab, currentSec === section && styles.tabActive]}
            >
              <Text style={[styles.tabText, currentSec === section && styles.tabTextActive]}>
                {section === 'subtasks' ? 'Aportación' : section.replace('sub', '')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dynamicContent}>
          {content.length === 0 ? (
            <Text style={styles.noContent}>Sin datos en esta sección</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselRow}>
              {content.map((sub, idx) => (
                <View key={sub.id || `${currentSec}-${idx}`} style={[styles.subItem, { width: detailItemWidth }]}>
                  <Text style={styles.subItemEyebrow}>
                    {currentSec === 'subtasks' ? 'APORTACIÓN' : currentSec === 'subfactores' ? 'FACTOR' : 'FUENTE'} {idx + 1}
                  </Text>
                  {sub.title ? <Text style={styles.subItemTitle}>{sub.title}</Text> : null}
                  {sub.description ? <Text style={styles.subItemDesc}>{sub.description}</Text> : null}
                  {sub.image ? (
                    <Image source={{ uri: getImageUrl(sub.image) }} style={styles.subMedia} contentFit="cover" />
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

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
      </View>
    );
  };

  const renderHeader = () => (
    // ✅ DEBUG: Muestra en la consola el estado del usuario justo antes de renderizar
    console.log('[ProfileScreen] Renderizando header con usuario:', JSON.stringify(user, null, 2)),

    <View style={styles.profileHeader}>
      <View style={styles.profileInfoContainer}>
        <Image 
          source={{ uri: getImageUrl(user?.user_image || user?.profile?.user_image) }} 
          style={styles.profileAvatar} 
        />
        <View style={styles.profileTextContainer}>
          <Text style={styles.profileName}>
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username || 'Usuario'}
          </Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          {/* ✅ AÑADIDO: Mostrar la insignia de admin si el usuario actual es staff o superuser */}
          {isCurrentUser && (user?.is_staff || user?.is_superuser) ? (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.adminBadgeText}>
                {user?.is_superuser ? 'Superadministrador' : 'Administrador'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      
      {isCurrentUser && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('EditProfile', { user })}>
            <Ionicons name="pencil" size={18} color="#4dabf7" />
            <Text style={styles.actionBtnText}>Editar Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.logoutBtn]} onPress={handleLogout}>
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
        {isCurrentUser ? (
          <TouchableOpacity
            onPress={() => setProfileMenuVisible(true)}
            style={styles.profileMenuButton}
            accessibilityLabel="Opciones del perfil"
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#333" />
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal
        visible={profileMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <TouchableOpacity style={styles.profileMenuOverlay} activeOpacity={1} onPress={() => setProfileMenuVisible(false)}>
          <View style={styles.profileMenuCard}>
            <TouchableOpacity style={styles.profileMenuOption} onPress={togglePersonalFilterVisibility}>
              <Ionicons name={personalFilterPublic ? 'eye-off-outline' : 'eye-outline'} size={20} color="#4dabf7" />
              <Text style={styles.profileMenuText}>
                {personalFilterPublic ? 'Usar mi filtro solo en mi perfil' : 'Usar mi filtro en toda la app'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.appFilterSection}>
        <Text style={styles.appFilterTitle}>Filtro de la app</Text>
        {appCategories.length > 0 ? (
          <CategoryHierarchy
            availableCategories={appCategories}
            showDescendants
            onSelect={(category) => setSelectedCategory(category)}
          />
        ) : (
          <Text style={styles.emptyFilterText}>No hay categorías disponibles para este perfil.</Text>
        )}
      </View>

      {isCurrentUser ? (
        <PersonalCategoryFilter
          isOwner
          title="Mi filtro"
          excludeNames={appCategoryNames}
          onSelect={(category) => setSelectedCategory(category)}
          onCategoriesChanged={fetchProfileAndAppCategories}
        />
      ) : (
        <PersonalCategoryFilter
          userId={userId}
          isOwner={false}
          excludeNames={appCategoryNames}
          title={`Filtro de ${user?.username || 'este perfil'}`}
          onSelect={(category) => setSelectedCategory(category)}
        />
      )}

      <View style={styles.viewModeRow}>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'compact' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('compact')}
        >
          <Ionicons name="list-outline" size={16} color={viewMode === 'compact' ? '#fff' : '#4dabf7'} />
          <Text style={[styles.viewModeText, viewMode === 'compact' && styles.viewModeTextActive]}>Compacta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'detailed' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('detailed')}
        >
          <Ionicons name="albums-outline" size={16} color={viewMode === 'detailed' ? '#fff' : '#4dabf7'} />
          <Text style={[styles.viewModeText, viewMode === 'detailed' && styles.viewModeTextActive]}>Detallada</Text>
        </TouchableOpacity>
      </View>

      {selectedCategory ? (
        <TouchableOpacity style={styles.clearFilterChip} onPress={() => setSelectedCategory('')}>
          <Ionicons name="close-circle" size={16} color="#4dabf7" />
          <Text style={styles.clearFilterText}>Quitar filtro: {selectedCategory}</Text>
        </TouchableOpacity>
      ) : null}

      {loading && page === 1 ? (
        <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={viewMode === 'detailed' ? renderDetailedTask : renderTask}
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
  profileMenuButton: { position: 'absolute', right: 16, top: Platform.OS === 'ios' ? 50 : 16, padding: 4 },
  profileMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 92 : 58, paddingRight: 12 },
  profileMenuCard: { backgroundColor: '#fff', borderRadius: 12, padding: 6, minWidth: 220, elevation: 6 },
  profileMenuOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  profileMenuText: { color: '#333', fontSize: 14, fontWeight: '600' },
  appFilterSection: { marginBottom: 6 },
  appFilterTitle: { marginHorizontal: 16, fontSize: 13, fontWeight: '800', color: '#555' },
  emptyFilterText: { marginHorizontal: 16, marginTop: 6, color: '#999', fontSize: 12 },
  viewModeRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  viewModeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e7f5ff', borderWidth: 1, borderColor: '#d0ebff' },
  viewModeBtnActive: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  viewModeText: { color: '#4dabf7', fontSize: 12, fontWeight: '700' },
  viewModeTextActive: { color: '#fff' },
  detailedCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 15, borderRadius: 16, padding: 16, elevation: 2 },
  sectionTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginTop: 10, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#4dabf7' },
  tabText: { fontSize: 11, color: '#999', fontWeight: 'bold' },
  tabTextActive: { color: '#4dabf7' },
  dynamicContent: { minHeight: 40 },
  carouselRow: { gap: 12, paddingRight: 12 },
  subItem: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 12 },
  subItemEyebrow: { fontSize: 10, color: '#4dabf7', fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  subItemTitle: { fontSize: 15, color: '#222', fontWeight: '700' },
  subItemDesc: { fontSize: 13, color: '#666', lineHeight: 19, marginTop: 6 },
  subMedia: { width: '100%', height: 150, borderRadius: 10, marginTop: 10, backgroundColor: '#e9ecef' },
  noContent: { fontSize: 12, color: '#bbb', fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  clearFilterChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#e7f5ff', gap: 4 },
  clearFilterText: { color: '#4dabf7', fontSize: 12, fontWeight: '700' },
  
  profileHeader: { padding: 20, backgroundColor: '#fff', marginBottom: 10 },
  profileInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  profileAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#eee', marginRight: 15 },
  profileTextContainer: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  profileEmail: { fontSize: 14, color: '#666', marginTop: 4 },
  adminBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: '#d9534f' },
  adminBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  
  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'flex-start', gap: 10 },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
    paddingHorizontal: 15, 
    borderRadius: 20, 
    backgroundColor: '#e7f5ff',
    borderWidth: 1,
    borderColor: '#d0ebff'
  },
  logoutBtn: { backgroundColor: '#ffe3e3', borderColor: '#ffc9c9' },
  actionBtnText: { color: '#4dabf7', fontWeight: 'bold', marginLeft: 5, fontSize: 14 },
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
