/**
 * utils/externalShare.js
 *
 * Compartir en otras apps (WhatsApp, Instagram, correo...) con el menú del sistema.
 * El enlace usa las rutas de la app web (ver `linking` en App.js): en la web, el dominio
 * donde se abrió la app; en el teléfono, `expo.extra.webUrl` de app.json (sin él se
 * comparte solo el texto).
 */
import { Alert, Platform, Share } from 'react-native';
import Constants from 'expo-constants';

const webBase = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const configured = Constants.expoConfig?.extra?.webUrl;
  return configured ? String(configured).replace(/\/+$/, '') : null;
};

const linkTo = (path) => {
  const base = webBase();
  return base ? `${base}/${path}` : null;
};

export const taskShareLink = (taskId) => (taskId ? linkTo(`tasks/${taskId}`) : null);
export const profileShareLink = (userId) => (userId ? linkTo(`user/${userId}`) : null);

const notify = (message) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
  else Alert.alert('Compartir', message);
};

/**
 * Abre el menú de compartir del sistema. En la web, si el navegador no lo tiene,
 * copia el enlace. Devuelve 'shared' | 'copied' | 'cancelled' | 'unavailable'.
 */
export async function shareExternally({ title, text, link }) {
  const message = [title, text, link].filter(Boolean).join('\n');
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.share) {
      try {
        await nav.share({ title, text: [title, text].filter(Boolean).join('\n'), url: link || undefined });
        return 'shared';
      } catch (error) {
        if (error?.name === 'AbortError') return 'cancelled';
      }
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(link || message);
      notify(link ? 'Enlace copiado. Pégalo donde quieras compartirlo.' : 'Texto copiado.');
      return 'copied';
    }
    notify('Tu navegador no permite compartir desde aquí.');
    return 'unavailable';
  }
  const result = await Share.share(link ? { message, url: link, title } : { message, title });
  return result?.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
