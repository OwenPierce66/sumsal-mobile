/**
 * __tests__/screens/CategoryExplorerScreen.test.js
 *
 * Explorar categorías: tarjetas con imagen y descripción, nivel por nivel, lo más
 * destacado de cada una y el botón que abre el feed ya filtrado.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import CategoryExplorerScreen from '../../screens/CategoryExplorerScreen';

jest.mock('@api', () => ({
  __esModule: true,
  default: { patch: jest.fn() },
  UPLOAD_TIMEOUT_MS: 1000,
  getImageUrl: (path) => (path ? path.replace(/^https?:\/\/[^/]+/, 'http://api:8001') : null),
}));
jest.mock('../../utils/mediaUpload', () => ({ appendMediaFile: jest.fn() }));
const mockInvalidate = jest.fn();
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));

const CATEGORIES = [
  { id: 1, name: 'Salud', parent: null, description: 'Cuerpo y mente.', image_url: 'http://x/salud.png' },
  { id: 2, name: 'Nutrición', parent: 1, description: 'Comer bien.', image_url: null },
  { id: 3, name: 'Ejercicio', parent: 1, description: '', image_url: null },
  { id: 4, name: 'Dinero', parent: null, description: '', image_url: null },
  { id: 5, name: 'Aprobada', parent: null, description: '', image_url: null },
];
const mockCategories = jest.fn();
const mockTasks = jest.fn();
let mockAdmin = { isAdmin: false, isStaff: false };
jest.mock('@hooks/useApi', () => ({
  useCategories: (pch) => mockCategories(pch),
  useIsAdmin: () => ({ data: mockAdmin }),
  useTasks: (params) => mockTasks(params),
}));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));
const press = async (renderer, label) => {
  const target = renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((child) => child.type === Text && child.props.children === label).length > 0
  )).pop();
  await act(async () => { await target.props.onPress(); });
};

let navigation;
let parentNavigate;
const renderExplorer = async (params = {}) => {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(<CategoryExplorerScreen navigation={navigation} route={{ params }} />);
  });
  return renderer;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAdmin = { isAdmin: false, isStaff: false };
  mockCategories.mockReturnValue({ data: CATEGORIES, isLoading: false, isError: false, refetch: jest.fn() });
  mockTasks.mockReturnValue({ data: [{ id: 't1', title: 'Desayuno sano', description: 'Avena', likes_count: 7, username: 'ana' }], isLoading: false });
  parentNavigate = jest.fn();
  navigation = { goBack: jest.fn(), push: jest.fn(), getParent: () => ({ navigate: parentNavigate }) };
});

it('muestra las categorías principales con su descripción y sin "Aprobada"', async () => {
  const renderer = await renderExplorer();
  const texts = textsOf(renderer);
  expect(mockCategories).toHaveBeenLastCalledWith('consejos');
  expect(texts).toEqual(expect.arrayContaining(['Categorías', 'Salud', 'Cuerpo y mente.', '2 subcategorías', 'Dinero']));
  expect(texts).not.toContain('Aprobada');
  expect(texts).not.toContain('Nutrición');
  act(() => renderer.unmount());
});

it('se entra nivel por nivel y se vuelve con la ruta o la flecha', async () => {
  const renderer = await renderExplorer();
  await press(renderer, 'Abrir categoría Salud');
  let texts = textsOf(renderer);
  expect(texts).toEqual(expect.arrayContaining(['Salud', 'Cuerpo y mente.', 'Subcategorías', 'Nutrición', 'Comer bien.', 'Ejercicio', 'Lo más destacado', 'Desayuno sano']));
  expect(mockTasks).toHaveBeenLastCalledWith({ pch: 'consejos', category: 'Salud', sort_by: 'likes', page_size: 5 });

  await press(renderer, 'Abrir categoría Nutrición');
  expect(mockTasks).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'Salud,Nutrición' }));
  expect(textsOf(renderer)).not.toContain('Subcategorías');

  await press(renderer, 'Volver');
  expect(textsOf(renderer)).toContain('Subcategorías');
  await press(renderer, 'Todas las categorías');
  expect(textsOf(renderer)).toContain('Categorías');
  await press(renderer, 'Volver');
  expect(navigation.goBack).toHaveBeenCalled();
  act(() => renderer.unmount());
});

it('"Ver publicaciones" abre el feed filtrado por esa categoría', async () => {
  const renderer = await renderExplorer({ pch: 'peticiones', path: 'Salud,Nutrición' });
  expect(mockCategories).toHaveBeenLastCalledWith('peticiones');
  await press(renderer, 'Ver publicaciones de Nutrición');
  expect(parentNavigate).toHaveBeenCalledWith('Tasks', {
    screen: 'TasksList', params: { categoryPath: 'Salud,Nutrición', categoryPch: 'peticiones' },
  });
  await press(renderer, 'Abrir publicación Desayuno sano');
  expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 't1' });
  act(() => renderer.unmount());
});

it('al cambiar de tipo vuelve al inicio con sus categorías', async () => {
  const renderer = await renderExplorer({ path: 'Salud' });
  await pressText(renderer, 'Historias');
  expect(mockCategories).toHaveBeenLastCalledWith('historias');
  expect(textsOf(renderer)).toContain('Categorías');
  act(() => renderer.unmount());
});

it('solo un admin ve el lápiz para editar la presentación', async () => {
  let renderer = await renderExplorer({ path: 'Salud' });
  expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Editar presentación de la categoría')).toHaveLength(0);
  act(() => renderer.unmount());
  mockAdmin = { isAdmin: true, isStaff: true };
  renderer = await renderExplorer({ path: 'Salud' });
  expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Editar presentación de la categoría').length).toBeGreaterThan(0);
  act(() => renderer.unmount());
});

it('las tarjetas usan la dirección del servidor de la app para la imagen', async () => {
  const { Image } = require('expo-image');
  const renderer = await renderExplorer();
  expect(renderer.root.findAllByType(Image).map((node) => node.props.source)).toContainEqual({ uri: 'http://api:8001/salud.png' });
  act(() => renderer.unmount());
});
