import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ⚡ TU IP LOCAL EXACTA (192.168.1.115)
const LOCAL_IP = '192.168.1.115';

// Usa 'localhost' en Web y tu IP local en móvil (Android / iOS)
const API_URL = Platform.OS === 'web' ? 'http://localhost:8001/api/' : `http://${LOCAL_IP}:8001/api/`;

export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') && !path.includes('localhost') && !path.includes('127.0.0.1') && !path.includes('192.168.')) {
    return path;
  }
  const IP = Platform.OS === 'web' ? 'localhost' : LOCAL_IP;
  let cleanPath = path;
  if (cleanPath.startsWith('http')) {
    cleanPath = cleanPath.replace(/^https?:\/\/[^\/]+/, '');
  }
  return `http://${IP}:8001${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ⚡ 1. INTERCEPTOR DE PETICIÓN (Inyectar Token y manejar FormData)
api.interceptors.request.use(
  async (config) => {
    if (config.data instanceof FormData) {
      if (config.headers) {
        delete config.headers['Content-Type'];
      }
    }
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ⚡ 2. INTERCEPTOR DE RESPUESTA (Refresh Token Automático)
api.interceptors.response.use(
  (response) => response, 
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; 

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        
        const refreshResponse = await axios.post(`${API_URL}auth/refresh/`, {
          refresh: refreshToken,
        });

        const newAccessToken = refreshResponse.data.access;
        await AsyncStorage.setItem('accessToken', newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        await clearAuthData();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// ⚡ FUNCIONES EXPORTADAS PARA LOGIN/LOGOUT
export const saveAuthData = async (data) => {
  try {
    await AsyncStorage.setItem('accessToken', data.access);
    await AsyncStorage.setItem('refreshToken', data.refresh);
  } catch (error) {
    console.error("Error guardando tokens:", error);
  }
};

export const clearAuthData = async () => {
  try {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
  } catch (error) {
    console.error("Error limpiando tokens:", error);
  }
};

export default api;
