/**
 * Relaciones del usuario con otros perfiles (seguidos, favoritos, anclados) y con
 * tareas (guardadas, favoritas, top 5 general y por categoría, "solo para mí").
 *
 * Una sola consulta (`users/me/relations/`) alimenta el corazón junto a cada
 * nombre de usuario y el menú de 3 puntos de cada tarea, así no hace falta que cada
 * lista/serializer traiga el estado y todo se actualiza a la vez.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { subscribeRelationsChange } from '../api';
import {
  toRelationSets, relationStateFor, applyRelationState, toTaskSets, taskStateFor, applyTaskState,
} from '../utils/relations';

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
      // Contadores y botones del perfil (Seguir / favoritos / top 5).
      queryClient.invalidateQueries({ queryKey: ['profileSocial'] });
      // Listas de favoritos y guardadas, y el top 5 del perfil.
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favoritesFeed'] });
      queryClient.invalidateQueries({ queryKey: ['favoritesTop'] });
    });
  }, [queryClient]);

  const { data } = useQuery({
    queryKey: MY_RELATIONS_KEY,
    queryFn: async () => (await api.get('users/me/relations/')).data,
    staleTime: 2 * 60 * 1000,
  });

  const relations = useMemo(() => (data ? toRelationSets(data) : null), [data]);
  const taskSets = useMemo(() => (data ? toTaskSets(data) : null), [data]);

  const getState = useCallback((userId) => relationStateFor(relations, userId), [relations]);
  const getTaskState = useCallback((taskId) => taskStateFor(taskSets, taskId), [taskSets]);

  const setStateLocally = useCallback((userId, nextState) => {
    queryClient.setQueryData(MY_RELATIONS_KEY, (prev) => applyRelationState(prev, userId, nextState));
  }, [queryClient]);

  /** `patch`: campos que cambian ({ saved, favorite, pinned, private, categories }). */
  const setTaskStateLocally = useCallback((taskId, patch) => {
    queryClient.setQueryData(MY_RELATIONS_KEY, (prev) => applyTaskState(prev, taskId, patch));
  }, [queryClient]);

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: MY_RELATIONS_KEY }),
    [queryClient],
  );

  return { ready: !!relations, getState, setStateLocally, getTaskState, setTaskStateLocally, refresh };
};
