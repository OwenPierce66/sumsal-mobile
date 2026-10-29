/**
 * __tests__/components/FollowHeart.test.js
 *
 * Corazón de seguir: cada toque sube un nivel (seguir → favorito), ya en favoritos
 * abre el menú, y mantenerlo presionado abre el menú en cualquier nivel.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '../../api';
import FollowHeart from '../../components/FollowHeart';

jest.mock('../../api', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ data: {} })), delete: jest.fn(() => Promise.resolve({ data: {} })) },
}));
const mockRelations = { state: 'none' };
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({
    ready: true,
    getState: () => mockRelations.state,
    setStateLocally: (_id, next) => { mockRelations.state = next; },
    refresh: () => {},
  }),
}));

let mounted;
afterEach(() => { act(() => mounted?.unmount()); mounted = null; jest.clearAllMocks(); });

const render = async () => {
  await act(async () => { mounted = TestRenderer.create(<FollowHeart userId="ana" username="ana" />); });
  return mounted;
};
const heart = (renderer) => renderer.root.findAll((n) => n.props.onLongPress && n.props.accessibilityLabel)[0];
const press = async (renderer) => {
  await act(async () => { await heart(renderer).props.onPress(); });
  act(() => renderer.update(<FollowHeart userId="ana" username="ana" />));
};
const menuTexts = (renderer) => renderer.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

describe('FollowHeart', () => {
  it('primer toque sigue, segundo agrega a favoritos y el tercero abre el menú', async () => {
    mockRelations.state = 'none';
    const renderer = await render();

    await press(renderer);
    expect(api.post).toHaveBeenLastCalledWith('users/ana/follow/');
    expect(heart(renderer).props.accessibilityLabel).toBe('Agregar a ana a favoritos');

    await press(renderer);
    expect(api.post).toHaveBeenLastCalledWith('pfavoritos/agregar/', { perfil_id: 'ana' });

    await press(renderer);
    expect(menuTexts(renderer)).toEqual(expect.arrayContaining(['Anclar en mi top 5', 'Quitar de favoritos', 'Dejar de seguir']));
  });

  it('mantener presionado abre el menú aunque solo lo sigas, y dejar de seguir quita todo', async () => {
    mockRelations.state = 'following';
    const renderer = await render();
    await act(async () => { heart(renderer).props.onLongPress(); });
    expect(menuTexts(renderer)).toEqual(expect.arrayContaining(['Agregar a favoritos', 'Dejar de seguir']));

    const unfollow = renderer.root.findAll((n) => n.props.onPress && n.findAll((c) => c.type === Text
      && [].concat(c.props.children).join('') === 'Dejar de seguir').length).pop();
    await act(async () => { await unfollow.props.onPress(); });
    expect(api.delete).toHaveBeenCalledWith('users/ana/follow/');
    expect(mockRelations.state).toBe('none');
  });
});
