import React, { useState, useEffect, useRef, useMemo, useCallback, createContext } from 'react';
import { View, Image, ActivityIndicator, LogBox } from 'react-native';
LogBox.ignoreLogs(['[Sentry] DSN no configurado']);
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import SecureStorage from './secureStorage';
import { Ionicons } from '@expo/vector-icons';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { isNetOnline } from './utils/network';
import OfflineWriteNotifier from '@components/OfflineWriteNotifier';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { asyncStoragePersister, MAX_AGE_MS, shouldPersistQuery } from './persistence/queryPersister';
import NetInfo from '@react-native-community/netinfo';
import api, { clearAuthData, authInterceptorController, getImageUrl } from './api';
import GlobalError from '@components/GlobalError';
import ErrorBoundary from '@components/ErrorBoundary';
import { ToastProvider } from '@contexts/ToastContext';
import { GlobalErrorContext } from './contexts/GlobalErrorContext';
import * as SentryService from './sentry';
import { usePushNotifications, registerForPush, unregisterForPush } from './hooks/usePushNotifications';

// Inicializar Sentry al arrancar el módulo (antes del primer render)
SentryService.init();

// React Query en React Native no detecta la conectividad por sí solo (asume
// siempre en línea). Se conecta a NetInfo para que, sin señal, las lecturas se
// pausen y se sirvan desde la caché persistida en lugar de fallar y reintentar.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((netState) => setOnline(isNetOnline(netState)))
);

// Configuración global del cliente de caché TanStack Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de datos frescos
      gcTime: MAX_AGE_MS,          // 24h — debe ser >= maxAge del persister
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      // 'always': no pausar ni encolar escrituras sin conexión. Se ejecutan y
      // fallan de inmediato (el usuario recibe un aviso) en vez de reenviarse
      // solas más tarde, lo que podría duplicar likes, comentarios o posts.
      networkMode: 'always',
    },
  },
});

/**
 * Borra el caché de datos del usuario (memoria + AsyncStorage). Debe llamarse
 * al cerrar sesión: el caché persistido sobrevive al logout y, si no se borra,
 * el siguiente usuario del dispositivo vería datos del anterior.
 */
const clearUserCache = async () => {
  // El "ver como" de esta sesión no pasa a la siguiente.
  setViewAs(null);
  try {
    queryClient.clear();
    await asyncStoragePersister.removeClient();
  } catch (error) {
    console.warn('[Auth] No se pudo limpiar el caché local:', error?.message);
  }
};

// ─── Pantallas principales — carga inmediata (necesarias en la primera pantalla) ────
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import TasksScreen from './screens/TasksScreen';
import ReelsScreen from './screens/ReelsScreen';
import Stories24hScreen from './screens/Stories24hScreen';
import SharedTasksScreen from './screens/SharedTasksScreen';
import ForumScreen from './screens/ForumScreen';
import ProfileScreen from './screens/ProfileScreen';
import ChatListScreen from './screens/ChatListScreen';

import CreateTaskScreen from './screens/CreateTaskScreen';
import TaskDetailScreen from './screens/TaskDetailScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import SharedTaskDetailScreen from './screens/SharedTaskDetailScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import SubscriptionsScreen from './screens/SubscriptionsScreen';
import PetitionSupportsScreen from './screens/PetitionSupportsScreen';
import GroupsScreen from './screens/GroupsScreen';
import GroupDetailScreen from './screens/GroupDetailScreen';
import GroupFormScreen from './screens/GroupFormScreen';
import FollowListScreen from './screens/FollowListScreen';
import AdminScreen from './screens/AdminScreen';
import TopScreen from './screens/TopScreen';
import MapScreen from './screens/MapScreen';
import { setViewAs } from './hooks/useViewAs';
import CategoryExplorerScreen from './screens/CategoryExplorerScreen';
import ActivityScreen from './screens/ActivityScreen';
import ProfileVisitsScreen from './screens/ProfileVisitsScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import DeleteAccountScreen from './screens/DeleteAccountScreen';

import { NotificationsProvider } from './contexts/NotificationsContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Contextos globales
export const AuthContext = createContext();

const TasksStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TasksList" component={TasksScreen} />
      <Stack.Screen name="CategoryExplorer" component={CategoryExplorerScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="SharedTaskDetail" component={SharedTaskDetailScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="UserProfile" component={ProfileScreen} />
      <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Stack.Screen name="PetitionSupports" component={PetitionSupportsScreen} />
      <Stack.Screen name="Groups" component={GroupsScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="GroupForm" component={GroupFormScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
    </Stack.Navigator>
  );
};

const HomeStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="HomeMain"
        component={TasksScreen}
        initialParams={{ feedMode: 'favorites' }}
      />
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="UserProfile" component={ProfileScreen} />
      <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Stack.Screen name="PetitionSupports" component={PetitionSupportsScreen} />
      <Stack.Screen name="Groups" component={GroupsScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="GroupForm" component={GroupFormScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="SharedTaskDetail" component={SharedTaskDetailScreen} />
    </Stack.Navigator>
  );
};

const MessagesStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="UserProfile" component={ProfileScreen} />
      <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Stack.Screen name="PetitionSupports" component={PetitionSupportsScreen} />
      <Stack.Screen name="Groups" component={GroupsScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="GroupForm" component={GroupFormScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="SharedTaskDetail" component={SharedTaskDetailScreen} />
    </Stack.Navigator>
  );
};

// Pestaña Top: tu top 5 y lo más votado; desde ahí se abren perfiles y publicaciones.
const TopStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TopMain" component={TopScreen} />
      <Stack.Screen name="CategoryExplorer" component={CategoryExplorerScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="SharedTaskDetail" component={SharedTaskDetailScreen} />
      <Stack.Screen name="UserProfile" component={ProfileScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Stack.Screen name="PetitionSupports" component={PetitionSupportsScreen} />
      <Stack.Screen name="Groups" component={GroupsScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="GroupForm" component={GroupFormScreen} />
    </Stack.Navigator>
  );
};

const NotificationsStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NotificationsMain" component={NotificationsScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
      <Stack.Screen name="UserProfile" component={ProfileScreen} />
      <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Stack.Screen name="PetitionSupports" component={PetitionSupportsScreen} />
      <Stack.Screen name="Groups" component={GroupsScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="GroupForm" component={GroupFormScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
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
      <Stack.Screen name="Activity" component={ActivityScreen} />
      <Stack.Screen name="ProfileVisits" component={ProfileVisitsScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="UserProfile" component={ProfileScreen} />
      <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Stack.Screen name="PetitionSupports" component={PetitionSupportsScreen} />
      <Stack.Screen name="Groups" component={GroupsScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="GroupForm" component={GroupFormScreen} />
      <Stack.Screen name="FollowList" component={FollowListScreen} />
      <Stack.Screen name="CreateTask" component={CreateTaskScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Favorites" component={FavoritesScreen} />
      <Stack.Screen name="AdminCenter" component={AdminScreen} />
      <Stack.Screen name="SharedTaskDetail" component={SharedTaskDetailScreen} />
    </Stack.Navigator>
  );
};

const AuthenticatedTabs = () => {
  const { user } = React.useContext(AuthContext);
  const profileImage = user?.user_image || user?.profile?.user_image;

  return (
    <NotificationsProvider>
      <Tab.Navigator
      initialRouteName="Tasks"
      backBehavior="none"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarIcon: ({ focused, color, size: baseSize }) => {
          // La pestaña seleccionada se ve un poco más grande.
          const size = focused ? baseSize + 6 : baseSize;
          let iconName;
          if (route.name === 'Tasks') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Top') iconName = focused ? 'trophy' : 'trophy-outline';
          else if (route.name === 'HomeTab') iconName = focused ? 'list' : 'list-outline';
          else if (route.name === 'Reels') iconName = focused ? 'videocam' : 'videocam-outline';
          else if (route.name === 'Map') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Stories') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Forum') iconName = focused ? 'chatbox' : 'chatbox-outline';
          else if (route.name === 'SharedTasks') iconName = focused ? 'share' : 'share-outline';
          else if (route.name === 'Messages') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Notifications') iconName = focused ? 'notifications' : 'notifications-outline';
          else if (route.name === 'Profile' && profileImage) {
            return (
              <Image
                source={{ uri: getImageUrl(profileImage) }}
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: focused ? 2 : 0,
                  borderColor: focused ? color : 'transparent',
                }}
              />
            );
          } else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4dabf7',
        tabBarInactiveTintColor: '#999',
      })}
    >
      <Tab.Screen name="Tasks" component={TasksStackNavigator} options={{ tabBarLabel: 'Aportaciones' }} />
      <Tab.Screen name="Top" component={TopStackNavigator} options={{ tabBarLabel: 'Top' }} />
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ tabBarLabel: 'Tareas' }} />
      <Tab.Screen name="Reels" component={ReelsScreen} options={{ tabBarLabel: 'Reels' }} />
      <Tab.Screen name="Messages" component={MessagesStackNavigator} options={{ tabBarLabel: 'Mensajes' }} />
      <Tab.Screen name="Notifications" component={NotificationsStackNavigator} options={{ tabBarLabel: 'Notificaciones' }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ tabBarLabel: 'Mapa' }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ tabBarLabel: 'Perfil' }} />
      <Tab.Screen
        name="Stories"
        component={Stories24hScreen}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="SharedTasks"
        component={SharedTasksStackNavigator}
        options={{ tabBarButton: () => null }}
      />
      <Tab.Screen
        name="Forum"
        component={ForumStackNavigator}
        options={{ tabBarButton: () => null }}
      />
      </Tab.Navigator>
    </NotificationsProvider>
  );
};

