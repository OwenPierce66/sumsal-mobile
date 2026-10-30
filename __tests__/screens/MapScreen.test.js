/**
 * __tests__/screens/MapScreen.test.js
 *
 * Pestaña Mapa: pide el permiso al abrir, se centra en la persona y explica qué hacer
 * si no se puede mostrar su ubicación. También la versión web (OpenStreetMap).
 */
import React from 'react';
import { Linking, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import * as Location from 'expo-location';
import MapScreen from '../../screens/MapScreen';
import WebMapScreen, { openStreetMapUrl } from '../../screens/MapScreen.web';

const mockAnimateToRegion = jest.fn();
jest.mock('react-native-maps', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  const MockMapView = forwardRef((_props, ref) => {
    useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
    return null;
  });
  return { __esModule: true, default: MockMapView, PROVIDER_GOOGLE: 'google' };
});
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const POSITION = { coords: { latitude: 28.5, longitude: -106.1 } };
const textsOf = (renderer) => renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));
const render = async (Screen = MapScreen) => {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<Screen />); });
  return renderer;
};
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((child) => child.type === Text && child.props.children === label).length > 0
  )).pop();
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};
const grant = () => Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });

beforeEach(() => {
  jest.clearAllMocks();
  Location.getLastKnownPositionAsync.mockResolvedValue(null);
  Location.getCurrentPositionAsync.mockResolvedValue(POSITION);
});

it('con permiso muestra el punto azul y se centra en la persona', async () => {
  grant();
  const renderer = await render();
  const map = renderer.root.findByProps({ provider: 'google' });
  expect(map.props.showsUserLocation).toBe(true);
  expect(map.props.showsMyLocationButton).toBe(true);
  expect(mockAnimateToRegion).toHaveBeenLastCalledWith(
    { latitude: 28.5, longitude: -106.1, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600,
  );
  expect(textsOf(renderer)).toEqual([]);
  act(() => renderer.unmount());
});

it('si lo niega se puede volver a pedir', async () => {
  Location.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied', canAskAgain: true });
  const renderer = await render();
  expect(renderer.root.findByProps({ provider: 'google' }).props.showsUserLocation).toBe(false);
  expect(textsOf(renderer)).toContain('Activa tu ubicación para verte en el mapa.');

  grant();
  await pressText(renderer, 'Permitir');
  expect(renderer.root.findByProps({ provider: 'google' }).props.showsUserLocation).toBe(true);
  expect(textsOf(renderer)).toEqual([]);
  act(() => renderer.unmount());
});

it('si ya no se puede pedir, lleva a Ajustes', async () => {
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
  const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  const renderer = await render();
  await pressText(renderer, 'Abrir Ajustes');
  expect(openSettings).toHaveBeenCalled();
  act(() => renderer.unmount());
});

it('si no se puede leer la posición (GPS apagado) deja reintentar', async () => {
  grant();
  Location.getCurrentPositionAsync.mockRejectedValueOnce(new Error('GPS apagado'));
  const renderer = await render();
  expect(textsOf(renderer)).toContain('No pudimos obtener tu ubicación. Revisa que el GPS esté encendido.');
  expect(mockAnimateToRegion).not.toHaveBeenCalled();

  await pressText(renderer, 'Reintentar');
  expect(mockAnimateToRegion).toHaveBeenCalled();
  expect(textsOf(renderer)).toEqual([]);
  act(() => renderer.unmount());
});

it('en la web usa OpenStreetMap, centrado en la persona cuando se conoce', async () => {
  grant();
  const renderer = await render(WebMapScreen);
  const src = renderer.root.findByType('iframe').props.src;
  expect(src).toContain('openstreetmap.org/export/embed.html');
  expect(src).toContain('marker=28.5,-106.1');
  expect(openStreetMapUrl(null)).not.toContain('marker=');
  act(() => renderer.unmount());
});
