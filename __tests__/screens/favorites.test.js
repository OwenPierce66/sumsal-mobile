/**
 * __tests__/screens/favorites.test.js
 *
 * Favoritos (Ver todo) y el top 5 del perfil: Guardadas -> Favoritas -> Top 5, el top 5
 * por categoría, "solo para ti" y si cada lista es pública.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import FavoritesScreen from '../../screens/FavoritesScreen';
import ProfileTopFive from '../../components/ProfileTopFive';

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
}));
jest.mock('@components/TaskActionsModal', () => () => null);
jest.mock('@hooks/useTaskActions', () => () => ({}));
jest.mock('@components/UserBadges', () => {
  const { Text: MockText } = require('react-native');
  return { NameWithBadges: ({ children }) => <MockText>{children}</MockText> };
});

const mockState = {};
const mockPin = jest.fn(() => Promise.resolve());
const mockReorder = jest.fn(() => Promise.resolve());
jest.mock('@hooks/useApi', () => ({
  useMe: () => ({ data: { id: 'me' } }),
  useIsAdmin: () => ({ data: { isAdmin: false } }),
  useFavoritesCollection: () => mockState.collection,
  usePinFavorite: () => ({ mutateAsync: mockPin }),
  useReorderFavorites: () => ({ mutateAsync: mockReorder }),
  useFavoritesTop: () => ({ data: mockState.top }),
  useCategories: () => ({ data: [] }),
}));
const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate, setQueryData: jest.fn() }),
  useQuery: () => ({ data: undefined, isLoading: false }),
}));

const task = (id, title, categories = '') => ({ id, title, categories, user: { id: 'ana', username: 'ana' } });
const COLLECTION = {
  profiles: [],
  tasks: [
    { id: 'f1', task: task('t1', 'Huerto', 'Salud'), is_pinned: true, position: 0, is_private: false },
    { id: 'f2', task: task('t2', 'Composta', 'Salud'), is_pinned: false, position: 1, is_private: true },
    { id: 'f3', task: task('t3', 'Riego', 'Salud, Agua'), is_pinned: false, position: 2, is_private: false },
  ],
  saved: [{ id: 's1', task: task('t4', 'Semillas', 'Salud'), is_private: false }],
  category_pins: { Salud: ['f3'] },
  visibility: { profiles: false, tasks: false },
};
const query = (data) => ({ data, isLoading: false, isFetching: false, refetch: jest.fn() });

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));
const byLabel = (renderer, label) => renderer.root.findAll((n) => n.props.accessibilityLabel === label && n.props.onPress)[0];
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((c) => c.type === Text && [].concat(c.props.children).join('') === label).length > 0
  )).pop();
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

let mounted;
let navigation;
beforeEach(() => {
  navigation = { navigate: jest.fn(), goBack: jest.fn(), push: jest.fn() };
  mockState.collection = query(COLLECTION);
  ['post', 'patch'].forEach((method) => api[method].mockReset().mockResolvedValue({ data: {} }));
  mockPin.mockClear();
  mockReorder.mockClear();
});
afterEach(() => { act(() => mounted?.unmount()); mounted = null; });

const render = async (element) => {
  await act(async () => { mounted = TestRenderer.create(element); });
  return mounted;
};

describe('FavoritesScreen (tareas)', () => {
  it('muestra Top 5, Favoritas y Guardadas, con "solo para ti", y deja ordenar, anclar y agregar', async () => {
    const renderer = await render(<FavoritesScreen navigation={navigation} route={{ params: {} }} />);
    await pressText(renderer, 'Tareas');
    const texts = textsOf(renderer);
    ['Top 5', 'Favoritas', 'Guardadas', 'Huerto', 'Composta', 'Semillas', 'Solo para ti'].forEach((text) => expect(texts).toContain(text));
    expect(texts.indexOf('Huerto')).toBeLessThan(texts.indexOf('Favoritas'));

    await act(async () => { byLabel(renderer, 'Agregar a favoritos').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('favoritos/agregar/', { task_id: 't4' });

    await act(async () => { renderer.root.findAll((n) => n.props.accessibilityLabel === 'Anclar en el top 5' && n.props.onPress)[0].props.onPress(); });
    expect(mockPin).toHaveBeenCalledWith({ type: 'task', id: 'f2', is_pinned: true });

    // La primera de la lista no puede subir: el primer "Subir" habilitado es el de Composta.
    const firstUp = renderer.root.findAll((n) => n.props.accessibilityLabel === 'Subir' && n.props.onPress && !n.props.disabled)[0];
    await act(async () => { firstUp.props.onPress(); });
    expect(mockReorder).toHaveBeenCalledWith({ type: 'tasks', order: ['f2', 'f1', 'f3'] });
  });

  it('con una categoría: su top 5 aparte, anclar y ordenar ahí', async () => {
    const renderer = await render(<FavoritesScreen navigation={navigation} route={{ params: {} }} />);
    await pressText(renderer, 'Tareas');
    // El filtro por niveles se ve directo y solo ofrece las categorías de lo guardado.
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Salud', 'Agua']));
    await pressText(renderer, 'Salud');
    const texts = textsOf(renderer);
    expect(texts).toContain('Top 5 de Salud');
    expect(texts.indexOf('Riego')).toBeLessThan(texts.indexOf('Favoritas'));

    await act(async () => { byLabel(renderer, 'Anclar en el top 5 de Salud').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('favorites/category-pin/', { task_id: 't1', category: 'Salud', is_pinned: true });
    await act(async () => { byLabel(renderer, 'Quitar del top 5 de Salud').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('favorites/category-pin/', { task_id: 't3', category: 'Salud', is_pinned: false });
  });

  it('la lista privada se puede hacer pública', async () => {
    const renderer = await render(<FavoritesScreen navigation={navigation} route={{ params: {} }} />);
    await pressText(renderer, 'Tareas');
    await act(async () => { byLabel(renderer, 'Lista privada: tocar para mostrarla').props.onPress(); });
    expect(api.patch).toHaveBeenCalledWith('categories/visibility/', { favorite_tasks_public: true });
  });

  it('de otro perfil con la lista privada: aviso y sin acciones', async () => {
    mockState.collection = query({ profiles: [], tasks: [], saved: [], category_pins: {}, visibility: { profiles: false, tasks: false } });
    const renderer = await render(<FavoritesScreen navigation={navigation} route={{ params: { userId: 'ana' } }} />);
    await pressText(renderer, 'Tareas');
    expect(textsOf(renderer)).toContain('Esta lista es privada.');
    expect(byLabel(renderer, 'Lista privada: tocar para mostrarla')).toBeUndefined();
  });
});

describe('ProfileTopFive', () => {
  const TOP = {
    is_owner: true,
    visibility: { profiles: true, tasks: false },
    profiles: [{ id: 'ana', username: 'ana' }],
    tasks: [{ id: 't1', title: 'Huerto', username: 'ana' }],
    categories: [{ name: 'Salud', tasks: [{ id: 't3', title: 'Riego', username: 'ana' }] }],
  };

  it('muestra perfiles y tareas del top 5, cambia de categoría y deja ocultar cada parte', async () => {
    mockState.top = TOP;
    const onOpenProfile = jest.fn();
    const renderer = await render(
      <ProfileTopFive userId="me" isCurrentUser navigation={navigation} onOpenProfile={onOpenProfile} />,
    );
    const texts = textsOf(renderer);
    ['Top 5', 'Perfiles', 'Tareas', 'ana', 'Huerto', 'Puesto 1', 'General', 'Salud'].forEach((text) => expect(texts).toContain(text));

    await pressText(renderer, 'Salud');
    expect(textsOf(renderer)).toContain('Riego');
    expect(textsOf(renderer)).not.toContain('Huerto');

    await act(async () => { byLabel(renderer, 'Puesto 1: ana').props.onPress(); });
    expect(onOpenProfile).toHaveBeenCalledWith(TOP.profiles[0]);

    await act(async () => { byLabel(renderer, 'Privado: tocar para mostrarlo').props.onPress(); });
    expect(api.patch).toHaveBeenCalledWith('categories/visibility/', { favorite_tasks_public: true });
  });

  it('de otro perfil sin nada público no se muestra; el propio vacío explica cómo llenarlo', async () => {
    mockState.top = { is_owner: false, visibility: {}, profiles: [], tasks: [], categories: [] };
    const visitor = await render(<ProfileTopFive userId="ana" isCurrentUser={false} navigation={navigation} />);
    expect(visitor.toJSON()).toBeNull();
    act(() => visitor.unmount());

    mockState.top = { ...mockState.top, is_owner: true };
    const owner = await render(<ProfileTopFive userId="me" isCurrentUser navigation={navigation} />);
    expect(textsOf(owner).join(' ')).toContain('Ancla perfiles con el corazón');
  });
});
