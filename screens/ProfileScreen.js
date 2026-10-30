import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl, Platform, Modal, Alert,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import api, { getImageUrl } from '@api';
import { setAccountActive, setAccountStaff } from '../utils/adminActions';
import { AuthContext } from '@app';
import SideMenu from '@components/SideMenu';
import ReportContentButton from '@components/ReportContentButton';
import ProfileRecommendations from '@components/ProfileRecommendations';
import ProfileActivity from '@components/ProfileActivity';
import ProfileTopFive from '@components/ProfileTopFive';
import RecommendButton from '@components/RecommendButton';
import PersonalCategoryFilter from '@components/PersonalCategoryFilter';
import CategoryHierarchy from '@components/CategoryHierarchy';
import ProfileSubscription from '@components/ProfileSubscription';
import PetitionSupportStat from '@components/PetitionSupportStat';
import HiddenTaskBanner from '@components/HiddenTaskBanner';
import TestimonialCard from '@components/TestimonialCard';
import { NameWithBadges } from '@components/UserBadges';
import LanguagePickerModal from '@components/LanguagePickerModal';
import {
  useMe,
  useProfileSocial,
  useProfileTasksInfinite,
  useProfileCategories,
  useFavoritesFeed,
  useUserTestimonials,
} from '@hooks/useApi';
import StoryRing from '../components/StoryRing';
import { subItemTitle } from '../utils/aportaciones';
import FollowHeart from '@components/FollowHeart';
import { useMyRelations } from '../hooks/useMyRelations';
import TestimonialPost from '@components/TestimonialPost';
import TaskActionsModal from '@components/TaskActionsModal';
import useTaskActions from '@hooks/useTaskActions';
import { profileShareLink, shareExternally } from '../utils/externalShare';
import SocialLinks from '@components/SocialLinks';
import { setViewAs } from '@hooks/useViewAs';

// Controles opcionales del perfil (se guardan en el dispositivo; ocultos por defecto).
const PROFILE_CONTROLS_KEY = 'profileControls';
const DEFAULT_PROFILE_CONTROLS = { showFollowButton: false, showFilterAdd: false, showRecommendations: false, showActivity: false };

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Aplanar páginas de useInfiniteQuery → array plano de tareas */
const flattenPages = (data) =>
  data?.pages?.flatMap((p) => (Array.isArray(p) ? p : p.results ?? [])) ?? [];

// ─── Componente ───────────────────────────────────────────────────────────────

// Alert.alert no hace nada en la web: ahí se avisa con window.alert.
const notify = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

