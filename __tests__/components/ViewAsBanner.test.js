/**
 * __tests__/components/ViewAsBanner.test.js
 *
 * "Ver como" en toda la app: un solo estado para el feed, Reels y Top, con su franja y Salir.
 */
import React from 'react';
import { Text, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import ViewAsBanner from '../../components/ViewAsBanner';
import { getViewAs, setViewAs } from '../../hooks/useViewAs';

afterEach(() => act(() => setViewAs(null)));

const textsOf = (renderer) => renderer.root.findAllByType(Text).map((node) => [].concat(node.props.children).join(''));

it('solo sale mientras se ve como alguien, y Salir lo quita en todas partes', async () => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<View><ViewAsBanner /><ViewAsBanner what="los reels" /></View>);
  });
  expect(textsOf(renderer)).toEqual([]);

  act(() => setViewAs({ id: 'ana-id', username: 'ana', extra: 'no se guarda' }));
  expect(getViewAs()).toEqual({ id: 'ana-id', username: 'ana' });
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Viendo el feed como @ana', 'Viendo los reels como @ana']));

  const exit = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Salir de ver como' && node.props.onPress)[0];
  await act(async () => { exit.props.onPress(); });
  expect(getViewAs()).toBeNull();
  expect(textsOf(renderer)).toEqual([]);
  act(() => renderer.unmount());
});

it('sin id no se activa', () => {
  setViewAs({ username: 'sin-id' });
  expect(getViewAs()).toBeNull();
});
