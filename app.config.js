/**
 * app.config.js
 *
 * Reemplaza app.json para poder inyectar variables de entorno desde .env
 * en la configuración de Expo (accesibles vía expo-constants en runtime).
 *
 * Las variables de .env se leen aquí en BUILD TIME y se exponen en:
 *   import Constants from 'expo-constants';
 *   Constants.expoConfig.extra.apiLocalIp
 *   Constants.expoConfig.extra.apiPort
 */

// Expo ya carga .env automáticamente en SDK 49+ cuando existe app.config.js
const LOCAL_IP  = process.env.LOCAL_IP  || '192.168.0.108';
const API_PORT  = process.env.API_PORT  || '8001';

module.exports = {
  expo: {
    name:        'Sumsal Mobile',
    slug:        'sumsal-mobile',
    version:     '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
    },
    android: {},
    web: {},

    // ─── Variables accesibles en runtime ──────────────────────────────────
    extra: {
      /** IP local del backend — usada en iOS/Android para conectar via red */
      apiLocalIp: LOCAL_IP,
      /** Puerto del proxy nginx */
      apiPort: API_PORT,
    },
  },
};
