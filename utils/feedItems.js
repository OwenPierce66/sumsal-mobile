/**
 * utils/feedItems.js
 *
 * Utilidades puras para armar el feed mixto (tareas + compartidas) de
 * Inicio y Tareas.
 */

const timeOf = (item) => {
  const time = new Date(item?.created_at).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Quita duplicados del feed mixto. Cada elemento debe traer `feedType`
 * ('task' | 'shared').
 *
 * Reglas:
 *  - La publicación original y su repost (compartida) conviven: NO se
 *    consideran duplicados entre sí.
 *  - Una misma tarea o compartida repetida por id (por ejemplo, por el
 *    desplazamiento de la paginación) se muestra una sola vez.
 *  - Si un mismo usuario compartió varias veces la misma tarea, solo se
 *    conserva su repost más reciente.
 *
 * No muta la lista recibida y conserva el orden de primera aparición.
 *
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
export function dedupeFeedItems(items) {
  if (!Array.isArray(items)) return [];

  const result = [];
  const indexByKey = new Map();

  for (const item of items) {
    if (!item) continue;

    const isShared = item.feedType === 'shared';
    const idKey = `${isShared ? 'shared' : 'task'}:${item.id}`;
    if (indexByKey.has(idKey)) continue;

    if (isShared) {
      const sharerId = item.shared_by?.id ?? item.shared_by;
      const taskId = item.task?.id;
      if (sharerId != null && taskId != null) {
        const repostKey = `repost:${sharerId}:${taskId}`;
        const existingIndex = indexByKey.get(repostKey);
        if (existingIndex !== undefined) {
          if (timeOf(item) > timeOf(result[existingIndex])) {
            result[existingIndex] = item;
            indexByKey.set(idKey, existingIndex);
          }
          continue;
        }
        indexByKey.set(repostKey, result.length);
      }
    }

    indexByKey.set(idKey, result.length);
    result.push(item);
  }

  return result;
}
