/**
 * utils/repost.js
 *
 * Impulsar una publicación (tasks/<id>/repost/ es un interruptor): lo mismo en el feed,
 * el detalle, las compartidas y los reels. Impulsar también deja tu like; quitar el
 * impulso conserva el like (así lo decide el backend).
 *
 * El número junto al botón es `reposts_count` (cuántas personas la impulsaron), no
 * `interaction_score`, que también sube al compartir.
 */

const REPOST_FIELDS = ['user_has_reposted', 'user_has_liked', 'likes_count', 'interaction_score', 'reposts_count'];

/** Lo que cambia al impulsar, tal como está ahora (para poder volver atrás si falla). */
export function repostSnapshot(task) {
  return {
    user_has_reposted: Boolean(task?.user_has_reposted),
    user_has_liked: Boolean(task?.user_has_liked),
    likes_count: task?.likes_count || 0,
    interaction_score: task?.interaction_score || 0,
    reposts_count: task?.reposts_count || 0,
  };
}

/** El cambio inmediato al tocar el botón, antes de que responda el servidor. */
export function optimisticRepost(snapshot) {
  const next = !snapshot.user_has_reposted;
  const step = next ? 1 : -1;
  return {
    user_has_reposted: next,
    user_has_liked: snapshot.user_has_liked || next,
    likes_count: snapshot.likes_count + (!snapshot.user_has_liked && next ? 1 : 0),
    interaction_score: Math.max(0, snapshot.interaction_score + step),
    reposts_count: Math.max(0, snapshot.reposts_count + step),
  };
}

/** Lo que confirma el servidor (solo los campos que mandó). */
export function repostFromResponse(data) {
  const patch = {};
  REPOST_FIELDS.forEach((field) => {
    if (data?.[field] !== undefined) patch[field] = data[field];
  });
  return patch;
}
