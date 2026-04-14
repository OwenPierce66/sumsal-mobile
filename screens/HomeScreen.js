import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Button, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api, { authHeaders, clearAuthData } from '../api';

const HomeScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await authHeaders();

      const [userResponse, tasksResponse] = await Promise.all([
        api.get('users/me/', { headers }),
        api.get('tasks/', { headers }),
      ]);

      setUser(userResponse.data);
      setTasks(tasksResponse.data.results ?? tasksResponse.data ?? []);
    } catch (error) {
      console.error('Error loading home data:', error.response?.data || error.message);
      Alert.alert('Error', 'No se pudo cargar información. Por favor inicia sesión de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleLogout = async () => {
    await clearAuthData();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const renderTask = ({ item }) => (
    <TouchableOpacity
      style={styles.taskItem}
      onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
    >
      <Text style={styles.taskTitle}>{item.title}</Text>
      <Text style={styles.taskDescription}>{item.description}</Text>
      {!!item.pch && <Text style={styles.taskType}>{item.pch}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Bienvenido{user?.first_name ? `, ${user.first_name}` : ''}
        </Text>
        <Button title="Cerrar sesión" onPress={handleLogout} />
      </View>

      <View style={styles.topRow}>
        <Text style={styles.subtitle}>Tus tareas</Text>
        <Button title="Nueva tarea" onPress={() => navigation.navigate('CreateTask')} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text>Cargando...</Text>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.centered}>
          <Text>No hay tareas disponibles.</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTask}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  taskItem: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  taskTitle: {
    fontWeight: 'bold',
    marginBottom: 6,
    fontSize: 16,
    color: '#222',
  },
  taskDescription: {
    color: '#555',
    marginBottom: 8,
  },
  taskType: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    color: '#4dabf7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HomeScreen;