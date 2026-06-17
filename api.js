import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://127.0.0.1:8000/api/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export async function authHeaders() {
  const token = await AsyncStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function saveAuthData({ access, refresh, user }) {
  await AsyncStorage.setItem('token', access);
  if (refresh) {
    await AsyncStorage.setItem('refreshToken', refresh);
  }
  if (user) {
    await AsyncStorage.setItem('user', JSON.stringify(user));
  }
}

export async function clearAuthData() {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('refreshToken');
  await AsyncStorage.removeItem('user');
}

export default api;
