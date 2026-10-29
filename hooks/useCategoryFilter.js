/**
 * hooks/useCategoryFilter.js
 *
 * Datos del filtro por categorías que comparten tareas, perfiles y foro:
 * - useCategoryTree: el árbol de categorías de la app (de un PCH o de todos) junto con
 *   las tuyas (tu filtro personal), sin repetir.
 * - useUsersInCategory: de una lista de perfiles, los que tienen esa categoría (las de
 *   un perfil son las de sus tareas y su filtro personal; lo decide el backend).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@api';
import { useCategories } from '@hooks/useApi';
import { categoryPath, mergeCategoryTrees } from '../utils/categoryFilter';

const STALE_TIME = 5 * 60 * 1000;

export function useMyCategories(enabled = true) {
  return useQuery({
    queryKey: ['myCategories'],
    queryFn: async () => {
      const res = await api.get('categories/');
      return res.data?.results ?? res.data ?? [];
    },
    enabled,
    staleTime: STALE_TIME,
  });
}

export function useCategoryTree({ pch = '', includePersonal = true, includeApproval = true } = {}) {
  const app = useCategories(pch);
  const mine = useMyCategories(includePersonal);
  const nodes = useMemo(() => {
    const appNodes = (app.data || []).filter((node) => (
      includeApproval || String(node?.name || '').trim().toLowerCase() !== 'aprobada'
    ));
    return mergeCategoryTrees(appNodes, includePersonal ? mine.data || [] : []);
  }, [app.data, mine.data, includePersonal, includeApproval]);
  return { nodes, appCategories: app.data || [], myCategories: mine.data || [], loading: app.isLoading };
}

const defaultUserId = (item) => item?.id;

// Respuestas recientes de users/in-category/ ("ruta::ids" -> ids que coinciden). Sin React
// Query a propósito: estas listas viven también en modales que se montan en muchas pantallas.
const matchCache = new Map();
const MATCH_CACHE_SIZE = 50;

export function useUsersInCategory(items, category, getUserId = defaultUserId) {
  const path = categoryPath(category).join(',');
  const ids = useMemo(
    () => [...new Set((items || []).map(getUserId).filter(Boolean).map(String))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );
  const enabled = Boolean(path) && ids.length > 0;
  const key = `${path}::${ids.join('|')}`;
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    if (matchCache.has(key)) {
      setResult({ key, ids: matchCache.get(key) });
      return undefined;
    }
    let active = true;
    api.post('users/in-category/', { category: path, user_ids: ids }, { readOnly: true })
      .then((res) => {
        const matched = (res.data?.user_ids || []).map(String);
        matchCache.set(key, matched);
        if (matchCache.size > MATCH_CACHE_SIZE) matchCache.delete(matchCache.keys().next().value);
        if (active) setResult({ key, ids: matched });
      })
      .catch(() => { if (active) setResult({ key, ids: [], failed: true }); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  const current = result?.key === key ? result : null;
  const filtered = useMemo(() => {
    if (!path) return items || [];
    const allowed = new Set(current?.ids || []);
    return (items || []).filter((item) => allowed.has(String(getUserId(item))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, path, current]);
  return {
    items: filtered,
    active: Boolean(path),
    loading: enabled && !current,
    failed: Boolean(current?.failed),
  };
}

/** Estado del filtro + perfiles filtrados, para cualquier lista de perfiles con CategoryFilterBar. */
export function useProfileCategoryFilter(items, getUserId = defaultUserId) {
  const [category, setCategory] = useState('');
  return { category, setCategory, ...useUsersInCategory(items, category, getUserId) };
}
