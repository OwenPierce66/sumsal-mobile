/**
 * __tests__/screens/SubscriptionsScreen.test.js
 *
 * Mis suscripciones: las que pago (con renovación automática) y las que recibo.
 */
import React from 'react';
import { Alert, Switch, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@api';
import SubscriptionsScreen from '../../screens/SubscriptionsScreen';

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
}));

const ME = { id: 'me', username: 'yo' };
const LUIS = { id: 'luis', username: 'luis' };
const END = '2026-11-26T12:00:00Z';

const RESPONSE = {
  paid: [
    { id: 'p1', subscriber: ME, recipient: LUIS, amount: '50.00', currency: 'mxn', is_gift: true,
      is_active: true, auto_renew: true, current_period_end: END },
    { id: 'p2', subscriber: ME, recipient: ME, amount: '1.00', currency: 'usd', is_gift: false,
      is_active: false, auto_renew: false, current_period_end: '2026-09-01T00:00:00Z' },
  ],
  received: [
    { id: 'r1', subscriber: LUIS, recipient: ME, amount: '3.00', currency: 'usd', is_gift: true,
      is_active: true, auto_renew: false, current_period_end: END },
  ],
  summary: { active: true, amount_usd: '3.00', tier: 'sub_green', subscribers_count: 1 },
  stripe_enabled: true,
};

const textsOf = (renderer) => renderer.root
  .findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));

// React Query entrega los datos en un setTimeout: con timers falsos hay que avanzarlos.
const flush = async () => {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
  }
};

let mounted;
async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    mounted = TestRenderer.create(
      <QueryClientProvider client={client}>
        <SubscriptionsScreen navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }} />
      </QueryClientProvider>,
    );
  });
  await flush();
  return mounted;
}

beforeEach(() => {
  jest.useFakeTimers();
  api.get.mockReset().mockImplementation((path) => Promise.resolve({
    data: path === 'users/me/' ? ME : RESPONSE,
  }));
  api.patch.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  jest.useRealTimers();
  Alert.alert.mockRestore();
});

it('lista lo que pago y lo que recibo, y lo que muestra mi perfil', async () => {
  const renderer = await renderScreen();
  expect(textsOf(renderer)).toEqual(expect.arrayContaining([
    'Suscripción', '$3.00 USD al mes',
    'Para @luis', '$50.00 MXN al mes · Se renueva el 26 de noviembre',
    'Para mí', '$1.00 USD al mes · Terminó',
    'De @luis', '$3.00 USD al mes · Termina el 26 de noviembre',
  ]));
  // Mi propia suscripción terminó: puedo volver a suscribirme.
  expect(textsOf(renderer)).toContain('Suscribirme');
  // Solo la activa tiene interruptor de renovación.
  expect(renderer.root.findAllByType(Switch)).toHaveLength(1);
});

it('apaga la renovación automática de una suscripción que pago', async () => {
  api.patch.mockResolvedValueOnce({ data: { ...RESPONSE.paid[0], auto_renew: false } });
  const renderer = await renderScreen();
  const toggle = renderer.root.findByType(Switch);
  expect(toggle.props.value).toBe(true);
  expect(toggle.props.accessibilityLabel).toBe('Renovar automáticamente para @luis');

  await act(async () => { await toggle.props.onValueChange(false); });
  expect(api.patch).toHaveBeenCalledWith('subscriptions/p1/', { auto_renew: false });
});

it('avisa si Stripe no deja cambiarla', async () => {
  api.patch.mockRejectedValueOnce({ response: { status: 502, data: { detail: 'No pudimos comunicarnos con Stripe.' } } });
  const renderer = await renderScreen();
  await act(async () => { await renderer.root.findByType(Switch).props.onValueChange(false); });
  expect(Alert.alert).toHaveBeenCalledWith('No se pudo cambiar la renovación', 'No pudimos comunicarnos con Stripe.');
});

it('sin Stripe configurado el botón Suscribirme se ve y explica por qué no se puede pagar', async () => {
  api.get.mockImplementation((path) => Promise.resolve({
    data: path === 'users/me/' ? ME : { ...RESPONSE, paid: [], stripe_enabled: false },
  }));
  const renderer = await renderScreen();
  const button = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((child) => child.type === Text && child.props.children === 'Suscribirme').length > 0
  )).pop();
  expect(button).toBeDefined();

  await act(async () => { button.props.onPress(); });
  expect(Alert.alert).toHaveBeenCalledWith(
    'Pagos no disponibles', 'Por ahora no se pueden hacer pagos. Intenta de nuevo más tarde.',
  );
});

it('si el backend no responde, lo dice y el botón sigue ahí', async () => {
  api.get.mockImplementation((path) => (
    path === 'users/me/' ? Promise.resolve({ data: ME }) : Promise.reject(new Error('404'))
  ));
  const renderer = await renderScreen();
  expect(textsOf(renderer)).toEqual(expect.arrayContaining([
    'No se pudieron cargar tus suscripciones. Toca para reintentar.', 'Suscribirme',
  ]));
});
