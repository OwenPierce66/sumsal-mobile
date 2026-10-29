/**
 * __tests__/utils/repost.test.js
 *
 * Impulsar: el cambio inmediato al tocar el botón y lo que confirma el servidor.
 */
import { optimisticRepost, repostFromResponse, repostSnapshot } from '../../utils/repost';

describe('utils/repost', () => {
  it('impulsar suma un impulso y deja el like (si no lo tenía, suma uno)', () => {
    const before = repostSnapshot({ likes_count: 3, interaction_score: 5, reposts_count: 2 });
    expect(optimisticRepost(before)).toEqual({
      user_has_reposted: true, user_has_liked: true, likes_count: 4, interaction_score: 6, reposts_count: 3,
    });
  });

  it('quitar el impulso resta uno y conserva el like', () => {
    const before = repostSnapshot({
      user_has_reposted: true, user_has_liked: true, likes_count: 4, interaction_score: 6, reposts_count: 3,
    });
    expect(optimisticRepost(before)).toEqual({
      user_has_reposted: false, user_has_liked: true, likes_count: 4, interaction_score: 5, reposts_count: 2,
    });
  });

  it('nunca baja de cero y solo toma del servidor lo que mandó', () => {
    expect(optimisticRepost(repostSnapshot({ user_has_reposted: true })).reposts_count).toBe(0);
    expect(repostFromResponse({ reposted: true, user_has_reposted: true, reposts_count: 1 }))
      .toEqual({ user_has_reposted: true, reposts_count: 1 });
  });
});
