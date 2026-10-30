import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import api, { getImageUrl } from '@api';
import {
  useFavoritesCollection,
  useIsAdmin,
  useMe,
  usePinFavorite,
  useReorderFavorites,
} from '@hooks/useApi';
import useTaskActions from '@hooks/useTaskActions';
import TaskActionsModal from '@components/TaskActionsModal';
import { NameWithBadges } from '@components/UserBadges';
import { taskCategories } from '../utils/relations';
import CategoryFilterBar from '@components/CategoryFilterBar';
import { useProfileCategoryFilter } from '@hooks/useCategoryFilter';
import { categoryPath, matchesCategoryPath } from '../utils/categoryFilter';
import SaveCollectionsPanel from '@components/SaveCollectionsPanel';

const ALL = '__all__';

const getName = (user) => (
  user?.username
  || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
  || 'Perfil'
);

const sameText = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

const IconButton = ({ name, color = '#4dabf7', onPress, disabled, label }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Ionicons name={name} size={20} color={disabled ? '#ced4da' : color} />
  </TouchableOpacity>
);

/**
 * Favoritos de un perfil (sin `userId`: los tuyos).
 *
 * Perfiles: el top 5 arriba y luego el resto de favoritos.
 * Tareas: la misma escala que el menú de 3 puntos: Top 5, Favoritas y Guardadas. Con una
 * categoría elegida (por niveles, como el filtro de las tareas) se ve el top 5 de la más
 * específica y las favoritas que se pueden anclar en él.
 * Las dos listas se filtran por categoría; las de un perfil son las de sus tareas.
 * El dueño ordena con las flechas, ancla con el pin, decide si cada lista es pública y ve
 * cuáles guardó "solo para él"; los demás ven solo lo público.
 */
