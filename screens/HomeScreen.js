import React, { useCallback, useContext } from 'react';
import {
  View, Text, FlatList, StyleSheet, Button,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '@app';
import { NotificationsContext } from '@contexts/NotificationsContext';
import { useTasks } from '@hooks/useApi';
import { Ionicons } from '@expo/vector-icons';

const HomeScreen = ({ navigation }) => {
  const { user, signOut } = useContext(AuthContext);
  const { unreadCount, refreshUnreadCount } = useContext(NotificationsContext);
  const queryClient = useQueryClient();

  // ─── React Query: tareas recientes ───────────────────────────────────────
  const {
    data: tasks = [],
    isLoading,
    isError,
    refetch,
  } = useTasks({ page_size: 20 });

  // Refresh contador de notificaciones al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount();
    }, [refreshUnreadCount])
  );

  // Pull-to-refresh: invalida el caché y fuerza un nuevo fetch
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    refetch();
  }, [queryClient, refetch]);

  const renderTask = ({ item }) => (
    <TouchableOpacity
      style={styles.taskItem}
      onPress={() => navigation.navigate('Tasks', {
        screen: 'TaskDetail',
        params: { taskId: item.id },
      })}
    >
      <Text style={styles.taskTitle}>{item.title}</Text>
      <Text style={styles.taskDescription}>{item.description}</Text>
      <View style={styles.tagsRow}>
        {!!item.pch && <Text style={styles.taskType}>{item.pch}</Text>}
        {item.categories
          ? item.categories.split(',').slice(0, 2).map((cat, idx) => (
              <Text key={idx} style={styles.categoryBadge}>{cat.trim()}</Text>
            ))
          : null}
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4dabf7" />
        </View>
      );
    }
    if (isError) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>No se pudo cargar.</Text>
          <TouchableOpacity onPress={refetch} style={styles.retryButton}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (tasks.length === 0) {
      return (
        <View style={styles.centered}>
          <Text>No hay tareas disponibles.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTask}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={isLoading}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Sumsal{user?.first_name ? `, ${user.first_name}` : ''} 🖤
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.notificationButton}
          >
            <Ionicons
              name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
              size={26}
              color="#333"
            />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ChatList')}>
            <Ionicons name="chatbubbles-outline" size={26} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut}>
            <Ionicons name="log-out-outline" size={26} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.topRow}>
        <Text style={styles.subtitle}>Explorar</Text>
        <Button
          title="Nueva tarea"
          onPress={() => navigation.navigate('Tasks', {
            screen: 'CreateTask',
            params: { initialPch: 'consejos' },
          })}
          color="#4dabf7"
        />
      </View>

      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  notificationButton: { position: 'relative', padding: 2 },
  notificationBadge: {
    position: 'absolute', right: -7, top: -5,
    minWidth: 17, height: 17, borderRadius: 9,
    paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ff4d6d', borderWidth: 1.5, borderColor: '#f5f5f5',
  },
  notificationBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  subtitle: { fontSize: 18, fontWeight: '600' },
  listContent: { paddingBottom: 20 },
  taskItem: {
    padding: 16, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 10, marginBottom: 12, backgroundColor: '#fff',
  },
  taskTitle: { fontWeight: 'bold', marginBottom: 6, fontSize: 16, color: '#222' },
  taskDescription: { color: '#555', marginBottom: 8 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  taskType: {
    backgroundColor: '#333', color: '#fff',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, fontSize: 12, fontWeight: 'bold',
  },
  categoryBadge: {
    backgroundColor: '#e3f2fd', color: '#4dabf7',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, fontSize: 11, fontWeight: 'bold',
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#e74c3c', marginBottom: 12, fontSize: 15 },
  retryButton: {
    backgroundColor: '#4dabf7', paddingHorizontal: 20,
    paddingVertical: 10, borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '700' },
});

export default HomeScreen;