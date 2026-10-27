/**
 * __tests__/components/subscriptions.test.js
 *
 * Suscribirse con monto libre, regalar una a otro perfil y verla en el perfil.
 */
import React from 'react';
import { Alert, AppState, Linking, Switch, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@api';
import SubscribeSheet from '../../components/SubscribeSheet';
import ProfileSubscription from '../../components/ProfileSubscription';

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
}));

const textsOf = (renderer) => renderer.root
  .findAllByType(Text)
  .map((node) => [].concat(node.props.children)
    .filter((part) => typeof part === 'string' || typeof part === 'number')
    .join(''));

const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((child) => child.type === Text && textsOf({ root: child }).some((t) => t === label)).length > 0
  )).pop();
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

const pressLabel = async (renderer, label) => {
  const target = renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

const typeAmount = async (renderer, value) => {
  const input = renderer.root.findAll((node) => node.type === TextInput && node.props.accessibilityLabel === 'Monto al mes')[0];
  await act(async () => { input.props.onChangeText(value); });
};

// React Query entrega los datos en un setTimeout: con timers falsos hay que avanzarlos.
const flush = async () => {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
  }
};

let mounted;
let appStateListener;
async function render(element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    mounted = TestRenderer.create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  await flush();
  return mounted;
}

beforeEach(() => {
  jest.useFakeTimers();
  api.get.mockReset();
  api.post.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(true);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
    appStateListener = handler;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('SubscribeSheet', () => {
  it('sugiere 16 MXN, deja elegir 10 MXN y no deja pagar menos', async () => {
    const renderer = await render(<SubscribeSheet visible onClose={jest.fn()} />);
    expect(textsOf(renderer)).toContain('Pagar $16.00 MXN al mes');

    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['$10.00 MXN', '$16.00 MXN', 'Mínimo $10.00 MXN al mes.']));
    await pressText(renderer, '$10.00 MXN');
    expect(textsOf(renderer)).toContain('Pagar $10.00 MXN al mes');

    await typeAmount(renderer, '9');
    expect(textsOf(renderer)).toContain('El mínimo es $10.00 MXN al mes.');
    await pressLabel(renderer, 'Ir a pagar');
    expect(api.post).not.toHaveBeenCalled();

    await pressText(renderer, 'USD');
    expect(textsOf(renderer)).toContain('Pagar $1.00 USD al mes');
  });

  it('paga el monto elegido, sin renovación, y confirma al volver a la app', async () => {
    api.post.mockResolvedValueOnce({
      data: { subscription: { id: 'sub-local' }, checkout_url: 'https://checkout.stripe.com/c/cs_1' },
    });
    const onClose = jest.fn();
    const renderer = await render(<SubscribeSheet visible onClose={onClose} />);

    await typeAmount(renderer, '37,50');
    await act(async () => { renderer.root.findByType(Switch).props.onValueChange(false); });
    expect(textsOf(renderer)).toContain('Se cobra solo este mes y termina sola.');
    await pressLabel(renderer, 'Ir a pagar');

    expect(api.post).toHaveBeenCalledWith('subscriptions/checkout/', {
      amount: '37.50', currency: 'mxn', auto_renew: false,
    });
    expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.stripe.com/c/cs_1');
    expect(onClose).toHaveBeenCalled();

    api.post.mockResolvedValueOnce({ data: { id: 'sub-local', is_active: true } });
    await act(async () => { await appStateListener('active'); });
    expect(api.post).toHaveBeenLastCalledWith('subscriptions/sub-local/sync/');

    // Ya quedó pagada: no se vuelve a preguntar.
    await act(async () => { await appStateListener('active'); });
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  it('regala la suscripción a otro perfil', async () => {
    api.post.mockResolvedValueOnce({ data: { subscription: { id: 's' }, checkout_url: 'https://checkout.stripe.com/x' } });
    const renderer = await render(<SubscribeSheet visible onClose={jest.fn()} recipient={{ id: 'luis-id', username: 'luis' }} />);
    expect(textsOf(renderer)).toContain('Suscribir a @luis');

    await pressText(renderer, 'USD');
    await pressText(renderer, '$5.00 USD');
    await pressLabel(renderer, 'Ir a pagar');
    expect(api.post).toHaveBeenCalledWith('subscriptions/checkout/', {
      amount: '5', currency: 'usd', auto_renew: true, recipient_id: 'luis-id',
    });
  });

  it('muestra el motivo si el backend lo rechaza', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 400, data: { detail: 'Ya pagas una suscripción activa para este perfil.' } },
    });
    const renderer = await render(<SubscribeSheet visible onClose={jest.fn()} />);
    await pressLabel(renderer, 'Ir a pagar');
    expect(textsOf(renderer)).toContain('Ya pagas una suscripción activa para este perfil.');
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});

