import { useMemo, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImageUrl } from '@api';
import { useStories } from '@hooks/useApi';
import { STORY_WINDOW_MS, getStoryMedia, parseCreatedAtMs } from '../utils/storyWindow';

/**
 * Historias ya vistas en este dispositivo. El backend dice `viewed_by_me` en cada
 * historia, pero las propias no se registran como vista y entre que abres una y se
 * vuelve a pedir la lista pasa un rato: este registro local pone el aro en gris al momento.
 */
const SEEN_KEY = 'storySeenIds';
let seen = {}; // { storyId: ms en que se vio }
let version = 0;
const listeners = new Set();

const emit = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

AsyncStorage.getItem(SEEN_KEY)
  .then((raw) => {
    const stored = raw ? JSON.parse(raw) : {};
    seen = { ...stored, ...seen };
    emit();
  })
  .catch(() => {});

export function markStorySeen(storyId) {
  if (!storyId || seen[storyId]) return;
  const now = Date.now();
  // Solo importan las de las últimas 24 h: lo demás se descarta al guardar.
  const kept = Object.fromEntries(Object.entries(seen).filter(([, ms]) => now - ms < STORY_WINDOW_MS * 2));
  seen = { ...kept, [storyId]: now };
  AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen)).catch(() => {});
  emit();
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getVersion = () => version;

/** Agrupa las historias activas por usuario. Se calcula una vez por lista y estado de vistas. */
let cache = { data: null, version: -1, users: [] };
function groupStories(data) {
  if (cache.data === data && cache.version === version) return cache.users;
  const now = Date.now();
  const grouped = new Map();
  (Array.isArray(data) ? data : []).forEach((story) => {
    const userId = story?.user?.id || story?.user_id;
    if (!userId || !getStoryMedia(story)) return;
    const createdMs = parseCreatedAtMs(story) || 0;
    if (createdMs && now - createdMs > STORY_WINDOW_MS) return;
    const key = String(userId);
    if (!grouped.has(key)) {
      grouped.set(key, {
        userId,
        username: story?.user?.username || story?.username || 'Usuario',
        avatar: getImageUrl(story?.user?.user_image),
        stories: [],
      });
    }
    grouped.get(key).stories.push({
      id: story.id,
      createdMs,
      seen: Boolean(story.viewed_by_me || seen[story.id]),
    });
  });

  const users = Array.from(grouped.values()).map((entry) => {
    const stories = entry.stories.sort((a, b) => a.createdMs - b.createdMs);
    const firstUnseen = stories.find((s) => !s.seen);
    return {
      ...entry,
      latestMs: stories[stories.length - 1].createdMs,
      allSeen: !firstUnseen,
      // Se abre en la primera que falta por ver; si ya las viste todas, desde el principio.
      openStoryId: (firstUnseen || stories[0]).id,
    };
  });
  cache = { data, version, users };
  return users;
}

/** Usuarios con historia activa: primero los que tienen algo sin ver, luego los más recientes. */
export function useStoryUsers() {
  const query = useStories();
  const seenVersion = useSyncExternalStore(subscribe, getVersion, getVersion);
  const users = useMemo(() => groupStories(query.data), [query.data, seenVersion]);
  const sorted = useMemo(
    () => [...users].sort((a, b) => (a.allSeen - b.allSeen) || (b.latestMs - a.latestMs)),
    [users],
  );
  return { ...query, users: sorted };
}

/**
 * Aro de historia para el avatar de `userId`: `null` si no tiene historias activas,
 * o `{ storyId, seen }` (seen = ya viste todas → aro gris).
 */
export function useStoryRing(userId) {
  const { data } = useStories();
  const seenVersion = useSyncExternalStore(subscribe, getVersion, getVersion);
  return useMemo(() => {
    if (!userId) return null;
    const entry = groupStories(data).find((u) => String(u.userId) === String(userId));
    return entry ? { storyId: entry.openStoryId, seen: entry.allSeen } : null;
  }, [data, seenVersion, userId]);
}
