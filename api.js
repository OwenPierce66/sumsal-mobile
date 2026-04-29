import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.0.103:8001/api/'; 

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor para inyectar el token automáticamente
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// EXPORTS NOMBRADOS (Vital para que los otros archivos los encuentren)
export const saveAuthData = async ({ access, refresh, user }) => {
  try {
    await AsyncStorage.setItem('token', access);
    if (refresh) await AsyncStorage.setItem('refreshToken', refresh);
    if (user) await AsyncStorage.setItem('user', JSON.stringify(user));
  } catch (e) {
    console.error("Error guardando auth data", e);
  }
};

export const clearAuthData = async () => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
  } catch (e) {
    console.error("Error limpiando auth data", e);
  }
};

export default api;