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
