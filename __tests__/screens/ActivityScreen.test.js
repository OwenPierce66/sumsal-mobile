/**
 * __tests__/screens/ActivityScreen.test.js
 *
 * Tu actividad (desde el menú de tu perfil): tu actividad completa con sus controles.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ActivityScreen from '../../screens/ActivityScreen';

jest.mock('@api', () => ({ __esModule: true, default: {}, getImageUrl: (path) => path || null }));
jest.mock('@hooks/useApi', () => ({ useMe: () => ({ data: { id: 'ana-id', username: 'ana' } }) }));
const mockActivity = jest.fn(() => null);
jest.mock('@components/ProfileActivity', () => (props) => mockActivity(props));

it('muestra tu actividad como dueño y abre los perfiles; la flecha regresa', async () => {
  const navigation = { goBack: jest.fn(), push: jest.fn() };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<ActivityScreen navigation={navigation} />); });
  expect(mockActivity).toHaveBeenLastCalledWith(expect.objectContaining({
    userId: 'ana-id', username: 'ana', isCurrentUser: true, showTitle: false,
  }));
  await act(async () => { mockActivity.mock.calls.slice(-1)[0][0].onOpenProfile({ id: 'eva', username: 'eva' }); });
  expect(navigation.push).toHaveBeenCalledWith('UserProfile', expect.objectContaining({ userId: 'eva' }));
  const back = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Volver' && node.props.onPress)[0];
  await act(async () => { back.props.onPress(); });
  expect(navigation.goBack).toHaveBeenCalled();
  act(() => renderer.unmount());
});
