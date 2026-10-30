/**
 * __tests__/components/UserTagPicker.test.js
 *
 * Etiquetar personas: al abrir ya hay sugerencias; al escribir, busca.
 */
import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import UserTagPicker from '../../components/UserTagPicker';

jest.mock('@api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../../components/UserBadges', () => ({ NameWithBadges: ({ children }) => {
  const { Text: MockText } = require('react-native');
  return <MockText>{children}</MockText>;
} }));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string').join(''));

beforeEach(() => { jest.useFakeTimers(); api.get.mockReset(); });
afterEach(() => { jest.useRealTimers(); });

it('al abrir muestra sugerencias sin escribir y al escribir busca', async () => {
  api.get
    .mockResolvedValueOnce({ data: { profiles: [{ id: 'u1', username: 'seguido' }, { id: 'me', username: 'yo' }] } })
    .mockResolvedValueOnce({ data: { profiles: [{ id: 'u2', username: 'ana' }] } });
  const onChange = jest.fn();
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<UserTagPicker visible onClose={jest.fn()} onChange={onChange} excludeIds={['me']} />);
  });
  await act(async () => { jest.runOnlyPendingTimers(); });
  expect(api.get).toHaveBeenCalledWith('search/directory/', { params: { q: '', scope: 'profiles' } });
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Sugerencias', '@seguido']));
  expect(textsOf(renderer)).not.toContain('@yo');

  const row = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Etiquetar @seguido' && node.props.onPress)[0];
  await act(async () => { row.props.onPress(); });
  expect(onChange).toHaveBeenCalledWith([{ id: 'u1', username: 'seguido' }]);

  await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('an'); });
  await act(async () => { jest.runOnlyPendingTimers(); });
  expect(api.get).toHaveBeenLastCalledWith('search/directory/', { params: { q: 'an', scope: 'profiles' } });
  expect(textsOf(renderer)).toContain('@ana');
  expect(textsOf(renderer)).not.toContain('Sugerencias');
  act(() => renderer.unmount());
});
