/**
 * __tests__/screens/ForgotPasswordScreen.test.js
 *
 * Recuperar la contraseña: pedir el código, elegir una nueva y volver al login con el aviso.
 */
import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import ForgotPasswordScreen from '../../screens/ForgotPasswordScreen';
import LoginScreen from '../../screens/LoginScreen';

jest.mock('@api', () => ({ __esModule: true, default: { post: jest.fn() }, saveAuthData: jest.fn() }));
jest.mock('@app', () => {
  const { createContext } = jest.requireActual('react');
  return { AuthContext: createContext({ signIn: jest.fn() }) };
});

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));
const input = (renderer, placeholder) => renderer.root.findAllByType(TextInput).find((node) => node.props.placeholder === placeholder);
const type = (renderer, placeholder, value) => act(async () => { input(renderer, placeholder).props.onChangeText(value); });
const press = async (renderer, label) => {
  const button = renderer.root.findAll((node) => node.props.onPress && node.findAll((c) => c.type === Text && [].concat(c.props.children).join('') === label).length).pop();
  await act(async () => { button.props.onPress(); });
};
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const open = async (params) => {
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<ForgotPasswordScreen navigation={navigation} route={{ params }} />); });
  return renderer;
};
const askForCode = async (renderer, email = 'ana@example.com') => {
  await type(renderer, 'Correo', email);
  api.post.mockResolvedValueOnce({ data: { detail: 'ok' } });
  await press(renderer, 'Enviar código');
};
const fillNewPassword = async (renderer, { code = '123456', password = 'clave-nueva-1', repeat = password } = {}) => {
  await type(renderer, 'Código de 6 dígitos', code);
  await type(renderer, 'Contraseña nueva', password);
  await type(renderer, 'Repite la contraseña nueva', repeat);
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

it('pide el código y pasa a elegir la contraseña sin decir si la cuenta existe', async () => {
  const renderer = await open();
  await askForCode(renderer, '  ana@example.com ');
  expect(api.post).toHaveBeenCalledWith('auth/password-reset/', { email: 'ana@example.com' }, expect.any(Object));
  expect(textsOf(renderer).join(' ')).toContain('Si existe una cuenta con ana@example.com');
  expect(input(renderer, 'Código de 6 dígitos')).toBeTruthy();
  act(() => renderer.unmount());
});

it('no envía un correo mal escrito', async () => {
  const renderer = await open();
  await type(renderer, 'Correo', 'no-es-correo');
  await press(renderer, 'Enviar código');
  expect(api.post).not.toHaveBeenCalled();
  expect(textsOf(renderer)).toContain('Ingresa un email válido.');
  act(() => renderer.unmount());
});

it('muestra por qué no se pudo enviar', async () => {
  const renderer = await open({ email: 'ana@example.com' });
  api.post.mockRejectedValueOnce({ response: { status: 503, data: { detail: 'Por ahora no podemos enviar correos.' } } });
  await press(renderer, 'Enviar código');
  expect(textsOf(renderer)).toContain('Por ahora no podemos enviar correos.');
  expect(input(renderer, 'Correo')).toBeTruthy();
  act(() => renderer.unmount());
});

it('cambia la contraseña y vuelve al login con el aviso y el correo', async () => {
  const renderer = await open();
  await askForCode(renderer, 'ANA@example.com');
  await fillNewPassword(renderer);
  api.post.mockResolvedValueOnce({ data: { detail: 'Tu contraseña se cambió.', email: 'ana@example.com' } });
  await press(renderer, 'Cambiar contraseña');
  expect(api.post).toHaveBeenLastCalledWith(
    'auth/password-reset/confirm/',
    { email: 'ANA@example.com', code: '123456', new_password: 'clave-nueva-1' },
    expect.any(Object),
  );
  expect(navigation.navigate).toHaveBeenCalledWith('Login', { email: 'ana@example.com', notice: 'Tu contraseña se cambió.' });
  act(() => renderer.unmount());
});

it('revisa el código y las contraseñas antes de enviar', async () => {
  const renderer = await open();
  await askForCode(renderer);
  await fillNewPassword(renderer, { code: '12', password: 'clave-nueva-1', repeat: 'otra-distinta' });
  await press(renderer, 'Cambiar contraseña');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Escribe los 6 dígitos del código.', 'Las contraseñas no coinciden.']));
  act(() => renderer.unmount());
});

it('muestra en su campo los errores del servidor', async () => {
  const renderer = await open();
  await askForCode(renderer);
  await fillNewPassword(renderer);
  api.post.mockRejectedValueOnce({ response: { status: 400, data: { code: ['El código no es válido.'] } } });
  await press(renderer, 'Cambiar contraseña');
  expect(textsOf(renderer)).toContain('El código no es válido.');
  api.post.mockRejectedValueOnce({ response: { status: 400, data: { new_password: ['Es muy común.', 'Es muy corta.'] } } });
  await press(renderer, 'Cambiar contraseña');
  expect(textsOf(renderer)).toContain('Es muy común. Es muy corta.');
  expect(navigation.navigate).not.toHaveBeenCalled();
  act(() => renderer.unmount());
});

it('solo deja reenviar el código después de un minuto', async () => {
  const renderer = await open();
  await askForCode(renderer);
  expect(textsOf(renderer)).toContain('Reenviar código en 60 s');
  for (let second = 0; second < 60; second += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { jest.advanceTimersByTime(1000); });
  }
  api.post.mockResolvedValueOnce({ data: { detail: 'ok' } });
  await press(renderer, 'Reenviar código');
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(textsOf(renderer)).toContain('Reenviar código en 60 s');
  act(() => renderer.unmount());
});

describe('LoginScreen', () => {
  const openLogin = async (params) => {
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<LoginScreen navigation={navigation} route={{ params }} />); });
    return renderer;
  };

  it('lleva a recuperar la contraseña con el correo ya escrito', async () => {
    const renderer = await openLogin();
    await type(renderer, 'Email o usuario', ' ana@example.com ');
    await press(renderer, '¿Olvidaste tu contraseña?');
    expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword', { email: 'ana@example.com' });
    act(() => renderer.unmount());
  });

  it('no pasa un nombre de usuario como si fuera correo', async () => {
    const renderer = await openLogin();
    await type(renderer, 'Email o usuario', 'ana');
    await press(renderer, '¿Olvidaste tu contraseña?');
    expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword', { email: '' });
    act(() => renderer.unmount());
  });

  it('al volver muestra el aviso y deja el correo escrito', async () => {
    const renderer = await openLogin({ email: 'ana@example.com', notice: 'Tu contraseña se cambió.' });
    expect(textsOf(renderer)).toContain('Tu contraseña se cambió.');
    expect(input(renderer, 'Email o usuario').props.value).toBe('ana@example.com');
    act(() => renderer.unmount());
  });
});
