/**
 * hooks/usePetitionSupport.js
 *
 * Apoyo monetario a peticiones: pago único en Stripe Checkout. Al volver a la
 * app se confirma con el backend (sin esperar al webhook) y el total nuevo se
 * muestra de inmediato en todas las tarjetas de esa petición.
 */
import { useCallback, useState, useSyncExternalStore } from 'react';
import { AppState, Linking } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import api from '@api';

const MAX_SYNC_ATTEMPTS = 5;
// Las listas que traen tareas (y por tanto su support_total).
const TASK_QUERY_KEYS = [['petitionSupports'], ['tasks'], ['task'], ['taskDetail'], ['profileTasks'], ['myTasks'], ['sharedTasks'], ['sharedTask'], ['favoritesFeed']];

// Totales confirmados en esta sesión, por id de tarea. Ganan sobre lo que traiga
// una lista que todavía no se recarga.
const totals = new Map();
const listeners = new Set();
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setPetitionSupportTotal(taskId, total) {
  if (!taskId || !total) return;
  totals.set(String(taskId), total);
  listeners.forEach((listener) => listener());
}

/** Lo recaudado por la petición: `{ amount_mxn, supporters_count }`, o null si no es petición. */
export function usePetitionSupportTotal(task) {
  const override = useSyncExternalStore(subscribe, () => (task?.id ? totals.get(String(task.id)) : undefined));
  return override || task?.support_total || null;
}

// Pago abierto en Stripe que falta confirmar. Vive fuera de los componentes:
// la hoja de pago se cierra al abrir Stripe y la confirmación llega al volver a la app.
let pending = null;
let appStateListener = null;

async function syncPending(queryClient) {
  const current = pending;
  if (!current) return;
  current.attempts += 1;
  try {
    const { data } = await api.post(`petition-supports/${current.id}/sync/`);
    setPetitionSupportTotal(current.taskId, data?.support_total);
    if (data?.support?.status !== 'pending' || current.attempts >= MAX_SYNC_ATTEMPTS) pending = null;
    if (data?.support?.status === 'paid' && queryClient) {
      TASK_QUERY_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      queryClient.invalidateQueries({ queryKey: ['petitionSupporters', current.taskId] });
    }
  } catch {
    if (current.attempts >= MAX_SYNC_ATTEMPTS) pending = null;
  }
}

/**
 * Crea el apoyo, abre Stripe Checkout y confirma el pago al volver a la app.
 * body: { amount, currency }. `queryClient` (opcional) recarga las listas al confirmar.
 * Lanza el error del backend.
 */
export async function openPetitionSupportCheckout(taskId, body, queryClient = null) {
  const { data } = await api.post(`tasks/${taskId}/support/`, body);
  pending = data.support?.id ? { id: data.support.id, taskId: String(taskId), attempts: 0 } : null;
  if (pending) {
    appStateListener?.remove();
    appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncPending(queryClient);
    });
  }
  await Linking.openURL(data.checkout_url);
  return data.support;
}

export function usePetitionSupportCheckout() {
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState(false);

  const startCheckout = useCallback(async (taskId, body) => {
    setIsStarting(true);
    try {
      return await openPetitionSupportCheckout(taskId, body, queryClient);
    } finally {
      setIsStarting(false);
    }
  }, [queryClient]);

  return { startCheckout, isStarting };
}
