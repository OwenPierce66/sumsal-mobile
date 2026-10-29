/**
 * __tests__/components/TaskStatsSheet.test.js
 *
 * Estadísticas de una publicación: los números públicos y, para su creador, cuántas
 * personas la guardaron, la pusieron en favoritos o la anclaron.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import TaskStatsSheet from '../../components/TaskStatsSheet';

jest.mock('@api', () => ({ __esModule: true, default: { get: jest.fn() } }));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));

const PUBLIC = {
  likes: 4, comments: 2, reposts: 1, shares: 0,
  citations: { comments: 1, forum: 2, shared_comments: 0, total: 3 },
};

it('el creador ve también lo privado', async () => {
  api.get.mockResolvedValueOnce({ data: {
    is_owner: true,
    public: PUBLIC,
    private: { saves: 5, favorites: 3, pinned: 1, category_pins: 2, story_shares: 0 },
  } });
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<TaskStatsSheet visible taskId="t1" onClose={jest.fn()} />); });
  expect(api.get).toHaveBeenCalledWith('tasks/t1/stats/');
  const texts = textsOf(renderer);
  expect(texts).toEqual(expect.arrayContaining([
    'Me gusta', '4', 'Citada en comentarios', '3', '1 en aportaciones · 2 en el foro',
    'Solo tú ves esto', 'La guardaron', '5', 'En su top 5',
  ]));
  act(() => renderer.unmount());
});

it('los demás solo ven lo público', async () => {
  api.get.mockResolvedValueOnce({ data: { is_owner: false, public: PUBLIC, private: null } });
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<TaskStatsSheet visible taskId="t1" onClose={jest.fn()} />); });
  expect(textsOf(renderer)).not.toContain('Solo tú ves esto');
  expect(textsOf(renderer)).not.toContain('La guardaron');
  act(() => renderer.unmount());
});
