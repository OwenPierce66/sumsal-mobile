/**
 * __tests__/screens/TopScreen.test.js
 *
 * Pestaña Top: tu top 5 y lo más votado por tipo de aportación, en el periodo elegido.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import TopScreen from '../../screens/TopScreen';
import { setViewAs } from '../../hooks/useViewAs';

jest.mock('@api', () => ({ __esModule: true, default: {}, getImageUrl: (path) => path || null }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('@hooks/useApi', () => ({ useMe: () => ({ data: { id: 'me' } }) }));
const mockTopFive = jest.fn(() => null);
jest.mock('@components/ProfileTopFive', () => (props) => mockTopFive(props));
const mockTopics = jest.fn(() => null);
jest.mock('@components/TopicTopSections', () => (props) => mockTopics(props));

const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((c) => c.type === Text && c.props.children === label).length > 0
  )).pop();
  await act(async () => { await target.props.onPress(); });
};

it('muestra tu top 5 y lo más votado del periodo; "ver todo" abre el feed con ese tipo', async () => {
  const parentNavigate = jest.fn();
  const navigation = { push: jest.fn(), navigate: jest.fn(), getParent: () => ({ navigate: parentNavigate }) };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<TopScreen navigation={navigation} />); });

  expect(mockTopFive).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'me', isCurrentUser: true }));
  expect(mockTopics).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'top_month' }));

  await pressText(renderer, 'Explorar categorías');
  expect(navigation.navigate).toHaveBeenCalledWith('CategoryExplorer');

  await pressText(renderer, 'Semana');
  expect(mockTopics).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: 'top_week' }));

  await act(async () => { mockTopics.mock.calls.slice(-1)[0][0].onSelectTopic('peticiones'); });
  expect(parentNavigate).toHaveBeenCalledWith('Tasks', {
    screen: 'TasksList', params: { topicPch: 'peticiones', topicSortBy: 'top_week' },
  });

  await act(async () => { mockTopFive.mock.calls.slice(-1)[0][0].onOpenProfile({ id: 'ana', username: 'ana' }); });
  expect(navigation.push).toHaveBeenCalledWith('UserProfile', expect.objectContaining({ userId: 'ana' }));
  act(() => renderer.unmount());
});

it('ver como otra persona: su top 5 y lo más votado de quienes sigue, con aviso para salir', async () => {
  const navigation = { push: jest.fn(), navigate: jest.fn(), getParent: () => ({ navigate: jest.fn() }) };
  setViewAs({ id: 'ana-id', username: 'ana' });
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<TopScreen navigation={navigation} />); });
  expect(mockTopFive).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'ana-id', isCurrentUser: false }));
  expect(mockTopics).toHaveBeenLastCalledWith(expect.objectContaining({ asUser: 'ana-id' }));
  const texts = renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));
  expect(texts).toContain('Viendo el top como @ana');

  const exit = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Salir de ver como' && node.props.onPress)[0];
  await act(async () => { exit.props.onPress(); });
  expect(mockTopFive).toHaveBeenLastCalledWith(expect.objectContaining({ userId: 'me', isCurrentUser: true }));
  expect(mockTopics).toHaveBeenLastCalledWith(expect.objectContaining({ asUser: undefined }));
  act(() => renderer.unmount());
});
