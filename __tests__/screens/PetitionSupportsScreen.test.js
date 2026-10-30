/**
 * __tests__/screens/PetitionSupportsScreen.test.js
 *
 * Mis apoyos: peticiones que apoyé (con su total al lado) y lo que recibieron las mías.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@api';
import PetitionSupportsScreen from '../../screens/PetitionSupportsScreen';
import SubscriptionsScreen from '../../screens/SubscriptionsScreen';

const mockSupports = {
  given: [
    { task: { id: 'p1', title: 'Más parques', is_hidden: false, user: { id: 'ana', username: 'ana' } }, amount_mxn: '26.00', times: 2, last_paid_at: '2026-10-26T12:00:00Z' },
    { task: { id: 'p2', title: 'Oculta ajena', is_hidden: true, user: { id: 'luis', username: 'luis' } }, amount_mxn: '10.00', times: 1, last_paid_at: '2026-10-20T12:00:00Z' },
  ],
  received: [
    { task: { id: 'p3', title: 'Ciclovías', is_hidden: false, user: { id: 'me', username: 'yo' } }, amount_mxn: '150.00', supporters_count: 3, last_paid_at: '2026-10-27T12:00:00Z' },
  ],
  summary: { given_mxn: '36.00', received_mxn: '150.00' },
  stripe_enabled: true,
};
const mockUseSupports = jest.fn();
const mockSubscriptions = {
  user: { id: 'luis', username: 'luis' },
  paid: [{ id: 's1', recipient: { id: 'ana', username: 'ana' }, subscriber: { id: 'luis', username: 'luis' }, amount: '5.00', currency: 'usd', is_active: true, is_gift: true, auto_renew: true, current_period_end: '2026-11-20T00:00:00Z' }],
  received: [],
  summary: { active: false, amount_usd: '0.00', tier: null },
  stripe_enabled: true,
};
const mockUseSubscriptions = jest.fn(() => ({ data: mockSubscriptions, isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false }));
const mockNoCategories = { data: [], isLoading: false };
jest.mock('@hooks/useApi', () => ({
  useMe: () => ({ data: { id: 'me' } }),
  useMyPetitionSupports: (...args) => mockUseSupports(...args),
  useMySubscriptions: (...args) => mockUseSubscriptions(...args),
  // El filtro por categoría de la lista de quienes apoyaron.
  useCategories: () => mockNoCategories,
}));
beforeEach(() => {
  mockUseSupports.mockReturnValue({ data: mockSupports, isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false });
});
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({ ready: false, getState: () => null, setStateLocally: () => {}, refresh: () => {} }),
}));
jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getImageUrl: (path) => path || null,
}));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));
const byLabel = (renderer, label) => renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];

let mounted;
afterEach(() => { act(() => mounted?.unmount()); mounted = null; });

const render = (params, Screen = PetitionSupportsScreen) => {
  const navigation = { push: jest.fn(), navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    mounted = TestRenderer.create(
      <QueryClientProvider client={client}><Screen navigation={navigation} route={{ params }} /></QueryClientProvider>,
    );
  });
  return { renderer: mounted, navigation };
};

it('muestra los totales y cada petición con lo que di al lado', () => {
  const { renderer } = render();
  expect(textsOf(renderer)).toEqual(expect.arrayContaining([
    '$36.00 MXN', '$150.00 MXN', 'Más parques', '$26.00 MXN', 'Ciclovías',
  ]));
});

it('abre la petición que apoyé, salvo si su autor la ocultó', async () => {
  const { renderer, navigation } = render();
  await act(async () => { byLabel(renderer, 'Abrir petición Más parques').props.onPress(); });
  expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 'p1' });
  expect(byLabel(renderer, 'Abrir petición Oculta ajena').props.disabled).toBe(true);
});

it('en mis peticiones abre quién las apoyó', async () => {
  api.get.mockResolvedValue({ data: { supporters: [{ id: 'fan', username: 'fan', amount_mxn: '100.00' }], support_total: { amount_mxn: '150.00', supporters_count: 3 } } });
  const { renderer } = render();
  await act(async () => { byLabel(renderer, 'Ver quién apoyó Ciclovías').props.onPress(); });
  expect(api.get).toHaveBeenCalledWith('tasks/p3/supporters/');
  expect(textsOf(renderer)).toContain('Apoyo recaudado');
});

describe('en el perfil de otra persona', () => {
  it('muestra sus apoyos con su nombre', () => {
    mockUseSupports.mockReturnValue({
      data: { ...mockSupports, user: { id: 'luis', username: 'luis' } },
      isLoading: false, isError: false, refetch: jest.fn(), isRefetching: false,
    });
    const { renderer } = render({ userId: 'luis', username: 'luis' });
    expect(mockUseSupports).toHaveBeenCalledWith('luis');
    expect(textsOf(renderer)).toEqual(expect.arrayContaining([
      'Apoyos de @luis', 'Ha dado', 'Peticiones que apoyó', 'Lo que recibieron sus peticiones',
    ]));
  });

  it('mis apoyos no piden los de nadie más', () => {
    render();
    expect(mockUseSupports).toHaveBeenCalledWith(null);
  });

  it('sus suscripciones se ven en solo lectura: sin botón de suscribirme ni de renovar', () => {
    const { renderer, navigation } = render({ userId: 'luis', username: 'luis' }, SubscriptionsScreen);
    expect(mockUseSubscriptions).toHaveBeenCalledWith('luis');
    const texts = textsOf(renderer);
    expect(texts).toEqual(expect.arrayContaining(['Suscripciones de @luis', 'Las que regala', 'Para @ana']));
    expect(texts).not.toContain('Suscribirme');
    expect(texts).not.toContain('Renovar');

    renderer.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.onPress)
      .find((node) => node.findAll((c) => c.type === Text && c.props.children === 'Apoyos a peticiones de @luis').length)
      .props.onPress();
    expect(navigation.navigate).toHaveBeenCalledWith('PetitionSupports', { userId: 'luis' });
  });
});
