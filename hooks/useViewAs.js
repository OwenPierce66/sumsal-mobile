/**
 * hooks/useViewAs.js
 *
 * "Ver como" otra persona en toda la app: el feed, Reels y Top muestran lo de quienes
 * sigue esa persona (si lo permite) hasta que se toque "Salir". Es un solo estado para
 * todas las pantallas; cada una lo manda al servidor como `as_user`.
 */
import { useSyncExternalStore } from 'react';

let current = null;
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getViewAs = () => current;

/** `user` = { id, username } para empezar; null para salir. */
export function setViewAs(user) {
  current = user?.id ? { id: user.id, username: user.username || '' } : null;
  listeners.forEach((listener) => listener());
}

export function useViewAs() {
  return useSyncExternalStore(subscribe, getViewAs, getViewAs);
}
