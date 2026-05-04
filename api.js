import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.0.103:8001/api/'; 
// En api.js
// const API_BASE_URL = 'http://192.168.100.76:8001/api/';
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
    let token = null;

    try {
      // 🛡️ Lógica Multiplataforma para leer el token
      if (Platform.OS === 'web') {
        token = localStorage.getItem('token');
      } else {
        token = await AsyncStorage.getItem('token');
      }
    } catch (e) {
      console.error("Error leyendo auth data en el interceptor", e);
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// EXPORTS NOMBRADOS
export const saveAuthData = async ({ access, refresh, user }) => {
  try {
    // 🛡️ Lógica Multiplataforma para GUARDAR el token
    if (Platform.OS === 'web') {
      if (access) localStorage.setItem('token', access);
      if (refresh) localStorage.setItem('refreshToken', refresh);
      if (user) localStorage.setItem('user', JSON.stringify(user));
    } else {
      if (access) await AsyncStorage.setItem('token', access);
      if (refresh) await AsyncStorage.setItem('refreshToken', refresh);
      if (user) await AsyncStorage.setItem('user', JSON.stringify(user));
    }
  } catch (e) {
    console.error("Error guardando auth data", e);
  }
};

export const clearAuthData = async () => {
  try {
    // 🛡️ Lógica Multiplataforma para BORRAR el token
    if (Platform.OS === 'web') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    } else {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('user');
    }
  } catch (e) {
    console.error("Error limpiando auth data", e);
  }
};

export default api;