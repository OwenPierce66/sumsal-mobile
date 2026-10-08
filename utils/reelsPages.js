/**
 * utils/reelsPages.js
 *
 * Utilidades puras para convertir las páginas de React Query (DRF) del feed
 * de Reels en la lista plana que renderiza la pantalla.
 */

/**
 * Aplana las páginas, conserva solo publicaciones con algún medio (video o
 * imagen) y descarta duplicados por `id` (los items nuevos desplazan el offset
 * de las páginas siguientes).
 *
 * @param {{ pages?: Array<{ results?: any[] } | any[]> } | undefined} data
 * @param {(content: any) => string | null} getMedia  devuelve el primer medio o null
 * @returns {any[]}
 */
export function buildReelsFromPages(data, getMedia) {
  if (!data?.pages) return [];
  const seen = new Set();
  const reels = [];
  for (const page of data.pages) {
    const items = Array.isArray(page) ? page : page?.results ?? [];
    for (const item of items) {
      if (!item || seen.has(item.id)) continue;
      // Los items compartidos llevan el contenido dentro de `task`.
      const content = item.is_original ? item : item.task;
      if (!content) continue;
      const anyMedia = getMedia(content);
      if (!anyMedia) continue;
      seen.add(item.id);
      reels.push({ ...item, _anyMedia: anyMedia });
    }
  }
  return reels;
}
