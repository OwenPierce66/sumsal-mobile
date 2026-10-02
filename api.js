import axios from 'axios';
import SecureStorage from './secureStorage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE URL — leída desde .env via app.config.js → expo-constants
// ─────────────────────────────────────────────────────────────────────────────
const extra    = Constants.expoConfig?.extra ?? {};
const LOCAL_IP = extra.apiLocalIp ?? '192.168.0.108';
const API_PORT = extra.apiPort    ?? '8001';

const API_URL =
  Platform.OS === 'web'
    ? `http://localhost:${API_PORT}/api/`
    : `http://${LOCAL_IP}:${API_PORT}/api/`;

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
  const IP = Platform.OS === 'web' ? 'localhost' : LOCAL_IP;
  let cleanPath = path;
  if (cleanPath.startsWith('http')) {
    cleanPath = cleanPath.replace(/^https?:\/\/[^\/]+/, '');
  }
  return `http://${IP}:${API_PORT}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
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
// CLIENTE HTTP PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERCEPTOR DE PETICIÓN
// Inyecta el token de acceso cifrado en cada petición saliente.
// Detecta FormData y elimina Content-Type para que Axios ponga
// el boundary correcto de multipart automáticamente.
// ─────────────────────────────────────────────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
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
  (response) => response,

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

    return Promise.reject(error);
  },
);

export default api;
