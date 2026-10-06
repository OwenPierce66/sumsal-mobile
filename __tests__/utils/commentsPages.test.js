/**
 * __tests__/utils/commentsPages.test.js
 *
 * Tests de la paginación LimitOffset de comentarios.
 */
import {
  getNextOffset,
  flattenCommentPages,
  getRemainingComments,
} from '../../utils/commentsPages';

const makeData = () => ({
  pageParams: [0, 10],
  pages: [
    {
      count: 14,
      next: 'http://localhost:8001/api/tasks/5/comments/?limit=10&offset=10',
      previous: null,
      results: Array.from({ length: 10 }, (_, i) => ({ id: 14 - i, text: `c${14 - i}` })),
    },
    {
      count: 14,
      next: null,
      previous: 'http://localhost:8001/api/tasks/5/comments/?limit=10',
      results: Array.from({ length: 4 }, (_, i) => ({ id: 4 - i, text: `c${4 - i}` })),
    },
  ],
});

describe('getNextOffset', () => {
  it('extrae el offset de la URL next', () => {
    expect(getNextOffset({ next: 'http://x/c/?limit=10&offset=10' })).toBe(10);
  });

  it('funciona con offset como primer parámetro', () => {
    expect(getNextOffset({ next: 'http://x/c/?offset=20&limit=10' })).toBe(20);
  });

  it('no confunde limit con offset', () => {
    expect(getNextOffset({ next: 'http://x/c/?limit=10' })).toBeUndefined();
  });

  it('devuelve undefined sin siguiente página', () => {
    expect(getNextOffset({ next: null })).toBeUndefined();
    expect(getNextOffset(undefined)).toBeUndefined();
  });
});

describe('flattenCommentPages', () => {
  it('aplana todas las páginas en orden', () => {
    const ids = flattenCommentPages(makeData()).map((c) => c.id);
    expect(ids).toHaveLength(14);
    expect(ids[0]).toBe(14);
    expect(ids[13]).toBe(1);
  });

  it('elimina duplicados por desplazamiento de offset', () => {
    const data = makeData();
    // un comentario nuevo desplazó la lista: el id 5 reaparece al inicio de la página 2
    data.pages[1].results.unshift({ id: 5, text: 'c5' });
    expect(flattenCommentPages(data)).toHaveLength(14);
  });

  it('devuelve lista vacía sin datos', () => {
    expect(flattenCommentPages(undefined)).toEqual([]);
    expect(flattenCommentPages({ pages: [] })).toEqual([]);
  });
});

describe('getRemainingComments', () => {
  it('calcula cuántos faltan tras la primera página', () => {
    const data = makeData();
    data.pages = [data.pages[0]];
    expect(getRemainingComments(data)).toBe(4);
  });

  it('es 0 cuando todo está cargado', () => {
    expect(getRemainingComments(makeData())).toBe(0);
  });

  it('nunca es negativo', () => {
    const data = makeData();
    data.pages[1].count = 3; // el servidor ahora reporta menos (se borraron comentarios)
    expect(getRemainingComments(data)).toBe(0);
  });

  it('es 0 sin datos o sin count', () => {
    expect(getRemainingComments(undefined)).toBe(0);
    expect(getRemainingComments({ pages: [{ results: [] }] })).toBe(0);
  });
});
