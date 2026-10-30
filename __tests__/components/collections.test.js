/**
 * __tests__/components/collections.test.js
 *
 * Colecciones (álbumes) de guardados: el selector del menú de 3 puntos y el panel de Favoritos.
 */
import React from 'react';
import { Switch, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import CollectionPickerSheet from '../../components/CollectionPickerSheet';
import SaveCollectionsPanel from '../../components/SaveCollectionsPanel';

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));
const mockData = {};
jest.mock('@hooks/useApi', () => ({
  useCollections: () => ({ data: mockData.collections, isLoading: false }),
  useCollection: () => ({ data: mockData.collection, isLoading: false, refetch: jest.fn() }),
}));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));
const byLabel = (renderer, label) => renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];
const press = async (renderer, label) => { await act(async () => { await byLabel(renderer, label).props.onPress(); }); };

beforeEach(() => {
  ['get', 'post', 'patch', 'delete'].forEach((method) => api[method].mockReset());
  mockInvalidate.mockReset();
});

describe('CollectionPickerSheet', () => {
  it('marca, desmarca y crea una colección con la publicación', async () => {
    api.get.mockResolvedValueOnce({ data: [
      { id: 'c1', name: 'Estudios', count: 2, is_private: true, contains: false },
      { id: 'c2', name: 'Recetas', count: 1, is_private: false, contains: true },
    ] });
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<CollectionPickerSheet visible taskId="t1" onClose={jest.fn()} />); });
    expect(api.get).toHaveBeenCalledWith('tasks/t1/collections/');
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Estudios', '2 publicaciones · solo tú', 'Recetas']));

    api.post.mockResolvedValueOnce({ data: { id: 'c1', count: 3 } });
    await press(renderer, 'Estudios');
    expect(api.post).toHaveBeenCalledWith('collections/c1/items/', { task_id: 't1' });
    api.delete.mockResolvedValueOnce({ data: { id: 'c2', count: 0 } });
    await press(renderer, 'Recetas');
    expect(api.delete).toHaveBeenCalledWith('collections/c2/items/t1/');

    api.post
      .mockResolvedValueOnce({ data: { id: 'c3', name: 'Viajes', count: 0, is_private: true } })
      .mockResolvedValueOnce({ data: { id: 'c3', count: 1 } });
    await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('Viajes'); });
    await press(renderer, 'Crear colección');
    expect(api.post).toHaveBeenCalledWith('collections/', { name: 'Viajes' });
    expect(api.post).toHaveBeenLastCalledWith('collections/c3/items/', { task_id: 't1' });
    expect(textsOf(renderer)).toContain('Viajes');
    act(() => renderer.unmount());
  });
});

describe('SaveCollectionsPanel', () => {
  it('lista mis colecciones, abre una y cambia si es pública', async () => {
    mockData.collections = [{ id: 'c1', name: 'Estudios', count: 1, is_private: true }];
    mockData.collection = {
      id: 'c1', name: 'Estudios', is_private: true, is_owner: true,
      items: [{ id: 1, task: { id: 't1', title: 'Guía de becas', user: { username: 'luis' } } }],
    };
    const navigation = { navigate: jest.fn() };
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<SaveCollectionsPanel navigation={navigation} />); });
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Estudios', '1 publicación']));

    await press(renderer, 'Abrir colección Estudios');
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Guía de becas', 'Solo tú la ves']));
    api.patch.mockResolvedValueOnce({ data: {} });
    await act(async () => { await renderer.root.findByType(Switch).props.onValueChange(true); });
    expect(api.patch).toHaveBeenCalledWith('collections/c1/', { is_private: false });

    await press(renderer, 'Abrir Guía de becas');
    expect(navigation.navigate).toHaveBeenCalledWith('TaskDetail', { taskId: 't1' });
    act(() => renderer.unmount());
  });

  it('de otra persona solo muestra y no deja crear', async () => {
    mockData.collections = [];
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<SaveCollectionsPanel userId="luis" navigation={{ navigate: jest.fn() }} />); });
    expect(textsOf(renderer)).toContain('No tiene colecciones públicas.');
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
    act(() => renderer.unmount());
  });
});
