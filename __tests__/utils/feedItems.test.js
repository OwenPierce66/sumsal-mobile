/**
 * __tests__/utils/feedItems.test.js
 *
 * Tests de la deduplicación del feed mixto (tareas + compartidas).
 */
import { dedupeFeedItems } from '../../utils/feedItems';

const task = (id, extra = {}) => ({
  id,
  feedType: 'task',
  created_at: '2026-10-10T10:00:00Z',
  ...extra,
});

const shared = (id, sharerId, taskId, createdAt, extra = {}) => ({
  id,
  feedType: 'shared',
  shared_by: { id: sharerId },
  task: { id: taskId },
  created_at: createdAt,
  ...extra,
});

describe('dedupeFeedItems', () => {
  it('conserva la original y su repost: no son duplicados entre sí', () => {
    const items = [task('t1'), shared('s1', 'u1', 't1', '2026-10-11T10:00:00Z')];
    expect(dedupeFeedItems(items).map((i) => i.id)).toEqual(['t1', 's1']);
  });

  it('conserva todas las veces que el mismo usuario comparte la misma tarea', () => {
    const items = [
      shared('s1', 'u1', 't1', '2026-10-11T10:00:00Z', { description: 'a' }),
      shared('s2', 'u1', 't1', '2026-10-12T10:00:00Z', { description: 'b' }),
      shared('s3', 'u1', 't1', '2026-10-09T10:00:00Z', { description: 'c' }),
    ];
    expect(dedupeFeedItems(items).map((i) => i.id)).toEqual(['s1', 's2', 's3']);
  });

  it('conserva reposts de la misma tarea hechos por usuarios distintos', () => {
    const items = [
      shared('s1', 'u1', 't1', '2026-10-11T10:00:00Z'),
      shared('s2', 'u2', 't1', '2026-10-12T10:00:00Z'),
    ];
    expect(dedupeFeedItems(items).map((i) => i.id)).toEqual(['s1', 's2']);
  });

  it('quita elementos repetidos por id (paginación desplazada)', () => {
    const items = [task('t1'), task('t2'), task('t1'), shared('s1', 'u1', 't9', '2026-10-11T10:00:00Z'), shared('s1', 'u1', 't9', '2026-10-11T10:00:00Z')];
    expect(dedupeFeedItems(items).map((i) => i.id)).toEqual(['t1', 't2', 's1']);
  });

  it('no confunde una tarea y una compartida con el mismo id', () => {
    const items = [task('x'), shared('x', 'u1', 't1', '2026-10-11T10:00:00Z')];
    expect(dedupeFeedItems(items)).toHaveLength(2);
  });

  it('no muta la lista original', () => {
    const items = [shared('s1', 'u1', 't1', '2026-10-10T10:00:00Z'), shared('s2', 'u1', 't1', '2026-10-11T10:00:00Z')];
    const copy = [...items];
    dedupeFeedItems(items);
    expect(items).toEqual(copy);
  });

  it('devuelve lista vacía con entradas inválidas', () => {
    expect(dedupeFeedItems(undefined)).toEqual([]);
    expect(dedupeFeedItems(null)).toEqual([]);
    expect(dedupeFeedItems([null, undefined])).toEqual([]);
  });
});
