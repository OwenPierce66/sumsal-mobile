/**
 * __tests__/utils/postsPages.test.js
 *
 * Tests de la lógica de paginación infinita del foro.
 */
import {
  getNextPageNumber,
  mapPostsPages,
  removePostFromPages,
  flattenPosts,
} from '../../utils/postsPages';

const makeData = () => ({
  pageParams: [1, 2],
  pages: [
    {
      count: 4,
      next: 'http://localhost:8001/api/posts/?page=2',
      previous: null,
      results: [
        { id: 4, title: 'D', likes_count: 0, has_liked: false },
        { id: 3, title: 'C', likes_count: 2, has_liked: true },
      ],
    },
    {
      count: 4,
      next: null,
      previous: 'http://localhost:8001/api/posts/',
      results: [
        { id: 2, title: 'B', likes_count: 1, has_liked: false },
        { id: 1, title: 'A', likes_count: 0, has_liked: false },
      ],
    },
  ],
});

describe('getNextPageNumber', () => {
  it('extrae el número de página de la URL next', () => {
    expect(getNextPageNumber({ next: 'http://x/api/posts/?page=3' })).toBe(3);
  });

  it('funciona cuando page no es el primer parámetro', () => {
    expect(getNextPageNumber({ next: 'http://x/api/posts/?page_size=10&page=5' })).toBe(5);
  });

  it('no confunde page_size con page', () => {
    expect(getNextPageNumber({ next: 'http://x/api/posts/?page_size=10' })).toBeUndefined();
  });

  it('devuelve undefined cuando no hay siguiente página', () => {
    expect(getNextPageNumber({ next: null })).toBeUndefined();
    expect(getNextPageNumber({})).toBeUndefined();
    expect(getNextPageNumber(undefined)).toBeUndefined();
  });
});

describe('mapPostsPages', () => {
  it('modifica solo el post indicado en cualquier página', () => {
    const result = mapPostsPages(makeData(), (p) =>
      p.id === 2 ? { ...p, likes_count: 99 } : p
    );
    expect(result.pages[1].results[0].likes_count).toBe(99);
    expect(result.pages[0].results[0].likes_count).toBe(0);
  });

  it('conserva next, count y pageParams', () => {
    const result = mapPostsPages(makeData(), (p) => p);
    expect(result.pageParams).toEqual([1, 2]);
    expect(result.pages[0].next).toBe('http://localhost:8001/api/posts/?page=2');
    expect(result.pages[0].count).toBe(4);
  });

  it('no muta el objeto original', () => {
    const original = makeData();
    mapPostsPages(original, (p) => ({ ...p, title: 'X' }));
    expect(original.pages[0].results[0].title).toBe('D');
  });

  it('devuelve el dato tal cual si aún no hay páginas', () => {
    expect(mapPostsPages(undefined, (p) => p)).toBeUndefined();
  });
});

describe('removePostFromPages', () => {
  it('elimina el post y reduce count en la página afectada', () => {
    const result = removePostFromPages(makeData(), 3);
    expect(result.pages[0].results.map((p) => p.id)).toEqual([4]);
    expect(result.pages[0].count).toBe(3);
    expect(result.pages[1].count).toBe(4);
  });

  it('no cambia nada si el id no existe', () => {
    const result = removePostFromPages(makeData(), 999);
    expect(flattenPosts(result)).toHaveLength(4);
    expect(result.pages[0].count).toBe(4);
  });

  it('devuelve el dato tal cual si aún no hay páginas', () => {
    expect(removePostFromPages(undefined, 1)).toBeUndefined();
  });
});

describe('flattenPosts', () => {
  it('aplana las páginas respetando el orden', () => {
    expect(flattenPosts(makeData()).map((p) => p.id)).toEqual([4, 3, 2, 1]);
  });

  it('elimina duplicados causados por posts nuevos entre páginas', () => {
    const data = makeData();
    // Un post nuevo desplaza los elementos: el id 3 reaparece al inicio de la página 2
    data.pages[1].results.unshift({ id: 3, title: 'C', likes_count: 2, has_liked: true });
    const ids = flattenPosts(data).map((p) => p.id);
    expect(ids).toEqual([4, 3, 2, 1]);
  });

  it('devuelve lista vacía sin datos', () => {
    expect(flattenPosts(undefined)).toEqual([]);
    expect(flattenPosts({ pages: [] })).toEqual([]);
  });
});
