/**
 * __tests__/components/CategoryHeader.test.js
 *
 * Cabecera de la categoría elegida en el feed: imagen y descripción (un admin las edita).
 */
import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import CategoryHeader, { findCategoryNode } from '../../components/CategoryHeader';

jest.mock('@api', () => ({
  __esModule: true,
  default: { patch: jest.fn() },
  UPLOAD_TIMEOUT_MS: 1000,
  getImageUrl: (path) => (path ? path.replace(/^https?:\/\/[^/]+/, 'http://api:8001') : null),
}));
jest.mock('../../utils/mediaUpload', () => ({ appendMediaFile: jest.fn() }));

const CATEGORIES = [
  { id: 1, name: 'Programación', parent: null, description: 'Código y apps.', image_url: 'http://x/prog.png' },
  { id: 2, name: 'React', parent: 1, description: '', image_url: null },
  { id: 3, name: 'React', parent: null, description: 'Otro React', image_url: null },
];
const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string').join(''));

it('encuentra la categoría siguiendo la ruta nivel por nivel', () => {
  expect(findCategoryNode(CATEGORIES, 'Programación').id).toBe(1);
  expect(findCategoryNode(CATEGORIES, 'programación, react').id).toBe(2);
  expect(findCategoryNode(CATEGORIES, 'React').id).toBe(3);
  expect(findCategoryNode(CATEGORIES, '')).toBeNull();
});

it('muestra imagen y descripción; sin nada no se ve (salvo para un admin)', async () => {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<CategoryHeader categories={CATEGORIES} path="Programación" />); });
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Programación', 'Código y apps.']));
  await act(async () => { renderer.update(<CategoryHeader categories={CATEGORIES} path="Programación,React" />); });
  expect(renderer.toJSON()).toBeNull();
  await act(async () => { renderer.update(<CategoryHeader categories={CATEGORIES} path="Programación,React" isAdmin />); });
  expect(textsOf(renderer).join(' ')).toContain('Agrega una imagen y una descripción');
  act(() => renderer.unmount());
});

it('un admin edita la descripción', async () => {
  api.patch.mockResolvedValueOnce({ data: { id: 1, description: 'Todo sobre código.' } });
  const onUpdated = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<CategoryHeader categories={CATEGORIES} path="Programación" isAdmin onUpdated={onUpdated} />);
  });
  const edit = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Editar presentación de la categoría' && node.props.onPress)[0];
  await act(async () => { edit.props.onPress(); });
  await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('Todo sobre código.'); });
  const save = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Guardar presentación' && node.props.onPress)[0];
  await act(async () => { await save.props.onPress(); });
  expect(api.patch).toHaveBeenCalledWith('new-categories/1/', expect.any(FormData), { timeout: 1000 });
  expect(onUpdated).toHaveBeenCalledWith({ id: 1, description: 'Todo sobre código.' });
  act(() => renderer.unmount());
});

it('versión grande: se ve aunque esté vacía, sin el aviso de admin, y con sus acciones', async () => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <CategoryHeader categories={CATEGORIES} path="Programación,React" variant="hero" showEmpty>
        <Text>Ver publicaciones</Text>
      </CategoryHeader>,
    );
  });
  const texts = textsOf(renderer);
  expect(texts).toEqual(expect.arrayContaining(['React', 'Ver publicaciones']));
  expect(texts.join(' ')).not.toContain('Agrega una imagen');
  act(() => renderer.unmount());
});

it('la imagen usa la dirección del servidor de la app (no la que trae el backend)', async () => {
  const { Image } = require('expo-image');
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<CategoryHeader categories={CATEGORIES} path="Programación" />); });
  expect(renderer.root.findByType(Image).props.source).toEqual({ uri: 'http://api:8001/prog.png' });
  act(() => renderer.unmount());
});
