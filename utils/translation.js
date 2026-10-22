/**
 * Traductor de mensajes (directos y de grupo).
 * Lógica pura, sin React ni red, para poder probarla con Jest.
 */

const STORY_REPLY_PREFIX = '↪ Respuesta a tu historia:';
const TASK_SHARE_PREFIX = '↪ Publicación compartida:';

// Respaldo mientras no llega la lista del backend (`translation/language/`).
export const LANGUAGE_NAMES = {
  es: 'Español',
  en: 'Inglés',
  pt: 'Portugués',
  fr: 'Francés',
  de: 'Alemán',
  it: 'Italiano',
  ja: 'Japonés',
  ko: 'Coreano',
  zh: 'Chino',
  ru: 'Ruso',
};

export const languageName = (code) => {
  const key = String(code || '').toLowerCase().split('-')[0];
  return LANGUAGE_NAMES[key] || '';
};

/**
 * Texto que realmente escribió la persona: si el mensaje empieza con la línea
 * automática de historia/publicación compartida, esa línea no se traduce.
 */
export const getTranslatableText = (content) => {
  const text = String(content || '').trim();
  if (!text) return '';
  const lines = text.split('\n');
  const firstLine = (lines[0] || '').trim();
  if (firstLine.startsWith(STORY_REPLY_PREFIX) || firstLine.startsWith(TASK_SHARE_PREFIX)) {
    return lines.slice(1).join('\n').trim();
  }
  return text;
};

export const canTranslateMessage = (message) => !!getTranslatableText(message?.content);

/** Clave estable de un mensaje: los ids de directos y grupos pueden coincidir. */
export const translationKey = (type, id) => `${type === 'group' ? 'group' : 'direct'}:${id}`;

export const translationEndpoint = (type, id) => (
  type === 'group'
    ? `massaging/group_messages/${id}/translate/`
    : `massaging/messages/${id}/translate/`
);

/** Mensaje amable para cada fallo posible del backend. */
export const translationErrorMessage = (error) => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  if (status === 503) return 'El traductor todavía no está disponible.';
  if (status === 429) return 'Llegaste al límite de traducciones de hoy. Inténtalo mañana.';
  if (status === 400 && detail) return detail;
  if (status === 404) return 'No se encontró el mensaje.';
  if (status === 502) return 'No se pudo traducir en este momento. Inténtalo de nuevo.';
  if (!error?.response) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  return 'No se pudo traducir el mensaje.';
};

/** Estado guardado en la pantalla a partir de la respuesta del backend. */
export const translationFromResponse = (data) => ({
  status: 'done',
  text: String(data?.text ?? ''),
  sourceLang: data?.source_lang || '',
  sameLanguage: !!data?.same_language,
  showOriginal: false,
});
