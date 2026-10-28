/**
 * __tests__/screens/CreateTaskScreen.test.js
 *
 * Enlaces de los bloques (función de peticiones.js en la web): ahora van dentro
 * del texto de la descripción en lugar de un campo aparte.
 */
import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import CreateTaskScreen from '../../screens/CreateTaskScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
}));

const mockCategories = {
  appCategories: { data: [] },
  myCategories: { data: [] },
};
const mockAdmin = { data: { isAdmin: false, isStaff: false } };
jest.mock('@hooks/useApi', () => ({
  useCreateTaskCategories: () => mockCategories,
  useIsAdmin: () => mockAdmin,
}));

const inputsBy = (renderer, placeholder) =>
  renderer.root.findAll((node) => node.type === TextInput && node.props.placeholder === placeholder);

const type = async (renderer, placeholder, value, index = 0) => {
  await act(async () => { inputsBy(renderer, placeholder)[index].props.onChangeText(value); });
};

const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((child) => child.type === Text && child.props.children === label).length > 0
  ))[0];
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

const textsOf = (renderer) => renderer.root
  .findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));

const formValue = (formData, key) => (
  typeof formData.get === 'function'
    ? formData.get(key)
    : formData.getParts().find((part) => part.fieldName === key)?.string
);

let mounted;
async function renderScreen(params = {}) {
  const navigation = { goBack: jest.fn(), canGoBack: () => true, navigate: jest.fn() };
  await act(async () => {
    // Desde el feed se abre con el tipo (PCH) activo: ahora es obligatorio elegirlo.
    mounted = TestRenderer.create(
      <CreateTaskScreen navigation={navigation} route={{ params: { initialPch: 'consejos', ...params } }} />,
    );
  });
  return mounted;
}

beforeEach(() => {
  jest.useFakeTimers();
  api.post.mockReset().mockResolvedValue({ data: { id: 'nueva' } });
  api.patch.mockReset().mockResolvedValue({ data: {} });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  jest.useRealTimers();
  Alert.alert.mockRestore();
});

it('no hay campo de enlace aparte: el enlace va en la descripción', async () => {
  const renderer = await renderScreen();
  expect(inputsBy(renderer, 'Enlace (opcional)')).toHaveLength(0);

  await type(renderer, '¿Qué objetivo quieres compartir?', 'Mi aportación');
  await type(renderer, 'Descripción...', 'Guía completa en https://ejemplo.com/guia');
  await pressText(renderer, 'PUBLICAR ÉXITO');

  const [path, formData] = api.post.mock.calls[0];
  expect(path).toBe('tasks/');
  expect(formValue(formData, 'subtasks[0][description]')).toBe('Guía completa en https://ejemplo.com/guia');
  expect(formValue(formData, 'subtasks[0][link]') ?? null).toBeNull();
});

it('al editar, el enlace que la web guardaba aparte pasa a la descripción', async () => {
  const task = {
    id: 't1', title: 'Tarea', description: '', pch: 'consejos', categories: '',
    subtasks: [
      { id: 1, title: 'Con enlace', description: 'Lee la guía', link: 'ejemplo.com/guia' },
      { id: 2, title: 'Ya escrito', description: 'Ver https://x.com', link: 'https://x.com' },
      { id: 3, title: 'Basura de la web', description: 'Sin enlace', link: 'undefined' },
    ],
    subfactores: [],
    subfuentes: [],
  };
  const renderer = await renderScreen({ task });
  const descriptions = inputsBy(renderer, 'Descripción...').map((node) => node.props.value);
  expect(descriptions.slice(0, 3)).toEqual([
    'Lee la guía\nhttps://ejemplo.com/guia',
    'Ver https://x.com',
    'Sin enlace',
  ]);

  await pressText(renderer, 'GUARDAR CAMBIOS');
  const [path, formData] = api.patch.mock.calls[0];
  expect(path).toBe('tasks/t1/');
  expect(formValue(formData, 'subtasks[0][description]')).toBe('Lee la guía\nhttps://ejemplo.com/guia');
  // El campo aparte se vacía para que el enlace no se muestre dos veces.
  expect(formValue(formData, 'subtasks[0][link]')).toBe('');
  expect(formValue(formData, 'subtasks[2][link]')).toBe('');
});

