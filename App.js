import React, { useState, useEffect, useMemo, createContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { clearAuthData } from './api'; // Importamos tu función de limpieza

// Tus pantallas
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import TasksScreen from './screens/TasksScreen';
import CreateTaskScreen from './screens/CreateTaskScreen';
import TaskDetailScreen from './screens/TaskDetailScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ⚡ 1. CREAMOS EL CONTEXTO GLOBAL
export const AuthContext = createContext();

const TasksStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TasksList" component={TasksScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
    </Stack.Navigator>
  );
};

const HomeStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
    </Stack.Navigator>
  );
};

const AuthenticatedTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Tasks') iconName = focused ? 'list' : 'list-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4dabf7',
        tabBarInactiveTintColor: '#999',
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ tabBarLabel: 'Inicio' }} />
      <Tab.Screen name="Tasks" component={TasksStackNavigator} options={{ tabBarLabel: 'Tareas' }} />
      <Tab.Screen name="Profile" component={HomeScreen} options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);

  useEffect(() => {
    const bootstrapAsync = async () => {
      let token;
      try {
        // CORRECCIÓN: Buscamos 'accessToken' para que coincida con api.js
        token = await AsyncStorage.getItem('accessToken');
      } catch (e) {
        console.log("Error leyendo el token", e);
      }
      setUserToken(token);
      setIsLoading(false);
    };
    bootstrapAsync();
  }, []);

  // ⚡ 2. DEFINIMOS LAS FUNCIONES DEL CONTROL REMOTO
  const authContext = useMemo(() => ({
    signIn: (token) => {
      setUserToken(token); // Cambia el estado a logueado
    },
    signOut: async () => {
      await clearAuthData(); // Borra los tokens físicamente
      setUserToken(null); // Cambia el estado a deslogueado instantáneamente
    },
  }), []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#4dabf7" />
      </View>
    );
  }

  return (
   // ⚡ 3. ENVOLVEMOS LA APP CON EL CONTEXTO
    <AuthContext.Provider value={authContext}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {userToken == null ? (
            // ⚡ EL ARREGLO: Agrupamos Login y Register para los que no tienen sesión
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            // Si hay token, cargan las tabs.
            <Stack.Screen name="Home" component={AuthenticatedTabs} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}