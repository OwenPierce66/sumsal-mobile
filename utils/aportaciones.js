/**
 * utils/aportaciones.js
 *
 * Aportaciones favoritas que se pueden adjuntar a un comentario (la web antigua
 * lo llamaba "Seleccionar Aportación Favorita"). El backend solo acepta
 * aportaciones que la persona tiene en favoritos y nunca historias sin guardar.
 */

const BLOCK_SECTIONS = ['subtasks', 'subfactores', 'subfuentes'];

export const PCH_LABELS = {
  consejos: 'Consejo',
  peticiones: 'Petición',
  historias: 'Historia',
};

export const PCH_ICONS = {
  consejos: 'bulb-outline',
  peticiones: 'hand-left-outline',
  historias: 'book-outline',
};

const ACCENTS = {
  á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ñ: 'n', ç: 'c',
};

/** Minúsculas y sin acentos, para que "peticion" encuentre "Petición". */
export function foldText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[áàâäãéèêëíìîïóòôöõúùûüñç]/g, (char) => ACCENTS[char])
    .trim();
}

/** Primera imagen de la tarea: la propia o la del primer bloque que tenga. */
export function getTaskThumbnail(task) {
  if (!task) return null;
  if (task.image) return task.image;
  for (const section of BLOCK_SECTIONS) {
    const blocks = Array.isArray(task[section]) ? task[section] : [];
    const withImage = blocks.find((block) => block?.image);
    if (withImage) return withImage.image;
  }
  return null;
}

export function getTaskAuthor(task) {
  return task?.user?.username || task?.username || '';
}

/** Historias que el dueño no guardó: el backend las rechaza. */
export function isAttachableAportacion(task) {
  return Boolean(task?.id) && !(task.is_story && !task.story_saved);
}

/**
 * Lista del selector a partir de `favorites/collection/` (ya viene con las
 * ancladas primero): solo adjuntables y sin la tarea que se está comentando.
 */
export function toFavoriteAportaciones(collectionTasks, excludeTaskId = null) {
  if (!Array.isArray(collectionTasks)) return [];
  return collectionTasks
    .filter((item) => isAttachableAportacion(item?.task))
    .filter((item) => excludeTaskId == null || String(item.task.id) !== String(excludeTaskId))
    .map((item) => ({ ...item.task, isPinned: Boolean(item.is_pinned) }));
}

/** Filtro local por tipo (pch) y por texto en título, autor, descripción o categorías. */
export function filterAportaciones(list, { query = '', pch = '' } = {}) {
  const needle = foldText(query);
  return (Array.isArray(list) ? list : []).filter((task) => {
    if (pch && task.pch !== pch) return false;
    if (!needle) return true;
    const haystack = foldText(
      [task.title, getTaskAuthor(task), task.description, task.categories].join(' ')
    );
    return haystack.includes(needle);
  });
}

/** Lo mínimo que muestra la tarjeta de una aportación (mismo formato que `aportacion_info`). */
export function toAportacionInfo(task) {
  if (!task?.id) return null;
  return {
    id: String(task.id),
    title: task.title || '',
    image: getTaskThumbnail(task),
    pch: task.pch || null,
    username: getTaskAuthor(task) || null,
  };
}

/**
 * Título real de una publicación/factor/fuente. Al crear sin título se guardaba
 * "Elemento N" de relleno (el backend lo exige): ese no se muestra.
 */
export const subItemTitle = (sub) => {
  const title = String(sub?.title || '').trim();
  return /^elemento \d+$/i.test(title) ? '' : title;
};