const linking = {
  prefixes: ['http://localhost:8081', 'aportaciones://', 'http://127.0.0.1:8081'],
  config: {
    screens: {
      Home: {
        screens: {
          HomeTab: {
            screens: {
              HomeMain: 'home',
              UserProfile: 'user/:userId',
              TaskDetail: 'task/:taskId',
              SharedTaskDetail: 'shared-task/:sharedTaskId'
            }
          },
          Tasks: {
            screens: {
              TasksList: 'tasks',
              CreateTask: 'tasks/create',
              CategoryExplorer: 'tasks/categories',
              TaskDetail: 'tasks/:taskId',
              SharedTaskDetail: 'tasks/shared/:sharedTaskId'
            }
          },
          Map: 'map',
          Top: {
            screens: {
              TopMain: 'top',
            }
          },
          Messages: {
            screens: {
              ChatList: 'chats',
              ChatDetail: 'chat/:chatId'
            }
          },
          Notifications: {
            screens: {
              NotificationsMain: 'notifications'
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

  const navigationRef = useRef(null);
usePushNotifications(navigationRef);

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
      clearUserCache();
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
  registerForPush(); // ← agregar esta línea
},
    signOut: async ({ accountDeleted = false } = {}) => {
      try {
        // Con la cuenta ya borrada no queda nada que cerrar en el servidor.
        if (!accountDeleted) {
          // Da de baja el token push de este dispositivo mientras la sesión aún es válida.
          await unregisterForPush();
          // Obtiene el refresh token cifrado y lo envía al servidor para blacklistearlo.
          // Esto invalida la sesión en la BD — aunque alguien robe el token, ya no sirve.
          const refreshToken = await SecureStorage.getItem('refreshToken');
          if (refreshToken) {
            await api.post('auth/logout/', { refresh: refreshToken });
          }
        }
      } catch (error) {
        // Si el servidor no responde (sin conexión, token ya expirado, etc.)
        // el logout local sigue adelante — el usuario nunca queda bloqueado.
        console.warn('[Auth] Logout en servidor fallido, procediendo con logout local:', error?.message);
      } finally {
        // Siempre limpia tokens locales y reinicia el estado
        await clearAuthData();
        await clearUserCache();
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
          <OfflineWriteNotifier />
          <GlobalErrorContext.Provider value={{ isConnected, wasDisconnected }}>
            <AuthContext.Provider value={authContext}>
              <NavigationContainer linking={linking} ref={navigationRef}>
                {/* Banner flotante de conectividad - flota sobre toda la app */}
                <GlobalError />
                <Stack.Navigator screenOptions={{ headerShown: false }}>{
                  state.userToken == null ? (
                    <>
                      <Stack.Screen name="Login" component={LoginScreen} />
                      <Stack.Screen name="Register" component={RegisterScreen} />
                      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
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
