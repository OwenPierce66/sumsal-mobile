/**
 * secureStorage.js
 *
 * Wrapper de almacenamiento seguro multiplataforma:
 * - En Android/iOS: usa react-native-encrypted-storage (Keystore/Keychain cifrado por hardware)
 * - En Web:         usa AsyncStorage como fallback (los navegadores no tienen Keystore nativo)
 *
 * Importa siempre desde aquí, nunca directamente de las librerías nativas.
 */

import { Platform, NativeModules } from 'react-native';

let storage;

const hasNativeEncryptedStorage = Boolean(NativeModules?.RNEncryptedStorage);

if (Platform.OS === 'web' || !hasNativeEncryptedStorage) {
  // Web o entorno sin módulo nativo compilado (ej. Expo Go): fallback a AsyncStorage
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;

  storage = {
    setItem:    (key, value) => AsyncStorage.setItem(key, value),
    getItem:    (key)        => AsyncStorage.getItem(key),
    removeItem: (key)        => AsyncStorage.removeItem(key),
  };
} else {
  // Móvil nativo con módulo compilado (Android Keystore / iOS Keychain)
  const EncryptedStorage = require('react-native-encrypted-storage').default;

  storage = {
    setItem:    (key, value) => EncryptedStorage.setItem(key, value),
    getItem:    (key)        => EncryptedStorage.getItem(key),
    removeItem: (key)        => EncryptedStorage.removeItem(key),
  };
}

export default storage;
