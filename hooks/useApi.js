/**
 * hooks/useApi.js
 *
 * Hooks de React Query centralizados para toda la app.
 * Cada hook encapsula: fetch, caché, loading, error y retry.
 *
 * Convenciones de query keys:
 *   ['tasks', { pch, page, ...filters }]
 *   ['task', taskId]
 *   ['notifications']
 *   ['profile', userId]
 *
 * Uso básico:
 *   const { data, isLoading, error, refetch } = useTasks({ pch: 'consejos' });
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import api from '@api';

// ─── Config compartida ────────────────────────────────────────────────────────

/** Tiempo que los datos se consideran frescos sin refetch (5 min) */
const STALE_TIME = 5 * 60 * 1000;

/** Tiempo que los datos permanecen en caché después de no usarse (30 min) */
const GC_TIME = 30 * 60 * 1000;

// ─── Tareas ───────────────────────────────────────────────────────────────────

/**
 * Lista paginada de tareas con todos los filtros.
 * Usa useInfiniteQuery para soportar el "cargar más" de FlatList.
 */
export function useTasksInfinite(filters = {}) {
  return useInfiniteQuery({
    queryKey: ['tasks', filters],
    queryFn: async ({ pageParam = 1 }) => {
      const params = { page: pageParam, ...filters };
      const res = await api.get('tasks/', { params });
      return res.data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined;
      const url = new URL(lastPage.next);
      return Number(url.searchParams.get('page'));
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Lista simple de tareas (primera página) — para HomeScreen.
 */
export function useTasks(params = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const res = await api.get('tasks/', { params });
      return res.data.results ?? res.data ?? [];
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Detalle de una tarea individual.
 */
export function useTask(taskId) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const res = await api.get(`tasks/${taskId}/`);
      return res.data;
    },
    enabled: Boolean(taskId),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Tareas del usuario autenticado (mi perfil).
 */
export function useMyTasksInfinite(extraParams = {}) {
  return useInfiniteQuery({
    queryKey: ['myTasks', extraParams],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get('users/me/tasks/', { params: { page: pageParam, ...extraParams } });
      return res.data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined;
      const url = new URL(lastPage.next);
      return Number(url.searchParams.get('page'));
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Tareas de un perfil — propias (users/me/tasks/) o de otro usuario (tasks/?user_id=).
 * Resuelve el problema de hooks condicionales en ProfileScreen.
 *
 * @param {boolean} isCurrentUser - true → endpoint propio, false → endpoint general
 * @param {string}  userId        - ID del usuario ajeno (ignorado cuando isCurrentUser=true)
 * @param {object}  extraParams   - Filtros adicionales (category, etc.)
 */
export function useProfileTasksInfinite(isCurrentUser, userId, extraParams = {}) {
  return useInfiniteQuery({
    queryKey: ['profileTasks', isCurrentUser ? 'me' : userId, extraParams],
    queryFn: async ({ pageParam = 1 }) => {
      const endpoint = isCurrentUser ? 'users/me/tasks/' : 'tasks/';
      const params = {
        page: pageParam,
        ...extraParams,
        ...(isCurrentUser ? {} : { user_id: userId }),
      };
      const res = await api.get(endpoint, { params });
      return res.data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined;
      const url = new URL(lastPage.next);
      return Number(url.searchParams.get('page'));
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ─── Like de tarea ────────────────────────────────────────────────────────────

/**
 * Mutación optimista para dar/quitar like a una tarea.
 * Actualiza el caché local sin esperar al servidor.
 */
export function useToggleTaskLike(queryKey) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId) => api.post(`tasks/${taskId}/like/`),

    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      // Actualización optimista en el caché
      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old;
        const updateItem = (item) =>
          item.id === taskId
            ? {
                ...item,
                has_liked: !item.has_liked,
                likes_count: item.has_liked ? item.likes_count - 1 : item.likes_count + 1,
              }
            : item;

        // Soporta tanto listas planas como infiniteQuery (pages)
        if (Array.isArray(old)) return old.map(updateItem);
        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              results: page.results.map(updateItem),
            })),
          };
        }
        return old;
      });

      return { previous };
    },

    onError: (_err, _taskId, context) => {
      // Revertir si el servidor rechaza
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: () => {
      // Refrescar desde el servidor para sincronizar
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ─── Notificaciones ───────────────────────────────────────────────────────────

/**
 * Lista de notificaciones paginada.
 */
export function useNotificationsInfinite() {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam }) => {
      const params = pageParam ? { cursor: pageParam } : {};
      const res = await api.get('notifications/', { params });
      return res.data;
    },
    getNextPageParam: (lastPage) => lastPage.next || undefined,
    staleTime: 60 * 1000, // 1 minuto — notificaciones se actualizan más seguido
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Contador de notificaciones no leídas.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get('notifications/unread-count/');
      return res.data.unread_count ?? 0;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000, // Auto-refresh cada minuto
  });
}

