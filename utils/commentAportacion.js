/**
 * Cuerpo JSON para publicar un comentario en una publicación.
 *
 * - `aportacion` es una aportación favorita del usuario (`{ id }`). Igual que en la
 *   web antigua, solo los comentarios principales la llevan; las respuestas no.
 */
export function buildCommentPayload({ text, replyingTo = null, aportacion = null }) {
  const payload = { text };
  if (replyingTo?.id != null) {
    payload.parent = replyingTo.id;
  } else if (aportacion?.id) {
    payload.aportacion = aportacion.id;
  }
  return payload;
}

/**
 * Datos de la aportación adjunta a un comentario, o null si no tiene
 * (o si la aportación fue eliminada).
 */
export function getCommentAportacion(comment) {
  const info = comment?.aportacion_info;
  if (!info?.id) return null;
  return {
    id: info.id,
    title: info.title || 'Aportación',
    image: info.image || null,
    username: info.username || null,
  };
}
