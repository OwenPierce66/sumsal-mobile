/**
 * Traductor de mensajes (directos y de grupo).
 * Lógica pura, sin React ni red, para poder probarla con Jest.
 *
 * Dos usos:
 *  - Leer: tocar un mensaje muestra u oculta su traducción (la que el autor envió
 *    con el mensaje o, si no hay, una pedida al servidor en tu idioma).
 *  - Escribir: con "Hablar traducido" activo, ves la traducción en vivo y viaja
 *    con tu mensaje (como en la web: escribes y debajo aparece la traducción).
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

// "Hablar traducido": idioma destino por defecto (se puede cambiar por chat); el origen se detecta solo.
export const LIVE_TRANSLATE_DEFAULT_TARGET = 'en';
export const LIVE_TRANSLATE_DEBOUNCE_MS = 800;
export const LIVE_TRANSLATE_ENDPOINT = 'massaging/translation/preview/';

export const liveTranslateStorageKey = (type, chatId) => `chatLiveTranslate:${type === 'group' ? 'group' : 'direct'}:${chatId}`;
export const liveTranslateLangStorageKey = (type, chatId) => `chatLiveTranslateLang:${type === 'group' ? 'group' : 'direct'}:${chatId}`;

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

/** Estado guardado en la pantalla a partir de la respuesta del backend (tocar el mensaje). */
export const translationFromResponse = (data) => ({
  status: 'done',
  text: String(data?.text ?? ''),
  sourceLang: data?.source_lang || '',
  targetLang: data?.target_lang || '',
  sameLanguage: !!data?.same_language,
  open: true,
});

/** Estado a partir de la traducción que el autor envió junto con el mensaje. */
export const translationFromSent = (sent) => ({
  status: 'done',
  text: String(sent?.text ?? ''),
  sourceLang: sent?.source_lang || '',
  targetLang: sent?.lang || '',
  sameLanguage: false,
  open: true,
});

/** Etiqueta del recuadro de traducción bajo el mensaje. */
export const translationLabel = (translation) => {
  if (translation?.sameLanguage) return 'Ya está en tu idioma';
  const name = languageName(translation?.targetLang);
  return name ? `Traducción · ${name}` : 'Traducción';
};

// --- Traducción en vivo al escribir ---

export const LIVE_PREVIEW_IDLE = { status: 'idle', forText: '', target: '', text: '', sourceLang: '', sameLanguage: false, error: '' };

/** Idioma destino válido (de los que ofrece la app) o el inglés por defecto. */
export const normalizeLiveTarget = (code) => {
  const key = String(code || '').toLowerCase().split('-')[0];
  return LANGUAGE_NAMES[key] ? key : LIVE_TRANSLATE_DEFAULT_TARGET;
};

/** ¿Hay que pedir (o volver a pedir) la vista previa para este borrador y este idioma? */
export const needsLivePreview = (draft, preview, target) => {
  const text = String(draft || '').trim();
  if (!text) return false;
  return !(preview?.forText === text && preview.target === target && preview.status === 'done');
};

/** Estado de la vista previa a partir de la respuesta del backend. */
export const livePreviewFromResponse = (draft, data, target) => ({
  status: 'done',
  forText: String(draft || '').trim(),
  target: target || '',
  text: String(data?.text ?? ''),
  sourceLang: data?.source_lang || '',
  sameLanguage: !!data?.same_language,
  error: '',
});

/** Estado de la vista previa cuando falla la traducción. */
export const livePreviewFromError = (draft, message, target) => ({
  status: 'error',
  forText: String(draft || '').trim(),
  target: target || '',
  text: '',
  sourceLang: '',
  sameLanguage: false,
  error: message || 'No se pudo traducir.',
});

/** Campos extra al enviar: solo si la vista previa corresponde exactamente al texto y al idioma enviados. */
export const sentTranslationFields = (draft, preview, target) => {
  const text = String(draft || '').trim();
  if (
    !text || preview?.status !== 'done' || preview.forText !== text || preview.target !== target
    || !preview.text || preview.sameLanguage
  ) {
    return null;
  }
  return {
    translation_text: preview.text,
    translation_lang: target,
    translation_source: preview.sourceLang || '',
  };
};

/** Cuerpo de la petición de vista previa (el idioma de origen lo detecta el servidor). */
export const livePreviewRequest = (draft, target) => ({
  text: String(draft || '').trim(),
  target,
});

