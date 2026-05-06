import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Image, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api';

const TasksScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tema, setTema] = useState('consejos');
  const [visibleSections, setVisibleSections] = useState({});

  // ⚡ NUEVOS ESTADOS PARA EL INFINITE SCROLL
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modificamos fetchTasks para que acepte el número de página
  const fetchTasks = useCallback(async (pageNumber = 1) => {
    try {
      if (pageNumber === 1) setLoading(true);
      else setLoadingMore(true);

      // Enviamos el parámetro 'page' a Django
      const response = await api.get('tasks/', { params: { pch: tema, page: pageNumber } });
      const data = response.data.results ?? response.data ?? [];

      // Si es la página 1, reemplazamos. Si es mayor, concatenamos.
      if (pageNumber === 1) {
        setTasks(data);
      } else {
        setTasks(prev => [...prev, ...data]);
      }

      // Verificamos si Django nos dice que hay una página siguiente
      if (response.data.next) {
        setHasMore(true);
      } else {
        setHasMore(false);
      }

      // Mantenemos tu lógica de secciones
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

  useFocusEffect(useCallback(() => { 
    // Al entrar a la pantalla o cambiar de tema, siempre empezamos en la página 1
    setPage(1);
    fetchTasks(1); 
  }, [fetchTasks]));

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchTasks(1);
  };

  // ⚡ FUNCIÓN PARA CARGAR MÁS DATOS AL BAJAR
  const loadMoreTasks = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchTasks(nextPage);
    }
  };

  const changeSection = (taskId, section) => {
    setVisibleSections(prev => ({ ...prev, [taskId]: section }));
  };

  const filteredTasks = tasks.filter((task) =>
    task.title?.toLowerCase().includes(searchText.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  // HELPER INFALIBLE CON LA IP ACTUAL
  const getImageUrl = (path) => {
    if (!path) return null;
    let cleanPath = path.replace('localhost', '192.168.0.103').replace('127.0.0.1', '192.168.0.103');
    if (cleanPath.startsWith('http')) return cleanPath;
    return `http://192.168.0.103:8001${cleanPath}`;
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

  const renderTaskCard = ({ item }) => {
    const currentSec = visibleSections[item.id] || 'subtasks';

    return (
      <View style={styles.taskCard}>
        {/* HEADER LIMPIO: Solo el avatar del usuario y los 3 puntitos */}
        <View style={styles.taskHeader}>
          <Image 
            source={{ uri: item.user_image || 'https://via.placeholder.com/40' }} 
            style={styles.avatar} 
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <Text style={styles.taskUser}>{item.user?.username || item.username || 'Anónimo'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
            <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* DESCRIPCIÓN PRINCIPAL */}
        <Text style={styles.taskDescription}>{item.description}</Text>

        {/* TAB SELECTOR */}
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

        {/* CONTENIDO DINÁMICO */}
        <View style={styles.dynamicContent}>
          {renderSubContent(item, currentSec)}
        </View>

        {/* FOOTER: Interacciones */}
        <View style={styles.taskFooter}>
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={18} color="#ff6b6b" />
              <Text style={styles.statText}>{item.likes_count ?? 0}</Text>
            </View>
            <TouchableOpacity style={styles.stat} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
              <Ionicons name="chatbubble-outline" size={18} color="#4dabf7" />
              <Text style={styles.statText}>{item.comments_count ?? 0}</Text>
            </TouchableOpacity>
            <View style={styles.stat}>
              <Ionicons name="share-social-outline" size={18} color="#51cf66" />
              <Text style={styles.statText}>{item.share_count ?? 0}</Text>
            </View>
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
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTaskCard}
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
});

export default TasksScreen;