describe('ProfileSubscription', () => {
  const navigation = { navigate: jest.fn() };

  it('en otro perfil muestra lo que recibe y deja regalarle una', async () => {
    api.get.mockResolvedValueOnce({ data: {
      active: true, amount_usd: '8.00', tier: 'sub_red', subscribers_count: 2,
      my_subscription: null, stripe_enabled: true,
    } });
    const renderer = await render(
      <ProfileSubscription userId="luis-id" username="luis" isCurrentUser={false} navigation={navigation} />,
    );
    expect(api.get).toHaveBeenCalledWith('subscriptions/status/luis-id/');
    expect(textsOf(renderer)).toEqual(expect.arrayContaining([
      'Suscripción +', '$8.00 USD al mes · 2 suscriptores', 'Suscribir a @luis',
    ]));

    await pressText(renderer, 'Suscribir a @luis');
    expect(textsOf(renderer)).toContain('Tú pagas y la suscripción aparece en su perfil. Tú eliges cuánto aportar al mes.');
  });

  it('si ya le pago una, muestra cuándo se renueva en vez del botón', async () => {
    api.get.mockResolvedValueOnce({ data: {
      active: true, amount_usd: '1.00', tier: 'sub_green', subscribers_count: 1, stripe_enabled: true,
      my_subscription: {
        id: 's1', amount: '16.00', currency: 'mxn', is_active: true, auto_renew: false,
        current_period_end: '2026-11-26T12:00:00Z',
      },
    } });
    const renderer = await render(
      <ProfileSubscription userId="luis-id" username="luis" isCurrentUser={false} navigation={navigation} />,
    );
    expect(textsOf(renderer)).toEqual(expect.arrayContaining([
      'Suscripción', 'Le pagas $16.00 MXN al mes · Termina el 26 de noviembre',
    ]));
    expect(textsOf(renderer)).not.toContain('Suscribir a @luis');

    await pressText(renderer, 'Mis suscripciones');
    expect(navigation.navigate).toHaveBeenCalledWith('Subscriptions');
  });

  it('si el estado no carga, el botón sigue visible', async () => {
    api.get.mockRejectedValueOnce(new Error('404'));
    const renderer = await render(
      <ProfileSubscription userId="me-id" username="yo" isCurrentUser navigation={navigation} />,
    );
    expect(textsOf(renderer)).toEqual(expect.arrayContaining([
      'No se pudo cargar la suscripción. Toca para reintentar.', 'Suscribirme',
    ]));
    await pressText(renderer, 'Suscribirme');
    expect(Alert.alert).toHaveBeenCalledWith('Pagos no disponibles', expect.any(String));
  });

  it('en mi perfil sin suscripción invita a suscribirme', async () => {
    api.get.mockResolvedValueOnce({ data: {
      active: false, amount_usd: '0.00', tier: null, subscribers_count: 0, my_subscription: null, stripe_enabled: true,
    } });
    const renderer = await render(
      <ProfileSubscription userId="me-id" username="yo" isCurrentUser navigation={navigation} />,
    );
    expect(textsOf(renderer)).toEqual(expect.arrayContaining([
      'No tienes una suscripción activa.', 'Suscribirme', 'Mis suscripciones',
    ]));
  });
});
