/**
 * __tests__/utils/aportaciones.test.js
 *
 * Selector de aportaciones favoritas para adjuntar a un comentario.
 */
import {
  foldText,
  getTaskThumbnail,
  isAttachableAportacion,
  toFavoriteAportaciones,
  filterAportaciones,
  toAportacionInfo,
} from '../../utils/aportaciones';

const task = (overrides = {}) => ({
  id: 't1',
  title: 'Cómo ahorrar',
  description: '',
  categories: 'Finanzas,Ahorro',
  pch: 'consejos',
  user: { username: 'ana' },
  subtasks: [],
  subfactores: [],
  subfuentes: [],
  ...overrides,
});

describe('foldText', () => {
  it('ignora mayúsculas y acentos', () => {
    expect(foldText('  Petición ÑANDÚ ')).toBe('peticion nandu');
  });
});

describe('getTaskThumbnail', () => {
  it('prefiere la imagen propia de la tarea', () => {
    expect(getTaskThumbnail(task({ image: '/media/t.png', subtasks: [{ image: '/media/s.png' }] })))
      .toBe('/media/t.png');
  });

  it('usa el primer bloque con imagen (consejos, factores y fuentes en ese orden)', () => {
    const t = task({
      subtasks: [{ title: 'sin media' }],
      subfactores: [{ image: '/media/f.png' }],
      subfuentes: [{ image: '/media/fu.png' }],
    });
    expect(getTaskThumbnail(t)).toBe('/media/f.png');
  });

  it('devuelve null si no hay imágenes', () => {
    expect(getTaskThumbnail(task())).toBeNull();
    expect(getTaskThumbnail(null)).toBeNull();
  });
});

describe('isAttachableAportacion', () => {
  it('rechaza historias sin guardar', () => {
    expect(isAttachableAportacion(task({ is_story: true, story_saved: false }))).toBe(false);
    expect(isAttachableAportacion(task({ is_story: true, story_saved: true }))).toBe(true);
    expect(isAttachableAportacion(task())).toBe(true);
    expect(isAttachableAportacion({})).toBe(false);
  });
});

describe('toFavoriteAportaciones', () => {
  const collection = [
    { id: 'f1', is_pinned: true, task: task({ id: 'a' }) },
    { id: 'f2', is_pinned: false, task: task({ id: 'b', is_story: true, story_saved: false }) },
    { id: 'f3', is_pinned: false, task: task({ id: 'c' }) },
  ];

  it('conserva el orden, marca las ancladas y quita las no adjuntables', () => {
    const result = toFavoriteAportaciones(collection);
    expect(result.map((t) => t.id)).toEqual(['a', 'c']);
    expect(result[0].isPinned).toBe(true);
    expect(result[1].isPinned).toBe(false);
  });

  it('excluye la tarea que se está comentando', () => {
    expect(toFavoriteAportaciones(collection, 'a').map((t) => t.id)).toEqual(['c']);
  });

  it('tolera respuestas vacías', () => {
    expect(toFavoriteAportaciones(undefined)).toEqual([]);
  });
});

describe('filterAportaciones', () => {
  const list = [
    task({ id: '1', title: 'Petición de becas', pch: 'peticiones', user: { username: 'luis' } }),
    task({ id: '2', title: 'Rutina de ejercicio', pch: 'consejos', categories: 'Salud' }),
    task({ id: '3', title: 'Mi historia', pch: 'historias', user: null, username: 'marta' }),
  ];

  it('busca sin acentos en título, autor y categorías', () => {
    expect(filterAportaciones(list, { query: 'peticion' }).map((t) => t.id)).toEqual(['1']);
    expect(filterAportaciones(list, { query: 'LUIS' }).map((t) => t.id)).toEqual(['1']);
    expect(filterAportaciones(list, { query: 'salud' }).map((t) => t.id)).toEqual(['2']);
    expect(filterAportaciones(list, { query: 'marta' }).map((t) => t.id)).toEqual(['3']);
  });

  it('filtra por tipo', () => {
    expect(filterAportaciones(list, { pch: 'historias' }).map((t) => t.id)).toEqual(['3']);
  });

  it('sin filtros devuelve todo', () => {
    expect(filterAportaciones(list)).toHaveLength(3);
  });
});

describe('toAportacionInfo', () => {
  it('produce el mismo formato que aportacion_info del backend', () => {
    expect(toAportacionInfo(task({ id: 9, subtasks: [{ image: '/media/s.png' }] }))).toEqual({
      id: '9',
      title: 'Cómo ahorrar',
      image: '/media/s.png',
      pch: 'consejos',
      username: 'ana',
    });
    expect(toAportacionInfo(null)).toBeNull();
  });
});
