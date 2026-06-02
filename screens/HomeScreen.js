import React, { useState, useCallback, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, Button, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api, { clearAuthData } from '../api'; // Importamos lo que realmente usamos
import { AuthContext } from '../App';
import { Ionicons } from '@expo/vector-icons';

const HomeScreen = ({ navigation }) => {
  const [tasks, setTasks] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const { signOut } = useContext(AuthContext);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // ELIMINAMOS: const headers = await authHeaders();
      // El interceptor se encarga de todo ahora.

      const [userResponse, tasksResponse] = await Promise.all([
        api.get('users/me/'), // Sin headers manuales
        api.get('tasks/'),    // Sin headers manuales
      ]);

      setUser(userResponse.data);
      setTasks(tasksResponse.data.results ?? tasksResponse.data ?? []);
    } catch (error) {
      console.error('Error loading home data:', error.response?.data || error.message);
      // Si el error es 401, podrías forzar el logout aquí
      Alert.alert('Error', 'No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

const handleLogout = () => {
    // Esto borra los tokens y le avisa a App.js que te expulse al Login de inmediato
    signOut(); 
  };

  const renderTask = ({ item }) => (
    <TouchableOpacity
      style={styles.taskItem}
      onPress={() => navigation.navigate('Tasks', { 
        screen: 'TaskDetail', 
        params: { taskId: item.id } 
      })}
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
          Sumsal{user?.first_name ? `, ${user.first_name}` : ''} 🖤
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
          <TouchableOpacity onPress={() => navigation.navigate('ChatList')}>
            <Ionicons name="chatbubbles-outline" size={26} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={26} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.topRow}>
        <Text style={styles.subtitle}>Explorar</Text>
        <Button 
          title="Nueva tarea" 
          onPress={() => navigation.navigate('Tasks', { screen: 'CreateTask' })} 
          color="#4dabf7"
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4dabf7" />
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
          showsVerticalScrollIndicator={false}
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