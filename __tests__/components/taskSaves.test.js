/**
 * __tests__/components/taskSaves.test.js
 *
 * Menú de 3 puntos de una tarea: Guardar -> Favoritos -> Top 5, el top 5 por categoría
 * y "solo para mí", con el estado compartido de las relaciones.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import TaskActionsModal from '../../components/TaskActionsModal';

jest.mock('@hooks/useApi', () => ({ useMe: () => ({ data: { id: 'me' } }) }));
jest.mock('@hooks/useDownloadTask', () => ({ useDownloadTask: () => ({ downloadTask: jest.fn(), isDownloading: false }) }));
jest.mock('../../utils/adminActions', () => ({ setAccountActive: jest.fn() }));
jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
}));

const mockStore = { taskState: null, setTaskStateLocally: jest.fn() };
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({
    ready: true,
    getState: () => 'none',
    setStateLocally: jest.fn(),
    getTaskState: () => mockStore.taskState,
    setTaskStateLocally: mockStore.setTaskStateLocally,
    refresh: jest.fn(),
  }),
}));

const TASK = { id: 't1', title: 'Huerto', pch: 'consejos', categories: 'Salud, Procesando', user: { id: 'ana', username: 'ana' } };
const EMPTY = { saved: false, favorite: false, pinned: false, private: false, categories: [] };

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((child) => child.type === Text && [].concat(child.props.children).join('') === label).length > 0
  )).pop();
  if (!target) throw new Error(`No hay opción "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

let mounted;
let onClose;
const render = async (state) => {
  mockStore.taskState = state;
  onClose = jest.fn();
  await act(async () => {
    mounted = TestRenderer.create(
      <TaskActionsModal visible onClose={onClose} actionTask={TASK} currentUserId="me" handlers={{}} />,
    );
  });
  return mounted;
};

beforeEach(() => {
  ['post', 'patch', 'delete'].forEach((method) => api[method].mockReset().mockResolvedValue({ data: {} }));
  mockStore.setTaskStateLocally.mockReset();
});
afterEach(() => { act(() => mounted?.unmount()); mounted = null; });

describe('menú de 3 puntos: guardar, favoritos y top 5 de una tarea', () => {
  it('sin guardar ofrece los tres niveles y guarda al tocar "Guardar"', async () => {
    const renderer = await render(EMPTY);
    const texts = textsOf(renderer);
    expect(texts).toEqual(expect.arrayContaining(['Guardar', 'Agregar a favoritos', 'Anclar en mi top 5', 'Top 5 por categoría']));
    // "Solo para mí" solo tiene sentido si ya está guardada.
    expect(texts).not.toContain('Guardarla solo para mí');

    await pressText(renderer, 'Guardar');
    expect(api.post).toHaveBeenCalledWith('tasks/t1/save/');
    expect(mockStore.setTaskStateLocally).toHaveBeenCalledWith('t1', { saved: true });
    expect(onClose).toHaveBeenCalled();
  });

  it('agregar a favoritos y anclar usan sus endpoints', async () => {
    const renderer = await render(EMPTY);
    await pressText(renderer, 'Agregar a favoritos');
    expect(api.post).toHaveBeenCalledWith('favoritos/agregar/', { task_id: 't1' });
    await pressText(renderer, 'Anclar en mi top 5');
    expect(api.post).toHaveBeenCalledWith('favorites/pin/', { type: 'task', target_id: 't1', is_pinned: true });
  });

  it('ya guardada: quitarla, quitar de favoritos y top 5, y "solo para mí"', async () => {
    const renderer = await render({ saved: true, favorite: true, pinned: true, private: false, categories: [] });
    expect(textsOf(renderer)).toEqual(expect.arrayContaining([
      'Quitar de guardados', 'Quitar de favoritos', 'Quitar de mi top 5', 'Guardarla solo para mí',
    ]));
    await pressText(renderer, 'Guardarla solo para mí');
    expect(api.patch).toHaveBeenCalledWith('tasks/t1/save/', { is_private: true });
    await pressText(renderer, 'Quitar de guardados');
    expect(api.delete).toHaveBeenCalledWith('tasks/t1/save/');
  });

  it('top 5 por categoría: solo categorías reales y el menú sigue abierto', async () => {
    const renderer = await render({ saved: true, favorite: true, pinned: false, private: false, categories: [] });
    await pressText(renderer, 'Top 5 por categoría');
    const texts = textsOf(renderer);
    expect(texts).toContain('Salud');
    expect(texts).not.toContain('Procesando');

    await pressText(renderer, 'Salud');
    expect(api.post).toHaveBeenCalledWith('favorites/category-pin/', { task_id: 't1', category: 'Salud', is_pinned: true });
    expect(mockStore.setTaskStateLocally).toHaveBeenCalledWith('t1', { categories: ['Salud'] });
    expect(onClose).not.toHaveBeenCalled();
  });
});