// ─── Categorías ───────────────────────────────────────────────────────────────

/**
 * Categorías de un PCH específico.
 */
export function useCategories(pch, extraParams = {}) {
  return useQuery({
    queryKey: ['categories', pch, extraParams],
    queryFn: async () => {
      const res = await api.get('new-categories/', {
        params: { pch, include_approval: true, ...extraParams },
      });
      return res.data.results ?? res.data ?? [];
    },
    enabled: Boolean(pch),
    staleTime: 10 * 60 * 1000, // 10 min — las categorías cambian poco
    gcTime: GC_TIME,
  });
}

// ─── Perfil ───────────────────────────────────────────────────────────────────

/**
 * Datos del usuario autenticado (me).
 */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('users/me/');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: GC_TIME,
  });
}

/**
 * Categorías del perfil: propias del usuario + categorías de la app presentes
 * en sus tareas + visibilidad del filtro personal (solo para usuario actual).
 *
 * @param {string} userId  - ID del usuario, o 'me' para el usuario actual.
 * @param {boolean} isMe   - true si es el perfil del usuario autenticado.
 * @param {string|null} ownerId - ID real del usuario (resuelto tras cargar me).
 */
export function useProfileCategories(userId, isMe, ownerId) {
  return useQuery({
    queryKey: ['profileCategories', userId, ownerId],
    queryFn: async () => {
      const profileEndpoint = isMe ? 'categories/' : `categories/user/${userId}/`;
      const requests = [
        api.get(profileEndpoint),
        api.get('new-categories/', {
          params: { include_approval: 'true', profile_user_id: ownerId },
        }),
      ];
      if (isMe) requests.push(api.get('categories/visibility/'));

      const [profileRes, appRes, visibilityRes] = await Promise.all(requests);
      return {
        profileCategories: Array.isArray(profileRes.data) ? profileRes.data : [],
        appCategories: Array.isArray(appRes.data) ? appRes.data : [],
        personalFilterPublic: isMe ? Boolean(visibilityRes?.data?.personal_filter_public) : false,
      };
    },
    enabled: Boolean(ownerId), // Espera a tener el ID real del usuario
    staleTime: 10 * 60 * 1000,
    gcTime: GC_TIME,
  });
}

/**
 * Colección de tareas favoritas del usuario.
 * Solo se lanza cuando enabled=true (al abrir el menú de favoritos).
 */
