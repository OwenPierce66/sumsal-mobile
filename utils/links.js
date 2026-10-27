/**
 * utils/links.js
 *
 * Enlaces dentro del texto de las descripciones (de la aportación y de sus
 * consejos, factores y fuentes). La web antigua los guardaba en un campo aparte
 * (a veces como "undefined"); ahora van escritos en la descripción y se abren al
 * tocarlos.
 */

const EMPTY_VALUES = new Set(['', 'undefined', 'null']);
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const NON_WEB_SCHEME = /^(mailto|tel|sms|javascript|data|file|vbscript|intent):/i;
// Solo http(s):// o www., para no confundir textos como "archivo.pdf" con enlaces.
const URL_IN_TEXT = /(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'"»”’]$/;

/** Limpia un enlace suelto: sin espacios y con https:// si falta el esquema. */
export function normalizeLink(raw) {
  const value = String(raw ?? '').trim();
  if (EMPTY_VALUES.has(value.toLowerCase())) return '';
  if (HAS_SCHEME.test(value) || NON_WEB_SCHEME.test(value)) return value;
  return `https://${value.replace(/^\/+/, '')}`;
}

function linkHost(url) {
  const match = /^https?:\/\/([^/?#]+)/i.exec(url);
  if (!match) return '';
  return match[1].split('@').pop().split(':')[0];
}

/** URL lista para abrir, o null si no es un enlace web válido. */
export function getSafeLink(raw) {
  const value = normalizeLink(raw);
  if (!value || /\s/.test(value)) return null;
  return linkHost(value).includes('.') ? value : null;
}

/** Quita la puntuación pegada al final: "mira https://x.com." o "(https://x.com)". */
function trimTrailingPunctuation(url) {
  let result = url;
  for (;;) {
    if (TRAILING_PUNCTUATION.test(result)) {
      result = result.slice(0, -1);
    } else if (
      result.endsWith(')')
      && (result.match(/\(/g) || []).length < (result.match(/\)/g) || []).length
    ) {
      result = result.slice(0, -1);
    } else {
      return result;
    }
  }
}

/**
 * Parte un texto en trozos: [{ text }] para texto normal y [{ text, url }] para
 * enlaces, en el mismo orden. `text` conserva lo que escribió la persona.
 */
export function splitTextWithLinks(text) {
  const value = String(text ?? '');
  const parts = [];
  const pattern = new RegExp(URL_IN_TEXT.source, 'gi');
  let last = 0;
  let match;
  while ((match = pattern.exec(value)) !== null) {
    const raw = trimTrailingPunctuation(match[0]);
    const url = getSafeLink(raw);
    if (!url) continue;
    if (match.index > last) parts.push({ text: value.slice(last, match.index) });
    parts.push({ text: raw, url });
    last = match.index + raw.length;
  }
  if (last < value.length) parts.push({ text: value.slice(last) });
  return parts;
}

/**
 * Descripción con el enlace que la web guardaba aparte, agregado al final si no
 * estaba ya escrito en el texto. Así el enlace queda incorporado en la descripción.
 */
export function withLegacyLink(description, link) {
  const text = String(description ?? '');
  const url = getSafeLink(link);
  if (!url) return text;
  const raw = String(link).trim();
  if (text.includes(raw) || text.includes(url)) return text;
  return text.trim() ? `${text.replace(/\s+$/, '')}\n${url}` : url;
}
