import axios from 'axios';
import SecureStorage from './secureStorage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isNetworkError } from './utils/network';
import { emitOfflineWrite } from './utils/offlineEvents';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE URL — leída desde .env via app.config.js → expo-constants
// ─────────────────────────────────────────────────────────────────────────────
const extra    = Constants.expoConfig?.extra ?? {};
const LOCAL_IP = Platform.OS === 'android' && __DEV__
  ? '10.0.2.2'
  : extra.apiLocalIp ?? '192.168.1.115';
const API_PORT = extra.apiPort    ?? '8001';
const REMOTE_API_URL = 'https://aportaciones-backend.onrender.com/api/';
const LOCAL_API_URL =
  Platform.OS === 'web'
    ? `http://localhost:${API_PORT}/api/`
    : `http://${LOCAL_IP}:${API_PORT}/api/`;

const API_URL = (
  extra.apiUrl || (__DEV__ ? LOCAL_API_URL : REMOTE_API_URL)
).replace(/\/?$/, '/');
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');
export const API_TIMEOUT_MS = 30000;
export const UPLOAD_TIMEOUT_MS = 120000;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Construye la URL de medios correctamente sin importar el entorno
// ─────────────────────────────────────────────────────────────────────────────
export const getImageUrl = (path) => {
  if (!path) return null;
  if (
    path.startsWith('http') &&
    !path.includes('localhost') &&
    !path.includes('127.0.0.1') &&
    !path.includes('192.168.')
  ) {
    return path;
  }
  let cleanPath = path;
  if (cleanPath.startsWith('http')) {
    cleanPath = cleanPath.replace(/^https?:\/\/[^\/]+/, '');
  }
  return `${API_ORIGIN}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE CIFRADO (Android Keystore / iOS Keychain)
// Reemplaza AsyncStorage (texto plano) por almacenamiento cifrado por hardware.
// Los tokens son inaccesibles incluso en dispositivos rooteados.
// ─────────────────────────────────────────────────────────────────────────────
export const saveAuthData = async (data) => {
  try {
    await SecureStorage.setItem('accessToken', data.access);
    await SecureStorage.setItem('refreshToken', data.refresh);
  } catch (error) {
    console.error('[Auth] Error guardando tokens cifrados:', error);
  }
};

export const clearAuthData = async () => {
  try {
    await SecureStorage.removeItem('accessToken');
    await SecureStorage.removeItem('refreshToken');
  } catch (error) {
    console.error('[Auth] Error limpiando tokens:', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLADOR DEL INTERCEPTOR
// Permite que App.js conecte sus funciones de estado React al interceptor
// sin acoplamiento directo (sin importar App.js desde aquí).
// ─────────────────────────────────────────────────────────────────────────────
export const authInterceptorController = {
  signOut: null, // App.js conecta esta función en un useEffect
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMBIOS DE RELACIONES (seguir / favorito / anclado / bloquear)
// Cualquier escritura exitosa sobre estas rutas avisa a los suscriptores
// (hooks/useMyRelations) para refrescar los corazones junto a cada nombre.
// ─────────────────────────────────────────────────────────────────────────────
// Escrituras que cambian relaciones con perfiles o tareas (seguir, favoritos, guardar, anclar...).
// Agregar a una colección también guarda la tarea.
const RELATION_WRITE_PATH = /(\/|^)(follow|pfavoritos\/agregar|favoritos\/agregar|favorites\/pin|favorites\/category-pin|favorites\/collection|tasks\/[^/]+\/save|collections\/[^/]+\/items|block)\/?(\?|$)/;
const relationsListeners = new Set();

export const subscribeRelationsChange = (listener) => {
  relationsListeners.add(listener);
  return () => relationsListeners.delete(listener);
};

const emitRelationsChangeIfNeeded = (config) => {
  const method = String(config?.method || 'get').toLowerCase();
  if (method === 'get') return;
  if (!RELATION_WRITE_PATH.test(String(config?.url || ''))) return;
  relationsListeners.forEach((listener) => {
    try { listener(); } catch (e) { /* un suscriptor no debe romper la respuesta */ }
  });
};


// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE HTTP PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
// Axios infers JSON for objects; React Native's XHR must set the multipart boundary.
const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT_MS,
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERCEPTOR DE PETICIÓN
// Inyecta el token de acceso cifrado en cada petición saliente.
// React Native's native networking module requires the multipart media type
// to construct FormData bodies and supplies the boundary itself.
// ─────────────────────────────────────────────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const isReactNativeFormData =
      config.data && typeof config.data.getParts === 'function';
    const isBrowserFormData =
      typeof FormData !== 'undefined' && config.data instanceof FormData;
    if (isReactNativeFormData || isBrowserFormData) {
      config.headers.set('Content-Type', 'multipart/form-data');
    }

    const token = await SecureStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// ─────────────────────────────────────────────────────────────────────────────
// INTERCEPTOR DE RESPUESTA — SILENT REFRESH
// Si una petición devuelve 401, renueva el access token en segundo plano
// usando el refresh token cifrado. Si el refresh también expiró, limpia la
// sesión y llama a signOut() para redirigir al login sin un error crudo.
// ─────────────────────────────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    emitRelationsChangeIfNeeded(response?.config);
    return response;
  },

  async (error) => {
    const originalRequest = error.config;

    // Solo intentamos el refresh una vez por petición (_retry evita bucles)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStorage.getItem('refreshToken');

        if (!refreshToken) {
          throw new Error('[Auth] No refresh token disponible');
        }

        // Petición directa (sin interceptores) para renovar el token
        const refreshResponse = await axios.post(
          `${API_URL}auth/refresh/`,
          { refresh: refreshToken },
          { timeout: API_TIMEOUT_MS },
        );

        const newAccessToken = refreshResponse.data.access;
        await SecureStorage.setItem('accessToken', newAccessToken);

        // Si el backend rota el refresh token, también lo guardamos
        if (refreshResponse.data.refresh) {
          await SecureStorage.setItem('refreshToken', refreshResponse.data.refresh);
        }

        // Reintenta la petición original con el token renovado
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // Refresh falló: limpia tokens y desloguea limpiamente
        await clearAuthData();

        if (authInterceptorController.signOut) {
          authInterceptorController.signOut();
        }

        return Promise.reject(refreshError);
      }
    }

    // Fallo de red en una ESCRITURA (POST/PATCH/PUT/DELETE): avisar al usuario.
    // Las lecturas no avisan: se sirven desde la caché persistida. Tampoco las consultas
    // que van por POST (`readOnly`, p. ej. users/in-category/).
    const method = String(originalRequest?.method || 'get').toLowerCase();
    if (method !== 'get' && !originalRequest?.readOnly && isNetworkError(error)) {
      emitOfflineWrite();
    }

    return Promise.reject(error);
  },
);

export default api;
