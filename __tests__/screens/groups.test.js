/**
 * __tests__/screens/groups.test.js
 *
 * Grupos: lista, detalle (unirse, admins, revisión de publicaciones, integrantes)
 * y publicar dentro de un grupo.
 */
import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import GroupsScreen from '../../screens/GroupsScreen';
import GroupDetailScreen from '../../screens/GroupDetailScreen';
import CreateTaskScreen from '../../screens/CreateTaskScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({ ready: false, getState: () => null, setStateLocally: () => {}, refresh: () => {} }),
}));
jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
}));
// La tarjeta completa (videos, carrusel) no importa aquí: basta su título.
jest.mock('@components/TaskPostCard', () => {
  const { Text: MockText } = require('react-native');
  return { __esModule: true, default: ({ task }) => <MockText>{`Tarjeta: ${task.title}`}</MockText> };
});
jest.mock('@components/TaskActionsModal', () => () => null);
jest.mock('@hooks/useTaskActions', () => () => ({}));

const mockState = {};
const mockCategories = { appCategories: { data: [] }, myCategories: { data: [] } };
// El filtro por categorías del grupo (también un objeto estable).
const mockNoCategories = { data: [], isLoading: false };
const query = (data, extra = {}) => ({ data, isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false, ...extra });
const pages = (results) => query({ pages: [{ results, next: null }] }, { hasNextPage: false, fetchNextPage: jest.fn() });
jest.mock('@hooks/useApi', () => ({
  useMe: () => ({ data: { id: 'me' } }),
  useIsAdmin: () => ({ data: { isAdmin: false } }),
  useGroups: (params) => { mockState.groupsParams = params; return mockState.groups; },
  useGroup: () => mockState.group,
  useGroupTasks: (_id, { pending } = {}) => (pending ? mockState.pending : mockState.posts),
  useGroupMembers: (_id, { status } = {}) => (status === 'pending' ? mockState.requests : mockState.members),
  // Mismo objeto en cada render: uno nuevo dispara sin fin los efectos que dependen de las categorías.
  useCreateTaskCategories: () => mockCategories,
  useCategories: () => mockNoCategories,
}));
const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate, removeQueries: jest.fn(), setQueryData: jest.fn() }),
  useQuery: () => mockNoCategories,
}));

const GROUP = {
  id: 'g1', name: 'Huertos urbanos', description: 'Cultivar en la ciudad', rules: '1. Respeto',
  is_private: false, members_count: 3, my_role: null, my_status: null, is_admin: false,
  admins: [{ id: 'm0', role: 'owner', user: { id: 'ana', username: 'ana' } }],
};

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((c) => c.type === Text && [].concat(c.props.children).join('') === label).length > 0
  )).pop();
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};
const byLabel = (renderer, label) => renderer.root.findAll((n) => n.props.accessibilityLabel === label && n.props.onPress)[0];

let mounted;
let navigation;
beforeEach(() => {
  navigation = { push: jest.fn(), navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), canGoBack: () => true, addListener: () => () => {} };
  Object.assign(mockState, {
    groups: query([{ ...GROUP, my_role: 'member', my_status: 'active' }]),
    group: query(GROUP),
    posts: pages([{ id: 't1', title: 'Composta casera' }]),
    pending: pages([]),
    members: query([]),
    requests: query([]),
  });
  api.post.mockReset().mockResolvedValue({ data: {} });
  api.patch.mockReset().mockResolvedValue({ data: {} });
  api.delete.mockReset().mockResolvedValue({ data: {} });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  Alert.alert.mockRestore();
});

const render = async (Screen, params) => {
  await act(async () => { mounted = TestRenderer.create(<Screen navigation={navigation} route={{ params }} />); });
  return mounted;
};

