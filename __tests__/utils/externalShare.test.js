/**
 * __tests__/utils/externalShare.test.js
 *
 * Compartir en otras apps: el menú del sistema con el enlace a la publicación o al perfil.
 */
import { Platform, Share } from 'react-native';
import { profileShareLink, shareExternally, taskShareLink } from '../../utils/externalShare';

jest.mock('expo-constants', () => ({ expoConfig: { extra: { webUrl: 'https://aportaciones.app/' } } }));

afterEach(() => { jest.restoreAllMocks(); });

it('arma los enlaces con las rutas de la app web', () => {
  expect(taskShareLink('t1')).toBe('https://aportaciones.app/tasks/t1');
  expect(profileShareLink('u1')).toBe('https://aportaciones.app/user/u1');
  expect(taskShareLink(null)).toBeNull();
});

it('en el teléfono abre el menú de compartir con el texto y el enlace', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const result = await shareExternally({ title: 'Guía de becas', text: 'Paso a paso', link: 'https://aportaciones.app/tasks/t1' });
  expect(result).toBe('shared');
  expect(share).toHaveBeenCalledWith({
    message: 'Guía de becas\nPaso a paso\nhttps://aportaciones.app/tasks/t1',
    url: 'https://aportaciones.app/tasks/t1',
    title: 'Guía de becas',
  });
});

it('en la web sin menú de compartir copia el enlace', async () => {
  const originalOS = Platform.OS;
  Platform.OS = 'web';
  const writeText = jest.fn(() => Promise.resolve());
  global.navigator.clipboard = { writeText };
  global.window.alert = jest.fn();
  try {
    const result = await shareExternally({ title: 'Guía', link: 'http://localhost/tasks/t1' });
    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('http://localhost/tasks/t1');
  } finally {
    Platform.OS = originalOS;
    delete global.navigator.clipboard;
  }
});
