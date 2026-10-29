import {
  toRelationSets, relationStateFor, applyRelationState, toTaskSets, taskStateFor, applyTaskState, taskCategories,
} from '../../utils/relations';

const base = { me: 'me', following: ['a', 'b', 'c'], favorites: ['b', 'c'], pinned: ['c'] };

describe('relations', () => {
  const sets = toRelationSets(base);

  it('calcula el estado de cada perfil', () => {
    expect(relationStateFor(sets, 'x')).toBe('none');
    expect(relationStateFor(sets, 'a')).toBe('following');
    expect(relationStateFor(sets, 'b')).toBe('favorite');
    expect(relationStateFor(sets, 'c')).toBe('pinned');
  });

  it('no muestra relación para uno mismo ni sin datos', () => {
    expect(relationStateFor(sets, 'me')).toBeNull();
    expect(relationStateFor(null, 'a')).toBeNull();
    expect(relationStateFor(sets, undefined)).toBeNull();
  });

  it('seguir agrega solo a seguidos', () => {
    const next = applyRelationState(base, 'x', 'following');
    expect(next.following).toContain('x');
    expect(next.favorites).not.toContain('x');
  });

  it('anclar agrega a favoritos y seguidos', () => {
    const next = applyRelationState(base, 'x', 'pinned');
    expect(next.following).toContain('x');
    expect(next.favorites).toContain('x');
    expect(next.pinned).toContain('x');
  });

  it('quitar el favorito mantiene el seguimiento', () => {
    const next = applyRelationState(base, 'c', 'following');
    expect(next.following).toContain('c');
    expect(next.favorites).not.toContain('c');
    expect(next.pinned).not.toContain('c');
  });

  it('dejar de seguir quita favorito y ancla', () => {
    const next = applyRelationState(base, 'c', 'none');
    expect(next.following).not.toContain('c');
    expect(next.favorites).not.toContain('c');
    expect(next.pinned).not.toContain('c');
  });

  it('no duplica ids', () => {
    const next = applyRelationState(base, 'a', 'following');
    expect(next.following.filter((x) => x === 'a')).toHaveLength(1);
  });
});

describe('tareas: guardar -> favorito -> top 5', () => {
  const data = {
    saved_tasks: ['t1', 't2', 't3'],
    private_tasks: ['t3'],
    favorite_tasks: ['t2', 't3'],
    pinned_tasks: ['t3'],
    task_category_pins: { t3: ['Salud'] },
  };
  const stateOf = (raw, id) => taskStateFor(toTaskSets(raw), id);

  it('calcula el estado de cada tarea', () => {
    expect(stateOf(data, 't1')).toEqual({ saved: true, favorite: false, pinned: false, private: false, categories: [] });
    expect(stateOf(data, 't3')).toEqual({ saved: true, favorite: true, pinned: true, private: true, categories: ['Salud'] });
    expect(stateOf(data, 'otra')).toEqual({ saved: false, favorite: false, pinned: false, private: false, categories: [] });
  });

  it('anclar (en general o en una categoría) la agrega a favoritos y la guarda', () => {
    expect(stateOf(applyTaskState(data, 'nueva', { pinned: true }), 'nueva'))
      .toMatchObject({ saved: true, favorite: true, pinned: true });
    expect(stateOf(applyTaskState(data, 'nueva', { categories: ['Arte'] }), 'nueva'))
      .toMatchObject({ saved: true, favorite: true, categories: ['Arte'] });
  });

  it('quitar de favoritos quita sus top 5; quitar de guardados quita todo', () => {
    expect(stateOf(applyTaskState(data, 't3', { favorite: false }), 't3'))
      .toEqual({ saved: true, favorite: false, pinned: false, private: true, categories: [] });
    const unsaved = applyTaskState(data, 't3', { saved: false });
    expect(stateOf(unsaved, 't3')).toEqual({ saved: false, favorite: false, pinned: false, private: false, categories: [] });
    expect(unsaved.task_category_pins.t3).toBeUndefined();
  });

  it('las categorías del top 5 no incluyen etiquetas de estado ni repetidas', () => {
    expect(taskCategories({ categories: 'Salud, Procesando, salud, Aprobada, Arte' })).toEqual(['Salud', 'Arte']);
    expect(taskCategories(null)).toEqual([]);
  });
});
