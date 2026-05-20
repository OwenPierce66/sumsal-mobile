import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Image, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import api from '../api';

const TasksScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [sharedTasks, setSharedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tema, setTema] = useState('consejos');
  const [visibleSections, setVisibleSections] = useState({});

  // ⚡ NUEVOS ESTADOS PARA EL INFINITE SCROLL
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sharedPage, setSharedPage] = useState(1);
  const [sharedHasMore, setSharedHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modificamos fetchTasks para que acepte el número de página
  const fetchTasks = useCallback(async (pageNumber = 1) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await api.get('tasks/', { params: { pch: tema, page: pageNumber } });
      const data = response.data.results ?? response.data ?? [];

      if (pageNumber === 1) {
        setTasks(data);
      } else {
        setTasks(prev => [...prev, ...data]);
      }

      setPage(pageNumber);
      setHasMore(!!response.data.next);

      const sections = {};
      data.forEach(t => { sections[t.id] = 'subtasks'; });
      setVisibleSections(prev => pageNumber === 1 ? sections : { ...prev, ...sections });

    } catch (error) {
      console.error('Error fetching tasks:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [tema]);

  const fetchSharedTasks = useCallback(async (pageNumber = 1) => {
    try {
      const response = await api.get('shared-tasks/', { params: { page: pageNumber } });
      const data = response.data.results ?? response.data ?? [];

      if (pageNumber === 1) {
        setSharedTasks(data);
      } else {
        setSharedTasks(prev => [...prev, ...data]);
      }

      setSharedHasMore(!!response.data.next);
      setSharedPage(pageNumber);
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (detail === 'Invalid page.') {
        setSharedHasMore(false);
        return;
      }
      console.error('Error fetching shared tasks:', error.response?.data || error.message);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setPage(1);
    setSharedPage(1);
    setHasMore(true);
    setSharedHasMore(true);
    fetchTasks(1);
    fetchSharedTasks(1);
  }, [fetchTasks, fetchSharedTasks]));

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setSharedPage(1);
    setHasMore(true);
    setSharedHasMore(true);
    Promise.all([fetchTasks(1), fetchSharedTasks(1)]).finally(() => setRefreshing(false));
  };

  const handleShareTask = async (taskId) => {
    if (!taskId) return;

    // ⚡ ACTUALIZACIÓN OPTIMISTA
    setTasks((prev) => prev.map(t => t.id === taskId ? { ...t, share_count: (t.share_count || 0) + 1 } : t));
    setSharedTasks((prev) => prev.map(s => s.task?.id === taskId ? { ...s, task: { ...s.task, share_count: (s.task.share_count || 0) + 1 } } : s));

    try {
      await api.post('shared-tasks/', { task_id: taskId, description: '' });
      fetchSharedTasks(1);
    } catch (error) {
      console.error('Error sharing task:', error.response?.data || error.message);
    }
  };

  const handleLikeSharedTask = async (sharedTaskId) => {
    // ⚡ 1. Buscamos la tarea original asociada a esta publicación compartida
    const sharedItem = sharedTasks.find(s => s.id === sharedTaskId);
    const originalTaskId = sharedItem?.task?.id;
    const isLiked = !sharedItem?.user_has_liked;

    // ⚡ 2. ACTUALIZACIÓN OPTIMISTA - En Compartidas
    setSharedTasks((prev) => prev.map((item) => {
      if (item.id === sharedTaskId) {
        return { ...item, user_has_liked: isLiked, likes_count: (item.likes_count || 0) + (isLiked ? 1 : -1) };
      }
      return item;
    }));

    // ⚡ 3. ACTUALIZACIÓN OPTIMISTA - En Originales (Si la tarea original está visible en el feed al mismo tiempo)
    if (originalTaskId) {
      setTasks((prev) => prev.map((t) => {
        if (t.id === originalTaskId) {
          return { ...t, user_has_liked: isLiked, likes_count: (t.likes_count || 0) + (isLiked ? 1 : -1) };
        }
        return t;
      }));
    }

    try {
      // ⚡ 4. Confirmar con el servidor en segundo plano
      const response = await api.post(`shared-tasks/${sharedTaskId}/like/`);
      const { liked, likes_count_shared, likes_count_original } = response.data;

      setSharedTasks((prev) => prev.map((item) => {
        if (item.id !== sharedTaskId) return item;
        return { ...item, likes_count: likes_count_shared, user_has_liked: liked };
      }));

      if (originalTaskId) {
        setTasks((prev) => prev.map((t) => {
          if (t.id === originalTaskId) {
            return { ...t, user_has_liked: liked, likes_count: likes_count_original };
          }
          return t;
        }));
      }
    } catch (error) {
      console.error('Error liking shared task:', error.response?.data || error.message);
    }
  };

  const handleCommentSharedTask = (sharedTaskId) => {
    navigation.navigate('SharedTaskDetail', { sharedTaskId });
  };

  const handleShareSharedTask = async (taskId) => {
    if (!taskId) return;

    // ⚡ ACTUALIZACIÓN OPTIMISTA
    setTasks((prev) => prev.map(t => t.id === taskId ? { ...t, share_count: (t.share_count || 0) + 1 } : t));
    setSharedTasks((prev) => prev.map(s => s.task?.id === taskId ? { ...s, task: { ...s.task, share_count: (s.task.share_count || 0) + 1 } } : s));

    try {
      await api.post('shared-tasks/', { task_id: taskId, description: '' });
      fetchSharedTasks(1);
    } catch (error) {
      console.error('Error sharing task:', error.response?.data || error.message);
    }
  };

  // ⚡ FUNCIÓN PARA CARGAR MÁS DATOS AL BAJAR
  const loadMoreTasks = () => {
    if (!loadingMore && (hasMore || sharedHasMore)) {
      setLoadingMore(true);
      const promises = [];

      if (hasMore) promises.push(fetchTasks(page + 1));
      if (sharedHasMore) promises.push(fetchSharedTasks(sharedPage + 1));

      Promise.all(promises).finally(() => setLoadingMore(false));
    }
  };

  const changeSection = (taskId, section) => {
    setVisibleSections(prev => ({ ...prev, [taskId]: section }));
  };

  const feedItems = React.useMemo(() => {
    const plainTasks = tasks.map((task) => ({ ...task, feedType: 'task' }));
    const sharedItems = sharedTasks.map((shared) => ({ ...shared, feedType: 'shared' }));
    return [...plainTasks, ...sharedItems].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }, [tasks, sharedTasks]);

  const filteredTasks = feedItems.filter((item) => {
    const title = item.feedType === 'shared' ? item.task?.title : item.title;
    const description = item.feedType === 'shared'
      ? (item.description || item.task?.description)
      : item.description;

    return (
      title?.toLowerCase().includes(searchText.toLowerCase()) ||
      description?.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  // HELPER INFALIBLE CON LA IP ACTUAL
  const getImageUrl = (path) => {
    if (!path) return null;
    let cleanPath = path.replace('localhost', '192.168.0.103').replace('127.0.0.1', '192.168.0.103');
    if (cleanPath.startsWith('http')) return cleanPath;
    return `http://192.168.0.103:8001${cleanPath}`;
  };

  // ⚡ HELPER PARA EXTRAER EL NOMBRE DEL AUTOR DE LA TAREA
  const getAuthorName = (item) => {
    const userObj = item.user;
    
    if (userObj) {
      // 1. Intentamos usar el nombre y apellido real
      if (userObj.first_name) {
        return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
      }
      // 2. Usamos username si existe
      if (userObj.username) {
        return userObj.username;
      }
      // 3. Si no ha puesto nombre, usamos la primera parte de su email
      if (userObj.email) {
        return userObj.email.split('@')[0];
      }
    }
    // 4. Fallback final
    return item.username || 'Anónimo';
  };

  // ⚡ HELPER PARA EXTRAER EL NOMBRE DE QUIEN COMPARTE
  const getSharerName = (userObj) => {
    if (!userObj) return 'Usuario';
    if (userObj.first_name) return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
    if (userObj.username) return userObj.username;
    if (userObj.email) return userObj.email.split('@')[0];
    return 'Usuario';
  };

  // ⚡ HELPER PARA CONTAR COMENTARIOS ANIDADOS
  const countNestedComments = (comments = []) => {
    return comments.reduce((total, comment) => total + 1 + countNestedComments(comment.children || []), 0);
  };

  const renderSubContent = (task, section) => {
    const content = task[section] || []; 
    if (content.length === 0) return <Text style={styles.noContent}>Sin datos en esta sección</Text>;

    return content.map((sub, idx) => {
      const finalUri = getImageUrl(sub.image);

      return (
        <View key={idx} style={styles.subItem}>
          <Text style={styles.subItemTitle}>• {sub.title}</Text>
          
          {sub.description ? (
            <Text style={styles.subItemDesc}>{sub.description}</Text>
          ) : null}

          {/* RENDERIZAMOS CON LA URI PROCESADA Y FIX PARA WEB */}
          {finalUri && (
            <Image 
              source={{ uri: finalUri }} 
              style={styles.subImage} 
              resizeMode="cover" 
            />
          )}
        </View>
      );
    });
  };

  const renderSharedItemCard = (shared) => {
    const task = shared.task || {};

    return (
      <View style={styles.taskCard}>
        <View style={styles.sharedByHeader}>
          <Text style={styles.sharedByName}>{getSharerName(shared.shared_by)} compartió</Text>
          <Text style={styles.sharedDate}>{moment(shared.created_at).fromNow()}</Text>
        </View>

        {shared.description ? (
          <Text style={styles.sharedDescription}>{shared.description}</Text>
        ) : null}

        <View style={styles.originalTaskCard}>
          <View style={styles.taskHeader}>
            <Image 
              source={{ uri: getImageUrl(task.user?.user_image) || 'https://via.placeholder.com/40' }} 
              style={styles.avatar} 
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskUser}>{getAuthorName(task)}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}>
              <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
            </TouchableOpacity>
          </View>

          <Text style={styles.taskDescription}>{task.description}</Text>

          {/* ⚡ EXTRAEMOS LA PRIMERA IMAGEN DISPONIBLE (SUBTASKS, SUBFACTORES O SUBFUENTES) */}
          {(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) && (
            <Image
              source={{ uri: getImageUrl(task.image || task.subtasks?.[0]?.image || task.subfactores?.[0]?.image || task.subfuentes?.[0]?.image) }}
              style={styles.taskImage}
            />
          )}
        </View>

        <View style={styles.taskFooter}>
          <View style={styles.statsContainer}>
            <TouchableOpacity style={styles.stat} onPress={() => handleLikeSharedTask(shared.id)}>
              <Ionicons
                name={shared.user_has_liked ? 'heart' : 'heart-outline'}
                size={18}
                color={shared.user_has_liked ? '#ff6b6b' : '#999'}
              />
              <Text style={styles.statText}>{shared.likes_count ?? 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stat}
              onPress={() => handleCommentSharedTask(shared.id)}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#4dabf7" />
              <Text style={styles.statText}>{shared.comments_count || 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stat}
              onPress={() => handleShareSharedTask(shared.task?.id)}
            >
              <Ionicons name="share-social-outline" size={18} color="#51cf66" />
              <Text style={styles.statText}>{shared.task?.share_count ?? 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderFeedItem = ({ item }) => {
    if (item.feedType === 'shared') {
      return renderSharedItemCard(item);
    }
    const currentSec = visibleSections[item.id] || 'subtasks';

    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Image 
            source={{ uri: getImageUrl(item.user?.user_image) || 'https://via.placeholder.com/40' }} 
            style={styles.avatar} 
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <Text style={styles.taskUser}>{getAuthorName(item)}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
            <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        <Text style={styles.taskDescription}>{item.description}</Text>

        <View style={styles.sectionTabs}>
          {['subtasks', 'subfactores', 'subfuentes'].map((s) => (
            <TouchableOpacity 
              key={s} 
              onPress={() => changeSection(item.id, s)}
              style={[styles.tab, currentSec === s && styles.tabActive]}
            >
              <Text style={[styles.tabText, currentSec === s && styles.tabTextActive]}>
                {s === 'subtasks' ? (tema.charAt(0).toUpperCase() + tema.slice(1)) : s.replace('sub', '')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dynamicContent}>
          {renderSubContent(item, currentSec)}
        </View>

        <View style={styles.taskFooter}>
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={18} color="#ff6b6b" />
              <Text style={styles.statText}>{item.likes_count ?? 0}</Text>
            </View>
            <TouchableOpacity style={styles.stat} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
              <Ionicons name="chatbubble-outline" size={18} color="#4dabf7" />
              <Text style={styles.statText}>{item.comments_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stat} onPress={() => handleShareTask(item.id)}>
              <Ionicons name="share-social-outline" size={18} color="#51cf66" />
              <Text style={styles.statText}>{item.share_count ?? 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Éxito</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateTask')}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar objetivos..."
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <View style={styles.temaSelector}>
        {['consejos', 'peticiones', 'historias'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.temaBadge, tema === t && styles.temaBadgeActive]}
            onPress={() => {
              // Si cambian de pestaña, forzamos la página a 1
              setPage(1);
              setHasMore(true);
              setTema(t);
            }}
          >
            <Text style={[styles.temaBadgeText, tema === t && styles.temaBadgeTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => `${item.feedType}-${item.id}`}
        renderItem={renderFeedItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        
        // ⚡ LAS PROPS MÁGICAS DE RENDIMIENTO Y SCROLL INFINITO
        onEndReached={loadMoreTasks}
        onEndReachedThreshold={0.5} // Ejecuta loadMoreTasks cuando falte media pantalla para llegar al final
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 20 }} /> : null
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={8}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#333' },
  createBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4dabf7', justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 12, elevation: 2 },
  searchInput: { flex: 1, height: 45, marginLeft: 8 },
  temaSelector: { flexDirection: 'row', paddingHorizontal: 12, gap: 10, marginBottom: 10 },
  temaBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#eee' },
  temaBadgeActive: { backgroundColor: '#333' },
  temaBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  temaBadgeTextActive: { color: '#fff' },
  listContent: { paddingBottom: 100 },
  taskCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 16, borderRadius: 20, padding: 16, elevation: 4 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 45, height: 45, borderRadius: 22.5, marginRight: 12, backgroundColor: '#eee' },
  taskTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  taskUser: { fontSize: 12, color: '#4dabf7', fontWeight: '600' },
  taskDescription: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 15 },
  sectionTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#4dabf7' },
  tabText: { fontSize: 11, color: '#999', fontWeight: 'bold' },
  tabTextActive: { color: '#4dabf7' },
  dynamicContent: { minHeight: 40 },
  subItem: { marginBottom: 10, paddingLeft: 5 },
  subItemTitle: { fontSize: 14, color: '#333', fontWeight: '500' },
  subItemDesc: { fontSize: 14, color: '#666', marginTop: 4, paddingLeft: 10 },
  subImage: { width: '100%', height: 150, borderRadius: 12, marginTop: 8 },
  noContent: { fontSize: 12, color: '#bbb', fontStyle: 'italic', textAlign: 'center' },
  taskFooter: { marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  statsContainer: { flexDirection: 'row', gap: 20 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 13, color: '#666', fontWeight: '600' },
  sharedByHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sharedByName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  sharedDate: { fontSize: 12, color: '#999' },
  sharedDescription: { fontSize: 13, color: '#555', marginBottom: 10 },
  originalTaskCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#4dabf7', marginBottom: 10 },
  taskImage: { width: '100%', height: 200, borderRadius: 10, marginTop: 12, backgroundColor: '#e0e0e0' },
});

export default TasksScreen;