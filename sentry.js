/**
 * sentry.js
 *
 * Inicialización de Sentry para tracking de errores en producción.
 *
 * En web (webpack) el alias en webpack.config.js redirige
 * '@sentry/react-native' → 'sentry.web.stub.js' (no-ops seguros).
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

// En web webpack redirige este import al stub vacío vía alias en webpack.config.js
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN     = Constants.expoConfig?.extra?.sentryDsn ?? '';
const IS_PROD = !__DEV__;

/**
 * Inicializa Sentry. Llamar UNA VEZ al arrancar la app (en App.js).
 */
export function init() {
  if (!DSN) {
    if (__DEV__) console.warn('[Sentry] DSN no configurado — los errores no se enviarán a Sentry. Agrega SENTRY_DSN a .env');
    return;
  }
  Sentry.init({
    dsn: DSN,
    enabled: IS_PROD,
    tracesSampleRate: IS_PROD ? 0.2 : 0,
    attachStacktrace: true,
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
 * @param {Record<string, string>} [context]
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
 * Identifica al usuario autenticado en Sentry.
 * @param {{ id: number|string, username: string }|null} user
 */
export function setUser(user) {
  if (!DSN) return;
  Sentry.setUser(user ? { id: String(user.id), username: user.username } : null);
}

/**
 * HOC que envuelve el componente raíz (en web devuelve el componente sin cambios).
 */
export const wrap = Sentry.wrap;
