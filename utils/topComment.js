/**
 * Comentario destacado bajo una publicación, como en otras redes: el de más interacción
 * (sus likes más todas sus respuestas) y, debajo, su respuesta con más interacción.
 */

/** Respuestas de un comentario, a cualquier nivel. */
export const countReplies = (comment) => (
  (Array.isArray(comment?.children) ? comment.children : [])
    .reduce((total, child) => total + 1 + countReplies(child), 0)
);

export const interactionOf = (comment) => (comment?.likes_count || 0) + countReplies(comment);

// Más interacción primero; si empatan, el más reciente.
const byInteraction = (a, b) => (
  interactionOf(b) - interactionOf(a)
  || (Date.parse(b?.created_at || 0) || 0) - (Date.parse(a?.created_at || 0) || 0)
);

/**
 * `comments` es la lista que trae la tarea (incluye las respuestas sueltas; se toman las de
 * primer nivel, que traen sus respuestas en `children`).
 */
export const pickTopComment = (comments) => {
  const topLevel = (Array.isArray(comments) ? comments : []).filter((comment) => comment && comment.parent == null);
  if (!topLevel.length) return { comment: null, reply: null };
  const comment = [...topLevel].sort(byInteraction)[0];
  const reply = [...(Array.isArray(comment.children) ? comment.children : [])].sort(byInteraction)[0] || null;
  return { comment, reply };
};
