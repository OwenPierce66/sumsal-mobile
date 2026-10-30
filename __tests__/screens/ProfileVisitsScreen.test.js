/**
 * __tests__/screens/ProfileVisitsScreen.test.js
 *
 * Visitas a tu perfil: el contador para todos; quién visitó, con suscripción en la app;
 * y el modo anónimo.
 */
import React from 'react';
import { Switch, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import ProfileVisitsScreen from '../../screens/ProfileVisitsScreen';

jest.mock('@api', () => ({ __esModule: true, default: { patch: jest.fn() }, getImageUrl: (path) => path || null }));
const mockSetQueryData = jest.fn();
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ setQueryData: mockSetQueryData }) }));
let mockVisits;
jest.mock('@hooks/useApi', () => ({
  useMe: () => ({ data: { id: 'ana-id', username: 'ana' } }),
  useProfileVisits: () => ({ data: mockVisits, isLoading: false, isError: false, refetch: jest.fn() }),
}));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));
const navigation = { goBack: jest.fn(), push: jest.fn(), navigate: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockVisits = { visits_7d: 2, visits_30d: 5, anonymous_visits: false, can_see_visitors: false, visitors: [] };
});

it('sin suscripción: ve cuántas visitas tuvo y cómo ver quién', async () => {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<ProfileVisitsScreen navigation={navigation} />); });
  expect(textsOf(renderer)).toEqual(expect.arrayContaining([
    '2', 'Últimos 7 días', '5', 'Últimos 30 días', '¿Quién visitó tu perfil?',
  ]));
  const subscribe = renderer.root.findAll((node) => node.props.onPress && node.findAll((c) => c.type === Text && c.props.children === 'Ver suscripciones').length).pop();
  await act(async () => { subscribe.props.onPress(); });
  expect(navigation.navigate).toHaveBeenCalledWith('Subscriptions');
  act(() => renderer.unmount());
});

it('con suscripción: quién visitó (los anónimos sin nombre) y abre su perfil', async () => {
  mockVisits = {
    ...mockVisits,
    can_see_visitors: true,
    visitors: [
      { id: 'luis-id', anonymous: false, user: { id: 'luis-id', username: 'luis' }, last_visited_at: '2026-10-28T10:00:00Z', visits: 3 },
      { id: 'anonymous-9', anonymous: true, user: null, last_visited_at: '2026-10-27T10:00:00Z', visits: 1 },
    ],
  };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<ProfileVisitsScreen navigation={navigation} />); });
  const texts = textsOf(renderer);
  expect(texts).toEqual(expect.arrayContaining(['@luis', 'Visitante anónimo']));
  expect(texts.some((text) => text.endsWith('· 3 visitas'))).toBe(true);
  const open = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Abrir perfil de luis' && node.props.onPress)[0];
  await act(async () => { open.props.onPress(); });
  expect(navigation.push).toHaveBeenCalledWith('UserProfile', expect.objectContaining({ userId: 'luis-id' }));
  act(() => renderer.unmount());
});

it('activa el modo anónimo', async () => {
  api.patch.mockResolvedValueOnce({ data: { ...mockVisits, anonymous_visits: true } });
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<ProfileVisitsScreen navigation={navigation} />); });
  await act(async () => { await renderer.root.findByType(Switch).props.onValueChange(true); });
  expect(api.patch).toHaveBeenCalledWith('users/ana-id/visits/', { anonymous_visits: true });
  expect(mockSetQueryData).toHaveBeenCalledWith(['profileVisits', 'ana-id'], expect.objectContaining({ anonymous_visits: true }));
  act(() => renderer.unmount());
});
