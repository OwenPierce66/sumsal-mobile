/**
 * hooks/useDownloadTask.js
 *
 * Opción "Descargar" de los menús de 3 puntos: guarda las imágenes y videos
 * de una aportación y avisa cómo salió.
 */
import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { DownloadPermissionError, downloadMedia, getDownloadableMedia } from '../utils/download';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function useDownloadTask() {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadTask = useCallback(async (task) => {
    const media = getDownloadableMedia(task);
    if (media.length === 0) {
      Alert.alert('Nada para descargar', 'Esta aportación no tiene imágenes ni videos.');
      return;
    }

    setIsDownloading(true);
    try {
      const { saved, failed } = await downloadMedia(media);
      const where = Platform.OS === 'web' ? 'Se descargaron' : 'Se guardaron en tu galería';
      if (saved === 0) {
        Alert.alert('No se pudo descargar', 'Revisa tu conexión e intenta de nuevo.');
      } else {
        Alert.alert(
          'Descarga lista',
          `${where} ${plural(saved, 'archivo', 'archivos')}.`
            + (failed ? ` ${plural(failed, 'no se pudo', 'no se pudieron')} descargar.` : ''),
        );
      }
    } catch (error) {
      if (error instanceof DownloadPermissionError) {
        Alert.alert('Permiso necesario', 'Para descargar, permite que la app guarde en tu galería desde los ajustes del teléfono.');
      } else {
        Alert.alert('No se pudo descargar', 'Revisa tu conexión e intenta de nuevo.');
      }
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return { downloadTask, isDownloading };
}
