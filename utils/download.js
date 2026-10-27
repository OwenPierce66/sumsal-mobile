/**
 * utils/download.js
 *
 * Descarga las imágenes y videos de una aportación (principal, consejos,
 * factores y fuentes). En el teléfono se guardan en la galería; en la web se
 * descargan desde el navegador.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { getImageUrl } from '@api';
import { buildPlaylists } from '../screens/reelUtils';

export class DownloadPermissionError extends Error {}

/** Imágenes y videos de la aportación (o de la que se compartió), sin repetidos. */
export function getDownloadableMedia(task) {
  const source = task?.isSharedTask ? (task.task || task) : task;
  if (!source) return [];
  const seen = new Set();
  return buildPlaylists(source).main
    .map((entry) => ({ url: getImageUrl(entry.src), type: entry.type === 'video' ? 'video' : 'image' }))
    .filter((media) => media.url && !seen.has(media.url) && seen.add(media.url));
}

/** Nombre de archivo seguro, conservando el del servidor cuando se puede. */
export function fileNameFor(media, index) {
  const fallbackExt = media.type === 'video' ? 'mp4' : 'jpg';
  const last = decodeURIComponent(String(media.url).split('?')[0].split('#')[0].split('/').pop() || '');
  const clean = last.replace(/[^\w.-]+/g, '_').slice(-80);
  if (/\.[a-z0-9]{2,5}$/i.test(clean)) return `${index + 1}-${clean}`;
  return `aportacion-${index + 1}.${fallbackExt}`;
}

async function downloadOnWeb(media, name) {
  try {
    const response = await fetch(media.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  } catch {
    // Si el servidor no deja leer el archivo (CORS), al menos se abre para guardarlo a mano.
    window.open(media.url, '_blank', 'noopener');
  }
}

async function saveOnDevice(media, name) {
  const target = `${FileSystem.cacheDirectory}${Date.now()}-${name}`;
  const result = await FileSystem.downloadAsync(media.url, target);
  try {
    if (result.status >= 400) throw new Error(`HTTP ${result.status}`);
    await MediaLibrary.saveToLibraryAsync(result.uri);
  } finally {
    FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
  }
}

/** Descarga todo. Devuelve cuántos se guardaron y cuántos fallaron. */
export async function downloadMedia(mediaList) {
  if (Platform.OS !== 'web') {
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) throw new DownloadPermissionError();
  }

  let saved = 0;
  let failed = 0;
  for (let i = 0; i < mediaList.length; i += 1) {
    const name = fileNameFor(mediaList[i], i);
    try {
      if (Platform.OS === 'web') await downloadOnWeb(mediaList[i], name);
      else await saveOnDevice(mediaList[i], name);
      saved += 1;
    } catch {
      failed += 1;
    }
  }
  return { saved, failed };
}
