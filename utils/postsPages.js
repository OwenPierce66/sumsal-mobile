/**
 * utils/postsPages.js
 *
 * Utilidades puras para trabajar con la paginación infinita del foro.
 *
 * React Query guarda las queries infinitas como { pages: [...], pageParams: [...] }
 * donde cada página es la respuesta de DRF: { count, next, previous, results }.
 * Estas funciones encapsulan esa estructura para que los hooks (y los tests)
 * no dependan de ella directamente.
 */

/**
 * Extrae el número de la siguiente página desde la respuesta paginada de DRF.
 * Se usa regex en lugar de `new URL().searchParams` porque en React Native
 * (sin polyfill) `URLSearchParams.get` no está implementado.
 *
 * @param {{ next?: string | null } | undefined} lastPage
 * @returns {number | undefined} undefined = no hay más páginas
 */
export function getNextPageNumber(lastPage) {
  const next = lastPage?.next;
  if (!next) return undefined;
  const match = /[?&]page=(\d+)/.exec(next);
  return match ? Number(match[1]) : undefined;
}

/**
 * Aplica `fn` a cada post de todas las páginas, conservando el resto de la
 * estructura (count, next, pageParams…). Devuelve `data` sin cambios si aún
 * no hay páginas cargadas.
 */
export function mapPostsPages(data, fn) {
  if (!data?.pages) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      results: (page.results ?? []).map(fn),
    })),
  };
}

/**
 * Elimina un post de todas las páginas y ajusta `count`.
 */
export function removePostFromPages(data, postId) {
  if (!data?.pages) return data;
  return {
    ...data,
    pages: data.pages.map((page) => {
      const results = page.results ?? [];
      const filtered = results.filter((post) => post.id !== postId);
      return {
        ...page,
        results: filtered,
        count:
          typeof page.count === 'number' && filtered.length !== results.length
            ? page.count - 1
            : page.count,
      };
    }),
  };
}

/**
 * Aplana las páginas en una sola lista, sin duplicados.
 *
 * Los duplicados son posibles porque la paginación es por página/offset: si
 * alguien publica un post mientras el usuario hace scroll, los elementos se
 * desplazan y el último de la página N reaparece al inicio de la N+1.
 * Quedarse con la primera aparición mantiene el orden original.
 */
export function flattenPosts(data) {
  if (!data?.pages) return [];
  const seen = new Set();
  const posts = [];
  for (const page of data.pages) {
    for (const post of page.results ?? []) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      posts.push(post);
    }
  }
  return posts;
}
