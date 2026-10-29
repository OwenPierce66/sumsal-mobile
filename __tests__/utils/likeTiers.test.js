/**
 * __tests__/utils/likeTiers.test.js
 *
 * Insignias por nivel (colores de los números en reels y pestañas de la lista) y el total de
 * seguidores que se muestra en el reel al seguir / dejar de seguir.
 */
import { makeTierCounts, getTierKey, followersShown } from '../../utils/likeTiers';

describe('insignias', () => {
  it('cuenta por insignia con la misma regla que la lista (incluye suscripciones)', () => {
    const users = [
      { id: 'a', profile: { is_verified: true } },
      { id: 'b', profile: { is_recommended: true, is_verified: true } },
      { id: 'c', profile: { subscriptionActive: true, subscription_amount: '10' } },
      { id: 'd', profile: { subscriptionActive: true, subscription_amount: '3' } },
      { id: 'e', profile: {} },
    ];
    expect(makeTierCounts(users)).toEqual({
      all: 5, app: 0, recommended: 1, verified: 1, sub_red: 1, sub_green: 1, regular: 1,
    });
    expect(getTierKey({ username: 'app-bot' })).toBe('app');
  });
});

describe('seguidores en el reel', () => {
  const author = { id: 'ana', followers_count: 10, is_following: false };

  it('sube y baja al momento con el estado de seguir', () => {
    expect(followersShown({ author, relation: 'none' })).toBe(10);
    expect(followersShown({ author, relation: 'following' })).toBe(11);
    expect(followersShown({ author, relation: 'pinned' })).toBe(11);
    expect(followersShown({ author: { ...author, is_following: true, followers_count: 11 }, relation: 'none' })).toBe(10);
  });

  it('cuando llega la recarga que ya te incluye no cuenta doble', () => {
    const summary = { counts: { all: 11 }, viewerFollows: true };
    expect(followersShown({ summary, author, relation: 'following' })).toBe(11);
    expect(followersShown({ summary, author, relation: 'none' })).toBe(10);
  });

  it('sin relaciones cargadas usa lo que trae el autor', () => {
    expect(followersShown({ author, relation: null })).toBe(10);
    expect(followersShown({ author: {}, relation: null })).toBe(0);
  });
});