export function useFavoritesFeed(enabled = false) {
  return useQuery({
    queryKey: ['favoritesFeed'],
    queryFn: async () => {
      const res = await api.get('favorites/collection/');
      const tasks = Array.isArray(res.data?.tasks)
        ? res.data.tasks.map((item) => item.task).filter(Boolean)
        : [];
      return tasks;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: GC_TIME,
  });
}

// ─── Shared Tasks ─────────────────────────────────────────────────────────────

/**
 * Lista paginada de tareas compartidas.
 */
export function useSharedTasksInfinite(filters = {}) {
  return useInfiniteQuery({
    queryKey: ['sharedTasks', filters],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get('shared-tasks/', { params: { page: pageParam, ...filters } });
      return res.data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined;
      const url = new URL(lastPage.next);
      return Number(url.searchParams.get('page'));
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ─── Favoritos ────────────────────────────────────────────────────────────────

/**
 * Colección de favoritos (perfiles + tareas) de un usuario.
 * Si userId es null/undefined, trae la colección del usuario autenticado.
 */
export function useFavoritesCollection(userId) {
  return useQuery({
    queryKey: ['favorites', userId ?? 'me'],
    queryFn: async () => {
      const endpoint = userId ? `favorites/collection/${userId}/` : 'favorites/collection/';
      const res = await api.get(endpoint);
      return {
        profiles: Array.isArray(res.data?.profiles) ? res.data.profiles : [],
        tasks:    Array.isArray(res.data?.tasks)    ? res.data.tasks    : [],
        visibility: res.data?.visibility || {},
      };
    },
    staleTime: STALE_TIME,
    gcTime:    GC_TIME,
  });
}

/**
 * Mutación: anclaje / desanclaje de un favorito.
 */
export function usePinFavorite(userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id, is_pinned }) =>
      api.post('favorites/pin/', { type, id, is_pinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites', userId ?? 'me'] }),
  });
}

/**
 * Mutación: reordenar favoritos.
 */
export function useReorderFavorites(userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, order }) => api.patch('favorites/collection/', { type, order }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites', userId ?? 'me'] }),
  });
}

// ─── Foro ─────────────────────────────────────────────────────────────────────

/**
 * Lista de posts del foro.
 */
export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const res = await api.get('posts/');
      return res.data.results ?? res.data ?? [];
    },
    staleTime: STALE_TIME,
    gcTime:    GC_TIME,
  });
}

/**
 * Mutaciones del foro: crear, editar, eliminar, dar like a un post.
 */
export function usePostMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['posts'] });

  const createPost = useMutation({
    mutationFn: ({ title, content }) => api.post('posts/', { title, content }),
    onSuccess: invalidate,
  });

  const editPost = useMutation({
    mutationFn: ({ id, title, content }) => api.patch(`posts/${id}/`, { title, content }),
    onSuccess: invalidate,
  });

  const deletePost = useMutation({
    mutationFn: (postId) => api.delete(`posts/${postId}/`),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const prev = queryClient.getQueryData(['posts']);
      queryClient.setQueryData(['posts'], (old) => (old ?? []).filter((p) => p.id !== postId));
      return { prev };
    },
    onError: (_err, _vars, ctx) => queryClient.setQueryData(['posts'], ctx?.prev),
    onSuccess: invalidate,
  });

  const likePost = useMutation({
    mutationFn: (postId) => api.post(`posts/${postId}/like/`),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const prev = queryClient.getQueryData(['posts']);
      queryClient.setQueryData(['posts'], (old) =>
        (old ?? []).map((p) =>
          p.id === postId
            ? { ...p, has_liked: !p.has_liked, likes_count: p.likes_count + (p.has_liked ? -1 : 1) }
            : p
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => queryClient.setQueryData(['posts'], ctx?.prev),
    onSuccess: (data, postId) => {
      queryClient.setQueryData(['posts'], (old) =>
        (old ?? []).map((p) =>
          p.id === postId
            ? { ...p, likes_count: data.data.likes_count, has_liked: data.data.liked }
            : p
        )
      );
    },
  });

  return { createPost, editPost, deletePost, likePost };
}

/**
 * Detalle de un post del foro (con replies anidadas).
 */
export function usePostDetail(postId) {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const res = await api.get(`posts/${postId}/`);
      return res.data;
    },
    enabled: !!postId,
    staleTime: STALE_TIME,
    gcTime:    GC_TIME,
  });
}

/**
 * Like optimista en tareas compartidas (para SharedTasksScreen).
 */
export function useLikeSharedTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sharedTaskId) => api.post(`shared-tasks/${sharedTaskId}/like/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sharedTasks'] }),
  });
}
