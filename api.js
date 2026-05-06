import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚡ Volvemos a la IP fija que funciona perfecto en tu red actual
export const LOCAL_IP = '192.168.0.103'; 
const API_URL = `http://${LOCAL_IP}:8001/api/`;
// const API_URL = 'http://192.168.100.76:8001/api/'; 

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ⚡ 1. INTERCEPTOR DE PETICIÓN (Inyectar Token)
api.interceptors.request.use(
  async (config) => {
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
        // Si el refresh falla, limpiamos la sesión
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