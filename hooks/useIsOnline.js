/**
 * hooks/useIsOnline.js
 *
 * Estado de conectividad reactivo. Se apoya en `onlineManager` de React Query,
 * que App.js mantiene sincronizado con NetInfo (vía `isNetOnline`), de modo que
 * toda la app comparte una única fuente de verdad.
 */
import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

const subscribe = (callback) => onlineManager.subscribe(callback);
const getSnapshot = () => onlineManager.isOnline();

export function useIsOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export default useIsOnline;
