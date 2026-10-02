import React, { useState, useEffect, useRef, useMemo, useCallback, createContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import SecureStorage from './secureStorage';
import { Ionicons } from '@expo/vector-icons';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { asyncStoragePersister, MAX_AGE_MS, shouldPersistQuery } from './persistence/queryPersister';
import NetInfo from '@react-native-community/netinfo';
import api, { clearAuthData, authInterceptorController } from './api';
import GlobalError from '@components/GlobalError';
import ErrorBoundary from '@components/ErrorBoundary';
import { ToastProvider } from '@contexts/ToastContext';
import * as SentryService from './sentry';

// Inicializar Sentry al arrancar el módulo (antes del primer render)
SentryService.init();

// Configuración global del cliente de caché TanStack Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de datos frescos
      gcTime: MAX_AGE_MS,          // 24h — debe ser >= maxAge del persister
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Tus pantallas
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import TasksScreen from './screens/TasksScreen';
import ReelsScreen from './screens/ReelsScreen';
import Stories24hScreen from './screens/Stories24hScreen';
import CreateTaskScreen from './screens/CreateTaskScreen';
import TaskDetailScreen from './screens/TaskDetailScreen';
import ForumScreen from './screens/ForumScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import SharedTaskDetailScreen from './screens/SharedTaskDetailScreen';
import SharedTasksScreen from './screens/SharedTasksScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import { NotificationsProvider } from './contexts/NotificationsContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Contextos globales
export const AuthContext = createContext();
export const GlobalErrorContext = createContext();

const TasksStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TasksList" component={TasksScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="SharedTaskDetail" component={SharedTaskDetailScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="UserProfile" component={ProfileScreen} />
    </Stack.Navigator>
  );
};

const HomeStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="UserProfile" component={ProfileScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="SharedTaskDetail" component={SharedTaskDetailScreen} />
    </Stack.Navigator>
  );
};

const ForumStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ForumMain" component={ForumScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
    </Stack.Navigator>
  );
};

const SharedTasksStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SharedTasksList" component={SharedTasksScreen} />
      <Stack.Screen name="SharedTaskDetail" component={SharedTaskDetailScreen} />
    </Stack.Navigator>
  );
};

const ProfileStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="SharedTaskDetail" component={SharedTaskDetailScreen} />
    </Stack.Navigator>
  );
};

const AuthenticatedTabs = () => {
  return (
    <NotificationsProvider>
      <Tab.Navigator
      backBehavior="none"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'HomeTab') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Tasks') iconName = focused ? 'list' : 'list-outline';
          else if (route.name === 'Reels') iconName = focused ? 'videocam' : 'videocam-outline';
          else if (route.name === 'Stories') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Forum') iconName = focused ? 'chatbox' : 'chatbox-outline';
          else if (route.name === 'SharedTasks') iconName = focused ? 'share' : 'share-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4dabf7',
        tabBarInactiveTintColor: '#999',
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ tabBarLabel: 'Inicio' }} />
      <Tab.Screen name="Tasks" component={TasksStackNavigator} options={{ tabBarLabel: 'Tareas' }} />
      <Tab.Screen name="Reels" component={ReelsScreen} options={{ tabBarLabel: 'Reels' }} />
      <Tab.Screen name="Stories" component={Stories24hScreen} options={{ tabBarLabel: 'Historias' }} />
      <Tab.Screen name="SharedTasks" component={SharedTasksStackNavigator} options={{ tabBarLabel: 'Compartidas' }} />
      <Tab.Screen name="Forum" component={ForumStackNavigator} options={{ tabBarLabel: 'Foro' }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ tabBarLabel: 'Perfil' }} />
      </Tab.Navigator>
    </NotificationsProvider>
  );
};

