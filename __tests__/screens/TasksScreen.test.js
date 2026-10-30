/**
 * __tests__/screens/TasksScreen.test.js
 *
 * "Like de la App" del menú de administración (venía de peticiones.js en la web).
 * El backend lo da con la cuenta de la App (owen@gmail.com).
 */
import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@api';
import { AuthContext } from '@app';
import TasksScreen from '../../screens/TasksScreen';
import { setViewAs } from '../../hooks/useViewAs';

// El corazón de seguir junto a cada nombre (useMyRelations) necesita React Query; aquí no aplica.
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({ ready: false, getState: () => null, setStateLocally: () => {}, refresh: () => {} }),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('@react-native-community/slider', () => 'Slider');

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
}));

jest.mock('@app', () => ({ AuthContext: require('react').createContext(null) }));

jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));

jest.mock('../../hooks/useIsOnline', () => ({ useIsOnline: () => true }));

const TASK = {
  id: 't1',
  title: 'Aportación del feed',
  description: 'Texto',
  pch: 'consejos',
  categories: '',
  user: { id: 'autor', username: 'autor', profile: {} },
  subtasks: [],
  subfactores: [],
  subfuentes: [],
  likes_count: 3,
  comments_count: 0,
  share_count: 0,
  interaction_score: 0,
  created_at: '2026-10-20T00:00:00Z',
  user_has_liked: false,
  app_has_liked: false,
};
const mockTasksQuery = {
  data: { pages: [{ results: [TASK] }] },
  isLoading: false, isFetchingNextPage: false, fetchNextPage: jest.fn(),
  hasNextPage: false, refetch: jest.fn(), isRefetching: false,
};
const mockSharedQuery = {
  data: { pages: [{ results: [] }] },
  isFetchingNextPage: false, fetchNextPage: jest.fn(),
  hasNextPage: false, refetch: jest.fn(), isRefetching: false,
};
const mockTasksFilters = jest.fn();
jest.mock('@hooks/useApi', () => ({
  useTasksInfinite: (filters) => {
    mockTasksFilters(filters);
    return mockTasksQuery;
  },
  useSharedTasksInfinite: () => mockSharedQuery,
  useCategories: () => ({ data: [] }),
  useStories: () => ({ data: [], refetch: jest.fn() }),
  useTasks: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
  useMe: () => ({ data: mockMe }),
}));
const mockMe = { id: 'yo' };

const textsOf = (renderer) => renderer.root
  .findAllByType(Text)
  .map((node) => [].concat(node.props.children)
    .filter((part) => typeof part === 'string' || typeof part === 'number')
    .join(''));

// El más profundo: el overlay del modal también "contiene" el texto de cada opción.
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((child) => child.type === Text && child.props.children === label).length > 0
  )).pop();
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

const openTaskActions = async (renderer) => {
  let node = renderer.root.findAll((child) => child.props.name === 'ellipsis-vertical')[0];
  while (node && !node.props.onPress) node = node.parent;
  await act(async () => { node.props.onPress(); });
};

let mounted;
async function renderFeed(user, props = {}) {
  // El menú de 3 puntos lee quién soy (y si soy superadmin) de useMe.
  Object.keys(mockMe).forEach((key) => delete mockMe[key]);
  Object.assign(mockMe, user);
  const client = new QueryClient();
  await act(async () => {
    mounted = TestRenderer.create(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ user, isAdmin: Boolean(user?.is_staff || user?.is_superuser) }}>
          <TasksScreen navigation={{ navigate: jest.fn() }} {...props} />
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
  });
  return mounted;
}

beforeEach(() => {
  jest.useFakeTimers();
  api.get.mockReset().mockResolvedValue({ data: [] });
  api.post.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  act(() => setViewAs(null));
  act(() => mounted?.unmount());
  mounted = null;
  jest.useRealTimers();
  Alert.alert.mockRestore();
});

it('desde Explorar categorías abre el feed filtrado por esa categoría y su tipo', async () => {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  await renderFeed({ id: 'yo' }, {
    navigation, route: { params: { categoryPath: 'Salud,Nutrición', categoryPch: 'peticiones' } },
  });
  expect(mockTasksFilters).toHaveBeenLastCalledWith(expect.objectContaining({ pch: 'peticiones', category: 'Salud,Nutrición' }));
  expect(navigation.setParams).toHaveBeenCalledWith({ categoryPath: undefined, categoryPch: undefined });
});

it('ver como otra persona: su feed con un aviso para salir', async () => {
  setViewAs({ id: 'ana-id', username: 'ana' });
  const renderer = await renderFeed({ id: 'yo' });
  expect(mockTasksFilters).toHaveBeenLastCalledWith(expect.objectContaining({ as_user: 'ana-id' }));
  expect(textsOf(renderer)).toContain('Viendo el feed como @ana');

  const exit = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Salir de ver como' && node.props.onPress)[0];
  await act(async () => { exit.props.onPress(); });
  expect(mockTasksFilters).toHaveBeenLastCalledWith(expect.objectContaining({ as_user: undefined }));
  expect(textsOf(renderer)).not.toContain('Viendo el feed como @ana');
});

it('el ícono de categorías abre Explorar categorías', async () => {
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  const renderer = await renderFeed({ id: 'yo' }, { navigation });
  const button = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Explorar categorías' && node.props.onPress)[0];
  await act(async () => { button.props.onPress(); });
  expect(navigation.navigate).toHaveBeenCalledWith('CategoryExplorer', { pch: 'consejos', path: '' });
});

