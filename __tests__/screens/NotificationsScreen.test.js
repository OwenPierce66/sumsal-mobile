/**
 * __tests__/screens/NotificationsScreen.test.js
 *
 * "Tu historia terminó": además de Guardar / Ahora no, tocar la tarjeta abre la historia.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import NotificationsScreen from '../../screens/NotificationsScreen';

jest.mock('@api', () => ({ __esModule: true, default: { post: jest.fn(), patch: jest.fn() }, getImageUrl: (p) => p || null }));
jest.mock('@app', () => ({ AuthContext: require('react').createContext({ user: { id: 'me' }, signOut: jest.fn() }) }));
jest.mock('@contexts/NotificationsContext', () => ({
  NotificationsContext: require('react').createContext({
    unreadCount: 1, refreshUnreadCount: jest.fn(), markOneReadLocally: jest.fn(), clearUnreadLocally: jest.fn(),
  }),
}));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));
const mockMarkRead = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
  useMutation: () => ({ mutate: mockMarkRead, isPending: false }),
}));
jest.mock('@components/SideMenu', () => () => null);
jest.mock('@components/UserBadges', () => ({ NameWithBadges: ({ children }) => children }));
const mockState = {};
jest.mock('@hooks/useApi', () => ({
  useNotificationsInfinite: () => ({
    data: { pages: [{ results: mockState.notifications }] },
    isLoading: false, isError: false, isFetchingNextPage: false, hasNextPage: false,
    fetchNextPage: jest.fn(), refetch: jest.fn(), isRefetching: false,
  }),
}));

const STORY = {
  id: 'n1', notification_type: 'story_expired', is_read: false, created_at: '2026-10-29T10:00:00Z',
  target_type: 'task', target_id: 'story-1', actor: { id: 'me', username: 'yo' },
  data: { story_id: 'story-1', story_saved: false, story_exists: true },
};

it('tocar la tarjeta de la historia que terminó la abre (y la marca como leída)', async () => {
  mockState.notifications = [STORY];
  const navigation = { navigate: jest.fn(), getState: () => ({ index: 0 }), getParent: () => ({ navigate: jest.fn() }) };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<NotificationsScreen navigation={navigation} />); });
  const texts = renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));
  expect(texts).toContain('¿Guardarla en tus aportaciones?');

  const card = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Abrir la historia que terminó' && node.props.onPress)[0];
  await act(async () => { card.props.onPress(); });
  expect(navigation.navigate).toHaveBeenCalledWith('TaskDetail', { taskId: 'story-1' });
  expect(mockMarkRead).toHaveBeenCalledWith('n1');
  act(() => renderer.unmount());
});

it('si la historia ya no existe, la tarjeta no abre nada', async () => {
  mockState.notifications = [{ ...STORY, data: { ...STORY.data, story_exists: false } }];
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<NotificationsScreen navigation={{ navigate: jest.fn(), getState: () => ({ index: 0 }) }} />); });
  const card = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Abrir la historia que terminó' && node.props.onPress)[0];
  expect(card.props.disabled).toBe(true);
  act(() => renderer.unmount());
});
