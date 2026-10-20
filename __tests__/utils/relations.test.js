import { toRelationSets, relationStateFor, applyRelationState } from '../../utils/relations';

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
