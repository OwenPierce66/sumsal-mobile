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

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import api, { UPLOAD_TIMEOUT_MS } from '@api';
import { getNextPageNumber, mapPostsPages, removePostFromPages } from '../utils/postsPages';
import { getNextOffset, flattenCommentPages, getRemainingComments } from '../utils/commentsPages';

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
    getNextPageParam: getNextPageNumber,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Feed de Reels paginado. Clave propia (`['reels', params]`) para no mezclarse
 * con el feed de tareas aunque usen el mismo endpoint.
 */
export function useReelsInfinite(params = {}) {
  return useInfiniteQuery({
    queryKey: ['reels', params],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await api.get('tasks/', { params: { ...params, page: pageParam } });
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: getNextPageNumber,
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

/**
 * Historias activas (24 h). El backend ya filtra por ventana y pagina con
 * limit/offset; se piden las 60 más recientes como hacía la pantalla.
 */
export function useStories() {
  return useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      const res = await api.get('stories/', { params: { limit: 60, offset: 0 } });
      return Array.isArray(res.data?.results) ? res.data.results : [];
    },
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

/**
 * Lista simple de tareas (primera página) — para HomeScreen.
 */
export function useTasks(params = {}) {
  return useQuery({
    queryKey: ['tasks', 'list', params],
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
    getNextPageParam: getNextPageNumber,
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
    getNextPageParam: getNextPageNumber,
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
      const params = { include_approval: true, ...extraParams };
      if (pch) params.pch = pch;
      const res = await api.get('new-categories/', {
        params,
      });
      return res.data.results ?? res.data ?? [];
    },
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
 * Estadísticas de perfiles favoritos de un perfil: favorited_by_count, favorites_count (puede ser null si es privado) e is_favorited.
 */
export function useProfileSocial(userId) {
  return useQuery({
    queryKey: ['profileSocial', userId],
    queryFn: async () => {
      const res = await api.get(`users/${userId}/social/`);
      return res.data;
    },
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

/**
 * Recomendaciones entre usuarios de un perfil: received/given (con comentario),
 * conteos (null si el dueño las ocultó), `hidden`, `public` (solo importa al dueño),
 * `is_recommended_by_me` y `my_comment`.
 */
/**
 * Colecciones (álbumes) dentro de guardados. Sin `userId`: las mías (todas).
 */
export function useCollections(userId = null, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['collections', userId || 'me'],
    queryFn: async () => (await api.get(userId ? `collections/user/${userId}/` : 'collections/')).data,
    enabled,
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

/** Una colección con sus tareas. */
export function useCollection(collectionId) {
  return useQuery({
    queryKey: ['collection', collectionId],
    queryFn: async () => (await api.get(`collections/${collectionId}/`)).data,
    enabled: Boolean(collectionId),
    staleTime: 30 * 1000,
    gcTime: GC_TIME,
  });
}

/**
 * Actividad del perfil que su dueño decide si se ve: `kind` = likes | comments | verifications.
 */
export function useProfileActivity(userId, kind) {
  return useQuery({
    queryKey: ['profileActivity', userId, kind],
    queryFn: async () => (await api.get(`users/${userId}/activity/`, { params: { kind } })).data,
    enabled: Boolean(userId && kind),
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

/**
 * Visitas a tu perfil: cuántas (7 y 30 días), quién (con suscripción en la app) y si
 * visitas en modo anónimo.
 */
export function useProfileVisits(userId) {
  return useQuery({
    queryKey: ['profileVisits', userId],
    queryFn: async () => (await api.get(`users/${userId}/visits/`)).data,
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

export function useUserRecommendations(userId) {
  return useQuery({
    queryKey: ['userRecommendations', userId],
    queryFn: async () => {
      const res = await api.get(`users/${userId}/recommendations/`);
      return res.data;
    },
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
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
export function useFavoritesFeed(enabled = false, userId = null) {
  return useQuery({
    // Sin userId: mis favoritos. Con userId: los de otro perfil (vacío si los tiene privados).
    queryKey: ['favoritesFeed', userId ?? 'me'],
    queryFn: async () => {
      const res = await api.get(userId ? `favorites/collection/${userId}/` : 'favorites/collection/');
      const tasks = Array.isArray(res.data?.tasks)
        ? res.data.tasks.map((item) => item.task).filter(Boolean)
        : [];
      return tasks;
    },
    enabled,
    // Siempre recargar al abrir: lo que acabas de guardar debe aparecer de inmediato
    staleTime: 0,
    refetchOnMount: 'always',
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
    getNextPageParam: getNextPageNumber,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ─── Favoritos ────────────────────────────────────────────────────────────────

/**
 * Colección de favoritos (perfiles + tareas) de un usuario.
 * Si userId es null/undefined, trae la colección del usuario autenticado.
 * `enabled: false` evita pedirla hasta que se necesite (p. ej. un selector cerrado).
 */
export function useFavoritesCollection(userId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['favorites', userId ?? 'me'],
    queryFn: async () => {
      const endpoint = userId ? `favorites/collection/${userId}/` : 'favorites/collection/';
      const res = await api.get(endpoint);
      return {
        profiles: Array.isArray(res.data?.profiles) ? res.data.profiles : [],
        // Favoritas (con su top 5); `saved`: guardadas que no son favoritas.
        tasks:    Array.isArray(res.data?.tasks)    ? res.data.tasks    : [],
        saved:    Array.isArray(res.data?.saved)    ? res.data.saved    : [],
        // Top 5 por categoría: { categoría: [id de favorito, ...] } en orden.
        category_pins: res.data?.category_pins || {},
        visibility: res.data?.visibility || {},
      };
    },
    enabled,
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

/**
 * Top 5 para el perfil: perfiles anclados, tareas ancladas y el top 5 de cada categoría.
 * Sin userId: el propio. De otro perfil solo llega lo que su dueño tiene público.
 */
export function useFavoritesTop(userId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['favoritesTop', userId ?? 'me'],
    queryFn: async () => (await api.get(userId ? `favorites/top/${userId}/` : 'favorites/top/')).data,
    enabled,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ─── Foro ─────────────────────────────────────────────────────────────────────

/**
 * Lista paginada de posts del foro (scroll infinito).
 * El backend devuelve 10 por página (StandardPagination); antes solo se leía
 * la primera, por lo que los posts más antiguos nunca eran visibles.
 */
export function usePostsInfinite(userId = null, category = '', groupId = null) {
  // Foro de un usuario, de un grupo y/o de una categoría ("Tema,Subtema"), como el filtro de las tareas.
  const filters = {};
  if (userId) filters.user = userId;
  if (groupId) filters.group = groupId;
  if (category) filters.category = category;
  return useInfiniteQuery({
    queryKey: Object.keys(filters).length ? ['posts', filters] : ['posts'],
    queryFn: async ({ pageParam = 1 }) => {
      const params = { page: pageParam, ...filters };
      const res = await api.get('posts/', { params });
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: getNextPageNumber,
    staleTime: STALE_TIME,
    gcTime:    GC_TIME,
  });
}

/**
 * Mutaciones del foro: crear, editar, eliminar, dar like a un post.
 * Las actualizaciones optimistas operan sobre `data.pages` (query infinita).
 */
export function usePostMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['posts'] });
  // Los cambios optimistas llegan a todas las listas del foro (general, de un usuario, por categoría).
  const updateAll = (updater) => {
    const previous = queryClient.getQueriesData({ queryKey: ['posts'] });
    queryClient.setQueriesData({ queryKey: ['posts'] }, updater);
    return previous;
  };
  const restore = (previous) => (previous || []).forEach(([key, data]) => queryClient.setQueryData(key, data));

  const createPost = useMutation({
    // `body`: JSON o FormData (si el post lleva foto o video).
    mutationFn: (body) => (typeof FormData !== 'undefined' && body instanceof FormData
      ? api.post('posts/', body, { timeout: UPLOAD_TIMEOUT_MS })
      : api.post('posts/', body)),
    onSuccess: invalidate,
  });

  const editPost = useMutation({
    // Solo se mandan los campos que vienen (título, texto, categorías, quién lo ve, invitados).
    mutationFn: ({ id, ...fields }) => api.patch(
      `posts/${id}/`,
      Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)),
    ),
    onSuccess: invalidate,
  });

  const deletePost = useMutation({
    mutationFn: (postId) => api.delete(`posts/${postId}/`),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      return { prev: updateAll((old) => removePostFromPages(old, postId)) };
    },
    onError: (_err, _vars, ctx) => restore(ctx?.prev),
    onSuccess: invalidate,
  });

  const likePost = useMutation({
    mutationFn: (postId) => api.post(`posts/${postId}/like/`),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['posts'] });
      const prev = updateAll((old) =>
        mapPostsPages(old, (p) =>
          p.id === postId
            ? { ...p, has_liked: !p.has_liked, likes_count: p.likes_count + (p.has_liked ? -1 : 1) }
            : p
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => restore(ctx?.prev),
    onSuccess: (data, postId) => {
      updateAll((old) =>
        mapPostsPages(old, (p) =>
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

// ─── Detalle de Tarea Compartida ──────────────────────────────────────────────

/**
 * Detalle completo de una tarea compartida (incluye comentarios embebidos).
 */
export function useSharedTaskDetail(sharedTaskId) {
  return useQuery({
    queryKey: ['sharedTask', sharedTaskId],
    queryFn: async () => {
      const res = await api.get(`shared-tasks/${sharedTaskId}/`);
      return res.data;
    },
    enabled: !!sharedTaskId,
    staleTime: STALE_TIME,
    gcTime:    GC_TIME,
  });
}

// ─── Detalle de Tarea propia ──────────────────────────────────────────────────

/**
 * Detalle completo de una tarea propia (sin comentarios).
 */
export function useTaskDetail(taskId) {
  return useQuery({
    queryKey: ['taskDetail', taskId],
    queryFn: async () => {
      const res = await api.get(`tasks/${taskId}/`, { params: { _ts: Date.now() } });
      return res.data;
    },
    enabled: !!taskId,
    staleTime: STALE_TIME,
    gcTime:    GC_TIME,
  });
}

/**
 * Lista paginada de comentarios raíz de una tarea (LimitOffset, 10 por página).
 *
 * Antes solo se leía la primera página: en tareas con más de 10 comentarios el
 * resto era inaccesible. `data` conserva el contrato anterior (array plano), así
 * que la pantalla no necesita cambiar cómo lo consume; además se exponen
 * `fetchNextPage`, `hasNextPage`, `isFetchingNextPage` y `remaining`.
 */
export function useTaskComments(taskId) {
  const query = useInfiniteQuery({
    queryKey: ['taskComments', taskId],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await api.get(`tasks/${taskId}/comments/`, {
        params: { offset: pageParam },
      });
      // Tolerar un backend sin paginación (lista plana) como antes
      if (Array.isArray(res.data)) {
        return { count: res.data.length, next: null, previous: null, results: res.data };
      }
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: getNextOffset,
    enabled: !!taskId,
    staleTime: STALE_TIME,
    gcTime:    GC_TIME,
  });

  const comments = useMemo(() => flattenCommentPages(query.data), [query.data]);
  const remaining = useMemo(() => getRemainingComments(query.data), [query.data]);

  return {
    ...query,
    // undefined mientras carga (igual que useQuery) para no pisar el estado local
    data: query.data ? comments : undefined,
    remaining,
  };
}

/**
 * Verifica si el usuario es admin/staff.
 */
export function useIsAdmin() {
  return useQuery({
    queryKey: ['isAdmin'],
    queryFn: async () => {
      const res = await api.get('verify-admin/');
      return { isAdmin: !!res.data.is_admin, isStaff: !!res.data.is_staff };
    },
    staleTime: 10 * 60 * 1000, // 10 min — el rol no cambia frecuentemente
    gcTime:    GC_TIME,
  });
}

// ─── Categorías ───────────────────────────────────────────────────────────────

/**
 * Categorías del app filtradas por PCH + categorías propias del usuario.
 * Devuelve { appCategories, myCategories }.
 */
export function useCreateTaskCategories(tema, isAdminUser) {
  const appCats = useQuery({
    queryKey: ['newCategories', tema],
    queryFn: async () => {
      const params = {};
      if (tema) params.pch = tema;
      const res = await api.get('new-categories/', { params });
      return res.data?.results ?? res.data ?? [];
    },
    staleTime: STALE_TIME,
    gcTime:    GC_TIME,
  });

  const myCats = useQuery({
    queryKey: ['myCategories'],
    queryFn: async () => {
      const res = await api.get('categories/');
      return res.data?.results ?? res.data ?? [];
    },
    staleTime: STALE_TIME,
    gcTime:    GC_TIME,
  });

  return { appCategories: appCats, myCategories: myCats };
}

// ─── Suscripciones ────────────────────────────────────────────────────────────

/**
 * Suscripción de un perfil: total que recibe al mes (en USD), insignia y la
 * suscripción que yo le pago, si hay.
 */
export function useSubscriptionStatus(userId) {
  return useQuery({
    queryKey: ['subscriptionStatus', userId],
    queryFn: async () => (await api.get(`subscriptions/status/${userId}/`)).data,
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

/** Las suscripciones que pago (mías o regaladas) y las que recibo. */
/** Sin userId: mis suscripciones. Con userId: las de otro perfil, solo lectura. */
export function useMySubscriptions(userId = null) {
  return useQuery({
    queryKey: userId ? ['subscriptions', 'user', userId] : ['subscriptions'],
    queryFn: async () => (await api.get(userId ? `subscriptions/users/${userId}/` : 'subscriptions/')).data,
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

/** Apoyos a peticiones (los que dio y los que recibieron sus peticiones): míos, o de `userId`. */
export function useMyPetitionSupports(userId = null) {
  return useQuery({
    queryKey: ['petitionSupports', userId ?? 'me'],
    queryFn: async () => (await api.get(userId ? `petition-supports/users/${userId}/` : 'petition-supports/')).data,
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

// ─── Testimonios ──────────────────────────────────────────────────────────────

/**
 * Comentarios donde etiquetaron a `userId` y que aprobó como testimonio.
 * Al dueño del perfil también le llegan los pendientes (`pending`).
 */
export function useUserTestimonials(userId) {
  return useQuery({
    queryKey: ['testimonials', userId],
    queryFn: async () => (await api.get(`users/${userId}/testimonials/`)).data,
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    gcTime: GC_TIME,
  });
}

// ─── Grupos ───────────────────────────────────────────────────────────────────

/** Lista de grupos. `{ mine: true }`: a los que pertenezco. `{ q }`: buscar por nombre o descripción. */
export function useGroups({ mine = false, q = '' } = {}) {
  return useQuery({
    queryKey: ['groups', mine ? 'mine' : 'all', q],
    queryFn: async () => (await api.get('groups/', { params: { ...(mine ? { mine: 1 } : {}), ...(q ? { q } : {}) } })).data,
    staleTime: 30 * 1000,
    gcTime: GC_TIME,
  });
}

/** Un grupo con sus admins, mi rol y, si soy admin, cuánto espera revisión. */
export function useGroup(groupId) {
  return useQuery({
    queryKey: ['group', String(groupId)],
    queryFn: async () => (await api.get(`groups/${groupId}/`)).data,
    enabled: Boolean(groupId),
    staleTime: 30 * 1000,
    gcTime: GC_TIME,
  });
}

/**
 * Publicaciones de un grupo, paginadas. `pending`: las que esperan revisión
 * (los admins ven todas; un integrante, solo las suyas pendientes o rechazadas).
 */
export function useGroupTasks(groupId, { pending = false, enabled = true, category = '' } = {}) {
  return useInfiniteQuery({
    // `category`: filtro por categoría y subcategorías ("Tema,Subtema"), como el feed.
    queryKey: ['groupTasks', String(groupId), pending ? 'pending' : 'approved', ...(category ? [category] : [])],
    queryFn: async ({ pageParam = 1 }) => (
      await api.get(`groups/${groupId}/tasks/${pending ? 'pending/' : ''}`, {
        params: category ? { page: pageParam, category } : { page: pageParam },
      })
    ).data,
    getNextPageParam: getNextPageNumber,
    enabled: Boolean(groupId) && enabled,
    staleTime: 30 * 1000,
    gcTime: GC_TIME,
  });
}

/** Integrantes activos, o con `status: 'pending'` las solicitudes para entrar (solo admins). */
export function useGroupMembers(groupId, { status = 'active', enabled = true } = {}) {
  return useQuery({
    queryKey: ['groupMembers', String(groupId), status],
    queryFn: async () => (await api.get(`groups/${groupId}/members/`, { params: { status } })).data,
    enabled: Boolean(groupId) && enabled,
    staleTime: 30 * 1000,
    gcTime: GC_TIME,
  });
}
