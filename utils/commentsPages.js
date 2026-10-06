/**
 * utils/commentsPages.js
 *
 * Utilidades puras para la paginación infinita de comentarios de una tarea.
 *
 * A diferencia del foro (PageNumberPagination), CommentPagination en el backend
 * es LimitOffsetPagination: la URL `next` trae `limit` y `offset`, no `page`.
 * React Query guarda { pages: [{ count, next, previous, results }], pageParams }.
 */

/**
 * Extrae el `offset` de la URL `next` de DRF. Se usa regex porque
 * `URLSearchParams.get` no está implementado en React Native sin polyfill.
 *
 * @param {{ next?: string | null } | undefined} lastPage
 * @returns {number | undefined} undefined = no hay más páginas
 */
export function getNextOffset(lastPage) {
  const next = lastPage?.next;
  if (!next) return undefined;
  const match = /[?&]offset=(\d+)/.exec(next);
  return match ? Number(match[1]) : undefined;
}

/**
 * Aplana las páginas en una lista, sin duplicados y respetando el orden.
 *
 * Con paginación por offset, un comentario nuevo desplaza los elementos y el
 * último de la página N reaparece al inicio de la N+1; se conserva la primera
 * aparición.
 */
export function flattenCommentPages(data) {
  if (!data?.pages) return [];
  const seen = new Set();
  const comments = [];
  for (const page of data.pages) {
    for (const comment of page.results ?? []) {
      if (seen.has(comment.id)) continue;
      seen.add(comment.id);
      comments.push(comment);
    }
  }
  return comments;
}

/**
 * Cuántos comentarios raíz faltan por cargar (según el `count` del servidor).
 * Nunca devuelve negativos.
 */
export function getRemainingComments(data) {
  const pages = data?.pages;
  if (!pages?.length) return 0;
  const total = pages[pages.length - 1]?.count;
  if (typeof total !== 'number') return 0;
  return Math.max(0, total - flattenCommentPages(data).length);
}
