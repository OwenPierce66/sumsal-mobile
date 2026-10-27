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
jest.mock('@hooks/useApi', () => ({
  useTasksInfinite: () => mockTasksQuery,
  useSharedTasksInfinite: () => mockSharedQuery,
  useCategories: () => ({ data: [] }),
}));

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
async function renderFeed(user) {
  const client = new QueryClient();
  await act(async () => {
    mounted = TestRenderer.create(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ user, isAdmin: Boolean(user?.is_staff || user?.is_superuser) }}>
          <TasksScreen navigation={{ navigate: jest.fn() }} />
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
  act(() => mounted?.unmount());
  mounted = null;
  jest.useRealTimers();
  Alert.alert.mockRestore();
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