const FavoritesScreen = ({ navigation, route }) => {
  const userId = route?.params?.userId;
  const isOwner = !userId;
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: adminData } = useIsAdmin();

  const [activeType, setActiveType] = useState('profiles');
  // Ruta "Tema,Subtema" ('' = todas).
  const [category, setCategory] = useState('');
  const [actionTask, setActionTask] = useState(null);
  const [savingVisibility, setSavingVisibility] = useState(false);

  // ─── React Query ────────────────────────────────────────────────────────────
  const {
    data: collection,
    isLoading,
    isFetching,
    refetch,
  } = useFavoritesCollection(userId);

  const pinMutation     = usePinFavorite(userId);
  const reorderMutation = useReorderFavorites(userId);
  const refreshLists = () => {
    queryClient.invalidateQueries({ queryKey: ['favorites'] });
    queryClient.invalidateQueries({ queryKey: ['favoritesTop'] });
  };
  const taskActions = useTaskActions({
    navigation,
    actionTask,
    currentUserId: me?.id,
    close: () => setActionTask(null),
    refresh: refreshLists,
    onDeleted: refreshLists,
  });

  const profiles     = collection?.profiles ?? [];
  const favorites    = collection?.tasks ?? [];
  const saved        = collection?.saved ?? [];
  const categoryPins = collection?.category_pins ?? {};
  const visibility   = collection?.visibility ?? {};
  const refreshing   = isFetching && !isLoading;

  // Categorías de lo guardado (y de los top 5 que ya existan), para el top 5 por categoría.
  const categories = useMemo(() => {
    const names = new Map();
    const add = (name) => { if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name); };
    [...favorites, ...saved].forEach((item) => taskCategories(item.task).forEach(add));
    Object.keys(categoryPins).forEach(add);
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [favorites, saved, categoryPins]);
  const categoryLevels = categoryPath(category);
  // El top 5 por categoría es el de la más específica elegida.
  const activeCategory = categoryLevels.length ? categoryLevels[categoryLevels.length - 1] : ALL;
  const profilesByCategory = useProfileCategoryFilter(profiles, (item) => item.profile?.id);
  const shownProfiles = profilesByCategory.items;

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const reorder = async (type, nextItems) => {
    if (!isOwner) return;
    try {
      await reorderMutation.mutateAsync({ type, order: nextItems.map((item) => item.id) });
    } catch {
      Alert.alert('No se pudo ordenar', 'Intenta nuevamente.');
    }
  };

  const move = (list, index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return null;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  const togglePin = async (item, type) => {
    if (!isOwner) return;
    try {
      await pinMutation.mutateAsync({ type, id: item.id, is_pinned: !item.is_pinned });
      queryClient.invalidateQueries({ queryKey: ['favoritesTop'] });
    } catch (error) {
      const message = error.response?.data?.is_pinned?.[0] || 'No se pudo actualizar el anclaje.';
      Alert.alert('No se pudo actualizar', message);
    }
  };

  const run = async (request, failure) => {
    try {
      await request();
      refreshLists();
    } catch (error) {
      Alert.alert('No se pudo actualizar', error.response?.data?.category || error.response?.data?.order || failure);
    }
  };

  const toggleCategoryPin = (item, pinned) => run(
    () => api.post('favorites/category-pin/', { task_id: item.task.id, category: activeCategory, is_pinned: !pinned }),
    'No se pudo actualizar el top 5 de esta categoría.',
  );
  const moveInCategory = (list, index, direction) => {
    const next = move(list, index, direction);
    if (!next) return;
    run(
      () => api.patch('favorites/category-pin/', { category: activeCategory, order: next.map((item) => item.task.id) }),
      'No se pudo ordenar.',
    );
  };
  const addToFavorites = (item) => run(
    () => api.post('favoritos/agregar/', { task_id: item.task.id }),
    'No se pudo agregar a favoritos.',
  );

  const toggleVisibility = async () => {
    if (savingVisibility) return;
    const kind = activeType === 'profiles' ? 'profiles' : 'tasks';
    setSavingVisibility(true);
    try {
      await api.patch('categories/visibility/', {
        [kind === 'profiles' ? 'favorite_profiles_public' : 'favorite_tasks_public']: !visibility[kind],
      });
      refreshLists();
    } catch {
      Alert.alert('No se pudo actualizar', 'Intenta nuevamente.');
    } finally {
      setSavingVisibility(false);
    }
  };

  // ─── Renders ─────────────────────────────────────────────────────────────────
  const sectionTitle = (title, key) => (
    <View key={key} style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );

  const renderProfile = (item, index) => {
    const profile = item.profile || {};
    return (
      <View key={item.id} style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => navigation.navigate('UserProfile', {
            userId:     profile.id,
            userName:   getName(profile),
            userAvatar: getImageUrl(profile.user_image),
          })}
        >
          <View>
            <Image source={{ uri: getImageUrl(profile.user_image) }} style={styles.avatar} />
            {item.is_pinned ? <View style={styles.rankBadge}><Text style={styles.rankText}>{index + 1}</Text></View> : null}
          </View>
          <View style={styles.cardText}>
            <NameWithBadges userId={profile.id} style={styles.cardTitle}>{getName(profile)}</NameWithBadges>
            <Text style={styles.cardSubtitle}>{item.is_pinned ? `Puesto ${index + 1} de 5` : 'Perfil favorito'}</Text>
          </View>
        </TouchableOpacity>
        {isOwner ? (
          <View style={styles.cardActions}>
            <IconButton name="chevron-up" onPress={() => { const next = move(profiles, index, -1); if (next) reorder('profiles', next); }} disabled={index === 0} label="Subir" />
            <IconButton name="chevron-down" onPress={() => { const next = move(profiles, index, 1); if (next) reorder('profiles', next); }} disabled={index === profiles.length - 1} label="Bajar" />
            <IconButton
              name={item.is_pinned ? 'pin' : 'pin-outline'}
              color="#845ef7"
              onPress={() => togglePin(item, 'profile')}
              label={item.is_pinned ? 'Quitar del top 5' : 'Anclar en el top 5'}
            />
          </View>
        ) : null}
      </View>
    );
  };

  /** Fila de tarea: `rank` para las del top 5 y `actions` (solo el dueño). */
  const renderTask = (item, { rank, actions } = {}) => {
    const task = item.task || {};
    return (
      <View key={`${item.id}-${task.id}`} style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
        >
          {rank ? (
            <View style={[styles.taskIcon, styles.taskIconRank]}><Text style={styles.taskRank}>{rank}</Text></View>
          ) : (
            <View style={styles.taskIcon}><Ionicons name="document-text-outline" size={22} color="#4dabf7" /></View>
          )}
          <View style={styles.cardText}>
            <Text style={styles.cardTitle} numberOfLines={1}>{task.title || 'Tarea'}</Text>
            <NameWithBadges userId={task.user?.id} style={styles.creatorText} badgeSize={12}>Creada por {getName(task.user)}</NameWithBadges>
            {item.is_private ? (
              <View style={styles.privateTag}>
                <Ionicons name="lock-closed" size={11} color="#868e96" />
                <Text style={styles.privateText}>Solo para ti</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
        {isOwner ? (
          <View style={styles.cardActions}>
            {actions}
            <IconButton name="ellipsis-vertical" color="#868e96" onPress={() => setActionTask(task)} label={`Opciones de ${task.title || 'la tarea'}`} />
          </View>
        ) : null}
      </View>
    );
  };

  const renderAllTasks = () => {
    const top = favorites.filter((item) => item.is_pinned);
    const rest = favorites.filter((item) => !item.is_pinned);
    const favoriteRow = (item, index) => renderTask(item, {
      rank: item.is_pinned ? index + 1 : null,
      actions: (
        <>
          <IconButton name="chevron-up" onPress={() => { const next = move(favorites, index, -1); if (next) reorder('tasks', next); }} disabled={index === 0} label="Subir" />
          <IconButton name="chevron-down" onPress={() => { const next = move(favorites, index, 1); if (next) reorder('tasks', next); }} disabled={index === favorites.length - 1} label="Bajar" />
          <IconButton
            name={item.is_pinned ? 'pin' : 'pin-outline'}
            color="#845ef7"
            onPress={() => togglePin(item, 'task')}
            label={item.is_pinned ? 'Quitar del top 5' : 'Anclar en el top 5'}
          />
        </>
      ),
    });
    return [
      top.length ? sectionTitle('Top 5', 'top') : null,
      ...top.map((item) => favoriteRow(item, favorites.indexOf(item))),
      rest.length ? sectionTitle('Favoritas', 'favorites') : null,
      ...rest.map((item) => favoriteRow(item, favorites.indexOf(item))),
      saved.length ? sectionTitle('Guardadas', 'saved') : null,
      ...saved.map((item) => renderTask(item, {
        actions: <IconButton name="star-outline" color="#f59f00" onPress={() => addToFavorites(item)} label="Agregar a favoritos" />,
      })),
    ];
  };

  const renderCategoryTasks = () => {
    const inCategory = (item) => matchesCategoryPath(item.task?.categories, categoryLevels);
    const pinKey = Object.keys(categoryPins).find((name) => sameText(name, activeCategory));
    const top = (pinKey ? categoryPins[pinKey] : [])
      .map((id) => favorites.find((item) => String(item.id) === String(id)))
      .filter(Boolean);
    const topIds = new Set(top.map((item) => String(item.id)));
    const others = favorites.filter((item) => inCategory(item) && !topIds.has(String(item.id)));
    const savedHere = saved.filter(inCategory);
    return [
      sectionTitle(`Top 5 de ${activeCategory}`, 'cat-top'),
      top.length ? null : (
        <Text key="cat-top-empty" style={styles.sectionHint}>
          {isOwner ? 'Ancla aquí hasta 5 favoritas de esta categoría.' : 'Sin tareas ancladas en esta categoría.'}
        </Text>
      ),
      ...top.map((item, index) => renderTask(item, {
        rank: index + 1,
        actions: (
          <>
            <IconButton name="chevron-up" onPress={() => moveInCategory(top, index, -1)} disabled={index === 0} label="Subir" />
            <IconButton name="chevron-down" onPress={() => moveInCategory(top, index, 1)} disabled={index === top.length - 1} label="Bajar" />
            <IconButton name="pin" color="#845ef7" onPress={() => toggleCategoryPin(item, true)} label={`Quitar del top 5 de ${activeCategory}`} />
          </>
        ),
      })),
      others.length ? sectionTitle('Favoritas', 'cat-favorites') : null,
      ...others.map((item) => renderTask(item, {
        actions: <IconButton name="pin-outline" color="#845ef7" onPress={() => toggleCategoryPin(item, false)} label={`Anclar en el top 5 de ${activeCategory}`} />,
      })),
      savedHere.length ? sectionTitle('Guardadas', 'cat-saved') : null,
      ...savedHere.map((item) => renderTask(item, {
        actions: <IconButton name="star-outline" color="#f59f00" onPress={() => addToFavorites(item)} label="Agregar a favoritos" />,
      })),
    ];
  };

  const renderProfiles = () => {
    const top = shownProfiles.filter((item) => item.is_pinned);
    const rest = shownProfiles.filter((item) => !item.is_pinned);
    if (profilesByCategory.loading) return [<ActivityIndicator key="p-loading" color="#4dabf7" style={styles.loader} />];
    if (profilesByCategory.active && !shownProfiles.length) {
      return [<Text key="p-empty" style={styles.empty}>Ningún favorito tiene esa categoría.</Text>];
    }
    return [
      top.length ? sectionTitle('Top 5', 'p-top') : null,
      ...top.map((item) => renderProfile(item, profiles.indexOf(item))),
      rest.length ? sectionTitle('Favoritos', 'p-rest') : null,
      ...rest.map((item) => renderProfile(item, profiles.indexOf(item))),
    ];
  };

  const listIsPublic = Boolean(visibility[activeType === 'profiles' ? 'profiles' : 'tasks']);
  const isEmpty = activeType === 'profiles' ? profiles.length === 0 : favorites.length + saved.length === 0;
  let emptyText = 'No hay favoritos visibles en esta lista.';
  if (isOwner) {
    emptyText = activeType === 'profiles'
      ? 'Agrega perfiles a favoritos con el corazón.'
      : 'Guarda tareas desde su menú de 3 puntos.';
  } else if (!listIsPublic) {
    emptyText = 'Esta lista es privada.';
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isOwner ? 'Mis favoritos' : 'Favoritos'}</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={styles.tabs}>
        {[
          ['profiles',    'Perfiles',    'people-outline'],
          ['tasks',       'Tareas',      'document-text-outline'],
          ['collections', 'Colecciones', 'albums-outline'],
        ].map(([type, label, icon]) => (
          <TouchableOpacity
            key={type}
            style={[styles.tab, activeType === type && styles.tabActive]}
            onPress={() => setActiveType(type)}
          >
            <Ionicons name={icon} size={17} color={activeType === type ? '#fff' : '#4dabf7'} />
            <Text style={[styles.tabText, activeType === type && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {isOwner && activeType !== 'collections' ? (
        <View style={styles.toolbar}>
          <Text style={styles.helper} numberOfLines={2}>
            {activeType === 'profiles'
              ? 'Flechas para ordenar y pin para tu top 5.'
              : 'Guardadas → favoritas → top 5. Usa ⋮ para más opciones.'}
          </Text>
          <TouchableOpacity
            style={[styles.visibility, listIsPublic ? styles.visibilityPublic : styles.visibilityPrivate]}
            onPress={toggleVisibility}
            disabled={savingVisibility}
            accessibilityRole="button"
            accessibilityLabel={listIsPublic ? 'Lista pública: tocar para ocultarla' : 'Lista privada: tocar para mostrarla'}
          >
            <Ionicons name={listIsPublic ? 'eye-outline' : 'lock-closed'} size={14} color={listIsPublic ? '#1864ab' : '#868e96'} />
            <Text style={[styles.visibilityText, listIsPublic ? styles.visibilityTextPublic : styles.visibilityTextPrivate]}>
              {listIsPublic ? 'Pública' : 'Privada'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {/* Categorías por niveles: en tareas, solo las de lo guardado; en perfiles, todas. */}
      {activeType === 'tasks' && categories.length ? (
        <CategoryFilterBar value={category} onChange={setCategory} onlyNames={categories} />
      ) : null}
      {activeType === 'profiles' && profiles.length ? (
        <CategoryFilterBar value={profilesByCategory.category} onChange={profilesByCategory.setCategory} />
      ) : null}
      {isLoading ? (
        <ActivityIndicator size="large" color="#4dabf7" style={styles.loader} />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
        >
          {activeType === 'collections' ? (
            <SaveCollectionsPanel userId={userId} navigation={navigation} />
          ) : isEmpty ? (
            <Text style={styles.empty}>{emptyText}</Text>
          ) : activeType === 'profiles' ? renderProfiles() : (
            activeCategory === ALL ? renderAllTasks() : renderCategoryTasks()
          )}
        </ScrollView>
      )}

      <TaskActionsModal
        visible={Boolean(actionTask)}
        onClose={() => setActionTask(null)}
        actionTask={actionTask}
        currentUserId={me?.id}
        isAdmin={Boolean(adminData?.isAdmin)}
        canEdit={Boolean(actionTask) && String(actionTask?.user?.id) === String(me?.id)}
        handlers={taskActions}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f8f9fa' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff' },
  backButton:  { width: 32 },
  headerTitle: { color: '#212529', fontSize: 18, fontWeight: '700' },
  tabs:        { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff' },
  tab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#e7f5ff' },
  tabActive:   { backgroundColor: '#4dabf7' },
  tabText:     { color: '#1864ab', fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  toolbar:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  helper:      { flex: 1, color: '#868e96', fontSize: 12 },
  visibility:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  visibilityPublic:  { backgroundColor: '#e7f5ff' },
  visibilityPrivate: { backgroundColor: '#f1f3f5' },
  visibilityText:    { fontSize: 12, fontWeight: '700' },
  visibilityTextPublic:  { color: '#1864ab' },
  visibilityTextPrivate: { color: '#868e96' },
  list:        { padding: 12, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sectionTitle:  { fontSize: 12, fontWeight: '800', color: '#5f3dc4', textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionLine:   { flex: 1, height: 1, backgroundColor: '#e5dbff' },
  sectionHint:   { color: '#868e96', fontSize: 12 },
  card:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 8 },
  cardMain:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:      { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e9ecef' },
  rankBadge:   {
    position: 'absolute', right: -2, bottom: -2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#845ef7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  rankText:    { color: '#fff', fontSize: 10, fontWeight: '800' },
  taskIcon:    { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7f5ff' },
  taskIconRank: { backgroundColor: '#845ef7' },
  taskRank:    { color: '#fff', fontSize: 18, fontWeight: '800' },
  cardText:    { flex: 1 },
  cardTitle:   { color: '#212529', fontSize: 15, fontWeight: '700' },
  creatorText: { color: '#4dabf7', fontSize: 12, marginTop: 3 },
  cardSubtitle: { color: '#868e96', fontSize: 12, marginTop: 3 },
  privateTag:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  privateText: { color: '#868e96', fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loader:      { marginTop: 40 },
  empty:       { textAlign: 'center', color: '#868e96', marginTop: 40 },
});

export default FavoritesScreen;
