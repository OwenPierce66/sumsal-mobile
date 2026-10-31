/**
 * __tests__/screens/DeleteAccountScreen.test.js
 *
 * Eliminar la cuenta: pide contraseña y escribir ELIMINAR; al terminar cierra la sesión local.
 */
import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import DeleteAccountScreen from '../../screens/DeleteAccountScreen';

jest.mock('@api', () => ({ __esModule: true, default: { post: jest.fn() } }));
const mockSignOut = jest.fn();
jest.mock('@app', () => {
  const { createContext } = jest.requireActual('react');
  return { AuthContext: createContext({ signOut: (...args) => mockSignOut(...args) }) };
});

const navigation = { goBack: jest.fn() };
const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string').join(''));
const input = (renderer, placeholder) => renderer.root.findAllByType(TextInput).find((node) => node.props.placeholder === placeholder);
const deleteButton = (renderer) => renderer.root.findAllByType(TouchableOpacity)
  .find((node) => node.props.accessibilityLabel === 'Eliminar mi cuenta para siempre');
const open = async () => {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<DeleteAccountScreen navigation={navigation} />); });
  return renderer;
};
const fill = async (renderer, { password = 'mi-clave', word = 'eliminar' } = {}) => {
  await act(async () => { input(renderer, 'Contraseña').props.onChangeText(password); });
  await act(async () => { input(renderer, 'ELIMINAR').props.onChangeText(word); });
};
const pressDelete = (renderer) => act(async () => { deleteButton(renderer).props.onPress(); });

beforeEach(() => jest.clearAllMocks());

it('explica lo que se pierde', async () => {
  const renderer = await open();
  const texts = textsOf(renderer).join(' ');
  expect(texts).toContain('no se puede deshacer');
  expect(texts).toContain('suscripciones');
  act(() => renderer.unmount());
});

it('no deja eliminar sin la contraseña y la palabra', async () => {
  const renderer = await open();
  expect(deleteButton(renderer).props.disabled).toBe(true);
  await fill(renderer, { word: 'borrar' });
  expect(deleteButton(renderer).props.disabled).toBe(true);
  await pressDelete(renderer);
  expect(api.post).not.toHaveBeenCalled();
  await fill(renderer, { password: '', word: 'ELIMINAR' });
  expect(deleteButton(renderer).props.disabled).toBe(true);
  act(() => renderer.unmount());
});

it('elimina la cuenta y cierra la sesión sin volver a llamar al servidor', async () => {
  const renderer = await open();
  await fill(renderer);
  api.post.mockResolvedValueOnce({ status: 204 });
  await pressDelete(renderer);
  expect(api.post).toHaveBeenCalledWith('users/me/delete/', { password: 'mi-clave' }, expect.any(Object));
  expect(mockSignOut).toHaveBeenCalledWith({ accountDeleted: true });
  act(() => renderer.unmount());
});

it('una contraseña incorrecta se muestra y no cierra la sesión', async () => {
  const renderer = await open();
  await fill(renderer);
  api.post.mockRejectedValueOnce({ response: { status: 400, data: { password: ['La contraseña no es correcta.'] } } });
  await pressDelete(renderer);
  expect(textsOf(renderer)).toContain('La contraseña no es correcta.');
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(deleteButton(renderer).props.disabled).toBe(false);
  act(() => renderer.unmount());
});

it('si no se pudieron cancelar los cobros, avisa que la cuenta sigue activa', async () => {
  const renderer = await open();
  await fill(renderer);
  const detail = 'No pudimos cancelar tus suscripciones. Tu cuenta sigue activa: intenta de nuevo.';
  api.post.mockRejectedValueOnce({ response: { status: 503, data: { detail } } });
  await pressDelete(renderer);
  expect(textsOf(renderer)).toContain(detail);
  expect(mockSignOut).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});

it('sin conexión también lo dice', async () => {
  const renderer = await open();
  await fill(renderer);
  api.post.mockRejectedValueOnce(new Error('Network Error'));
  await pressDelete(renderer);
  expect(textsOf(renderer).join(' ')).toContain('Revisa tu conexión');
  act(() => renderer.unmount());
});
