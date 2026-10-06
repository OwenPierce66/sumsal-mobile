/**
 * utils/network.js
 *
 * Helpers puros de conectividad. Se mantienen separados de React/NetInfo
 * para poder testearlos y reutilizarlos (banner, React Query, etc.).
 */

/**
 * Decide si el dispositivo tiene conexión a partir del estado de NetInfo.
 *
 * Un valor `null`/`undefined` (estado aún desconocido, p. ej. justo al arrancar)
 * se trata como "en línea": es preferible intentar la petición que dejar toda
 * la app en pausa por un estado que todavía no se ha resuelto.
 *
 * @param {{ isConnected?: boolean | null, isInternetReachable?: boolean | null } | null | undefined} netState
 * @returns {boolean}
 */
export function isNetOnline(netState) {
  if (!netState) return true;
  return netState.isConnected !== false && netState.isInternetReachable !== false;
}

/**
 * Indica si un error de axios es un fallo de red (la petición no llegó al
 * servidor), a diferencia de un 4xx/5xx donde el servidor sí respondió.
 *
 * @param {any} error
 * @returns {boolean}
 */
export function isNetworkError(error) {
  if (!error || error.response) return false;
  return error.code === 'ERR_NETWORK' || error.message === 'Network Error';
}