describe('GroupsScreen', () => {
  it('muestra mis grupos, busca en Descubrir y abre el grupo', async () => {
    const renderer = await render(GroupsScreen);
    expect(mockState.groupsParams).toEqual({ mine: true, q: '' });
    expect(textsOf(renderer)).toContain('Huertos urbanos');

    await pressText(renderer, 'Descubrir');
    expect(mockState.groupsParams.mine).toBe(false);
    await act(async () => { byLabel(renderer, 'Abrir grupo Huertos urbanos').props.onPress(); });
    expect(navigation.push).toHaveBeenCalledWith('GroupDetail', { groupId: 'g1' });

    await act(async () => { byLabel(renderer, 'Crear grupo').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('GroupForm');
  });
});

describe('GroupDetailScreen', () => {
  it('muestra reglas y admins, y deja unirse a un grupo público', async () => {
    const renderer = await render(GroupDetailScreen, { groupId: 'g1' });
    const texts = textsOf(renderer);
    expect(texts).toEqual(expect.arrayContaining(['Huertos urbanos', 'Admins', 'ana', 'Tarjeta: Composta casera']));
    await pressText(renderer, 'Reglas del grupo');
    expect(textsOf(renderer)).toContain('1. Respeto');

    await pressText(renderer, 'Unirme');
    expect(api.post).toHaveBeenCalledWith('groups/g1/join/');
  });

  it('un grupo privado oculta lo publicado hasta que aceptan la solicitud', async () => {
    mockState.group = query({ ...GROUP, is_private: true });
    api.post.mockResolvedValue({ data: { my_status: 'pending' } });
    const renderer = await render(GroupDetailScreen, { groupId: 'g1' });
    expect(textsOf(renderer).join(' ')).toContain('Este grupo es privado');
    expect(textsOf(renderer)).not.toContain('Tarjeta: Composta casera');

    await pressText(renderer, 'Pedir unirme');
    expect(Alert.alert).toHaveBeenCalledWith('Solicitud enviada', expect.any(String));
  });

  it('un integrante publica en el grupo y sabe que lo revisa un admin', async () => {
    mockState.group = query({ ...GROUP, my_role: 'member', my_status: 'active', my_pending_posts_count: 1 });
    const renderer = await render(GroupDetailScreen, { groupId: 'g1' });
    expect(textsOf(renderer)).toContain('Lo que publiques aquí lo revisa un admin antes de que se vea.');
    await pressText(renderer, 'Publicar en el grupo');
    expect(navigation.navigate).toHaveBeenCalledWith('CreateTask', expect.objectContaining({
      groupId: 'g1', groupName: 'Huertos urbanos', groupIsAdmin: false,
    }));
  });

  it('un admin aprueba o rechaza lo pendiente', async () => {
    mockState.group = query({ ...GROUP, my_role: 'admin', my_status: 'active', is_admin: true, pending_posts_count: 1 });
    mockState.pending = pages([{ id: 't9', title: 'Semillas', group_status: 'pending' }]);
    const renderer = await render(GroupDetailScreen, { groupId: 'g1' });
    await pressText(renderer, 'Por aprobar');
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Esperando aprobación', 'Tarjeta: Semillas']));

    await act(async () => { byLabel(renderer, 'Aprobar Semillas').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('groups/g1/tasks/t9/review/', { approve: true });
    await act(async () => { byLabel(renderer, 'Rechazar Semillas').props.onPress(); });
    expect(api.post).toHaveBeenCalledWith('groups/g1/tasks/t9/review/', { approve: false });
  });

  it('un admin acepta solicitudes, nombra admins y expulsa (con confirmación)', async () => {
    mockState.group = query({ ...GROUP, is_private: true, my_role: 'admin', my_status: 'active', is_admin: true });
    mockState.requests = query([{ id: 'r1', role: 'member', status: 'pending', user: { id: 'luis', username: 'luis' } }]);
    mockState.members = query([
      { id: 'm0', role: 'owner', status: 'active', user: { id: 'ana', username: 'ana' } },
      { id: 'm2', role: 'member', status: 'active', user: { id: 'caro', username: 'caro' } },
    ]);
    const renderer = await render(GroupDetailScreen, { groupId: 'g1' });
    await pressText(renderer, 'Integrantes');
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Solicitudes para entrar (1)', 'Integrantes (2)', 'Creador']));

    await pressText(renderer, 'Aceptar');
    expect(api.patch).toHaveBeenCalledWith('groups/g1/members/luis/', { status: 'active' });
    await pressText(renderer, 'Hacer admin');
    expect(api.patch).toHaveBeenCalledWith('groups/g1/members/caro/', { role: 'admin' });

    await act(async () => { byLabel(renderer, 'Expulsar a caro').props.onPress(); });
    expect(api.delete).not.toHaveBeenCalled();
    await pressText(renderer, '¿Expulsar?');
    expect(api.delete).toHaveBeenCalledWith('groups/g1/members/caro/');
  });
});

describe('Publicar en un grupo desde Crear tarea', () => {
  it('manda el grupo, no ofrece guardarla oculta y avisa que espera revisión', async () => {
    api.post.mockResolvedValue({ data: { id: 'nueva', group_status: 'pending' } });
    const renderer = await render(CreateTaskScreen, { initialPch: 'consejos', groupId: 'g1', groupName: 'Huertos urbanos' });
    const texts = textsOf(renderer);
    expect(texts).toContain('Publicando en Huertos urbanos');
    expect(texts).not.toContain('¿Cómo la quieres compartir?');

    const title = renderer.root.findAll((n) => n.type === TextInput && n.props.placeholder === '¿Qué objetivo quieres compartir?')[0];
    await act(async () => { title.props.onChangeText('Composta'); });
    await pressText(renderer, 'ENVIAR AL GRUPO');

    const [path, formData] = api.post.mock.calls[0];
    expect(path).toBe('tasks/');
    const value = (key) => (typeof formData.get === 'function' ? formData.get(key) : formData.getParts().find((p) => p.fieldName === key)?.string);
    expect(value('group')).toBe('g1');
    expect(value('is_hidden')).toBe('false');
    expect(Alert.alert).toHaveBeenCalledWith('Enviada al grupo', expect.stringContaining('Un admin de Huertos urbanos'));
  });
});
