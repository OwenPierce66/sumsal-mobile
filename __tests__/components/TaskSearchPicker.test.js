/**
 * __tests__/components/TaskSearchPicker.test.js
 *
 * Elegir el "siguiente recomendado": sugiere tus publicaciones y busca al escribir.
 */
import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import TaskSearchPicker from '../../components/TaskSearchPicker';

jest.mock('@api', () => ({ __esModule: true, default: { get: jest.fn() } }));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string').join(''));

beforeEach(() => { jest.useFakeTimers(); api.get.mockReset(); });
afterEach(() => { jest.useRealTimers(); });

it('sugiere mis publicaciones (sin la actual), busca y elige una', async () => {
  api.get
    .mockResolvedValueOnce({ data: { tasks: [
      { id: 't1', title: 'Parte 1', pch: 'consejos', user: { username: 'ana' } },
      { id: 't2', title: 'Parte 2', pch: 'consejos', user: { username: 'ana' } },
    ] } })
    .mockResolvedValueOnce({ data: { tasks: [{ id: 't9', title: 'Podcast 9', pch: 'historias', user: { username: 'luis' } }] } });
  const onSelect = jest.fn();
  const onClose = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<TaskSearchPicker visible excludeTaskId="t1" onSelect={onSelect} onClose={onClose} />);
  });
  await act(async () => { jest.runOnlyPendingTimers(); });
  expect(api.get).toHaveBeenCalledWith('search/directory/', { params: { q: '', scope: 'tasks' } });
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Tus publicaciones recientes', 'Parte 2']));
  expect(textsOf(renderer)).not.toContain('Parte 1');

  await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('podcast'); });
  await act(async () => { jest.runOnlyPendingTimers(); });
  const row = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Elegir Podcast 9' && node.props.onPress)[0];
  await act(async () => { row.props.onPress(); });
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 't9' }));
  expect(onClose).toHaveBeenCalled();
  act(() => renderer.unmount());
});
