/**
 * __tests__/utils/socialLinks.test.js
 *
 * Redes sociales del perfil: de lo que escribe la persona al enlace que abre cada red.
 */
import React from 'react';
import { Linking, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { filledSocialLinks, socialUrl } from '../../utils/socialLinks';
import SocialLinks from '../../components/SocialLinks';

it('arma el enlace de cada red desde usuario, @usuario, enlace o número', () => {
  expect(socialUrl('instagram', '@ana.becas')).toBe('https://instagram.com/ana.becas');
  expect(socialUrl('tiktok', 'ana')).toBe('https://www.tiktok.com/@ana');
  expect(socialUrl('youtube', 'https://youtube.com/c/Ana')).toBe('https://youtube.com/c/Ana');
  expect(socialUrl('x', '@ana')).toBe('https://x.com/ana');
  expect(socialUrl('linkedin', 'linkedin.com/in/ana/')).toBe('https://linkedin.com/in/ana/');
  expect(socialUrl('website', 'ana.dev')).toBe('https://ana.dev');
  expect(socialUrl('whatsapp', '+52 55 1234 5678')).toBe('https://wa.me/525512345678');
  expect(socialUrl('instagram', '   ')).toBeNull();
});

it('solo muestra las redes con algo escrito y las abre', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  expect(filledSocialLinks({ x: '@ana', tiktok: '', website: 'ana.dev' }).map((item) => item.key)).toEqual(['x', 'website']);

  let renderer;
  await act(async () => { renderer = TestRenderer.create(<SocialLinks links={{ instagram: '@ana', whatsapp: '5512345678' }} />); });
  const buttons = renderer.root.findAllByType(TouchableOpacity);
  expect(buttons.map((node) => node.props.accessibilityLabel)).toEqual(['Abrir Instagram', 'Abrir WhatsApp']);
  await act(async () => { buttons[1].props.onPress(); });
  expect(open).toHaveBeenCalledWith('https://wa.me/5512345678');

  await act(async () => { renderer.update(<SocialLinks links={{}} />); });
  expect(renderer.toJSON()).toBeNull();
  open.mockRestore();
});
