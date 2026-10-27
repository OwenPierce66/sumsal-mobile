/**
 * __tests__/components/UserBadges.test.js
 *
 * Insignias (App, admin, recomendado, verificado, suscripción) junto a cada nombre.
 */
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import TouchableUsername from '../../components/TouchableUsername';
import UserBadges, { NameWithBadges } from '../../components/UserBadges';
import { invalidateUserBadges } from '../../hooks/useUserBadges';

// El corazón de seguir junto a cada nombre (useMyRelations) necesita React Query; aquí no aplica.
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({ ready: false, getState: () => null, setStateLocally: () => {}, refresh: () => {} }),
}));

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
}));

const iconsOf = (renderer) => renderer.root.findAllByType(Ionicons).map((node) => node.props.name);

const flush = async () => {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
  }
};

let mounted;
async function render(element) {
  await act(async () => { mounted = TestRenderer.create(element); });
  await flush();
  return mounted;
}

beforeEach(() => {
  jest.useFakeTimers();
  invalidateUserBadges();
  api.get.mockReset().mockResolvedValue({ data: {
    ana: ['verified', 'sub_red'],
    luis: ['sub_green'],
    owen: ['app', 'admin'],
  } });
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  jest.useRealTimers();
});

it('todos los nombres en pantalla piden sus insignias en una sola petición', async () => {
  const renderer = await render(
    <View>
      <TouchableUsername username="ana" userId="ana" />
      <TouchableUsername username="luis" userId="luis" />
      <TouchableUsername username="ana otra vez" userId="ana" />
      <TouchableUsername username="sin insignias" userId="nadie" />
    </View>,
  );

  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('users/badges/', { params: { ids: 'ana,luis,nadie' } });
  expect(iconsOf(renderer)).toEqual(['checkmark-circle', 'star', 'star-half', 'checkmark-circle', 'star']);

  const labels = renderer.root.findAll((node) => node.props.accessible && node.props.accessibilityLabel)
    .map((node) => node.props.accessibilityLabel);
  expect(labels).toContain('Verificado, Suscripción +');
  expect(labels).toContain('Suscripción');
});

it('se guardan en caché: volver a mostrar el nombre no repite la petición', async () => {
  await render(<UserBadges userId="owen" />);
  act(() => mounted.unmount());
  const renderer = await render(<NameWithBadges userId="owen">owen</NameWithBadges>);
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(iconsOf(renderer)).toEqual(['apps', 'shield-checkmark']);
});

it('después de pagar se vuelven a pedir', async () => {
  await render(<UserBadges userId="luis" />);
  api.get.mockResolvedValueOnce({ data: { luis: ['sub_red'] } });
  await act(async () => { invalidateUserBadges(); });
  await flush();
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(iconsOf(mounted)).toEqual(['star']);
});

it('si falla la petición, el nombre se muestra igual sin insignias', async () => {
  api.get.mockRejectedValueOnce(new Error('offline'));
  const renderer = await render(<TouchableUsername username="ana" userId="ana" />);
  expect(iconsOf(renderer)).toEqual([]);
  expect(renderer.root.findAll((node) => [].concat(node.props.children).includes('ana')).length).toBeGreaterThan(0);
});

it('se puede apagar donde no hace falta', async () => {
  const renderer = await render(<TouchableUsername username="ana" userId="ana" showBadges={false} />);
  expect(api.get).not.toHaveBeenCalled();
  expect(iconsOf(renderer)).toEqual([]);
});