const linking = {
  prefixes: ['http://localhost:8081', 'sumsal://', 'http://127.0.0.1:8081'],
  config: {
    screens: {
      Home: {
        screens: {
          HomeTab: {
            screens: {
              HomeMain: 'home',
              ChatList: 'chats',
              Notifications: 'notifications',
              ChatDetail: 'chat/:chatId',
              UserProfile: 'user/:userId',
              TaskDetail: 'task/:taskId',
              SharedTaskDetail: 'shared-task/:sharedTaskId'
            }
          },
          Tasks: {
            screens: {
              TasksList: 'tasks',
              CreateTask: 'tasks/create',
              TaskDetail: 'tasks/:taskId',
              SharedTaskDetail: 'tasks/shared/:sharedTaskId'
            }
          },
          SharedTasks: {
            screens: {
              SharedTasksList: 'shared-tasks',
              SharedTaskDetail: 'shared-tasks/:sharedTaskId'
            }
          },
          Forum: {
            screens: {
              ForumMain: 'forum',
              PostDetail: 'forum/post/:postId'
            }
          },
          Profile: {
            screens: {
              ProfileMain: 'profile',
              Favorites: 'profile/favorites',
              TaskDetail: 'profile/task/:taskId',
              SharedTaskDetail: 'profile/shared/:sharedTaskId'
            }
          }
        }
      },
      Login: 'login',
      Register: 'register',
    }
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [state, dispatch] = React.useReducer(
    (prevState, action) => {
      switch (action.type) {
        case 'RESTORE_TOKEN': return { ...prevState, userToken: action.token, isLoading: false };
        case 'SIGN_IN': return { ...prevState, userToken: action.token };
        case 'SIGN_OUT': return { ...prevState, userToken: null };
      }
    },
    { isLoading: true, userToken: null }
  );

  // ─── Estado de conectividad ───────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState(true);
  const [wasDisconnected, setWasDisconnected] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netState) => {
      const connected = netState.isConnected && netState.isInternetReachable !== false;

      // En el primer render no mostramos el banner verde aunque haya conexión
      if (isFirstRender.current) {
        isFirstRender.current = false;
        setIsConnected(connected);
        return;
      }

      if (!connected) {
        setWasDisconnected(true);
        setIsConnected(false);
      } else {
        setIsConnected(true);
        // wasDisconnected se mantiene en true para que el banner verde aparezca
        // Se resetea después de que la animación termine (2s en GlobalError)
        setTimeout(() => setWasDisconnected(false), 3000);
      }
    });

    return () => unsubscribe();
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const response = await api.get('users/me/');
    setCurrentUser(response.data);
    return response.data;
  }, []);

  useEffect(() => {
    const bootstrapAsync = async () => {
      const token = await SecureStorage.getItem('accessToken');
      if (token) {
        try {
          await refreshCurrentUser();
        } catch (error) {
          console.error('[App] No se pudo actualizar el usuario autenticado:', error.response?.data || error);
        }
      }
      dispatch({ type: 'RESTORE_TOKEN', token });
    };
    bootstrapAsync();
  }, [refreshCurrentUser]);

  // Conecta el interceptor de api.js al dispatch de React para que pueda
  // cerrar la sesión limpiamente desde fuera sin dependencia circular.
  useEffect(() => {
    authInterceptorController.signOut = () => {
      dispatch({ type: 'SIGN_OUT' });
    };
    return () => {
      authInterceptorController.signOut = null;
    };
  }, []);
  // ⚡ 2. DEFINIMOS LAS FUNCIONES DEL CONTROL REMOTO
  const authContext = useMemo(() => ({
    signIn: async (token) => {
      dispatch({ type: 'SIGN_IN', token });
      try {
        await refreshCurrentUser();
      } catch (error) {
        console.error('[App] No se pudo cargar el usuario después de iniciar sesión:', error.response?.data || error);
      }
    },
    signOut: async () => {
      try {
        // Obtiene el refresh token cifrado y lo envía al servidor para blacklistearlo.
        // Esto invalida la sesión en la BD — aunque alguien robe el token, ya no sirve.
        const refreshToken = await SecureStorage.getItem('refreshToken');
        if (refreshToken) {
          await api.post('auth/logout/', { refresh: refreshToken });
        }
      } catch (error) {
        // Si el servidor no responde (sin conexión, token ya expirado, etc.)
        // el logout local sigue adelante — el usuario nunca queda bloqueado.
        console.warn('[Auth] Logout en servidor fallido, procediendo con logout local:', error?.message);
      } finally {
        // Siempre limpia tokens locales y reinicia el estado
        await clearAuthData();
        setCurrentUser(null);
        dispatch({ type: 'SIGN_OUT' });
      }
    },
    refreshCurrentUser,
    user: currentUser,
    isAdmin: Boolean(currentUser?.is_staff || currentUser?.is_superuser),
  }), [currentUser, refreshCurrentUser]);

  if (state.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#4dabf7" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: asyncStoragePersister,
          maxAge: MAX_AGE_MS,
          dehydrateOptions: {
            shouldDehydrateQuery: shouldPersistQuery,
          },
        }}
        onSuccess={() => {
          // Cache restaurado desde AsyncStorage — reanudar mutaciones pausadas
          queryClient.resumePausedMutations();
        }}
      >
        <ToastProvider>
          <GlobalErrorContext.Provider value={{ isConnected, wasDisconnected }}>
            <AuthContext.Provider value={authContext}>
              <NavigationContainer linking={linking}>
                {/* Banner flotante de conectividad - flota sobre toda la app */}
                <GlobalError />
                <Stack.Navigator screenOptions={{ headerShown: false }}>{
                  state.userToken == null ? (
                    <>
                      <Stack.Screen name="Login" component={LoginScreen} />
                      <Stack.Screen name="Register" component={RegisterScreen} />
                    </>
                  ) : (
                    <Stack.Screen name="Home" component={AuthenticatedTabs} />
                  )}
                </Stack.Navigator>
              </NavigationContainer>
            </AuthContext.Provider>
          </GlobalErrorContext.Provider>
        </ToastProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}
