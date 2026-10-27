/**
 * hooks/useUserBadges.js
 *
 * Insignias de una persona (App, admin, recomendado, verificado, suscripción)
 * para mostrarlas junto a su nombre en cualquier parte de la app.
 *
 * Los nombres de una pantalla piden sus insignias a la vez: se juntan en una
 * sola petición `users/badges/?ids=...` y se guardan 5 minutos. No depende de
 * React Query para funcionar también en modales y pantallas sin proveedor.
 */
import { useEffect, useSyncExternalStore } from 'react';
import api from '@api';

const TTL_MS = 5 * 60 * 1000;
// Si falla la petición, se vuelve a intentar en 30 s y no en cada render.
const RETRY_MS = 30 * 1000;
const MAX_IDS_PER_REQUEST = 100;
const NO_BADGES = [];

const cache = new Map(); // id → { badges, expiresAt }
const listeners = new Set();
const queued = new Set();
const inFlight = new Set();
let flushTimer = null;

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

async function flush() {
  flushTimer = null;
  const ids = [...queued];
  queued.clear();
  ids.forEach((id) => inFlight.add(id));

  for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
    const chunk = ids.slice(i, i + MAX_IDS_PER_REQUEST);
    try {
      const response = await api.get('users/badges/', { params: { ids: chunk.join(',') } });
      const data = response?.data || {};
      const expiresAt = Date.now() + TTL_MS;
      chunk.forEach((id) => cache.set(id, { badges: data[id] || NO_BADGES, expiresAt }));
    } catch {
      const expiresAt = Date.now() + RETRY_MS;
      chunk.forEach((id) => cache.set(id, { badges: cache.get(id)?.badges || NO_BADGES, expiresAt }));
    } finally {
      chunk.forEach((id) => inFlight.delete(id));
    }
  }
  emit();
}

function request(id) {
  if (queued.has(id) || inFlight.has(id)) return;
  queued.add(id);
  if (!flushTimer) flushTimer = setTimeout(flush, 0);
}

/** Olvida las insignias guardadas (p. ej. después de pagar una suscripción). */
export function invalidateUserBadges(userId) {
  if (userId) {
    cache.delete(String(userId));
  } else {
    cache.clear();
    queued.clear();
    inFlight.clear();
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  emit();
}

/** Claves de insignia de `userId`, p. ej. ['verified', 'sub_red']. */
export function useUserBadges(userId) {
  const id = userId ? String(userId) : null;
  const entry = useSyncExternalStore(subscribe, () => (id ? cache.get(id) : undefined));

  useEffect(() => {
    if (id && (!entry || entry.expiresAt <= Date.now())) request(id);
  }, [id, entry]);

  return entry?.badges || NO_BADGES;
}
