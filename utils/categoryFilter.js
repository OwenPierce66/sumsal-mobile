/**
 * utils/categoryFilter.js
 *
 * El filtro por categorías y subcategorías (niveles) que usan las tareas, llevado a
 * cualquier lista: tareas, perfiles y foro. Mismo contrato que el backend
 * (`filter_by_categories`): "Tema,Subtema" pide que cada parte esté entre las
 * categorías del elemento, sin importar mayúsculas ni espacios.
 */

const APPROVED_ALIASES = new Set(['aprobada', 'aprobadas', 'aprovada', 'aprovadas']);

export const normalizeCategory = (value) => String(value || '').trim().replace(/\s+/g, ' ');
export const categoryKey = (value) => normalizeCategory(value).toLowerCase();
const matchKey = (value) => (APPROVED_ALIASES.has(categoryKey(value)) ? 'aprobada' : categoryKey(value));

/** "Tema, Subtema" o ['Tema', 'Subtema'] -> ['Tema', 'Subtema'] (sin vacías ni repetidas). */
export function categoryPath(value) {
  const parts = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  return parts.map(normalizeCategory).filter((name) => {
    const key = categoryKey(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** ¿Las categorías del elemento ("A,B,C") incluyen todas las partes de la ruta? */
export function matchesCategoryPath(categories, path) {
  const wanted = categoryPath(path);
  if (!wanted.length) return true;
  const own = new Set(categoryPath(categories).map(matchKey));
  return wanted.every((name) => own.has(matchKey(name)));
}

/** Ordena primero lo que tiene la ruta exacta, luego lo que empieza por ella (como el backend). */
export function categoryPathRank(categories, path) {
  const wanted = categoryPath(path).map(categoryKey).join(',');
  const own = categoryPath(categories).map(categoryKey).join(',');
  if (!wanted) return 0;
  if (own === wanted) return 0;
  return own.startsWith(`${wanted},`) ? 1 : 2;
}

/** Filtra (y ordena por cercanía a la ruta) una lista con `getCategories(item)`. */
export function filterByCategoryPath(items, path, getCategories = (item) => item?.categories) {
  const wanted = categoryPath(path);
  if (!wanted.length) return items || [];
  return (items || [])
    .map((item, index) => ({ item, index, categories: getCategories(item) }))
    .filter(({ categories }) => matchesCategoryPath(categories, wanted))
    .sort((a, b) => (categoryPathRank(a.categories, wanted) - categoryPathRank(b.categories, wanted)) || (a.index - b.index))
    .map(({ item }) => item);
}

/** Id estable de un nodo por su ruta: el mismo tema de dos fuentes es el mismo nodo. */
export const categoryPathId = (path) => categoryPath(path).map(categoryKey).join('>');

/**
 * Une varios árboles de categorías ({id, name, parent}) en uno, sin repetir: dos nodos con
 * el mismo nombre bajo el mismo padre son el mismo (p. ej. las de la app de cada PCH y las
 * propias). Los nodos salen con `id` = su ruta y `parent` = la ruta del padre.
 */
export function mergeCategoryTrees(...lists) {
  const merged = [];
  const added = new Set();
  lists.forEach((list) => {
    const nodes = (Array.isArray(list) ? list : []).filter((node) => node && normalizeCategory(node.name));
    const byId = new Map(nodes.map((node) => [String(node.id), node]));
    const pathOf = (node) => {
      const names = [];
      const visited = new Set();
      let current = node;
      while (current && !visited.has(String(current.id))) {
        visited.add(String(current.id));
        names.unshift(normalizeCategory(current.name));
        current = current.parent == null ? null : byId.get(String(current.parent));
      }
      return names;
    };
    nodes.forEach((node) => {
      const path = pathOf(node);
      const id = categoryPathId(path);
      if (!id || added.has(id)) return;
      added.add(id);
      merged.push({
        id,
        name: path[path.length - 1],
        parent: path.length > 1 ? categoryPathId(path.slice(0, -1)) : null,
      });
    });
  });
  // Un hijo cuyo padre no llegó (p. ej. filtrado) se muestra como tema principal.
  const ids = new Set(merged.map((node) => node.id));
  return merged.map((node) => (node.parent && !ids.has(node.parent) ? { ...node, parent: null } : node));
}

/**
 * Deja del árbol solo lo que lleva a alguna de `names` (p. ej. las categorías de tus
 * guardadas). Las que no están en el árbol se agregan como temas principales.
 */
export function limitCategoryTree(nodes, names) {
  const wanted = new Set(categoryPath(names).map(categoryKey));
  const children = new Map();
  (nodes || []).forEach((node) => {
    const key = node.parent ?? null;
    children.set(key, [...(children.get(key) || []), node]);
  });
  const keep = new Set();
  const visit = (node) => {
    let leads = wanted.has(categoryKey(node.name));
    (children.get(node.id) || []).forEach((child) => { if (visit(child)) leads = true; });
    if (leads) keep.add(node.id);
    return leads;
  };
  (children.get(null) || []).forEach(visit);
  const kept = (nodes || []).filter((node) => keep.has(node.id));
  const present = new Set(kept.map((node) => categoryKey(node.name)));
  const loose = categoryPath(names)
    .filter((name) => !present.has(categoryKey(name)))
    .map((name) => ({ id: categoryPathId([name]), name, parent: null }));
  return [...kept, ...loose];
}

/**
 * Agrega al árbol las rutas escritas a mano (categorías que no están en la app ni en tu
 * filtro, p. ej. las propias de otra persona). Se pueden quitar (`isSearchCategory`).
 */
export function withCustomPaths(nodes, paths) {
  const result = [...(nodes || [])];
  const ids = new Set(result.map((node) => node.id));
  (paths || []).forEach((rawPath) => {
    const path = categoryPath(rawPath);
    path.forEach((name, level) => {
      const id = categoryPathId(path.slice(0, level + 1));
      if (ids.has(id)) return;
      ids.add(id);
      result.push({
        id,
        name,
        parent: level ? categoryPathId(path.slice(0, level)) : null,
        isSearchCategory: true,
        searchPath: path.slice(0, level + 1),
      });
    });
  });
  return result;
}
