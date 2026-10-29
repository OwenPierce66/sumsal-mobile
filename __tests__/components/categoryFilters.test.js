/**
 * __tests__/components/categoryFilters.test.js
 *
 * El filtro por categorías y subcategorías (niveles) en todas partes: utilidades, la barra
 * del filtro, el selector al publicar en el foro, el filtrado de perfiles y el foro.
 */
import React, { useState } from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import {
  categoryPathId, filterByCategoryPath, limitCategoryTree, matchesCategoryPath, mergeCategoryTrees, withCustomPaths,
} from '../../utils/categoryFilter';
import CategoryFilterBar from '../../components/CategoryFilterBar';
import CategoryPicker from '../../components/CategoryPicker';
import { useUsersInCategory } from '../../hooks/useCategoryFilter';
import ForumScreen from '../../screens/ForumScreen';

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  getImageUrl: (path) => path || null,
  UPLOAD_TIMEOUT_MS: 1000,
}));

// Categorías de la app (dos PCH con "Programación") y las propias.
const APP = [
  { id: 1, name: 'Programación', parent: null },
  { id: 2, name: 'React', parent: 1 },
  { id: 3, name: 'Hooks', parent: 2 },
  { id: 4, name: 'Salud', parent: null },
  { id: 10, name: 'Programación', parent: null },
  { id: 11, name: 'Python', parent: 10 },
  { id: 12, name: 'aprobada', parent: null },
];
const mockStore = { app: APP, mine: [], posts: null };
const mockUsePostsInfinite = jest.fn();
const mockCreatePost = jest.fn(() => Promise.resolve());
const mockEditPost = jest.fn(() => Promise.resolve());
jest.mock('@hooks/useApi', () => ({
  useCategories: () => ({ data: mockStore.app, isLoading: false }),
  useMe: () => ({ data: { id: 'me' } }),
  usePostsInfinite: (...args) => mockUsePostsInfinite(...args),
  usePostMutations: () => ({
    createPost: { mutateAsync: mockCreatePost, isPending: false },
    editPost: { mutateAsync: mockEditPost, isPending: false },
    deletePost: { mutate: jest.fn() },
    likePost: { mutate: jest.fn(), isPending: false },
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }) => ({ data: queryKey[0] === 'myCategories' ? mockStore.mine : undefined }),
  useQueryClient: () => ({
    setQueryData: (key, updater) => { mockStore.mine = updater(mockStore.mine); },
  }),
}));
jest.mock('../../hooks/useIsOnline', () => ({ useIsOnline: () => true }));
jest.mock('@components/FollowHeart', () => () => null);
jest.mock('@components/ContentActionsMenu', () => () => null);
jest.mock('@components/TouchableUsername', () => {
  const { Text: MockText } = require('react-native');
  return ({ username }) => <MockText>{username}</MockText>;
});
jest.mock('@components/MessageExtras', () => ({
  useMessageExtras: () => ({
    clip: null, preview: null, pickers: null, hasMedia: false,
    buildBody: async (fields) => fields, reset: jest.fn(),
  }),
  MessageExtrasView: () => null,
}));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string').join(''));
const byLabel = (renderer, label) => renderer.root.findAll((n) => n.props.accessibilityLabel === label && n.props.onPress)[0];
const pressLabel = async (renderer, label) => {
  const target = byLabel(renderer, label);
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((c) => c.type === Text && [].concat(c.props.children).join('') === label).length > 0
  )).pop();
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};
const typeInto = async (renderer, placeholder, text, submit = false) => {
  const input = renderer.root.findAllByType(TextInput).find((node) => String(node.props.placeholder || '').startsWith(placeholder));
  if (!input) throw new Error(`No hay campo "${placeholder}"`);
  await act(async () => { input.props.onChangeText(text); });
  if (submit) await act(async () => { await input.props.onSubmitEditing(); });
};

beforeEach(() => {
  mockStore.app = APP;
  mockStore.mine = [{ id: 50, name: 'Huerto', parent: null }, { id: 51, name: 'Riego', parent: 50 }];
  api.post.mockReset();
  mockUsePostsInfinite.mockReset();
  mockCreatePost.mockClear();
});

