/**
 * utils/mediaLayout.js
 *
 * Medidas de fotos y videos para mostrarlos sin deformarlos ni recortarlos de más:
 * - En el feed cada medio usa su propia forma, entre 4:5 (vertical) y 1.91:1 (horizontal),
 *   y sin pasar de una altura máxima (en la web el feed ocupa todo el ancho).
 * - En reels llena la pantalla solo si su forma se parece a la de la pantalla; si no, se ve
 *   completo con un fondo.
 * Las formas ya medidas se recuerdan por URL para que no salten al volver a verlas.
 */
import { useCallback, useState } from 'react';

export const FEED_MIN_RATIO = 4 / 5;
export const FEED_MAX_RATIO = 1.91;
export const FEED_DEFAULT_RATIO = 1;
export const FEED_MAX_HEIGHT = 520;
// Cuánto puede diferir la forma del medio de la de la pantalla para llenarla (recortando).
const FILL_TOLERANCE = 1.3;
const MAX_REMEMBERED = 500;

const remembered = new Map();

export const ratioOf = (size) => (size?.width > 0 && size?.height > 0 ? size.width / size.height : null);

export const rememberedRatio = (uri) => (uri ? remembered.get(uri) ?? null : null);

export function rememberRatio(uri, ratio) {
  if (!uri || !ratio) return;
  if (!remembered.has(uri) && remembered.size >= MAX_REMEMBERED) {
    remembered.delete(remembered.keys().next().value);
  }
  remembered.set(uri, ratio);
}

/** La forma con la que se muestra en el feed (la suya, dentro de los límites). */
export const feedRatio = (ratio) => Math.min(FEED_MAX_RATIO, Math.max(FEED_MIN_RATIO, ratio || FEED_DEFAULT_RATIO));

/** El tamaño en el feed para un ancho disponible: su forma, sin pasar de la altura máxima. */
export function feedMediaBox(ratio, availableWidth) {
  const shape = feedRatio(ratio);
  const height = Math.min(availableWidth / shape, FEED_MAX_HEIGHT);
  return { width: Math.round(height * shape), height: Math.round(height) };
}

/** En reels: true si el medio llena la pantalla (mientras no se conoce su forma, también). */
export const fillsBox = (mediaRatio, boxRatio) => (
  !mediaRatio || !boxRatio || Math.abs(Math.log(mediaRatio / boxRatio)) <= Math.log(FILL_TOLERANCE)
);

/** Tamaño de una foto desde el onLoad de expo-image. */
export const imageSizeFromLoad = (event) => event?.source || null;

/** Tamaño de un video desde el onReadyForDisplay de expo-av (celular o web). */
export function videoSizeFromReady(event) {
  const natural = event?.naturalSize;
  if (natural?.width && natural?.height) {
    // Algunos celulares dan el tamaño sin rotar: la orientación lo corrige.
    const rotated = natural.orientation === 'portrait' && natural.width > natural.height;
    return rotated ? { width: natural.height, height: natural.width } : { width: natural.width, height: natural.height };
  }
  // En la web llega el evento del <video>.
  const element = event?.target || event?.srcElement;
  if (element?.videoWidth && element?.videoHeight) return { width: element.videoWidth, height: element.videoHeight };
  return null;
}

/** [forma conocida de `uri` (o null), función para avisar su tamaño cuando carga]. */
export function useMediaRatio(uri) {
  const [measured, setMeasured] = useState(null);
  const ratio = measured?.uri === uri ? measured.ratio : rememberedRatio(uri);
  const onSize = useCallback((size) => {
    const next = ratioOf(size);
    if (!next) return;
    rememberRatio(uri, next);
    setMeasured((current) => (current?.uri === uri && current.ratio === next ? current : { uri, ratio: next }));
  }, [uri]);
  return [ratio, onSize];
}
