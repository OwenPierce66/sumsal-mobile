/**
 * Lógica pura de las relaciones del usuario con otros perfiles.
 * Jerarquía: Seguir -> Favorito -> Anclado.
 *
 * Estado de un perfil ajeno:
 *   'none'      -> no lo sigues            (corazón de contorno)
 *   'following' -> lo sigues               (sin corazón)
 *   'favorite'  -> en tus favoritos        (corazón negro)
 *   'pinned'    -> anclado                 (corazón morado)
 *   null        -> sin datos o eres tú
 */

export const toRelationSets = (data) => ({
  me: data?.me ? String(data.me) : null,
  following: new Set((data?.following || []).map(String)),
  favorites: new Set((data?.favorites || []).map(String)),
  pinned: new Set((data?.pinned || []).map(String)),
});

export const relationStateFor = (relations, userId) => {
  if (!relations || !userId) return null;
  const id = String(userId);
  if (relations.me && relations.me === id) return null;
  if (relations.pinned.has(id)) return 'pinned';
  if (relations.favorites.has(id)) return 'favorite';
  if (relations.following.has(id)) return 'following';
  return 'none';
};

/**
 * Aplica localmente un cambio de estado (actualización optimista)
 * respetando la jerarquía.
 */
export const applyRelationState = (data, userId, nextState) => {
  const id = String(userId);
  const drop = (list) => (list || []).filter((x) => String(x) !== id);
  const add = (list) => [...list, id];
  let following = drop(data?.following);
  let favorites = drop(data?.favorites);
  let pinned = drop(data?.pinned);
  if (nextState === 'pinned') {
    following = add(following);
    favorites = add(favorites);
    pinned = add(pinned);
  } else if (nextState === 'favorite') {
    following = add(following);
    favorites = add(favorites);
  } else if (nextState === 'following') {
    following = add(following);
  }
  return { ...(data || {}), following, favorites, pinned };
};
