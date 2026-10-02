/**
 * utils/compressImage.js
 *
 * Comprime imágenes antes de subirlas al servidor.
 *
 * ┌─ POR QUÉ ────────────────────────────────────────────────────────────────┐
 * │ Los usuarios pueden seleccionar fotos de 10-20 MB directamente desde     │
 * │ su cámara o galería. Subir esas imágenes sin comprimir:                  │
 * │   • Consume mucho ancho de banda del usuario (datos móviles)             │
 * │   • Satura el servidor y Nginx (timeouts en uploads lentos)              │
 * │   • Ocupa espacio innecesario en el servidor                             │
 * │                                                                          │
 * │ Esta utilidad comprime a ≤1280px de ancho y calidad JPEG al 82%,        │
 * │ reduciendo archivos típicos de 5-15 MB a 200-600 KB sin pérdida visual. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Uso:
 *   import { compressImage } from '../utils/compressImage';
 *
 *   // Devuelve el asset original si ya es pequeña, o el comprimido si no
 *   const compressed = await compressImage(result.assets[0]);
 *   // compressed.uri  → URI del archivo resultante
 *   // compressed.width, compressed.height → dimensiones finales
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** Ancho máximo de salida en px. Mantiene la proporción original. */
const MAX_WIDTH = 1280;

/** Calidad JPEG (0–1). 0.82 es imperceptible visualmente para fotos. */
const JPEG_QUALITY = 0.82;

/**
 * Comprime una imagen si es necesario.
 *
 * @param {{ uri: string, width?: number, height?: number, fileSize?: number }} asset
 *   El objeto asset devuelto por expo-image-picker (result.assets[0]).
 * @returns {Promise<{ uri: string, width: number, height: number }>}
 *   El asset comprimido (o el original si ya cumplía los límites).
 */
export async function compressImage(asset) {
  if (!asset?.uri) return asset;

  // En web no aplicamos compresión — expo-image-manipulator tiene soporte
  // limitado en web y el navegador ya gestiona la memoria eficientemente.
  if (Platform.OS === 'web') return asset;

  // Si el ancho ya es menor al límite, solo re-codificamos a JPEG para
  // reducir el tamaño de archivo (las fotos de iPhone son HEIC/HEIF en iOS).
  const actions = [];
  if (asset.width && asset.width > MAX_WIDTH) {
    actions.push({ resize: { width: MAX_WIDTH } });
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      actions,
      {
        compress: JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result; // { uri, width, height }
  } catch (err) {
    // Si la compresión falla por cualquier razón, usamos la imagen original
    // para no bloquear al usuario.
    console.warn('[compressImage] Compresión fallida, usando original:', err?.message);
    return asset;
  }
}

/**
 * Comprime múltiples imágenes en paralelo.
 *
 * @param {Array<{ uri: string, width?: number, height?: number }>} assets
 * @returns {Promise<Array<{ uri: string, width: number, height: number }>>}
 */
export async function compressImages(assets) {
  if (!Array.isArray(assets)) return assets;
  return Promise.all(assets.map(compressImage));
}
