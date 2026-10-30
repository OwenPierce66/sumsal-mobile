/**
 * __tests__/components/ProfileActivity.test.js
 *
 * Tu actividad: todo junto o por tipo; el dueño decide quién ve cada tipo (solo él, sus
 * suscriptores o todos) y si otros pueden "ver como" él.
 */
import React from 'react';
import { Switch, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import ProfileActivity, { describeActivity } from '../../components/ProfileActivity';

jest.mock('@api', () => ({
  __esModule: true,
  default: { patch: jest.fn() },
  getImageUrl: (path) => path || null,
}));
const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
const mockActivity = {};
jest.mock('@hooks/useApi', () => ({
  useProfileActivity: (_userId, kind) => ({ data: mockActivity[kind], isLoading: false, isError: false, refetch: jest.fn() }),
}));

const LEVELS = {
  likes: 'private', comments: 'private', saves: 'private', reposts: 'public', shares: 'public',
  follows: 'public', favorites: 'private', recommendations: 'public', verifications: 'public',
};
const ALL_KINDS = Object.keys(LEVELS);
const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((c) => c.type === Text && [].concat(c.props.children).join('') === label).length > 0
  )).pop();
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};
const pressLabel = async (renderer, label) => {
  const target = renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

const task = { id: 't1', title: 'Guía de becas', user: { username: 'luis' } };

beforeEach(() => {
  Object.keys(mockActivity).forEach((key) => delete mockActivity[key]);
  mockActivity.all = {
    kind: 'all', is_owner: true, kinds: ALL_KINDS, paid_kinds: [], hidden: false, count: 4,
    levels: LEVELS, feed_public: false,
    items: [
      { id: 'likes-1', kind: 'likes', created_at: '2026-10-28T10:00:00Z', task },
      { id: 'comments-task-2', kind: 'comments', where: 'task', created_at: '2026-10-28T09:00:00Z', text: 'Me sirvió', task },
      { id: 'follows-3', kind: 'follows', created_at: '2026-10-27T10:00:00Z', user: { id: 'eva', username: 'eva' } },
      { id: 'verifications-received-4', kind: 'verifications', direction: 'received', created_at: '2026-10-26T10:00:00Z', user: { id: 'admin', username: 'admin' } },
    ],
  };
  api.patch.mockReset();
  mockInvalidate.mockReset();
});

it('el dueño ve todo junto, con qué hizo y sobre qué', async () => {
  const navigation = { push: jest.fn(), getParent: () => ({ navigate: jest.fn() }) };
  const onOpenProfile = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <ProfileActivity userId="ana" username="ana" isCurrentUser navigation={navigation} onOpenProfile={onOpenProfile} />,
    );
  });
  const texts = textsOf(renderer);
  expect(texts).toEqual(expect.arrayContaining([
    'Tu actividad', 'Quién ve tu actividad en tu perfil', 'Todo', 'Me gusta', 'Guardados', 'Impulsos',
    'Guía de becas', '“Me sirvió”', '@eva', '@admin',
  ]));
  expect(texts.some((text) => text.startsWith('Empezó a seguir a ·'))).toBe(true);
  expect(texts.some((text) => text.startsWith('Lo verificó ·'))).toBe(true);

  await pressLabel(renderer, 'Me gusta Guía de becas');
  expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 't1' });
  await pressLabel(renderer, 'Empezó a seguir a @eva');
  expect(onOpenProfile).toHaveBeenCalledWith({ id: 'eva', username: 'eva' });
  act(() => renderer.unmount());
});

it('el dueño elige quién ve cada tipo: solo él, sus suscriptores o todos', async () => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<ProfileActivity userId="ana" username="ana" isCurrentUser navigation={{ push: jest.fn() }} />);
  });
  const selected = (label) => renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0]
    .props.accessibilityState.selected;
  expect(selected('Me gusta: Solo yo')).toBe(true);

  api.patch.mockResolvedValueOnce({ data: { kind: 'likes', level: 'subscribers', levels: { ...LEVELS, likes: 'subscribers' }, feed_public: false } });
  await pressLabel(renderer, 'Me gusta: Suscriptores');
  expect(api.patch).toHaveBeenCalledWith('users/ana/activity/', { kind: 'likes', level: 'subscribers' });
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['profileActivity', 'ana'] });
  expect(selected('Me gusta: Suscriptores')).toBe(true);

  api.patch.mockResolvedValueOnce({ data: { kind: 'feed', public: true, levels: { ...LEVELS, likes: 'subscribers' }, feed_public: true } });
  const feedSwitch = renderer.root.findAllByType(Switch).find((node) => node.props.accessibilityLabel === 'Permitir que otros vean mi feed');
  await act(async () => { await feedSwitch.props.onValueChange(true); });
  expect(api.patch).toHaveBeenLastCalledWith('users/ana/activity/', { kind: 'feed', public: true });
  expect(textsOf(renderer)).toContain('Ver como yo: otros pueden ver tu feed');

  // Los controles se pueden plegar.
  await pressText(renderer, 'Quién ve tu actividad en tu perfil');
  expect(renderer.root.findAllByType(Switch)).toHaveLength(0);
  act(() => renderer.unmount());
});

it('en otro perfil: solo los tipos que muestra, y los de paga con candado y aviso', async () => {
  mockActivity.all = {
    kind: 'all', is_owner: false, kinds: ['reposts', 'follows'], paid_kinds: ['likes'], hidden: false, count: 0, items: [],
  };
  mockActivity.likes = { kind: 'likes', level: 'subscribers', kinds: ['reposts', 'follows'], paid_kinds: ['likes'], hidden: true, count: 0, items: [] };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<ProfileActivity userId="luis" username="luis" isCurrentUser={false} navigation={{ push: jest.fn() }} />);
  });
  const texts = textsOf(renderer);
  expect(texts).toEqual(expect.arrayContaining(['Actividad', 'Todo', 'Me gusta', 'Impulsos', 'Seguidos']));
  expect(texts).not.toContain('Guardados');
  expect(texts).not.toContain('Quién ve tu actividad en tu perfil');
  expect(renderer.root.findAll((node) => node.props.name === 'lock-closed').length).toBeGreaterThan(0);

  await pressText(renderer, 'Me gusta');
  expect(textsOf(renderer).join(' ')).toContain(
    '@luis muestra esta actividad solo a sus suscriptores. Sus me gusta también los ves si tienes suscripción en la app.',
  );
  act(() => renderer.unmount());
});

it('describe cada acción', () => {
  expect(describeActivity({ kind: 'comments', where: 'forum' })).toBe('Respondió en el foro');
  expect(describeActivity({ kind: 'verifications', direction: 'given' })).toBe('Verificó a');
  expect(describeActivity({ kind: 'reposts' })).toBe('Impulsó');
});
