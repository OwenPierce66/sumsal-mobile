/**
 * __tests__/components/ProfileActivity.test.js
 *
 * Actividad del perfil: me gusta, comentarios y verificaciones; el dueño decide con un
 * interruptor por tipo qué ven los demás.
 */
import React from 'react';
import { Switch, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import ProfileActivity from '../../components/ProfileActivity';

jest.mock('@api', () => ({
  __esModule: true,
  default: { patch: jest.fn() },
  getImageUrl: (path) => path || null,
}));
const mockSetQueryData = jest.fn();
const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ setQueryData: mockSetQueryData, invalidateQueries: mockInvalidate }),
}));
const mockActivity = {};
jest.mock('@hooks/useApi', () => ({
  useProfileActivity: (_userId, kind) => ({ data: mockActivity[kind], isLoading: false, isError: false, refetch: jest.fn() }),
}));

const VISIBILITY = { likes: false, comments: true, verifications: true };
const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((c) => c.type === Text && [].concat(c.props.children).join('') === label).length > 0
  )).pop();
  await act(async () => { await target.props.onPress(); });
};
const switchFor = (renderer, label) => renderer.root.findAllByType(Switch)
  .find((node) => node.props.accessibilityLabel === label);

beforeEach(() => {
  mockActivity.likes = {
    kind: 'likes', public: false, hidden: false, count: 1, visibility: VISIBILITY,
    items: [{ id: 'l1', created_at: '2026-10-28T10:00:00Z', task: { id: 't1', title: 'Guía de becas', user: { username: 'luis' } } }],
  };
  mockActivity.comments = {
    kind: 'comments', public: true, hidden: false, count: 2, visibility: VISIBILITY,
    items: [
      { id: 'comment-1', kind: 'task', created_at: '2026-10-28T10:00:00Z', text: 'Me sirvió', task: { id: 't1', title: 'Guía de becas', user: { username: 'luis' } } },
      { id: 'forum-2', kind: 'forum', created_at: '2026-10-27T10:00:00Z', text: 'Yo te ayudo', forum_post: { id: 9, title: 'Dudas' } },
    ],
  };
  mockActivity.verifications = {
    kind: 'verifications', public: true, hidden: false, count: 1, visibility: VISIBILITY,
    items: { given: [], received: [{ id: 'v1', created_at: '2026-10-28T10:00:00Z', user: { id: 'admin', username: 'admin' } }] },
  };
  api.patch.mockReset();
  mockSetQueryData.mockReset();
  mockInvalidate.mockReset();
});

it('en su perfil el dueño ve los tres interruptores juntos y su actividad', async () => {
  const navigation = { push: jest.fn(), getParent: () => ({ navigate: jest.fn() }) };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<ProfileActivity userId="ana" username="ana" isCurrentUser navigation={navigation} />);
  });
  expect(textsOf(renderer)).toEqual(expect.arrayContaining([
    'Qué ven los demás en tu perfil', 'Me gusta: solo tú', 'Comentarios: todos lo ven', 'Verificaciones: todos lo ven',
    'Guía de becas',
  ]));
  expect(renderer.root.findAllByType(Switch)).toHaveLength(3);

  api.patch.mockResolvedValueOnce({ data: { ...mockActivity.likes, public: true, visibility: { ...VISIBILITY, likes: true } } });
  await act(async () => { await switchFor(renderer, 'Mostrar me gusta en mi perfil').props.onValueChange(true); });
  expect(api.patch).toHaveBeenCalledWith('users/ana/activity/', { kind: 'likes', public: true });
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['profileActivity', 'ana'] });
  expect(textsOf(renderer)).toContain('Me gusta: todos lo ven');

  await pressText(renderer, 'Comentarios');
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['“Me sirvió”', 'en Guía de becas', 'en el foro: Dudas']));

  await pressText(renderer, 'Verificaciones');
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Lo verificó', 'admin']));
  act(() => renderer.unmount());
});

it('en otro perfil dice que esa persona no la muestra y no hay interruptores', async () => {
  mockActivity.likes = { kind: 'likes', public: false, hidden: true, count: 0, items: [] };
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<ProfileActivity userId="luis" username="luis" isCurrentUser={false} navigation={{ push: jest.fn() }} />);
  });
  expect(textsOf(renderer).join(' ')).toContain('@luis no muestra sus me gusta en su perfil.');
  expect(renderer.root.findAllByType(Switch)).toHaveLength(0);
  act(() => renderer.unmount());
});
