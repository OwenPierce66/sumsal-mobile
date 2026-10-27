/**
 * utils/feedItems.js
 *
 * Utilidades puras para armar el feed mixto (tareas + compartidas) de
 * Inicio y Tareas.
 */

/**
 * Quita elementos repetidos del feed mixto. Cada elemento debe traer
 * `feedType` ('task' | 'shared').
 *
 * Reglas:
 *  - La publicación original y su repost (compartida) conviven: NO se
 *    consideran duplicados entre sí.
 *  - Cada compartida es independiente: si un usuario comparte varias veces la
 *    misma publicación (cada una con su descripción), todas se muestran.
 *  - Solo se descarta un elemento repetido por id (por ejemplo, por el
 *    desplazamiento de la paginación).
 *
 * No muta la lista recibida y conserva el orden de primera aparición.
 *
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
export function dedupeFeedItems(items) {
  if (!Array.isArray(items)) return [];

  const result = [];
  const seen = new Set();

  for (const item of items) {
    if (!item) continue;
    const key = `${item.feedType === 'shared' ? 'shared' : 'task'}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}
