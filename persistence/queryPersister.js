/**
 * persistence/queryPersister.js
 *
 * Configuración del persister de React Query para almacenamiento offline.
 *
 * Usa AsyncStorage para persistir el caché de React Query entre sesiones.
 * Cuando el usuario abre la app sin conexión o por segunda vez, los datos
 * del caché aparecen instantáneamente en lugar de un spinner.
 *
 * Qué se persiste:
 *   - Tareas (tasks, shared-tasks)
 *   - Categorías (cambian poco)
 *   - Perfil propio (me)
 *   - Notificaciones (primer página)
 *
 * Qué NO se persiste (se excluye intencionalmente):
 *   - Mutaciones en vuelo
 *   - Resultados de búsqueda (son transitorios)
 *   - Favoritos feed (datos sensibles de contexto)
 *   - Queries con error
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

// ─── Clave de almacenamiento en AsyncStorage ──────────────────────────────────
export const CACHE_KEY = 'SUMSAL_REACT_QUERY_CACHE_V1';

// ─── Tiempo máximo de validez del caché persistido ───────────────────────────
// Si el caché tiene más de 24h, se descarta para forzar datos frescos
export const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

// ─── Persister ────────────────────────────────────────────────────────────────
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_KEY,
  // Serializar/deserializar (por defecto JSON.stringify/parse)
  throttleTime: 2000, // Escribir en storage máximo cada 2s para no saturar I/O
});

// ─── Filtro de qué queries se persisten ──────────────────────────────────────
/**
 * Lista de prefijos de queryKey que SÍ deben persistirse.
 * Solo se persisten las queries exitosas (status === 'success').
 */
const PERSISTABLE_KEYS = [
  'tasks',
  'myTasks',
  'profileTasks',
  'sharedTasks',
  'categories',
  'me',
  'profileCategories',
  'notifications',
  'posts',
  'taskComments',
];

/**
 * Función que decide si una query específica debe ser incluida en el caché persistido.
 * Se pasa a dehydrateOptions.shouldDehydrateQuery.
 *
 * @param {import('@tanstack/react-query').Query} query
 * @returns {boolean}
 */
export function shouldPersistQuery(query) {
  // Solo persistir queries exitosas
  if (query.state.status !== 'success') return false;

  // Verificar que la queryKey comienza con uno de los prefijos permitidos
  const firstKey = query.queryKey[0];
  if (typeof firstKey !== 'string') return false;

  return PERSISTABLE_KEYS.some(prefix => firstKey === prefix || firstKey.startsWith(prefix));
}
