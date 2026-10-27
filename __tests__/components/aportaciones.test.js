/**
 * __tests__/components/aportaciones.test.js
 *
 * Comentar con una aportación favorita: selector y tarjeta adjunta.
 */
import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import FavoriteAportacionPicker from '../../components/FavoriteAportacionPicker';
import AportacionCard from '../../components/AportacionCard';

jest.mock('@api', () => ({
  __esModule: true,
  default: {},
  getImageUrl: (path) => (path ? `http://media.test${path}` : null),
}));

const mockUseFavoritesCollection = jest.fn();
jest.mock('@hooks/useApi', () => ({
  useFavoritesCollection: (...args) => mockUseFavoritesCollection(...args),
}));

const textsOf = (renderer) => renderer.root
  .findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));

const pressByLabel = (renderer, label) => {
  const target = renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];
  if (!target) throw new Error(`No hay nada que presionar con la etiqueta "${label}"`);
  act(() => target.props.onPress());
};

const favorite = (id, task, isPinned = false) => ({ id: `fav-${id}`, is_pinned: isPinned, task: { id, ...task } });

describe('FavoriteAportacionPicker', () => {
  const refetch = jest.fn();

  beforeEach(() => {
    refetch.mockReset();
    mockUseFavoritesCollection.mockReturnValue({
      data: {
        tasks: [
          favorite('a', { title: 'Petición de becas', pch: 'peticiones', user: { username: 'luis' } }, true),
          favorite('b', { title: 'Historia efímera', pch: 'historias', is_story: true, story_saved: false }),
          favorite('c', { title: 'Rutina de ejercicio', pch: 'consejos', subtasks: [{ image: '/media/r.png' }] }),
          favorite('post', { title: 'La que estoy comentando', pch: 'consejos' }),
        ],
      },
      isLoading: false,
      isError: false,
      refetch,
    });
  });

  const renderPicker = (props = {}) => {
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <FavoriteAportacionPicker visible onClose={jest.fn()} onSelect={jest.fn()} excludeTaskId="post" {...props} />,
      );
    });
    return renderer;
  };

  it('lista solo favoritas adjuntables, sin la tarea comentada, y refresca al abrir', () => {
    const renderer = renderPicker();
    const texts = textsOf(renderer);

    expect(texts).toEqual(expect.arrayContaining(['Petición de becas', 'Rutina de ejercicio', '@luis · Petición']));
    expect(texts).not.toContain('Historia efímera');
    expect(texts).not.toContain('La que estoy comentando');
    expect(mockUseFavoritesCollection).toHaveBeenCalledWith(null, { enabled: true });
    expect(refetch).toHaveBeenCalled();
  });

  it('busca sin acentos y devuelve la tarea elegida', () => {
    const onSelect = jest.fn();
    const renderer = renderPicker({ onSelect });
    act(() => renderer.root.findByType(TextInput).props.onChangeText('becas'));

    expect(textsOf(renderer)).not.toContain('Rutina de ejercicio');
    pressByLabel(renderer, 'Adjuntar Petición de becas');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', isPinned: true }));
  });

  it('explica cómo conseguir favoritas cuando no hay ninguna', () => {
    mockUseFavoritesCollection.mockReturnValue({ data: { tasks: [] }, isLoading: false, isError: false, refetch });
    const renderer = renderPicker();

    expect(textsOf(renderer)).toContain('Aún no tienes aportaciones favoritas');
  });

  it('no pide nada mientras está cerrado', () => {
    act(() => {
      TestRenderer.create(<FavoriteAportacionPicker visible={false} onClose={jest.fn()} onSelect={jest.fn()} />);
    });
    expect(mockUseFavoritesCollection).toHaveBeenLastCalledWith(null, { enabled: false });
    expect(refetch).not.toHaveBeenCalled();
  });
});

describe('AportacionCard', () => {
  const info = { id: '9', title: 'Cómo ahorrar', image: null, pch: 'consejos', username: 'ana' };

  it('muestra título, autor y tipo, y se puede abrir', () => {
    const onPress = jest.fn();
    let renderer;
    act(() => { renderer = TestRenderer.create(<AportacionCard info={info} onPress={onPress} />); });

    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Aportación adjunta', 'Cómo ahorrar', '@ana · Consejo']));
    pressByLabel(renderer, 'Aportación adjunta: Cómo ahorrar. Abrir aportación');
    expect(onPress).toHaveBeenCalled();
  });

  it('permite quitarla del comentario', () => {
    const onRemove = jest.fn();
    let renderer;
    act(() => { renderer = TestRenderer.create(<AportacionCard info={info} onRemove={onRemove} />); });
    pressByLabel(renderer, 'Quitar aportación adjunta');
    expect(onRemove).toHaveBeenCalled();
  });

  it('no pinta nada sin aportación', () => {
    let renderer;
    act(() => { renderer = TestRenderer.create(<AportacionCard info={null} />); });
    expect(renderer.toJSON()).toBeNull();
  });
});
