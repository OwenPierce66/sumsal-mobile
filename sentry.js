/**
 * sentry.js
 *
 * Inicialización de Sentry para tracking de errores en producción.
 *
 * ┌─ SETUP ──────────────────────────────────────────────────────────────────┐
 * │ 1. Crea un proyecto en https://sentry.io → Project type: React Native   │
 * │ 2. Copia el DSN de: Settings → Projects → [tu proyecto] → Client Keys  │
 * │ 3. Pégalo en .env como: SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Uso en pantallas / handlers:
 *   import * as SentryService from './sentry';
 *   SentryService.captureError(error, { screen: 'TasksScreen' });
 *   SentryService.captureMessage('Token refresh fallido', 'warning');
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN     = Constants.expoConfig?.extra?.sentryDsn ?? '';
const IS_PROD = !__DEV__;

/**
 * Inicializa Sentry. Llamar UNA VEZ al arrancar la app (en App.js).
 * En desarrollo solo activa el tracing, pero NO envía eventos al servidor
 * a menos que SENTRY_DSN esté definido.
 */
export function init() {
  if (!DSN) {
    if (__DEV__) console.warn('[Sentry] DSN no configurado — los errores no se enviarán a Sentry. Agrega SENTRY_DSN a .env');
    return;
  }

  Sentry.init({
    dsn: DSN,
    // Solo enviar en producción — en dev ver errores en consola
    enabled: IS_PROD,
    // % de sesiones incluidas en performance tracing (0.0 - 1.0)
    tracesSampleRate: IS_PROD ? 0.2 : 0,
    // Contexto adicional automático
    attachStacktrace: true,
    // Ignorar errores de red offline (ya los manejamos con GlobalError)
    ignoreErrors: [
      'Network request failed',
      'Network Error',
      /ERR_INTERNET_DISCONNECTED/,
    ],
  });
}

/**
 * Reporta un error a Sentry con contexto adicional.
 * @param {Error|unknown} error
 * @param {Record<string, string>} [context] - e.g. { screen: 'TasksScreen', action: 'delete' }
 */
export function captureError(error, context = {}) {
  if (!DSN || !IS_PROD) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, val]) => scope.setTag(key, String(val)));
    Sentry.captureException(error);
  });
}

/**
 * Reporta un mensaje informativo / warning a Sentry.
 * @param {string} message
 * @param {'info'|'warning'|'error'} level
 */
export function captureMessage(message, level = 'info') {
  if (!DSN || !IS_PROD) return;
  Sentry.captureMessage(message, level);
}

/**
 * Identifica al usuario autenticado en Sentry para correlacionar crashes.
 * Llamar después de login exitoso.
 * @param {{ id: number|string, username: string }} user
 */
export function setUser(user) {
  if (!DSN) return;
  Sentry.setUser(user ? { id: String(user.id), username: user.username } : null);
}

/**
 * HOC que envuelve el componente raíz para capturar errores de render.
 * Úsalo si quieres reemplazar ErrorBoundary con la versión de Sentry
 * (que envía automáticamente los errores de boundary).
 */
export const wrap = Sentry.wrap;