it('un superadmin da y quita el like de la App', async () => {
  api.post.mockResolvedValueOnce({ data: { task_id: 't1', liked: true, likes_count: 4, app_account_id: 'owen' } });
  const renderer = await renderFeed({ id: 'admin', is_superuser: true, is_staff: true });
  expect(textsOf(renderer)).toContain('3');

  await openTaskActions(renderer);
  await pressText(renderer, 'Dar like como la App');
  expect(api.post).toHaveBeenCalledWith('admin/tasks/t1/like/', { liked: true });
  expect(textsOf(renderer)).toContain('4');

  api.post.mockResolvedValueOnce({ data: { task_id: 't1', liked: false, likes_count: 3, app_account_id: 'owen' } });
  await openTaskActions(renderer);
  await pressText(renderer, 'Quitar like de la App');
  expect(api.post).toHaveBeenLastCalledWith('admin/tasks/t1/like/', { liked: false });
});

it('si el backend no encuentra la cuenta de la App lo explica', async () => {
  api.post.mockRejectedValueOnce({
    response: { status: 503, data: { detail: 'No existe la cuenta de la App (owen@gmail.com).' } },
  });
  const renderer = await renderFeed({ id: 'admin', is_superuser: true, is_staff: true });
  await openTaskActions(renderer);
  await pressText(renderer, 'Dar like como la App');

  expect(Alert.alert).toHaveBeenCalledWith(
    'No se pudo cambiar el like de la App', 'No existe la cuenta de la App (owen@gmail.com).',
  );
});

it('el staff que no es superadmin no ve la opción', async () => {
  const renderer = await renderFeed({ id: 'staff', is_superuser: false, is_staff: true });
  await openTaskActions(renderer);
  expect(textsOf(renderer)).toContain('Verificar Perfil');
  expect(textsOf(renderer)).not.toContain('Dar like como la App');
});

it('el autor de la aportación lleva sus insignias una sola vez', async () => {
  const { Ionicons } = require('@expo/vector-icons');
  require('../../hooks/useUserBadges').invalidateUserBadges();
  api.get.mockImplementation((path) => Promise.resolve({
    data: path === 'users/badges/' ? { autor: ['admin', 'sub_red'] } : [],
  }));
  const renderer = await renderFeed({ id: 'yo', is_superuser: false, is_staff: false });
  for (let i = 0; i < 3; i += 1) {
    await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
  }

  const icons = renderer.root.findAllByType(Ionicons).map((node) => node.props.name);
  expect(icons.filter((name) => name === 'shield-checkmark')).toHaveLength(1);
  expect(icons.filter((name) => name === 'star')).toHaveLength(1);
});

it('el menú de 3 puntos tiene Descargar y avisa si la aportación no tiene medios', async () => {
  const renderer = await renderFeed({ id: 'yo', is_superuser: false, is_staff: false });
  await openTaskActions(renderer);
  expect(textsOf(renderer)).toContain('Descargar');

  await pressText(renderer, 'Descargar');
  expect(Alert.alert).toHaveBeenCalledWith('Nada para descargar', 'Esta aportación no tiene imágenes ni videos.');
});

it('impulsar cambia el botón y cuenta impulsos (no interacciones), sin aviso de éxito', async () => {
  const pressIcon = async (renderer, name) => {
    let node = renderer.root.findAll((child) => child.props.name === name)[0];
    while (node && !node.props.onPress) node = node.parent;
    await act(async () => { await node.props.onPress(); });
  };
  const { Ionicons } = require('@expo/vector-icons');
  const footer = (renderer) => renderer.root.findAllByType(Ionicons)
    .map((child) => child.props.name)
    .filter((name) => name === 'trending-up' || name === 'trending-up-outline');

  api.post.mockResolvedValueOnce({ data: {
    reposted: true, user_has_reposted: true, user_has_liked: true, likes_count: 4, interaction_score: 7, reposts_count: 1,
  } });
  const renderer = await renderFeed({ id: 'yo', is_superuser: false, is_staff: false });
  await pressIcon(renderer, 'trending-up-outline');
  expect(api.post).toHaveBeenCalledWith('tasks/t1/repost/');
  expect(footer(renderer)).toEqual(['trending-up']);
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['1', '4']));
  expect(textsOf(renderer)).not.toContain('7');
  expect(Alert.alert).not.toHaveBeenCalled();

  // Quitar el impulso conserva el like.
  api.post.mockResolvedValueOnce({ data: {
    reposted: false, user_has_reposted: false, user_has_liked: true, likes_count: 4, interaction_score: 6, reposts_count: 0,
  } });
  await pressIcon(renderer, 'trending-up');
  expect(footer(renderer)).toEqual(['trending-up-outline']);
  expect(textsOf(renderer)).toContain('4');
  expect(Alert.alert).not.toHaveBeenCalled();
});

it('si impulsar falla, el botón vuelve como estaba', async () => {
  const pressIcon = async (renderer, name) => {
    let node = renderer.root.findAll((child) => child.props.name === name)[0];
    while (node && !node.props.onPress) node = node.parent;
    await act(async () => { await node.props.onPress(); });
  };
  global.alert = jest.fn();
  api.post.mockRejectedValueOnce(new Error('sin red'));
  const renderer = await renderFeed({ id: 'yo', is_superuser: false, is_staff: false });
  await pressIcon(renderer, 'trending-up-outline');
  const { Ionicons } = require('@expo/vector-icons');
  expect(renderer.root.findAllByType(Ionicons).filter((child) => child.props.name === 'trending-up')).toHaveLength(0);
  expect(textsOf(renderer)).toContain('3');
  expect(global.alert).toHaveBeenCalledWith('No se pudo impulsar la publicación. Inténtalo de nuevo.');
});
