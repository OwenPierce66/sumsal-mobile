/**
 * __tests__/components/ContentActionsMenu.test.js
 *
 * Menú de 3 puntos de comentarios y posts: lo propio (responder, editar, eliminar) y,
 * de otra persona, su perfil, mensaje, foro, seguir / favoritos / top 5 y reportar.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import ContentActionsButton from '../../components/ContentActionsMenu';

jest.mock('@api', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ data: {} })), delete: jest.fn(() => Promise.resolve({ data: {} })) },
  getImageUrl: (path) => path || null,
}));
const mockSetState = jest.fn();
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({ ready: true, getState: () => 'none', setStateLocally: mockSetState }),
}));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));
const byLabel = (renderer, label) => renderer.root.findAll((n) => n.props.accessibilityLabel === label && n.props.onPress)[0];
const press = async (renderer, label) => {
  const target = byLabel(renderer, label);
  if (!target) throw new Error(`No hay opción "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

let mounted;
let navigation;
beforeEach(() => {
  navigation = { navigate: jest.fn() };
  api.post.mockClear();
  mockSetState.mockClear();
});
afterEach(() => { act(() => mounted?.unmount()); mounted = null; });

const render = async (props) => {
  await act(async () => {
    mounted = TestRenderer.create(
      <ContentActionsButton
        accessibilityLabel="Más opciones del comentario"
        navigation={navigation}
        report={{ targetType: 'comment', targetId: 10 }}
        {...props}
      />,
    );
  });
  await press(mounted, 'Más opciones del comentario');
  return mounted;
};

it('en lo propio: responder, editar y eliminar; sin opciones de perfil ni reportar', async () => {
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  const renderer = await render({
    author: { id: 'me', username: 'yo' },
    currentUserId: 'me',
    onReply: jest.fn(),
    onEdit,
    onDelete,
    editLabel: 'Editar comentario',
    deleteLabel: 'Eliminar comentario',
  });
  const texts = textsOf(renderer);
  expect(texts).toEqual(expect.arrayContaining(['Responder', 'Editar comentario', 'Eliminar comentario']));
  expect(texts).not.toContain('Seguir');
  expect(texts).not.toContain('Reportar');

  await press(renderer, 'Eliminar comentario');
  expect(onDelete).toHaveBeenCalled();
});

it('de otra persona: perfil, mensaje, foro, seguir, favoritos, top 5 y reportar', async () => {
  const renderer = await render({ author: { id: 'ana', username: 'ana' }, currentUserId: 'me' });
  expect(textsOf(renderer)).toEqual(expect.arrayContaining([
    'Ver perfil de @ana', 'Mensaje directo', 'Ir al foro de @ana', 'Seguir',
    'Agregar perfil a favoritos', 'Anclar perfil en top 5', 'Reportar',
  ]));

  await press(renderer, 'Seguir');
  expect(api.post).toHaveBeenCalledWith('users/ana/follow/');
  expect(mockSetState).toHaveBeenCalledWith('ana', 'following');

  await press(renderer, 'Más opciones del comentario');
  await press(renderer, 'Mensaje directo');
  expect(navigation.navigate).toHaveBeenCalledWith('ChatDetail', expect.objectContaining({ chatId: 'ana', type: 'direct' }));

  await press(renderer, 'Más opciones del comentario');
  await press(renderer, 'Reportar');
  expect(textsOf(renderer)).toContain('Reportar contenido');
});