describe('utils/categoryFilter', () => {
  it('una ruta pide todas sus partes, sin importar mayúsculas, y "aprobada" acepta sus variantes', () => {
    expect(matchesCategoryPath('Programación, React,Hooks', 'programación,react')).toBe(true);
    expect(matchesCategoryPath('Programación', 'Programación,React')).toBe(false);
    expect(matchesCategoryPath('Arte artificial', 'Arte')).toBe(false);
    expect(matchesCategoryPath('Grabar Podcast,Aprobadas', 'grabar podcast,aprobada')).toBe(true);
    expect(matchesCategoryPath('lo que sea', '')).toBe(true);
  });

  it('filtra y pone primero la ruta exacta', () => {
    const items = [
      { id: 'a', categories: 'Salud,Programación,React' },
      { id: 'b', categories: 'Programación' },
      { id: 'c', categories: 'Programación,React' },
    ];
    expect(filterByCategoryPath(items, 'Programación,React').map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('une árboles sin repetir y recorta a lo que lleva a ciertos nombres', () => {
    const merged = mergeCategoryTrees(APP, mockStore.mine);
    expect(merged.filter((node) => node.name === 'Programación')).toHaveLength(1);
    const children = merged.filter((node) => node.parent === categoryPathId(['Programación'])).map((node) => node.name);
    expect(children).toEqual(['React', 'Python']);

    const limited = limitCategoryTree(merged, ['Hooks', 'Otra']).map((node) => node.id);
    expect(limited).toEqual(expect.arrayContaining(['programación', 'programación>react', 'programación>react>hooks', 'otra']));
    expect(limited).not.toContain('salud');

    const custom = withCustomPaths(merged, [['Programación', 'Rust']]);
    expect(custom.find((node) => node.id === 'programación>rust')).toMatchObject({ isSearchCategory: true, parent: 'programación' });
  });
});

const BarHarness = ({ onValue, ...props }) => {
  const [value, setValue] = useState('');
  return <CategoryFilterBar value={value} onChange={(next) => { setValue(next); onValue?.(next); }} {...props} />;
};

describe('CategoryFilterBar', () => {
  it('se ve directo con las categorías de la app y las tuyas y baja nivel por nivel', async () => {
    const onValue = jest.fn();
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<BarHarness onValue={onValue} />); });
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Programación', 'Salud', 'Huerto']));
    expect(byLabel(renderer, 'Filtrar por categoría')).toBeUndefined();
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);

    await pressText(renderer, 'Programación');
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['React', 'Python']));
    await pressText(renderer, 'React');
    expect(onValue).toHaveBeenLastCalledWith('Programación,React');
    expect(textsOf(renderer)).toContain('Hooks');

    // Una que no está en la app: con la lupa se escribe y queda como subnivel.
    await pressLabel(renderer, 'Buscar otra categoría');
    await typeInto(renderer, 'Otra subcategoría de React', 'Context', true);
    expect(onValue).toHaveBeenLastCalledWith('Programación,React,Context');
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);

    // Tocar otra vez la categoría elegida la quita (y todo lo de abajo).
    await pressText(renderer, 'Programación');
    expect(onValue).toHaveBeenLastCalledWith('');
    act(() => renderer.unmount());
  });

  it('con onlyNames solo ofrece esas (y lo que lleva a ellas) y en el foro no hay estados', async () => {
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(<BarHarness onlyNames={['Hooks', 'Grabar Podcast']} showStatuses={false} />);
    });
    const texts = textsOf(renderer);
    expect(texts).toEqual(expect.arrayContaining(['Programación', 'Grabar Podcast']));
    expect(texts).not.toContain('Salud');
    await pressText(renderer, 'Grabar Podcast');
    expect(textsOf(renderer)).not.toContain('Procesando');
    expect(byLabel(renderer, 'Buscar otra categoría')).toBeUndefined();
    act(() => renderer.unmount());
  });
});

const PickerHarness = ({ onValue }) => {
  const [value, setValue] = useState('');
  return <CategoryPicker value={value} onChange={(next) => { setValue(next); onValue(next); }} />;
};

