/**
 * utils/offlineEvents.js
 *
 * Mini bus de eventos para avisar a la UI cuando una ESCRITURA falla por falta
 * de conexión. Permite que api.js (que no puede usar hooks) notifique al
 * componente que muestra el toast, sin acoplar ambos módulos.
 */

const listeners = new Set();

/**
 * Suscribe un listener. Devuelve la función para cancelar la suscripción.
 * @param {() => void} listener
 */
export function onOfflineWrite(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Notifica a todos los listeners. Un listener que falle no afecta a los demás
 * ni rompe la petición que originó el evento.
 */
export function emitOfflineWrite() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('[offline] listener falló:', error?.message);
    }
  });
}