const ProfileScreen = ({ route, navigation }) => {
  const { signOut, user: sessionUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const detailItemWidth = Math.max(240, screenWidth - 80);

  const userId = route?.params?.userId || 'me';
  const isCurrentUser = userId === 'me';
  const hasBackNavigation = (navigation.getState()?.index ?? 0) > 0 || !isCurrentUser;

  // ── Estado local (solo UI, no datos remotos) ──────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState('');
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [showFavoriteFeed, setShowFavoriteFeed] = useState(false);
  const [favoriteFeedEnabled, setFavoriteFeedEnabled] = useState(false);
  // `initialView: 'testimonials'` abre directo los testimonios (p. ej. desde una notificación).
  const [viewMode, setViewMode] = useState(route?.params?.initialView || 'compact');
  useEffect(() => {
    if (route?.params?.initialView) setViewMode(route.params.initialView);
  }, [route?.params?.initialView]);
  // Menú de 3 puntos de un testimonio (es una publicación más).
  const [testimonialActionTask, setTestimonialActionTask] = useState(null);
  const [visibleSections, setVisibleSections] = useState({});
  const [profileControls, setProfileControls] = useState(DEFAULT_PROFILE_CONTROLS);
  const { showFollowButton, showFilterAdd, showRecommendations, showActivity } = profileControls;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PROFILE_CONTROLS_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw);
        setProfileControls({
          showFollowButton: saved?.showFollowButton === true,
          showFilterAdd: saved?.showFilterAdd === true,
          showRecommendations: saved?.showRecommendations === true,
          showActivity: saved?.showActivity === true,
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // ── Datos del usuario ─────────────────────────────────────────────────────
  const {
    data: me,
    isLoading: meLoading,
    refetch: refetchMe,
  } = useMe();

  // Para perfiles ajenos, usamos los datos del route.params hasta tener algo mejor
  const user = isCurrentUser
    ? me
    : { username: route?.params?.userName || '', user_image: route?.params?.userAvatar || null };

  const socialUserId = isCurrentUser ? me?.id : userId;
  const {
    data: socialStats,
    isLoading: socialLoading,
    isError: socialStatsError,
    refetch: refetchSocial,
  } = useProfileSocial(socialUserId);
  const [followUpdating, setFollowUpdating] = useState(false);
  // El corazón (seguir/favorito/anclar) y los botones de abajo muestran la misma relación.
  const { ready: relationsReady, getState: getRelationState, refresh: refreshRelations } = useMyRelations();
  // Anclado = está en tu top 5 de perfiles favoritos.
  const profileRelation = !isCurrentUser && relationsReady && socialUserId ? getRelationState(socialUserId) : null;
  const isPinnedProfile = profileRelation === 'pinned';
  const isFavoriteProfile = profileRelation ? ['favorite', 'pinned'].includes(profileRelation) : !!socialStats?.is_favorited;
  const isFollowingProfile = profileRelation ? profileRelation !== 'none' : !!socialStats?.is_following;
  const syncRelations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['profileSocial'] });
    refreshRelations();
  }, [queryClient, refreshRelations]);

  // ownerId: el ID real del usuario para pasarlo a las categorías
  const ownerId = isCurrentUser ? me?.id : userId;

  // ── Tareas ────────────────────────────────────────────────────────────────
  const tasksParams = useMemo(
    () => (selectedCategory ? { category: selectedCategory } : {}),
    [selectedCategory]
  );

  const {
    data: tasksData,
    isLoading: tasksLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch: refetchTasks,
  } = useProfileTasksInfinite(isCurrentUser, userId, tasksParams);

  const tasks = flattenPages(tasksData);

  // ── Categorías del perfil ─────────────────────────────────────────────────
  const {
    data: categoriesData,
    refetch: refetchCategories,
  } = useProfileCategories(userId, isCurrentUser, ownerId);

  const profileCategories = categoriesData?.profileCategories ?? [];
  const appCategories = categoriesData?.appCategories ?? [];
  const personalFilterPublic = categoriesData?.personalFilterPublic ?? false;

  const appCategoryNames = useMemo(
    () => appCategories.map((c) => String(c.name || '').trim()).filter(Boolean),
    [appCategories]
  );

  // ── Favoritos ─────────────────────────────────────────────────────────────
  const {
    data: favoriteFeedTasks = [],
    isLoading: favoriteFeedLoading,
  } = useFavoritesFeed(favoriteFeedEnabled, isCurrentUser ? null : userId);

  // ── Testimonios: publicaciones escritas en su perfil (pch "testimonios") o comentarios
  // donde lo etiquetaron. La persona del perfil decide cuáles se muestran.
  const { data: testimonialsData, refetch: refetchTestimonials } = useUserTestimonials(ownerId);
  const showTestimonials = viewMode === 'testimonials' && !showFavoriteFeed;
  // Los que yo escribí en este perfil y aún no se muestran (esperando o no aprobados).
  const myTestimonialIds = useMemo(
    () => new Set((testimonialsData?.mine ?? []).map((item) => String(item.id))),
    [testimonialsData],
  );
  const testimonials = useMemo(() => {
    const list = [
      ...(testimonialsData?.mine ?? []),
      ...(testimonialsData?.pending ?? []),
      ...(testimonialsData?.testimonials ?? []),
    ];
    // En el perfil de otra persona, arriba: escribirle un testimonio.
    if (testimonialsData?.can_write) list.unshift(WRITE_TESTIMONIAL_ITEM);
    return list;
  }, [testimonialsData]);
  // Escribir un testimonio es crear una publicación (sin elegir PCH) para este perfil.
  const writeTestimonial = () => {
    setProfileMenuVisible(false);
    setShowFavoriteFeed(false);
    setViewMode('testimonials');
    navigation.navigate('CreateTask', { testimonialFor: { id: ownerId, username: user?.username } });
  };
  const testimonialActions = useTaskActions({
    navigation,
    actionTask: testimonialActionTask,
    currentUserId: me?.id,
    close: () => setTestimonialActionTask(null),
    refresh: () => refetchTestimonials(),
    onDeleted: () => refetchTestimonials(),
  });
  const approvedCount = testimonialsData?.testimonials?.length ?? 0;
  const pendingCount = testimonialsData?.pending?.length ?? 0;

  const answerTestimonial = async (testimonial, status) => {
    try {
      const api = (await import('@api')).default;
      await api.patch(`testimonials/${testimonial.id}/`, { status });
      refetchTestimonials();
    } catch {
      Alert.alert('Error', 'No se pudo guardar tu respuesta. Intenta de nuevo.');
    }
  };

  // ── Refresh al enfocar la pantalla ────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (isCurrentUser) refetchMe();
      refetchTasks();
      // Al volver de escribir o editar un testimonio.
      refetchTestimonials();
      if (socialUserId) refetchSocial();
    }, [isCurrentUser, refetchMe, refetchTasks, refetchTestimonials, refetchSocial, socialUserId])
  );

  // ── Acciones ──────────────────────────────────────────────────────────────

  const onRefresh = useCallback(() => {
    if (isCurrentUser) refetchMe();
    refetchTasks();
    refetchCategories();
    refetchTestimonials();
    if (socialUserId) refetchSocial();
  }, [isCurrentUser, refetchMe, refetchTasks, refetchCategories, refetchSocial, refetchTestimonials, socialUserId]);

  // "Seguir" es una relación propia. Jerarquía: Seguir → Favorito → Anclado
  // (favoritar sigue; dejar de seguir quita el favorito).
  const toggleFollow = async () => {
    if (!socialUserId || !socialStats || followUpdating) return;
    setFollowUpdating(true);
    try {
      const wasFollowing = !!socialStats.is_following;
      const response = wasFollowing
        ? await api.delete(`users/${socialUserId}/follow/`)
        : await api.post(`users/${socialUserId}/follow/`);
      const data = response.data || {};
      queryClient.setQueryData(['profileSocial', socialUserId], (prev) => prev ? {
        ...prev,
        is_following: !!data.is_following,
        is_favorited: !!data.is_favorited,
        followers_count: data.followers_count ?? prev.followers_count,
        favorited_by_count: wasFollowing && prev.is_favorited
          ? Math.max(0, (prev.favorited_by_count || 0) - 1)
          : prev.favorited_by_count,
      } : prev);
      queryClient.invalidateQueries({ queryKey: ['profileSocial'] });
      refreshRelations();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el seguimiento. Inténtalo de nuevo.');
    } finally {
      setFollowUpdating(false);
    }
  };

  const openFollowList = (mode) => {
    if (!socialUserId) return;
    navigation.navigate('FollowList', {
      userId: socialUserId,
      mode,
      userName: user?.username || route?.params?.userName || '',
    });
  };

  // FavoritesScreen: sin userId muestra los propios; con userId, los públicos de esa persona.
  const openFavoriteProfiles = () => {
    if (!socialUserId) return;
    navigation.navigate('Favorites', isCurrentUser ? undefined : { userId: socialUserId });
  };

  // Anclar en el top 5 (lo agrega a favoritos y lo sigue si faltaba). Quitarlo lo deja
  // en favoritos, en el puesto 6 (el sexto sube a su lugar).
  const setProfilePinned = async (pinned) => {
    if (!socialUserId || followUpdating) return;
    setFollowUpdating(true);
    try {
      await api.post('favorites/pin/', { type: 'profile', target_id: socialUserId, is_pinned: pinned });
      syncRelations();
    } catch {
      Alert.alert('Error', pinned ? 'No se pudo anclar en el top 5.' : 'No se pudo quitar del top 5. Inténtalo de nuevo.');
    } finally {
      setFollowUpdating(false);
    }
  };
  const unpinProfile = () => setProfilePinned(false);

  // Perfil favorito: el endpoint alterna (201 agregado / 204 quitado) y no devuelve contadores.
  const toggleFavoriteProfile = async () => {
    if (!socialUserId || !socialStats || followUpdating) return;
    setFollowUpdating(true);
    try {
      const response = await api.post('pfavoritos/agregar/', { perfil_id: socialUserId });
      const isFavorited = response.status === 201;
      queryClient.setQueryData(['profileSocial', socialUserId], (prev) => prev ? {
        ...prev,
        is_favorited: isFavorited,
        // Favoritar sigue automáticamente (quitar el favorito no deja de seguir).
        is_following: isFavorited ? true : prev.is_following,
        followers_count: isFavorited && !prev.is_following
          ? (prev.followers_count || 0) + 1
          : prev.followers_count,
        favorited_by_count: Math.max(0, (prev.favorited_by_count || 0) + (isFavorited ? 1 : -1)),
      } : prev);
      queryClient.invalidateQueries({ queryKey: ['profileSocial'] });
      refreshRelations();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el perfil favorito. Inténtalo de nuevo.');
    } finally {
      setFollowUpdating(false);
    }
  };

  // Controles opcionales del perfil: ocultos hasta que se habilitan desde el menú de 3 puntos.
  const updateProfileControls = useCallback((patch) => {
    setProfileControls((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(PROFILE_CONTROLS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleFollowButton = () => {
    setProfileMenuVisible(false);
    updateProfileControls({ showFollowButton: !profileControls.showFollowButton });
  };

  const toggleRecommendations = () => {
    setProfileMenuVisible(false);
    updateProfileControls({ showRecommendations: !profileControls.showRecommendations });
  };

  const toggleActivity = () => {
    setProfileMenuVisible(false);
    updateProfileControls({ showActivity: !profileControls.showActivity });
  };

  // Visitas: abrir un perfil ajeno cuenta como visita (una por persona y día).
  useEffect(() => {
    if (isCurrentUser || !socialUserId) return;
    api.post(`users/${socialUserId}/visit/`).catch(() => {});
  }, [isCurrentUser, socialUserId]);

  const openProfileVisits = () => {
    setProfileMenuVisible(false);
    navigation.getParent()?.navigate('Profile', { screen: 'ProfileVisits' });
  };

  // Ver como esta persona: su feed (lo de quienes sigue), si lo permite.
  const openViewAs = () => {
    setProfileMenuVisible(false);
    if (!socialStats?.can_view_feed) {
      notify(
        'Ver como esta persona',
        `@${user?.username || route?.params?.userName || 'Esta persona'} no permite que otros vean su feed. Cada quien lo activa en su perfil: menú de 3 puntos → "Permitir ver como yo".`,
      );
      return;
    }
    // Queda activo en el feed, Reels y Top hasta tocar "Salir".
    setViewAs({ id: socialUserId, username: user?.username || route?.params?.userName || '' });
    navigation.getParent()?.navigate('Tasks', { screen: 'TasksList' });
  };

  // "Ver como yo": el dueño permite (o no) que otros vean su feed.
  const [feedSaving, setFeedSaving] = useState(false);
  const toggleFeedPublic = async () => {
    setProfileMenuVisible(false);
    if (!socialUserId || feedSaving) return;
    const next = !socialStats?.feed_public;
    setFeedSaving(true);
    try {
      await api.patch(`users/${socialUserId}/activity/`, { kind: 'feed', public: next });
      refetchSocial();
      queryClient.invalidateQueries({ queryKey: ['profileActivity', socialUserId] });
      notify(
        'Ver como yo',
        next
          ? 'Listo: en tu perfil ahora aparece "Ver como" para que otros vean tu feed.'
          : 'Listo: nadie puede ver tu feed.',
      );
    } catch {
      notify('Error', 'No se pudo cambiar. Intenta de nuevo.');
    } finally {
      setFeedSaving(false);
    }
  };

  const toggleFilterAdd = () => {
    setProfileMenuVisible(false);
    updateProfileControls({ showFilterAdd: !profileControls.showFilterAdd });
  };

  // ── Moderación (solo superadmin, sobre perfiles ajenos) ───────────────────
  const isSuperAdmin = Boolean(sessionUser?.is_superuser);
  const adminState = socialStats?.admin_state;
  const adminTargetName = user?.username || route?.params?.userName || '';

  const afterAdminChange = useCallback(() => {
    refetchSocial();
    queryClient.invalidateQueries({ queryKey: ['userRecommendations', socialUserId] });
  }, [refetchSocial, queryClient, socialUserId]);

  const adminToggleVerified = async () => {
    setProfileMenuVisible(false);
    try {
      await api.post(`admin/users/${socialUserId}/verify/`, { is_verified: !adminState?.is_verified });
      afterAdminChange();
    } catch (error) {
      Alert.alert('No se pudo actualizar', error.response?.data?.detail || 'Inténtalo de nuevo.');
    }
  };

  const adminToggleRecommended = async () => {
    setProfileMenuVisible(false);
    try {
      await api.post(`admin/users/${socialUserId}/recommend/`, { is_recommended: !adminState?.is_recommended });
      afterAdminChange();
    } catch (error) {
      Alert.alert('No se pudo actualizar', error.response?.data?.detail || 'Inténtalo de nuevo.');
    }
  };

  const adminToggleActive = () => {
    setProfileMenuVisible(false);
    setAccountActive(socialUserId, adminTargetName, !adminState?.is_active, afterAdminChange);
  };

  const adminToggleStaff = () => {
    setProfileMenuVisible(false);
    setAccountStaff(socialUserId, adminTargetName, !adminState?.is_staff, afterAdminChange);
  };

  const openRecommendedProfile = useCallback((person) => {
    if (!person?.id) return;
    const params = person.id === me?.id
      ? { userId: 'me' }
      : {
          userId: person.id,
          userName: person.username || person.name,
          userAvatar: getImageUrl(person.user_image || person.profile?.user_image),
        };
    if (typeof navigation.push === 'function') navigation.push('UserProfile', params);
    else navigation.navigate('UserProfile', params);
  }, [me?.id, navigation]);

  const loadMoreTasks = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
  };

  // Mismo destino que "Ir al foro" del menú de las tareas: el foro filtrado a este perfil.
  const openForum = () => {
    setProfileMenuVisible(false);
    if (!socialUserId) return;
    navigation.navigate('Forum', {
      screen: 'ForumMain',
      params: { userId: socialUserId, userName: user?.username || user?.first_name || 'usuario' },
    });
  };

  const openFavoriteFeed = () => {
    setFavoriteFeedEnabled(true);
    setShowFavoriteFeed(true);
    setProfileMenuVisible(false);
  };

  const exitFavoriteFeed = () => {
    setShowFavoriteFeed(false);
    setFavoriteFeedEnabled(false);
    // Limpiar caché para que se recargue la próxima vez
    queryClient.removeQueries({ queryKey: ['favoritesFeed'] });
  };

  const togglePersonalFilterVisibility = async () => {
    const nextValue = !personalFilterPublic;
    try {
      const response = await api.patch('categories/visibility/', {
        personal_filter_public: nextValue,
      });
      // Invalidar caché de categorías para reflejar el cambio
      queryClient.invalidateQueries({ queryKey: ['profileCategories'] });
      setProfileMenuVisible(false);
      Alert.alert(
        'Mi filtro',
        nextValue
          ? 'Ahora aparece en toda la app, debajo del filtro de la app.'
          : 'Ahora solo aparece en tu perfil.'
      );
    } catch {
      Alert.alert('Error', 'No se pudo cambiar la visibilidad del filtro.');
    }
  };

  const handleLogout = () => signOut();

  // ── Renderizado de tarjetas ───────────────────────────────────────────────

  const changeSection = (taskId, section) => {
    setVisibleSections((prev) => ({ ...prev, [taskId]: section }));
  };

  const renderTask = ({ item }) => {
    const taskOwner = item.user || user;
    return (
      <TouchableOpacity
        style={styles.taskCard}
        onPress={() => navigation.push('TaskDetail', { taskId: item.id })}
        activeOpacity={0.9}
      >
        <HiddenTaskBanner task={item} compact onPublished={() => refetchTasks()} />
        <View style={styles.taskHeader}>
          <Image
            source={{ uri: getImageUrl(taskOwner?.user_image || taskOwner?.profile?.user_image) }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <NameWithBadges userId={taskOwner?.id || ownerId} style={styles.taskCreator} badgeSize={12}>
              Creada por{' '}
              {taskOwner?.username ||
                [taskOwner?.first_name, taskOwner?.last_name].filter(Boolean).join(' ') ||
                'Usuario'}
            </NameWithBadges>
            <Text style={styles.taskDate}>{moment(item.created_at).fromNow()}</Text>
          </View>
        </View>

        <Text style={styles.taskDescription} numberOfLines={3}>
          {item.description}
        </Text>

        {item.categories ? (
          <View style={styles.categoriesList}>
            {item.categories.split(',').map((cat, idx) => (
              <Text key={idx} style={styles.categoryBadge}>
                {cat.trim()}
              </Text>
            ))}
          </View>
        ) : null}

        {(item.image ||
          item.subtasks?.[0]?.image ||
          item.subfactores?.[0]?.image ||
          item.subfuentes?.[0]?.image) && (
          <Image
            source={{
              uri: getImageUrl(
                item.image ||
                  item.subtasks?.[0]?.image ||
                  item.subfactores?.[0]?.image ||
                  item.subfuentes?.[0]?.image
              ),
            }}
            style={styles.taskImage}
          />
        )}

        <View style={styles.taskFooter}>
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons name="heart" size={16} color="#ff6b6b" />
              <Text style={styles.statText}>{item.likes_count ?? 0}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="chatbubble" size={16} color="#4dabf7" />
              <Text style={styles.statText}>{item.comments_count || 0}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="share-social" size={16} color="#51cf66" />
              <Text style={styles.statText}>{item.share_count ?? 0}</Text>
            </View>
            <PetitionSupportStat task={item} navigation={navigation} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailedTask = ({ item }) => {
    const currentSec = visibleSections[item.id] || 'subtasks';
    const content = Array.isArray(item[currentSec]) ? item[currentSec] : [];
    const taskOwner = item.user || user;

    return (
      <View style={styles.detailedCard}>
        <HiddenTaskBanner task={item} compact onPublished={() => refetchTasks()} />
        <View style={styles.taskHeader}>
          <Image
            source={{ uri: getImageUrl(taskOwner?.user_image || taskOwner?.profile?.user_image) }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            <NameWithBadges userId={taskOwner?.id || ownerId} style={styles.taskCreator} badgeSize={12}>
              Creada por{' '}
              {taskOwner?.username ||
                [taskOwner?.first_name, taskOwner?.last_name].filter(Boolean).join(' ') ||
                'Usuario'}
            </NameWithBadges>
            <Text style={styles.taskDate}>{moment(item.created_at).fromNow()}</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.push('TaskDetail', { taskId: item.id })}
        >
          <Text style={styles.taskDescription}>{item.description}</Text>
          {item.categories ? (
            <View style={styles.categoriesList}>
              {item.categories.split(',').map((cat, idx) => (
                <Text key={idx} style={styles.categoryBadge}>
                  {cat.trim()}
                </Text>
              ))}
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={styles.sectionTabs}>
          {['subtasks', 'subfactores', 'subfuentes'].map((section) => (
            <TouchableOpacity
              key={section}
              onPress={() => changeSection(item.id, section)}
              style={[styles.tab, currentSec === section && styles.tabActive]}
            >
              <Text style={[styles.tabText, currentSec === section && styles.tabTextActive]}>
                {section === 'subtasks' ? 'Aportación' : section.replace('sub', '')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dynamicContent}>
          {content.length === 0 ? (
            <Text style={styles.noContent}>Sin datos en esta sección</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselRow}
            >
              {content.map((sub, idx) => (
                <View
                  key={sub.id || `${currentSec}-${idx}`}
                  style={[styles.subItem, { width: detailItemWidth }]}
                >
                  {subItemTitle(sub) ? <Text style={styles.subItemTitle}>{subItemTitle(sub)}</Text> : null}
                  {sub.description ? (
                    <Text style={styles.subItemDesc}>{sub.description}</Text>
                  ) : null}
                  {sub.image ? (
                    <Image
                      source={{ uri: getImageUrl(sub.image) }}
                      style={styles.subMedia}
                      contentFit="cover"
                    />
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.taskFooter}>
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons name="heart" size={16} color="#ff6b6b" />
              <Text style={styles.statText}>{item.likes_count ?? 0}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="chatbubble" size={16} color="#4dabf7" />
              <Text style={styles.statText}>{item.comments_count || 0}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="share-social" size={16} color="#51cf66" />
              <Text style={styles.statText}>{item.share_count ?? 0}</Text>
            </View>
            <PetitionSupportStat task={item} navigation={navigation} />
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.profileHeader}>
      <View style={styles.profileInfoContainer}>
        {/* Aro de historia: azul si hay algo sin ver, gris si ya la viste, nada si no subió. */}
        <StoryRing userId={ownerId} size={70} navigation={navigation} style={styles.profileAvatarWrap}>
          <Image
            source={{ uri: getImageUrl(user?.user_image || user?.profile?.user_image) }}
            style={styles.profileAvatar}
          />
        </StoryRing>
        <View style={styles.profileTextContainer}>
          <NameWithBadges userId={ownerId} style={styles.profileName} badgeSize={20} numberOfLines={2}>
            {user?.first_name
              ? `${user.first_name} ${user.last_name || ''}`
              : user?.username || 'Usuario'}
          </NameWithBadges>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          {isCurrentUser && (user?.is_staff || user?.is_superuser) ? (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.adminBadgeText}>
                {user?.is_superuser ? 'Superadministrador' : 'Administrador'}
              </Text>
            </View>
          ) : null}
        </View>
        <RecommendButton userId={socialUserId} isCurrentUser={isCurrentUser} />
      </View>

      <SocialLinks links={socialStats?.social_links} style={styles.socialLinks} />

      {/* Ver como esta persona: con candado si no lo permite (al tocarlo explica cómo se activa). */}
      {!isCurrentUser && socialStats ? (
        <TouchableOpacity
          style={[styles.viewAsChip, !socialStats.can_view_feed && styles.viewAsChipLocked]}
          onPress={openViewAs}
          accessibilityLabel="Ver su feed"
        >
          <Ionicons
            name={socialStats.can_view_feed ? 'eye-outline' : 'lock-closed-outline'}
            size={16}
            color={socialStats.can_view_feed ? '#1864ab' : '#868e96'}
          />
          <Text style={[styles.viewAsChipText, !socialStats.can_view_feed && styles.viewAsChipTextLocked]}>
            Ver como @{user?.username || route?.params?.userName || 'usuario'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {socialStatsError ? (
        <TouchableOpacity
          style={styles.socialStatsError}
          onPress={() => refetchSocial()}
          accessibilityRole="button"
        >
          <Text style={styles.socialStatsErrorText}>No se pudieron cargar las estadísticas. Toca para reintentar.</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.socialStatsRow}>
          <TouchableOpacity
            style={styles.socialStat}
            onPress={() => openFollowList('followers')}
            disabled={!socialUserId}
            accessibilityRole="button"
            accessibilityLabel="Ver seguidores"
          >
            <Text style={styles.socialStatCount}>
              {socialLoading ? '…' : socialStats?.followers_count ?? '—'}
            </Text>
            <Text style={styles.socialStatLabel}>Seguidores</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialStat}
            onPress={() => openFollowList('following')}
            disabled={!socialUserId}
            accessibilityRole="button"
            accessibilityLabel="Ver a quién sigue"
          >
            <Text style={styles.socialStatCount}>
              {socialLoading ? '…' : socialStats?.following_count ?? '—'}
            </Text>
            <Text style={styles.socialStatLabel}>Siguiendo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialStat}
            onPress={() => openFollowList('favoritedBy')}
            disabled={!socialUserId}
            accessibilityRole="button"
            accessibilityLabel="Ver quién lo tiene en favoritos"
          >
            <Text style={styles.socialStatCount}>
              {socialLoading ? '…' : socialStats?.favorited_by_count ?? '—'}
            </Text>
            <Text style={styles.socialStatLabel}>Lo tienen en favoritos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialStat}
            onPress={openFavoriteProfiles}
            disabled={!socialUserId || socialStats?.favorites_count == null}
            accessibilityRole="button"
            accessibilityLabel="Ver perfiles favoritos"
          >
            <Text style={styles.socialStatCount}>
              {socialLoading ? '…' : socialStats?.favorites_count ?? '—'}
            </Text>
            <Text style={styles.socialStatLabel}>Perfiles favoritos</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Los demás contadores del perfil. */}
      {socialStats && !socialStatsError ? (
        <View style={styles.socialStatsRow}>
          <View style={styles.socialStat}>
            <Text style={styles.socialStatCount}>{socialStats.posts_count ?? '—'}</Text>
            <Text style={styles.socialStatLabel}>Publicaciones</Text>
          </View>
          <View style={styles.socialStat}>
            <Text style={styles.socialStatCount}>{socialStats.profile_likes_count ?? '—'}</Text>
            <Text style={styles.socialStatLabel}>Me gusta al perfil</Text>
          </View>
          <TouchableOpacity
            style={styles.socialStat}
            onPress={() => { setShowFavoriteFeed(false); setViewMode('testimonials'); }}
            accessibilityRole="button"
            accessibilityLabel="Ver testimonios"
          >
            <Text style={styles.socialStatCount}>{socialStats.testimonials_count ?? '—'}</Text>
            <Text style={styles.socialStatLabel}>Testimonios</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialStat}
            onPress={() => { if (!showRecommendations) updateProfileControls({ showRecommendations: true }); }}
            disabled={socialStats.recommendations_count == null}
            accessibilityRole="button"
            accessibilityLabel="Ver recomendaciones"
          >
            <Text style={styles.socialStatCount}>{socialStats.recommendations_count ?? '—'}</Text>
            <Text style={styles.socialStatLabel}>Recomendaciones</Text>
          </TouchableOpacity>
          {isCurrentUser && socialStats.visits_30d != null ? (
            <TouchableOpacity
              style={styles.socialStat}
              onPress={openProfileVisits}
              accessibilityRole="button"
              accessibilityLabel="Ver visitas a tu perfil"
            >
              <Text style={styles.socialStatCount}>{socialStats.visits_30d}</Text>
              <Text style={styles.socialStatLabel}>Visitas (30 días)</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {!isCurrentUser ? (
        <View style={styles.profileActions}>
          <TouchableOpacity
            style={[
              styles.followButton,
              socialStats?.is_following && styles.followingButton,
            ]}
            onPress={toggleFollow}
            disabled={!socialStats || socialLoading || followUpdating}
            accessibilityRole="button"
            accessibilityLabel={socialStats?.is_following ? 'Dejar de seguir' : 'Seguir'}
          >
            {followUpdating ? (
              <ActivityIndicator size="small" color={socialStats?.is_following ? '#4dabf7' : '#fff'} />
            ) : (
              <Text
                style={[
                  styles.followButtonText,
                  socialStats?.is_following && styles.followingButtonText,
                ]}
              >
                {socialStats?.is_following ? 'Siguiendo' : 'Seguir'}
              </Text>
            )}
          </TouchableOpacity>
          {isPinnedProfile ? (
          // Anclado en tu top 5: este lugar sirve para sacarlo (queda en el puesto 6).
          <TouchableOpacity
            style={[styles.followButton, styles.followingButton, styles.pinnedButton]}
            onPress={unpinProfile}
            disabled={followUpdating}
            accessibilityRole="button"
            accessibilityLabel="Quitar del top 5"
          >
            <Ionicons name="pin" size={14} color="#845ef7" />
            <Text style={[styles.followButtonText, styles.pinnedButtonText]}>Quitar del top 5</Text>
          </TouchableOpacity>
          ) : showFollowButton ? (
          <TouchableOpacity
            style={[
              styles.followButton,
              socialStats?.is_favorited && styles.followingButton,
            ]}
            onPress={toggleFavoriteProfile}
            disabled={!socialStats || socialLoading || followUpdating}
            accessibilityRole="button"
            accessibilityLabel={socialStats?.is_favorited ? 'Quitar de perfiles favoritos' : 'Agregar a perfiles favoritos'}
          >
            <Text
              style={[
                styles.followButtonText,
                socialStats?.is_favorited && styles.followingButtonText,
              ]}
            >
              {socialStats?.is_favorited ? 'En favoritos' : 'Agregar a favoritos'}
            </Text>
          </TouchableOpacity>
          ) : null}
          <ReportContentButton targetType="user" targetId={socialUserId} />
        </View>
      ) : null}

      {/* Top 5: perfiles y tareas ancladas (en general y por categoría). */}
      <ProfileTopFive
        userId={socialUserId}
        isCurrentUser={isCurrentUser}
        navigation={navigation}
        onOpenProfile={openRecommendedProfile}
      />

      {showRecommendations ? (
        <>
          <View style={styles.divider} />
          <ProfileRecommendations
            userId={socialUserId}
            isCurrentUser={isCurrentUser}
            currentUserId={me?.id}
            onOpenProfile={openRecommendedProfile}
          />
        </>
      ) : null}

      {/* Me gusta, comentarios y verificaciones: cada uno se ve si su dueño lo muestra. */}
      {showActivity ? (
        <>
          <View style={styles.divider} />
          <ProfileActivity
            userId={socialUserId}
            username={user?.username}
            isCurrentUser={isCurrentUser}
            navigation={navigation}
            onOpenProfile={openRecommendedProfile}
          />
        </>
      ) : null}

      {ownerId ? (
        <ProfileSubscription
          userId={ownerId}
          username={user?.username}
          isCurrentUser={isCurrentUser}
          navigation={navigation}
        />
      ) : null}

      <View style={styles.divider} />
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>
          {showFavoriteFeed
            ? (isCurrentUser ? 'Tareas favoritas' : `Favoritos de ${user?.username || ''}`)
            : showTestimonials
            ? (isCurrentUser ? 'Mis testimonios' : `Testimonios de ${user?.username || ''}`)
            : isCurrentUser
            ? 'Mis Publicaciones'
            : `Publicaciones de ${user?.username || ''}`}
        </Text>
        {showFavoriteFeed ? (
          <TouchableOpacity style={styles.exitFavoritesButton} onPress={exitFavoriteFeed}>
            <Ionicons name="close-circle-outline" size={18} color="#f59f00" />
            <Text style={styles.exitFavoritesText}>Salir</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  // ── Loading inicial ───────────────────────────────────────────────────────
  const isInitialLoading = (isCurrentUser && meLoading) || (tasksLoading && !tasksData);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Barra superior */}
      <View style={styles.topBar}>
        {hasBackNavigation ? (
          <TouchableOpacity
            onPress={() =>
              navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeMain')
            }
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        ) : (
          <SideMenu
            navigation={navigation}
            signOut={signOut}
            user={sessionUser}
            buttonStyle={styles.sideMenuButton}
          />
        )}
        <Text style={styles.topBarTitle}>Perfil</Text>
        {!isCurrentUser && socialUserId ? (
          <FollowHeart
            userId={socialUserId}
            username={user?.username}
            size={24}
            style={styles.profileHeartButton}
            onChange={syncRelations}
          />
        ) : null}
        <TouchableOpacity
          onPress={() => setProfileMenuVisible(true)}
          style={styles.profileMenuButton}
          accessibilityLabel="Opciones del perfil"
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Menú de opciones */}
      <Modal
        visible={profileMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.profileMenuOverlay}
          activeOpacity={1}
          onPress={() => setProfileMenuVisible(false)}
        >
          <View style={styles.profileMenuCard}>
            {/* Si no caben todas las opciones, el menú se desplaza. */}
            <ScrollView style={{ maxHeight: Math.max(240, screenHeight - 140) }} bounces={false}>
            {/* Tu actividad y "ver como": hasta arriba para que siempre se vean. */}
            {isCurrentUser ? (
              <TouchableOpacity
                style={styles.profileMenuOption}
                onPress={() => {
                  setProfileMenuVisible(false);
                  navigation.getParent()?.navigate('Profile', { screen: 'Activity' });
                }}
              >
                <Ionicons name="pulse-outline" size={20} color="#4dabf7" />
                <Text style={styles.profileMenuText}>Tu actividad (todo lo que haces y quién lo ve)</Text>
              </TouchableOpacity>
            ) : null}
            {isCurrentUser ? (
              <TouchableOpacity style={styles.profileMenuOption} onPress={openProfileVisits}>
                <Ionicons name="walk-outline" size={20} color="#4dabf7" />
                <Text style={styles.profileMenuText}>Visitas a tu perfil</Text>
              </TouchableOpacity>
            ) : null}
            {isCurrentUser ? (
              <TouchableOpacity style={styles.profileMenuOption} onPress={toggleFeedPublic} disabled={feedSaving}>
                <Ionicons name={socialStats?.feed_public ? 'eye' : 'eye-off-outline'} size={20} color="#1864ab" />
                <Text style={styles.profileMenuText}>
                  {socialStats?.feed_public
                    ? 'Ver como yo: permitido (toca para quitarlo)'
                    : 'Permitir ver como yo (que otros vean tu feed)'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.profileMenuOption} onPress={openViewAs}>
                <Ionicons name={socialStats?.can_view_feed ? 'eye-outline' : 'lock-closed-outline'} size={20} color="#1864ab" />
                <Text style={styles.profileMenuText}>Ver como esta persona (su feed)</Text>
              </TouchableOpacity>
            )}
            {isCurrentUser ? (
              <>
            <TouchableOpacity style={styles.profileMenuOption} onPress={openFavoriteFeed}>
              <Ionicons name="star-outline" size={20} color="#f59f00" />
              <Text style={styles.profileMenuText}>Favoritos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={() => {
                setProfileMenuVisible(false);
                navigation.navigate('Favorites', { mode: 'organize' });
              }}
            >
              <Ionicons name="options-outline" size={20} color="#845ef7" />
              <Text style={styles.profileMenuText}>Ordenar favoritos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={() => {
                setProfileMenuVisible(false);
                navigation.navigate('EditProfile', { user });
              }}
            >
              <Ionicons name="pencil-outline" size={20} color="#4dabf7" />
              <Text style={styles.profileMenuText}>Editar perfil</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={() => {
                setProfileMenuVisible(false);
                navigation.navigate('Subscriptions');
              }}
            >
              <Ionicons name="card-outline" size={20} color="#2f9e44" />
              <Text style={styles.profileMenuText}>Mis suscripciones</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={() => {
                setProfileMenuVisible(false);
                navigation.navigate('PetitionSupports');
              }}
            >
              <Ionicons name="cash-outline" size={20} color="#2f9e44" />
              <Text style={styles.profileMenuText}>Mis apoyos a peticiones</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={() => {
                setProfileMenuVisible(false);
                navigation.navigate('Groups');
              }}
            >
              <Ionicons name="people-circle-outline" size={20} color="#4dabf7" />
              <Text style={styles.profileMenuText}>Mis grupos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={() => {
                setProfileMenuVisible(false);
                setLanguageModalVisible(true);
              }}
            >
              <Ionicons name="language-outline" size={20} color="#7048e8" />
              <Text style={styles.profileMenuText}>Mi idioma (traductor)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileMenuOption} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#ff6b6b" />
              <Text style={styles.profileMenuText}>Cerrar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={togglePersonalFilterVisibility}
            >
              <Ionicons
                name={personalFilterPublic ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#4dabf7"
              />
              <Text style={styles.profileMenuText}>
                {personalFilterPublic
                  ? 'Usar mi filtro solo en mi perfil'
                  : 'Usar mi filtro en toda la app'}
              </Text>
            </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity
              style={styles.profileMenuOption}
              onPress={() => {
                setProfileMenuVisible(false);
                shareExternally({
                  title: `${user?.username || 'Perfil'} en Aportaciones`,
                  link: profileShareLink(socialUserId),
                }).catch(() => {});
              }}
              disabled={!socialUserId}
            >
              <Ionicons name="paper-plane-outline" size={20} color="#4dabf7" />
              <Text style={styles.profileMenuText}>
                {isCurrentUser ? 'Compartir mi perfil en otras apps' : 'Compartir este perfil en otras apps'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileMenuOption} onPress={openForum} disabled={!socialUserId}>
              <Ionicons name="newspaper-outline" size={20} color="#4dabf7" />
              <Text style={styles.profileMenuText}>
                {isCurrentUser ? 'Ir a mi foro' : `Ir al foro de ${user?.username || 'este perfil'}`}
              </Text>
            </TouchableOpacity>
            {!isCurrentUser ? (
              <>
                {/* Relación con este perfil: lo mismo que el corazón y los botones de abajo. */}
                <TouchableOpacity
                  style={styles.profileMenuOption}
                  onPress={() => { setProfileMenuVisible(false); toggleFollow(); }}
                >
                  <Ionicons name={isFollowingProfile ? 'person-remove-outline' : 'person-add-outline'} size={20} color="#4dabf7" />
                  <Text style={styles.profileMenuText}>{isFollowingProfile ? 'Dejar de seguir' : 'Seguir'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.profileMenuOption}
                  onPress={() => { setProfileMenuVisible(false); toggleFavoriteProfile(); }}
                >
                  <Ionicons name={isFavoriteProfile ? 'star' : 'star-outline'} size={20} color="#f59f00" />
                  <Text style={styles.profileMenuText}>{isFavoriteProfile ? 'Quitar de favoritos' : 'Agregar a favoritos'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.profileMenuOption}
                  onPress={() => { setProfileMenuVisible(false); setProfilePinned(!isPinnedProfile); }}
                >
                  <Ionicons name={isPinnedProfile ? 'pin' : 'pin-outline'} size={20} color="#845ef7" />
                  <Text style={styles.profileMenuText}>{isPinnedProfile ? 'Quitar del top 5' : 'Anclar en mi top 5'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMenuOption} onPress={writeTestimonial}>
                  <Ionicons name="chatbox-ellipses-outline" size={20} color="#845ef7" />
                  <Text style={styles.profileMenuText}>Escribir un testimonio</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMenuOption} onPress={openFavoriteFeed}>
                  <Ionicons name="star-outline" size={20} color="#f59f00" />
                  <Text style={styles.profileMenuText}>Favoritos de {user?.username || 'este perfil'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.profileMenuOption}
                  onPress={() => {
                    setProfileMenuVisible(false);
                    navigation.navigate('Subscriptions', { userId, username: user?.username });
                  }}
                >
                  <Ionicons name="card-outline" size={20} color="#2f9e44" />
                  <Text style={styles.profileMenuText}>Suscripciones de {user?.username || 'este perfil'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.profileMenuOption}
                  onPress={() => {
                    setProfileMenuVisible(false);
                    navigation.navigate('PetitionSupports', { userId, username: user?.username });
                  }}
                >
                  <Ionicons name="cash-outline" size={20} color="#2f9e44" />
                  <Text style={styles.profileMenuText}>Apoyos a peticiones de {user?.username || 'este perfil'}</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {isCurrentUser ? (
              <TouchableOpacity style={styles.profileMenuOption} onPress={toggleFilterAdd}>
                <Ionicons
                  name={showFilterAdd ? 'remove-circle-outline' : 'add-circle-outline'}
                  size={20}
                  color="#4dabf7"
                />
                <Text style={styles.profileMenuText}>
                  {showFilterAdd ? 'Ocultar agregar categoría a mi filtro' : 'Mostrar agregar categoría a mi filtro'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.profileMenuOption} onPress={toggleFollowButton}>
                <Ionicons
                  name={showFollowButton ? 'heart-dislike-outline' : 'heart-outline'}
                  size={20}
                  color="#ff0b5a"
                />
                <Text style={styles.profileMenuText}>
                  {showFollowButton ? 'Ocultar botón de favoritos' : 'Mostrar botón de favoritos'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.profileMenuOption} onPress={toggleRecommendations}>
              <Ionicons
                name={showRecommendations ? 'eye-off-outline' : 'ribbon-outline'}
                size={20}
                color="#f59f00"
              />
              <Text style={styles.profileMenuText}>
                {showRecommendations ? 'Ocultar recomendaciones' : 'Mostrar recomendaciones'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileMenuOption} onPress={toggleActivity}>
              <Ionicons
                name={showActivity ? 'eye-off-outline' : 'pulse-outline'}
                size={20}
                color="#4dabf7"
              />
              <Text style={styles.profileMenuText}>
                {showActivity ? 'Dejar de ver la actividad' : 'Ver actividad en el perfil'}
              </Text>
            </TouchableOpacity>
            {isSuperAdmin && !isCurrentUser && adminState ? (
              <>
                <Text style={styles.profileMenuSection}>Administración</Text>
                <TouchableOpacity style={styles.profileMenuOption} onPress={adminToggleVerified}>
                  <Ionicons
                    name={adminState.is_verified ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={20}
                    color="#4dabf7"
                  />
                  <Text style={styles.profileMenuText}>
                    {adminState.is_verified ? 'Quitar verificación' : 'Verificar perfil'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMenuOption} onPress={adminToggleRecommended}>
                  <Ionicons
                    name={adminState.is_recommended ? 'ribbon' : 'ribbon-outline'}
                    size={20}
                    color="#f59f00"
                  />
                  <Text style={styles.profileMenuText}>
                    {adminState.is_recommended ? 'Quitar recomendación' : 'Recomendar perfil'}
                  </Text>
                </TouchableOpacity>
                {!adminState.is_superuser ? (
                  <>
                    <TouchableOpacity style={styles.profileMenuOption} onPress={adminToggleActive}>
                      <Ionicons
                        name={adminState.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={20}
                        color={adminState.is_active ? '#ff6b6b' : '#2f9e44'}
                      />
                      <Text style={[styles.profileMenuText, adminState.is_active && { color: '#ff6b6b' }]}>
                        {adminState.is_active ? 'Suspender cuenta' : 'Reactivar cuenta'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.profileMenuOption} onPress={adminToggleStaff}>
                      <Ionicons name="shield-outline" size={20} color="#845ef7" />
                      <Text style={styles.profileMenuText}>
                        {adminState.is_staff ? 'Quitar staff' : 'Hacer staff'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </>
            ) : null}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {isCurrentUser ? (
        <LanguagePickerModal visible={languageModalVisible} onClose={() => setLanguageModalVisible(false)} />
      ) : null}

      {/* Filtros */}
      <View style={styles.appFilterSection}>
        <Text style={styles.appFilterTitle}>Filtro de la app</Text>
        {appCategories.length > 0 ? (
          <CategoryHierarchy
            availableCategories={appCategories}
            showDescendants
            onSelect={handleCategorySelect}
          />
        ) : (
          <Text style={styles.emptyFilterText}>
            No hay categorías disponibles para este perfil.
          </Text>
        )}
      </View>

      {isCurrentUser ? (
        <PersonalCategoryFilter
          isOwner
          canEdit={showFilterAdd}
          title="Mi filtro"
          excludeNames={appCategoryNames}
          onSelect={handleCategorySelect}
          onCategoriesChanged={refetchCategories}
        />
      ) : (
        <PersonalCategoryFilter
          userId={userId}
          isOwner={false}
          excludeNames={appCategoryNames}
          title={`Filtro de ${user?.username || 'este perfil'}`}
          onSelect={handleCategorySelect}
        />
      )}

      {/* Selector de vista */}
      <View style={styles.viewModeRow}>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'compact' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('compact')}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={viewMode === 'compact' ? '#fff' : '#4dabf7'}
          />
          <Text style={[styles.viewModeText, viewMode === 'compact' && styles.viewModeTextActive]}>
            Compacta
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'detailed' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('detailed')}
        >
          <Ionicons
            name="albums-outline"
            size={16}
            color={viewMode === 'detailed' ? '#fff' : '#4dabf7'}
          />
          <Text
            style={[styles.viewModeText, viewMode === 'detailed' && styles.viewModeTextActive]}
          >
            Detallada
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeBtn, viewMode === 'testimonials' && styles.viewModeBtnActive]}
          onPress={() => setViewMode('testimonials')}
          accessibilityRole="button"
        >
          <Ionicons
            name="chatbox-ellipses-outline"
            size={16}
            color={viewMode === 'testimonials' ? '#fff' : '#4dabf7'}
          />
          <Text
            style={[styles.viewModeText, viewMode === 'testimonials' && styles.viewModeTextActive]}
          >
            Testimonios{approvedCount ? ` (${approvedCount})` : ''}
          </Text>
          {isCurrentUser && pendingCount ? (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {selectedCategory ? (
        <TouchableOpacity
          style={styles.clearFilterChip}
          onPress={() => setSelectedCategory('')}
        >
          <Ionicons name="close-circle" size={16} color="#4dabf7" />
          <Text style={styles.clearFilterText}>Quitar filtro: {selectedCategory}</Text>
        </TouchableOpacity>
      ) : null}

      {/* Lista de tareas */}
      {isInitialLoading || favoriteFeedLoading ? (
        <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={showFavoriteFeed ? favoriteFeedTasks : showTestimonials ? testimonials : tasks}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={
            showTestimonials
              ? ({ item }) => (item.isWriteAction ? (
                  <TouchableOpacity
                    style={styles.writeTestimonial}
                    onPress={writeTestimonial}
                    accessibilityRole="button"
                    accessibilityLabel="Escribir un testimonio"
                  >
                    <Ionicons name="create-outline" size={20} color="#845ef7" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.writeTestimonialTitle}>
                        Escribir un testimonio para {user?.username || 'este perfil'}
                      </Text>
                      {testimonials.length === 1 ? (
                        <Text style={styles.writeTestimonialHint}>Aún no tiene testimonios. ¡Sé la primera persona!</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ) : item.kind === 'task' ? (
                  <TestimonialPost
                    testimonial={item}
                    navigation={navigation}
                    isOwner={isCurrentUser}
                    isMine={myTestimonialIds.has(String(item.id))}
                    onAnswer={answerTestimonial}
                    onOpenActions={setTestimonialActionTask}
                  />
                ) : (
                  <TestimonialCard
                    testimonial={item}
                    navigation={navigation}
                    isOwner={isCurrentUser}
                    onAnswer={answerTestimonial}
                    currentUserId={me?.id}
                  />
                ))
              : viewMode === 'detailed' ? renderDetailedTask : renderTask
          }
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={tasksLoading && Boolean(tasksData)}
              onRefresh={onRefresh}
            />
          }
          onEndReached={showTestimonials ? undefined : loadMoreTasks}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {showTestimonials
                ? isCurrentUser
                  ? 'Aún no tienes testimonios. Cuando alguien escriba uno en tu perfil o te etiquete en un comentario, podrás mostrarlo aquí.'
                  : 'Este perfil aún no tiene testimonios.'
                : showFavoriteFeed
                ? isCurrentUser
                  ? 'Aún no guardas tareas en favoritos.'
                  : 'No hay favoritos para ver: aún no guarda ninguno o los tiene privados.'
                : isCurrentUser
                ? 'Aún no has publicado nada.'
                : 'Este perfil aún no ha publicado nada.'}
            </Text>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#4dabf7" style={{ marginVertical: 20 }} />
            ) : null
          }
        />
      )}

      <TaskActionsModal
        visible={Boolean(testimonialActionTask)}
        onClose={() => setTestimonialActionTask(null)}
        actionTask={testimonialActionTask}
        currentUserId={me?.id}
        isAdmin={Boolean(sessionUser?.is_staff || sessionUser?.is_superuser)}
        canEdit={Boolean(testimonialActionTask) && String(testimonialActionTask?.user?.id) === String(me?.id)}
        handlers={testimonialActions}
      />
    </View>
  );
};

// Primer elemento de la lista de testimonios en el perfil de otra persona.
const WRITE_TESTIMONIAL_ITEM = { id: '__write_testimonial__', isWriteAction: true };

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  topBar: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 34 },
  backBtn: { position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 50 : 34, zIndex: 10 },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#333' },
  profileMenuButton: { position: 'absolute', right: 16, top: Platform.OS === 'ios' ? 50 : 34, padding: 4 },
  profileHeartButton: { position: 'absolute', right: 52, top: Platform.OS === 'ios' ? 50 : 34, padding: 4 },
  sideMenuButton: { position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 50 : 34, zIndex: 10 },
  profileMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: Platform.OS === 'ios' ? 92 : 76, paddingRight: 12 },
  profileMenuCard: { backgroundColor: '#fff', borderRadius: 12, padding: 6, minWidth: 220, elevation: 6 },
  profileMenuOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  profileMenuText: { color: '#333', fontSize: 14, fontWeight: '600' },
  profileMenuSection: { color: '#868e96', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 6, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f3f5' },
  appFilterSection: { marginBottom: 6 },
  appFilterTitle: { marginHorizontal: 16, fontSize: 13, fontWeight: '800', color: '#555' },
  emptyFilterText: { marginHorizontal: 16, marginTop: 6, color: '#999', fontSize: 12 },
  viewModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  pendingBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#845ef7' },
  pendingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  viewModeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e7f5ff', borderWidth: 1, borderColor: '#d0ebff' },
  viewModeBtnActive: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  viewModeText: { color: '#4dabf7', fontSize: 12, fontWeight: '700' },
  viewModeTextActive: { color: '#fff' },
  detailedCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 15, borderRadius: 16, padding: 16, elevation: 2 },
  sectionTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginTop: 10, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#4dabf7' },
  tabText: { fontSize: 11, color: '#999', fontWeight: 'bold' },
  tabTextActive: { color: '#4dabf7' },
  dynamicContent: { minHeight: 40 },
  carouselRow: { gap: 12, paddingRight: 12 },
  subItem: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 12 },
  subItemEyebrow: { fontSize: 10, color: '#4dabf7', fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  subItemTitle: { fontSize: 15, color: '#222', fontWeight: '700' },
  subItemDesc: { fontSize: 13, color: '#666', lineHeight: 19, marginTop: 6 },
  subMedia: { width: '100%', height: 150, borderRadius: 10, marginTop: 10, backgroundColor: '#e9ecef' },
  noContent: { fontSize: 12, color: '#bbb', fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
  clearFilterChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#e7f5ff', gap: 4 },
  clearFilterText: { color: '#4dabf7', fontSize: 12, fontWeight: '700' },
  profileHeader: { padding: 20, backgroundColor: '#fff', marginBottom: 10 },
  profileInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  socialStatsRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, rowGap: 8, marginBottom: 16 },
  socialStat: { alignItems: 'flex-start' },
  socialStatCount: { color: '#333', fontSize: 16, fontWeight: '800' },
  socialStatLabel: { color: '#777', fontSize: 12, marginTop: 2 },
  socialStatsError: { marginBottom: 16 },
  socialStatsErrorText: { color: '#d9480f', fontSize: 12 },
  followButton: { alignItems: 'center', justifyContent: 'center', minHeight: 38, borderRadius: 20, backgroundColor: '#4dabf7', paddingHorizontal: 22, alignSelf: 'flex-start', marginBottom: 4 },
  profileActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  followingButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#4dabf7' },
  followButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  followingButtonText: { color: '#4dabf7' },
  pinnedButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderColor: '#845ef7' },
  pinnedButtonText: { color: '#845ef7' },
  profileAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#eee' },
  profileAvatarWrap: { marginRight: 15 },
  profileTextContainer: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  profileEmail: { fontSize: 14, color: '#666', marginTop: 4 },
  adminBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: '#d9534f' },
  adminBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  actionButtonsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#e7f5ff', borderWidth: 1, borderColor: '#d0ebff' },
  logoutBtn: { backgroundColor: '#ffe3e3', borderColor: '#ffc9c9' },
  actionBtnText: { color: '#4dabf7', fontWeight: 'bold', marginLeft: 5, fontSize: 14 },
  actionBtnTextLogout: { color: '#ff6b6b', fontWeight: 'bold', marginLeft: 5, fontSize: 14 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  exitFavoritesButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#fff4d6' },
  exitFavoritesText: { color: '#d97706', fontSize: 12, fontWeight: '700' },
  listContent: { paddingBottom: 30 },
  taskCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 15, borderRadius: 16, padding: 16, elevation: 2 },
  taskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#eee' },
  taskTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  taskDate: { fontSize: 12, color: '#999', marginTop: 2 },
  taskCreator: { fontSize: 12, color: '#4dabf7', marginTop: 2 },
  taskDescription: { fontSize: 14, color: '#555', lineHeight: 20 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 10 },
  categoryBadge: { backgroundColor: '#e3f2fd', color: '#4dabf7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 11, fontWeight: '600' },
  taskImage: { width: '100%', height: 150, borderRadius: 10, marginTop: 8, backgroundColor: '#f0f0f0' },
  taskFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  statsContainer: { flexDirection: 'row', gap: 20 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, color: '#666', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 30, marginHorizontal: 24, fontSize: 15, fontStyle: 'italic' },
  socialLinks: { marginTop: 10 },
  viewAsChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#e7f5ff' },
  viewAsChipText: { color: '#1864ab', fontWeight: '700', fontSize: 13 },
  viewAsChipLocked: { backgroundColor: '#f1f3f5' },
  viewAsChipTextLocked: { color: '#868e96' },
  writeTestimonial: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 12, padding: 14,
    borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#b197fc', backgroundColor: '#f8f5ff',
  },
  writeTestimonialTitle: { color: '#5f3dc4', fontSize: 15, fontWeight: '700' },
  writeTestimonialHint: { color: '#868e96', fontSize: 12, marginTop: 2 },
});

export default ProfileScreen;
