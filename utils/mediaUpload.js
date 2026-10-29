/**
 * Fotos y videos elegidos de la galería para subirlos en un FormData (chat, comentarios).
 * En la web el archivo se manda como Blob; en el celular como { uri, name, type }.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export const getMediaExtension = (mimeType, fallback = 'bin') => {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  return fallback;
};

export const getAssetMimeType = (asset) => {
  const declaredMime = String(asset?.mimeType || '').toLowerCase();
  if (declaredMime) return declaredMime;

  const uriMimeMatch = String(asset?.uri || '').match(/^data:([^;,]+)/i);
  return uriMimeMatch?.[1]?.toLowerCase() || '';
};

export const isVideoAsset = (asset) => {
  const uri = String(asset?.uri || '').toLowerCase();
  const name = String(asset?.fileName || asset?.name || '').toLowerCase();
  const mimeType = getAssetMimeType(asset);
  return asset?.type === 'video'
    || mimeType.startsWith('video/')
    || /^video\//.test(String(asset?.type || '').toLowerCase())
    || uri.startsWith('data:video/')
    || /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(name)
    || /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(uri);
};

/** Abre la galería para elegir una foto o un video; null si se cancela. */
export async function pickPhotoOrVideo() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsEditing: false,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

/** Agrega la foto o el video `asset` al FormData en el campo `field`. */
export async function appendMediaFile(formData, field, asset) {
  const isVideo = isVideoAsset(asset);
  const sourceMimeType = getAssetMimeType(asset);
  const fileName = asset.fileName || asset.name || '';
  const nameExtension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const fileType = getMediaExtension(sourceMimeType, nameExtension || (isVideo ? 'mp4' : 'jpg'));
  const finalType = sourceMimeType.startsWith(isVideo ? 'video/' : 'image/')
    ? sourceMimeType
    : (isVideo ? 'video/mp4' : 'image/jpeg');

  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    const ext = getMediaExtension(blob.type || finalType, fileType);
    formData.append(field, blob, `media.${ext}`);
    return;
  }
  formData.append(field, { uri: asset.uri, name: `media.${fileType}`, type: finalType });
}
