import { appendMediaFile } from './mediaUpload';

/**
 * Cuerpo JSON para publicar un comentario en una publicación.
 *
 * - `aportacion` es una aportación favorita del usuario (`{ id }`). La llevan tanto
 *   los comentarios principales como las respuestas.
 */
export function buildCommentPayload({ text, replyingTo = null, aportacion = null }) {
  const payload = { text };
  if (replyingTo?.id != null) payload.parent = replyingTo.id;
  if (aportacion?.id) payload.aportacion = aportacion.id;
  return payload;
}

/**
 * Cuerpo para crear un comentario: el JSON de siempre, o un FormData si lleva una foto o un
 * video (`media`, un asset de la galería). Las etiquetas van repetidas en `tagged_user_ids`.
 */
export async function buildCommentBody({ text, replyingTo = null, aportacion = null, tagIds = [], media = null }) {
  return buildMessageBody(buildCommentPayload({ text, replyingTo, aportacion }), { tagIds, media });
}

/**
 * Cuerpo de cualquier mensaje (post o respuesta del foro, comentario de una compartida…):
 * `fields` más lo que lo acompaña. JSON normal, o FormData si lleva foto o video.
 */
export async function buildMessageBody(fields, { aportacion = null, tagIds = [], media = null } = {}) {
  const payload = { ...fields };
  if (aportacion?.id) payload.aportacion = aportacion.id;
  if (tagIds.length) payload.tagged_user_ids = tagIds;
  if (!media) return payload;
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value == null) return; // p. ej. `parent` cuando no es respuesta
    if (Array.isArray(value)) value.forEach((item) => formData.append(key, String(item)));
    else formData.append(key, String(value));
  });
  await appendMediaFile(formData, 'attachment', media);
  return formData;
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
