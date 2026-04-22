import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api, { authHeaders } from '../api';

const TasksScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tema, setTema] = useState('consejos');

  const fetchTasks = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const response = await api.get('tasks/', {
        headers,
        params: { pch: tema },
      });
      setTasks(response.data.results ?? response.data ?? []);
    } catch (error) {
      console.error('Error fetching tasks:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tema]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTasks();
    }, [fetchTasks])
  );

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [tema, fetchTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const filteredTasks = tasks.filter((task) =>
    task.title?.toLowerCase().includes(searchText.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  const renderTaskCard = ({ item }) => (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
    >
      <View style={styles.taskHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {item.title || 'Sin título'}
          </Text>
          <Text style={styles.taskUser}>
             {item.user?.first_name || item.user?.email || 'Anónimo'}
          </Text>
        </View>
        <Text style={styles.taskDate}>
          {new Date(item.created_at).toLocaleDateString('es-ES', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>

      <Text style={styles.taskDescription} numberOfLines={3}>
        {item.description}
      </Text>

      <View style={styles.taskFooter}>
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Ionicons name="heart-outline" size={16} color="#ff6b6b" />
            <Text style={styles.statText}>{item.likes_count ?? 0}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={16} color="#4dabf7" />
            <Text style={styles.statText}>{item.comments_count ?? 0}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="share-social-outline" size={16} color="#51cf66" />
            <Text style={styles.statText}>{item.share_count ?? 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tareas</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateTask')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar tareas..."
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.temaSelector}>
        {['consejos', 'peticiones', 'historias'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.temaBadge, tema === t && styles.temaBadgeActive]}
            onPress={() => setTema(t)}
          >
            <Text style={[styles.temaBadgeText, tema === t && styles.temaBadgeTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4dabf7" />
        </View>
      ) : filteredTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No hay tareas disponibles</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTaskCard}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4dabf7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  temaSelector: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  temaBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
  },
  temaBadgeActive: {
    backgroundColor: '#4dabf7',
  },
  temaBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  temaBadgeTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  taskUser: {
    fontSize: 9,
    color: '#999',
    marginTop: 4,
  },
  taskDate: {
    fontSize: 12,
    color: '#bbb',
    marginLeft: 12,
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  taskFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default TasksScreen;