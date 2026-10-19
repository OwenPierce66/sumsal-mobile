import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@api';

/**
 * Carga (paginada) todas las veces que se compartió una publicación.
 *
 * Los items viven en el estado de quien usa el hook para que las acciones de las
 * tarjetas (like, impulsar, compartir, favorito...) puedan actualizarlos con `setItems`.
 *
 * @param {string|null} taskId id de la publicación original; con null no carga nada.
 */
export default function useTaskSharesFeed(taskId) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);

  const loadPage = useCallback(async (pageToLoad) => {
    if (!taskId) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('shared-tasks/', {
        params: { task_id: taskId, page: pageToLoad },
      });
      if (requestId !== requestRef.current) return;
      const data = response.data;
      const results = Array.isArray(data) ? data : data?.results ?? [];
      setItems((previous) => {
        if (pageToLoad === 1) return results;
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...results.filter((item) => !seen.has(item.id))];
      });
      setPage(pageToLoad);
      setHasMore(Boolean(!Array.isArray(data) && data?.next));
    } catch (requestError) {
      if (requestId !== requestRef.current) return;
      console.error('[useTaskSharesFeed] Error cargando compartidas:', requestError.response?.data || requestError.message);
      setError(true);
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(false);
    setError(false);
    if (!taskId) {
      setLoading(false);
      return undefined;
    }
    loadPage(1);
    return () => {
      requestRef.current += 1;
    };
  }, [taskId, loadPage]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) loadPage(page + 1);
  }, [hasMore, loading, loadPage, page]);

  const retry = useCallback(() => loadPage(1), [loadPage]);

  return { items, setItems, loading, error, hasMore, loadMore, retry };
}
