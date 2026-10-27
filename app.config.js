/**
 * app.config.js
 *
 * Reemplaza app.json para poder inyectar variables de entorno desde .env
 * en la configuración de Expo (accesibles vía expo-constants en runtime).
 *
 * Las variables de .env se leen aquí en BUILD TIME y se exponen en:
 *   import Constants from 'expo-constants';
 *   Constants.expoConfig.extra.apiUrl
 *   Constants.expoConfig.extra.apiLocalIp
 *   Constants.expoConfig.extra.apiPort
 */

// Expo ya carga .env automáticamente en SDK 49+ cuando existe app.config.js
const LOCAL_IP  = process.env.LOCAL_IP   || '192.168.1.115';
const API_PORT  = process.env.API_PORT   || '8001';
const API_URL   = process.env.API_URL   || process.env.EXPO_PUBLIC_API_URL || '';
const SENTRY_DSN = process.env.SENTRY_DSN || '';

module.exports = {
  expo: {
    name:        'Aportaciones',
    slug:        'aportaciones-mobile',
    version:     '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
    },
    android: {
      package: 'com.sumsal.aportaciones',
    },
    web: {},

    plugins: [
      // Descargar imágenes y videos de las aportaciones a la galería.
      [
        'expo-media-library',
        {
          photosPermission: 'Permite que Aportaciones acceda a tus fotos para guardar lo que descargas.',
          savePhotosPermission: 'Permite que Aportaciones guarde en tu galería las imágenes y videos que descargas.',
          isAccessMediaLocationEnabled: false,
        },
      ],
    ],

    // ─── Variables accesibles en runtime ──────────────────────────────────
    extra: {
      /** URL base del backend; si no se define, se elige según el entorno */
      apiUrl: API_URL,
      /** IP local del backend — usada en iOS/Android para conectar via red */
      apiLocalIp: LOCAL_IP,
      /** Puerto del proxy nginx */
      apiPort: API_PORT,
      /** DSN de Sentry para crash reporting (vacío = deshabilitado) */
      sentryDsn: SENTRY_DSN,
    },
  },
};
