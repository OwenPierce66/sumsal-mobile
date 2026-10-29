/**
 * Insignias de quien da like, comparte o sigue: definen el color de los números por nivel
 * en los reels y las pestañas de la lista (TieredLikesModal). Una sola regla para ambos.
 */
export const TIER_KEYS = ['app', 'recommended', 'verified', 'sub_red', 'sub_green', 'regular'];

export const TIER_META = {
  verified: { label: 'Verificados', color: '#4dabf7' },
  recommended: { label: 'Recomendados', color: '#f59f00' },
  app: { label: 'App', color: '#000' },
  sub_red: { label: 'Suscripción +', color: '#ff6b6b' },
  sub_green: { label: 'Suscripción', color: '#51cf66' },
  regular: { label: 'Otros', color: '#868e96' },
  all: { label: 'Todos', color: '#333' },
};

export const getTierKey = (user) => {
  const profile = user?.profile || user || {};
  const username = String(user?.username || user?.user?.username || '').toLowerCase();
  const userId = user?.id || user?.user?.id;
  if (user?.is_app || username === 'app-bot' || username === 'owen' || userId === 1) return 'app';
  if (profile.is_recommended) return 'recommended';
  if (profile.subscriptionActive && parseFloat(profile.subscription_amount || 0) >= 8) return 'sub_red';
  if (profile.is_verified) return 'verified';
  if (profile.subscriptionActive) return 'sub_green';
  return 'regular';
};

/** Conteo por insignia de una lista de usuarios (`all` = cuántos vienen en la lista). */
export const makeTierCounts = (users = []) => {
  const counts = TIER_KEYS.reduce((acc, key) => ({ ...acc, [key]: 0 }), { all: (users || []).length });
  (users || []).forEach((user) => { counts[getTierKey(user?.user || user)] += 1; });
  return counts;
};

/**
 * Seguidores que se muestran de un autor. `summary` es la lista ya pedida (`counts.all` y
 * `viewerFollows`); sin ella se usan los datos que trae el autor. `relation` es el estado actual
 * de seguir (del mismo lugar que el corazón): el total se ajusta al momento y, cuando llega la
 * recarga que ya incluye el cambio, no se cuenta dos veces.
 */
export const followersShown = ({ summary, author, relation }) => {
  const base = summary?.counts
    ? { count: summary.counts.all, followed: Boolean(summary.viewerFollows) }
    : { count: author?.followers_count ?? 0, followed: Boolean(author?.is_following) };
  const followedNow = relation ? relation !== 'none' : base.followed;
  return Math.max(0, base.count + (followedNow ? 1 : 0) - (base.followed ? 1 : 0));
};
