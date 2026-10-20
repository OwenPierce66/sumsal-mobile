/**
 * Relaciones del usuario con otros perfiles (seguidos, favoritos, anclados).
 *
 * Una sola consulta (`users/me/relations/`) alimenta el corazón junto a cada
 * nombre de usuario de la app, así no hace falta que cada lista/serializer
 * traiga el estado y todos los nombres se actualizan a la vez.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { subscribeRelationsChange } from '../api';
import { toRelationSets, relationStateFor, applyRelationState } from '../utils/relations';

export const MY_RELATIONS_KEY = ['myRelations'];

let syncSubscribed = false;

export const useMyRelations = () => {
  const queryClient = useQueryClient();

  // Un único suscriptor global: cualquier escritura de seguir/favorito/anclar
  // refresca las relaciones, sin importar desde qué pantalla se hizo.
  useEffect(() => {
    if (syncSubscribed) return;
    syncSubscribed = true;
    subscribeRelationsChange(() => {
      queryClient.invalidateQueries({ queryKey: MY_RELATIONS_KEY });
    });
  }, [queryClient]);

  const { data } = useQuery({
    queryKey: MY_RELATIONS_KEY,
    queryFn: async () => (await api.get('users/me/relations/')).data,
    staleTime: 2 * 60 * 1000,
  });

  const relations = useMemo(() => (data ? toRelationSets(data) : null), [data]);

  const getState = useCallback((userId) => relationStateFor(relations, userId), [relations]);

  const setStateLocally = useCallback((userId, nextState) => {
    queryClient.setQueryData(MY_RELATIONS_KEY, (prev) => applyRelationState(prev, userId, nextState));
  }, [queryClient]);

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: MY_RELATIONS_KEY }),
    [queryClient],
  );

  return { ready: !!relations, getState, setStateLocally, refresh };
};
