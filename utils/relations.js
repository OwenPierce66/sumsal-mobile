/**
 * Lógica pura de las relaciones del usuario con otros perfiles.
 * Jerarquía: Seguir -> Favorito -> Anclado.
 *
 * Estado de un perfil ajeno:
 *   'none'      -> no lo sigues            (corazón de contorno)
 *   'following' -> lo sigues               (sin corazón)
 *   'favorite'  -> en tus favoritos        (corazón negro)
 *   'pinned'    -> anclado                 (corazón morado)
 *   null        -> sin datos o eres tú
 */

export const toRelationSets = (data) => ({
  me: data?.me ? String(data.me) : null,
  following: new Set((data?.following || []).map(String)),
  favorites: new Set((data?.favorites || []).map(String)),
  pinned: new Set((data?.pinned || []).map(String)),
});

export const relationStateFor = (relations, userId) => {
  if (!relations || !userId) return null;
  const id = String(userId);
  if (relations.me && relations.me === id) return null;
  if (relations.pinned.has(id)) return 'pinned';
  if (relations.favorites.has(id)) return 'favorite';
  if (relations.following.has(id)) return 'following';
  return 'none';
};

/**
 * Aplica localmente un cambio de estado (actualización optimista)
 * respetando la jerarquía.
 */
export const applyRelationState = (data, userId, nextState) => {
  const id = String(userId);
  const drop = (list) => (list || []).filter((x) => String(x) !== id);
  const add = (list) => [...list, id];
  let following = drop(data?.following);
  let favorites = drop(data?.favorites);
  let pinned = drop(data?.pinned);
  if (nextState === 'pinned') {
    following = add(following);
    favorites = add(favorites);
    pinned = add(pinned);
  } else if (nextState === 'favorite') {
    following = add(following);
    favorites = add(favorites);
  } else if (nextState === 'following') {
    following = add(following);
  }
  return { ...(data || {}), following, favorites, pinned };
};

/**
 * Tareas: Guardar -> Favorito -> Top 5 (y top 5 por categoría), con "solo para mí".
 * Estado de una tarea: { saved, favorite, pinned, private, categories } donde
 * `categories` son las categorías en cuyo top 5 está anclada.
 */
const taskLists = (data) => ({
  saved: (data?.saved_tasks || []).map(String),
  private: (data?.private_tasks || []).map(String),
  favorites: (data?.favorite_tasks || []).map(String),
  pinned: (data?.pinned_tasks || []).map(String),
  categoryPins: data?.task_category_pins || {},
});

export const toTaskSets = (data) => {
  const lists = taskLists(data);
  return {
    saved: new Set(lists.saved),
    private: new Set(lists.private),
    favorites: new Set(lists.favorites),
    pinned: new Set(lists.pinned),
    categoryPins: lists.categoryPins,
  };
};

export const taskStateFor = (taskSets, taskId) => {
  if (!taskSets || !taskId) return null;
  const id = String(taskId);
  return {
    saved: taskSets.saved.has(id),
    favorite: taskSets.favorites.has(id),
    pinned: taskSets.pinned.has(id),
    private: taskSets.private.has(id),
    categories: taskSets.categoryPins[id] || [],
  };
};

/**
 * Cambio optimista del estado de una tarea (`patch` con los campos que cambian),
 * respetando la escala: favorito o cualquier top 5 la guardan; quitarla de guardados
 * quita todo; quitarla de favoritos quita sus top 5.
 */
export const applyTaskState = (data, taskId, patch) => {
  const id = String(taskId);
  const next = { ...taskStateFor(toTaskSets(data), id), ...patch };
  // Primero lo que se quita (arrastra hacia abajo) y luego lo que se agrega (sube la escala).
  if (patch.saved === false) Object.assign(next, { favorite: false, pinned: false, categories: [], private: false });
  if (patch.favorite === false) Object.assign(next, { pinned: false, categories: [] });
  if (next.pinned || next.categories.length) next.favorite = true;
  if (next.favorite) next.saved = true;
  const lists = taskLists(data);
  const withId = (list, on) => {
    const rest = list.filter((x) => x !== id);
    return on ? [...rest, id] : rest;
  };
  const categoryPins = { ...lists.categoryPins };
  if (next.categories.length) categoryPins[id] = next.categories;
  else delete categoryPins[id];
  return {
    ...(data || {}),
    saved_tasks: withId(lists.saved, next.saved),
    private_tasks: withId(lists.private, next.private),
    favorite_tasks: withId(lists.favorites, next.favorite),
    pinned_tasks: withId(lists.pinned, next.pinned),
    task_category_pins: categoryPins,
  };
};

// Etiquetas de estado que viven en `categories` pero no son categorías (igual que en el backend).
const STATUS_TAGS = new Set(['aprobada', 'aprobadas', 'aprovada', 'aprovadas', 'procesando']);

/** Categorías de una tarea que admiten top 5 (sin repetir ni etiquetas de estado). */
export const taskCategories = (task) => {
  const seen = new Set();
  return String(task?.categories || '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key) || STATUS_TAGS.has(key)) return false;
      seen.add(key);
      return true;
    });
};