describe('CategoryPicker', () => {
  it('elige categorías de la app con sus subtemas por niveles (sin "aprobada")', async () => {
    const onValue = jest.fn();
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<PickerHarness onValue={onValue} />); });
    expect(textsOf(renderer)).not.toContain('aprobada');

    await pressLabel(renderer, 'Elegir Programación');
    expect(textsOf(renderer)).toContain('Subtemas de Programación');
    await pressLabel(renderer, 'Elegir React');
    expect(onValue).toHaveBeenLastCalledWith('Programación,React');
    expect(textsOf(renderer)).toContain('Subtemas de React');

    // Quitar la categoría quita también lo que colgaba de ella.
    await pressLabel(renderer, 'Quitar Programación');
    expect(onValue).toHaveBeenLastCalledWith('');
    act(() => renderer.unmount());
  });

  it('crea tus propias categorías y subcategorías en tu filtro personal', async () => {
    api.post
      .mockResolvedValueOnce({ data: { id: 60, name: 'Mi tema', parent: null } })
      .mockResolvedValueOnce({ data: { id: 61, name: 'Paso 1', parent: 60 } });
    const onValue = jest.fn();
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<PickerHarness onValue={onValue} />); });

    await typeInto(renderer, 'Escribe una categoría nueva', 'Mi tema');
    await pressLabel(renderer, 'Agregar categoría');
    expect(api.post).toHaveBeenCalledWith('categories/', { name: 'Mi tema' });
    expect(onValue).toHaveBeenLastCalledWith('Mi tema');

    await typeInto(renderer, 'Subcategoría de Mi tema', 'Paso 1');
    await pressLabel(renderer, 'Agregar subcategoría');
    expect(api.post).toHaveBeenLastCalledWith('categories/', { name: 'Paso 1', parent: 60 });
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(onValue).toHaveBeenLastCalledWith('Mi tema,Paso 1');

    // Una que ya existe en la app no se vuelve a crear.
    await typeInto(renderer, 'Escribe una categoría nueva', 'salud');
    await pressLabel(renderer, 'Agregar categoría');
    expect(api.post).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
  });
});

describe('useUsersInCategory', () => {
  let result;
  const Harness = ({ items, category }) => {
    result = useUsersInCategory(items, category, (item) => item.user?.id);
    return null;
  };
  const people = [{ user: { id: 'u1' } }, { user: { id: 'u2' } }];

  it('pregunta al backend qué perfiles tienen la categoría y lo recuerda', async () => {
    api.post.mockResolvedValue({ data: { user_ids: ['u2'] } });
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<Harness items={people} category="" />); });
    expect(result.items).toBe(people);
    expect(api.post).not.toHaveBeenCalled();

    await act(async () => { renderer.update(<Harness items={people} category="Salud, Nutrición" />); });
    expect(api.post).toHaveBeenCalledWith(
      'users/in-category/', { category: 'Salud,Nutrición', user_ids: ['u1', 'u2'] }, { readOnly: true },
    );
    expect(result.items).toEqual([people[1]]);

    await act(async () => { renderer.update(<Harness items={people} category="" />); });
    await act(async () => { renderer.update(<Harness items={people} category="Salud,Nutrición" />); });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(result.items).toEqual([people[1]]);
    act(() => renderer.unmount());
  });
});

describe('ForumScreen', () => {
  const POSTS = {
    pages: [{ results: [{
      id: 1, title: 'Duda de hooks', content: 'ayuda', categories: 'Programación,React',
      user: { id: 'u1', username: 'ana' }, replies: [], likes_count: 0,
    }] }],
  };
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false, setParams: jest.fn() };

  it('cada post muestra sus categorías y tocar una filtra el foro por ella', async () => {
    mockUsePostsInfinite.mockReturnValue({ data: POSTS, isLoading: false });
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<ForumScreen navigation={navigation} route={{ params: {} }} />); });
    expect(mockUsePostsInfinite).toHaveBeenLastCalledWith(null, '');

    await pressLabel(renderer, 'Categoría React');
    expect(mockUsePostsInfinite).toHaveBeenLastCalledWith(null, 'React');
    expect(textsOf(renderer)).toContain('React'); // resumen de la barra del filtro
    act(() => renderer.unmount());
  });

  it('al crear un post se eligen sus categorías antes de publicarlo', async () => {
    mockUsePostsInfinite.mockReturnValue({ data: { pages: [] }, isLoading: false });
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<ForumScreen navigation={navigation} route={{ params: {} }} />); });
    await pressLabel(renderer, 'Crear post');
    await typeInto(renderer, 'Título del post', 'Becas');
    await typeInto(renderer, 'Contenido del post', 'miren');
    await pressLabel(renderer, 'Elegir Salud');
    await pressText(renderer, 'Crear Post');
    expect(mockCreatePost).toHaveBeenCalledWith({ title: 'Becas', content: 'miren', categories: 'Salud' });
    act(() => renderer.unmount());
  });
});