it('ya no ofrece traducir el título', async () => {
  const renderer = await renderScreen();
  const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
  expect(texts).not.toContain('Traducir título');
});

it('se puede guardar oculta: solo en mi perfil, para ver cómo quedaría', async () => {
  const renderer = await renderScreen();
  await type(renderer, '¿Qué objetivo quieres compartir?', 'Borrador');
  expect(textsOf(renderer)).toContain('Todos podrán verla en el inicio, en reels y en tu perfil.');

  await pressText(renderer, 'Solo en mi perfil (oculta)');
  expect(textsOf(renderer)).toContain('GUARDAR OCULTA');
  await pressText(renderer, 'GUARDAR OCULTA');

  const [, formData] = api.post.mock.calls[0];
  expect(formValue(formData, 'is_hidden')).toBe('true');
  expect(Alert.alert).toHaveBeenCalledWith(
    '¡Éxito!', 'Se guardó oculta en tu perfil. Solo tú la ves; publícala cuando quieras.',
  );
});

it('por defecto se publica para todos y al editar respeta si estaba oculta', async () => {
  let renderer = await renderScreen();
  await type(renderer, '¿Qué objetivo quieres compartir?', 'Pública');
  await pressText(renderer, 'PUBLICAR ÉXITO');
  expect(formValue(api.post.mock.calls[0][1], 'is_hidden')).toBe('false');
  act(() => mounted.unmount());

  renderer = await renderScreen({ task: { id: 't9', title: 'Oculta', pch: 'consejos', categories: '', is_hidden: true, subtasks: [], subfactores: [], subfuentes: [] } });
  await pressText(renderer, 'Publicar ahora');
  await pressText(renderer, 'GUARDAR CAMBIOS');
  expect(formValue(api.patch.mock.calls[0][1], 'is_hidden')).toBe('false');
});

describe('apoyo monetario al crear una petición', () => {
  const { Linking } = require('react-native');
  const byLabel = (renderer, label) => renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];

  beforeEach(() => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    api.post.mockImplementation((path) => Promise.resolve(path === 'tasks/'
      ? { data: { id: 'pet-1' } }
      : { data: { support: { id: 's1', status: 'pending' }, checkout_url: 'https://checkout.stripe.com/c/cs_1' } }));
  });
  afterEach(() => Linking.openURL.mockRestore());

  it('solo se ofrece en peticiones', async () => {
    expect(textsOf(await renderScreen())).not.toContain('Apoyo monetario (opcional)');
    act(() => mounted.unmount());
    expect(textsOf(await renderScreen({ initialPch: 'peticiones' }))).toContain('Apoyo monetario (opcional)');
  });

  it('crea la petición y luego abre Stripe con el monto elegido', async () => {
    const renderer = await renderScreen({ initialPch: 'peticiones' });
    await type(renderer, '¿Qué objetivo quieres compartir?', 'Más parques');
    await act(async () => { byLabel(renderer, 'Apoyar mi petición al crearla').props.onPress(); });
    await act(async () => { renderer.root.findAll((node) => node.type === TextInput && node.props.accessibilityLabel === 'Monto del apoyo')[0].props.onChangeText('50'); });
    await pressText(renderer, 'PUBLICAR ÉXITO');

    expect(api.post.mock.calls.map(([path]) => path)).toEqual(['tasks/', 'tasks/pet-1/support/']);
    expect(api.post.mock.calls[1][1]).toEqual({ amount: '50', currency: 'mxn' });
    expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.stripe.com/c/cs_1');
  });

  it('si el monto no alcanza el mínimo no crea nada', async () => {
    const renderer = await renderScreen({ initialPch: 'peticiones' });
    await type(renderer, '¿Qué objetivo quieres compartir?', 'Más parques');
    await act(async () => { byLabel(renderer, 'Apoyar mi petición al crearla').props.onPress(); });
    await act(async () => { renderer.root.findAll((node) => node.type === TextInput && node.props.accessibilityLabel === 'Monto del apoyo')[0].props.onChangeText('5'); });
    await pressText(renderer, 'PUBLICAR ÉXITO');

    expect(api.post).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Revisa el apoyo', 'El mínimo es $10.00 MXN.');
  });
});
