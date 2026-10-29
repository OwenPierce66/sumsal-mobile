import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import moment from 'moment';
import { Image } from 'expo-image';
import { Video } from 'expo-av';
import Slider from '@react-native-community/slider';
import { getImageUrl } from '@api';
import TouchableUsername from '@components/TouchableUsername';
import LinkifiedText from '@components/LinkifiedText';
import FollowHeart from '@components/FollowHeart';
import PetitionSupportStat from '@components/PetitionSupportStat';
import TopCommentPreview from '@components/TopCommentPreview';
import StoryRing from '@components/StoryRing';
import { withLegacyLink } from '../utils/links';
import { subItemTitle } from '../utils/aportaciones';

const TASK_VIDEO_AUTOPLAY_DELAY_MS = 500;
const TASK_VIDEO_MIN_VISIBLE_FRACTION = 0.5;

// Contexto con los ids de las tareas visibles en la lista contenedora (opcional) y una función
// para medir los límites reales del contenedor con scroll (opcional).
export const FeedVideoVisibilityContext = React.createContext({ visibleIds: null, getListBounds: null });

// ─── Helpers de usuario ──────────────────────────────────────────────────────
export const getUserStatusColor = (userObj) => {
  if (!userObj) return '#555';
  const profile = userObj.profile || {};
  if (profile.is_verified) return '#4dabf7';
  if (profile.subscriptionActive && parseFloat(profile.subscription_amount || 0) >= 8) return '#ff6b6b';
  if (profile.subscriptionActive) return '#51cf66';
  if (profile.is_recommended) return '#000';
  return '#555';
};

export const getUserStatusIcon = (userObj) => {
  if (!userObj) return null;
  const profile = userObj.profile || {};
  if (profile.is_verified) return 'checkmark-circle';
  if (profile.subscriptionActive && parseFloat(profile.subscription_amount || 0) >= 8) return 'star';
  if (userObj.is_staff || userObj.is_superuser) return 'shield-checkmark';
  if (profile.subscriptionActive) return 'star-half';
  if (profile.is_recommended) return 'medal';
  return null;
};

export const getAuthorName = (item) => {
  const userObj = item?.user;
  if (userObj) {
    if (userObj.first_name) return `${userObj.first_name} ${userObj.last_name || ''}`.trim();
    if (userObj.username) return userObj.username;
    if (userObj.email) return userObj.email.split('@')[0];
  }
  return item?.username || 'Anónimo';
};

// ─── Video con autoplay solo cuando está realmente en pantalla ───────────────
export const TaskVideoPreview = ({ uri, onOpenReel, feedItemId }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const visibleSinceRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReadyToPlay, setIsReadyToPlay] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState({});
  const isScreenFocused = useIsFocused();
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');

  const feedVisibility = useContext(FeedVideoVisibilityContext);
  const feedVisibilityRef = useRef(feedVisibility);
  feedVisibilityRef.current = feedVisibility;
  const isFeedItemViewable = !feedVisibility.visibleIds
    || feedItemId === undefined
    || feedVisibility.visibleIds.has(String(feedItemId));

  // Solo se permite reproducir si el video esta en pantalla, la tarjeta es visible en la lista,
  // la pantalla tiene foco y la app esta activa
  const canPlay = isVisible && isFeedItemViewable && isScreenFocused && isAppActive;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setIsAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setIsReadyToPlay(false);
    if (canPlay) {
      visibleSinceRef.current = Date.now();
    } else {
      visibleSinceRef.current = null;
      setIsPausedByUser(false);
      playerRef.current?.pauseAsync().catch(() => {});
    }
  }, [canPlay]);

  useEffect(() => {
    if (!isReadyToPlay || !canPlay) return undefined;
    playerRef.current?.playAsync().catch(() => {});
    return undefined;
  }, [isReadyToPlay, canPlay, uri]);

  const togglePlayback = () => {
    if (playbackStatus.isPlaying) {
      setIsPausedByUser(true);
      playerRef.current?.pauseAsync();
    } else {
      setIsPausedByUser(false);
      playerRef.current?.playAsync();
    }
    setControlsVisible(true);
  };

  const toggleControls = () => setControlsVisible((visible) => !visible);

  useEffect(() => {
    let cancelled = false;

    const evaluateVisibility = (x, y, width, height, bounds) => {
      if (cancelled) return;
      const windowSize = Dimensions.get('window');
      const left = bounds ? bounds.x : 0;
      const top = bounds ? bounds.y : 0;
      const right = bounds ? bounds.x + bounds.width : windowSize.width;
      const bottom = bounds ? bounds.y + bounds.height : windowSize.height;
      const visibleWidth = Math.max(0, Math.min(x + width, right) - Math.max(x, left));
      const visibleHeight = Math.max(0, Math.min(y + height, bottom) - Math.max(y, top));
      const visibleFraction = width > 0 && height > 0 ? (visibleWidth * visibleHeight) / (width * height) : 0;
      const visible = visibleFraction >= TASK_VIDEO_MIN_VISIBLE_FRACTION;
      setIsVisible(visible);

      if (visible && visibleSinceRef.current) {
        const elapsed = Date.now() - visibleSinceRef.current;
        if (elapsed >= TASK_VIDEO_AUTOPLAY_DELAY_MS) {
          setIsReadyToPlay(true);
        }
      }
    };

    const checkVisibility = () => {
      const node = videoRef.current;
      if (!node) {
        setIsVisible(false);
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        const getListBounds = feedVisibilityRef.current.getListBounds;
        if (getListBounds) {
          getListBounds((bounds) => evaluateVisibility(x, y, width, height, bounds));
        } else {
          evaluateVisibility(x, y, width, height, null);
        }
      });
    };
    const interval = setInterval(checkVisibility, 250);
    checkVisibility();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <View ref={videoRef} collapsable={false} style={styles.subMediaWrapper}>
      <Video
        ref={playerRef}
        source={{ uri }}
        style={styles.subMedia}
        resizeMode="contain"
        shouldPlay={isReadyToPlay && canPlay && !isPausedByUser}
        isLooping
        onPlaybackStatusUpdate={setPlaybackStatus}
      />
      <TouchableOpacity style={styles.videoTouchSurface} activeOpacity={1} onPress={toggleControls} />
      {controlsVisible && (
        <View style={styles.videoControls} pointerEvents="box-none">
          <TouchableOpacity accessibilityLabel={playbackStatus.isPlaying ? 'Pausar video' : 'Reproducir video'} style={styles.videoControlButton} onPress={togglePlayback}>
            <Ionicons name={playbackStatus.isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
          </TouchableOpacity>
          <Slider
            style={styles.videoProgress}
            minimumValue={0}
            maximumValue={playbackStatus.durationMillis || 1}
            value={playbackStatus.positionMillis || 0}
            onSlidingStart={() => setIsPausedByUser(true)}
            onSlidingComplete={(value) => {
              playerRef.current?.setPositionAsync(value);
              setIsPausedByUser(false);
            }}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="rgba(255,255,255,0.45)"
            thumbTintColor="#fff"
          />
          <TouchableOpacity accessibilityLabel="Abrir video en reels" style={styles.expandVideoButton} onPress={onOpenReel}>
            <Ionicons name="expand-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── Carrusel de contenido (Tema / Factores / Fuentes) ───────────────────────
// Las historias (y cualquier tarea con medio propio) guardan su imagen/video en la tarea misma,
// no en una subtarea. Si la seccion de publicacion esta vacia se muestra ese medio principal.
const getTaskOwnMedia = (task) => {
  const image = task?.image || task?.image_url || task?.primary_image || null;
  const video = task?.video || task?.primary_video || task?.video_url || task?.media_url || null;
  if (!image && !video) return null;
  return { id: `main-${task.id}`, title: '', description: '', image, video, _isMain: true };
};

const SubContent = ({ task, section, carouselWidth, feedItemId, onShareSubItemToStory, onOpenSubMediaInReels }) => {
  let content = Array.isArray(task[section]) ? task[section] : [];
  if (content.length === 0 && section === 'subtasks') {
    const ownMedia = getTaskOwnMedia(task);
    if (ownMedia) content = [ownMedia];
  }
  if (content.length === 0) return <Text style={styles.noContent}>Sin datos en esta sección</Text>;

  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        style={{ width: carouselWidth }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: carouselWidth * content.length }}
        snapToInterval={carouselWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        directionalLockEnabled
        disableIntervalMomentum
        alwaysBounceHorizontal={content.length > 1}
        scrollEventThrottle={16}
      >
        {content.map((sub, idx) => {
          const finalUri = getImageUrl(sub.image);
          const videoUri = getImageUrl(sub.video);

          return (
            <View key={sub.id || `${section}-${idx}`} style={[styles.subItem, { width: carouselWidth }]}>
              {sub._isMain || !subItemTitle(sub) ? null : (
                <View style={styles.subItemHeaderRow}>
                  <View style={styles.subItemHeading}>
                    <Text style={styles.subItemTitle}>{subItemTitle(sub)}</Text>
                  </View>
                </View>
              )}

              {/* El enlace que la web guardaba aparte se muestra dentro de la descripción. */}
              {sub.description || sub.link ? (
                <LinkifiedText style={styles.subItemDesc} text={withLegacyLink(sub.description, sub.link)} collapsedLines={3} />
              ) : null}

              {finalUri && (
                <Image
                  source={{ uri: finalUri }}
                  style={styles.subImage}
                  contentFit="cover"
                />
              )}

              {videoUri && (
                <TaskVideoPreview
                  feedItemId={feedItemId ?? task.id}
                  uri={videoUri}
                  onOpenReel={() => onOpenSubMediaInReels?.(task, sub, section)}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
      {content.length > 1 && (
        <View style={styles.carouselMeta}>
          <Text style={styles.carouselHint}>Desliza para ver más</Text>
          <View style={styles.carouselDots}>
            {content.map((sub, idx) => <View key={sub.id || idx} style={styles.carouselDot} />)}
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Tarjeta de publicación (misma para el feed y para el detalle) ───────────
const TaskPostCard = ({
  task,
  navigation,
  tema,
  carouselWidth,
  currentSection,
  onChangeSection,
  onAvatarPress,
  onOpenActions,
  onOpenDetail,
  onRepost,
  onLike,
  onShowLikes,
  onPressComments,
  onShare,
  onShowShares,
  onShareSubItemToStory,
  onOpenSubMediaInReels,
  stats,
  showTopComment = false,
}) => {
  const [localSection, setLocalSection] = useState('subtasks');
  // Comentarios agregados o borrados desde el comentario destacado (hasta que la tarea se recargue).
  const [commentDelta, setCommentDelta] = useState(0);
  useEffect(() => { setCommentDelta(0); }, [task.comments_count]);
  const section = currentSection || localSection;
  const changeSection = (next) => {
    if (onChangeSection) onChangeSection(task.id, next);
    else setLocalSection(next);
  };

  // Contadores mostrados en el pie: por defecto los de la tarea; una tarea compartida puede sobrescribirlos
  const shown = { ...task, ...(stats || {}) };
  // Un testimonio solo tiene texto: sin pestañas de Aportación/Factores/Fuentes, sin impulsar ni compartir.
  const isTestimonial = Boolean(task.testimonial_for_info);
  const temaLabel = tema || task.pch || '';

  const descriptionBlock = (
    <>
      <LinkifiedText style={styles.taskDescription} text={task.description} collapsedLines={3} />

      {task.categories ? (
        <View style={styles.categoriesList}>
          {String(task.categories).split(',').map((cat, idx) => (
            <Text
              key={idx}
              style={[styles.categoryBadge, cat.trim().toLowerCase() === 'aprobada' && styles.categoryBadgeApproved]}
            >
              {cat.trim()}
            </Text>
          ))}
        </View>
      ) : null}

      {Array.isArray(task.tagged_users) && task.tagged_users.length > 0 && (
        <View style={styles.taggedUsersRow}>
          <Ionicons name="pricetag-outline" size={13} color="#845ef7" style={{ marginRight: 4 }} />
          <Text style={styles.taggedUsersLabel}>Con:</Text>
          {task.tagged_users.map((u, idx) => (
            <View key={u.id || idx} style={{ marginRight: 8 }}>
              <TouchableUsername
                username={`@${u.username || u.first_name || 'usuario'}`}
                userId={u.id}
                navigation={navigation}
                textStyle={styles.taggedUserName}
              />
            </View>
          ))}
        </View>
      )}
    </>
  );

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <StoryRing
          userId={task.user?.id}
          size={38}
          navigation={navigation}
          onPress={() => onAvatarPress?.(task.user?.id)}
          style={styles.avatarWrap}
        >
          <Image
            source={{ uri: getImageUrl(task.user?.user_image) || 'https://ui-avatars.com/api/?name=User&background=random' }}
            style={[styles.avatar, styles.avatarInRing]}
          />
        </StoryRing>
        <View style={{ flex: 1 }}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TouchableUsername
                username={getAuthorName(task)}
                userId={task.user?.id}
                userImage={getImageUrl(task.user?.user_image)}
                navigation={navigation}
                textStyle={[styles.taskUser, { color: getUserStatusColor(task.user) }]}
              />
            </View>
            <Text style={{ fontSize: 12, color: '#999' }}>• {moment(task.created_at).fromNow()}</Text>
          </View>
          {task.group_info ? (
            <TouchableOpacity
              style={styles.groupChip}
              onPress={() => navigation?.navigate('GroupDetail', { groupId: task.group_info.id })}
              accessibilityLabel={`Abrir grupo ${task.group_info.name}`}
            >
              <Ionicons name={task.group_info.is_private ? 'lock-closed' : 'people'} size={11} color="#1971c2" />
              <Text style={styles.groupChipText} numberOfLines={1}>en {task.group_info.name}</Text>
              {task.group_status && task.group_status !== 'approved' ? (
                <Text style={[styles.groupReview, task.group_status === 'rejected' && styles.groupRejected]}>
                  {task.group_status === 'rejected' ? '· rechazada' : '· en revisión'}
                </Text>
              ) : null}
            </TouchableOpacity>
          ) : null}
          {task.testimonial_for_info ? (
            // Testimonio: una publicación escrita en el perfil de otra persona.
            <TouchableOpacity
              style={[styles.groupChip, styles.testimonialChip]}
              onPress={() => navigation?.navigate('UserProfile', {
                userId: task.testimonial_for_info.id,
                userName: task.testimonial_for_info.username,
              })}
              accessibilityLabel={`Testimonio para ${task.testimonial_for_info.username || 'este perfil'}`}
            >
              <Ionicons name="chatbox-ellipses" size={11} color="#7048e8" />
              <Text style={[styles.groupChipText, styles.testimonialChipText]} numberOfLines={1}>
                Testimonio para @{task.testimonial_for_info.username || 'usuario'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <FollowHeart userId={task.user?.id} username={getAuthorName(task)} size={20} style={styles.headerHeart} />
        {onOpenActions ? (
          <TouchableOpacity onPress={() => onOpenActions(task)} accessibilityLabel="Más opciones">
            <Ionicons name="ellipsis-vertical" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {onOpenDetail ? (
        <TouchableOpacity activeOpacity={0.8} onPress={() => onOpenDetail(task)}>
          {descriptionBlock}
        </TouchableOpacity>
      ) : (
        <View>{descriptionBlock}</View>
      )}

      {isTestimonial ? null : (
        <TaskSections
          task={task}
          tema={temaLabel}
          carouselWidth={carouselWidth}
          section={section}
          onChangeSection={changeSection}
          onShareSubItemToStory={onShareSubItemToStory}
          onOpenSubMediaInReels={onOpenSubMediaInReels}
        />
      )}

      <View style={styles.taskFooter}>
        <View style={styles.statsContainer}>
          {isTestimonial ? null : (
            <TouchableOpacity style={styles.stat} onPress={() => onRepost?.(task)}>
              <Ionicons name={shown.user_has_reposted ? 'trending-up' : 'trending-up-outline'} size={18} color={shown.user_has_reposted ? '#f59f00' : '#999'} />
              <Text style={styles.statText}>{shown.reposts_count || 0}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.stat}>
            <TouchableOpacity onPress={() => onLike?.(task)}>
              <Ionicons name={shown.user_has_liked ? 'heart' : 'heart-outline'} size={18} color={shown.user_has_liked ? '#ff6b6b' : '#999'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onShowLikes?.(task.id)} style={{ marginLeft: 4, padding: 4 }}>
              <Text style={styles.statText}>{shown.likes_count ?? 0}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.stat} onPress={() => onPressComments?.(task)}>
            <Ionicons name="chatbubble-outline" size={18} color="#4dabf7" />
            <Text style={styles.statText}>{Math.max(0, (shown.comments_count || 0) + commentDelta)}</Text>
          </TouchableOpacity>

          {isTestimonial ? null : (
            <View style={styles.stat}>
              <TouchableOpacity onPress={() => onShare?.(task)}>
                <Ionicons name="share-social-outline" size={18} color="#51cf66" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onShowShares?.(task.id)} style={{ marginLeft: 4, padding: 4 }}>
                <Text style={styles.statText}>{shown.share_count || 0}</Text>
              </TouchableOpacity>
            </View>
          )}

          <PetitionSupportStat task={task} navigation={navigation} />
        </View>
      </View>

      {/* Comentario con más interacción (y su mejor respuesta), con me gusta, responder y comentar aquí. */}
      {showTopComment ? (
        <TopCommentPreview
          task={{ ...task, comments_count: Math.max(0, (shown.comments_count || 0) + commentDelta) }}
          navigation={navigation}
          onOpenComments={() => onPressComments?.(task)}
          onCountChange={(delta) => setCommentDelta((value) => value + delta)}
        />
      ) : null}
    </View>
  );
};

// Pestañas (Tema / Factores / Fuentes) + carrusel de contenido. Reutilizable fuera de la tarjeta,
// p. ej. dentro de una publicación compartida. `feedItemId` es el id con el que el FlatList identifica el item.
export const TaskSections = ({
  task,
  tema,
  carouselWidth,
  section,
  onChangeSection,
  feedItemId,
  onShareSubItemToStory,
  onOpenSubMediaInReels,
}) => {
  const temaLabel = tema || task.pch || '';
  return (
    <>
      <View style={styles.sectionTabs}>
        {['subtasks', 'subfactores', 'subfuentes'].map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onChangeSection(s)}
            style={[styles.tab, section === s && styles.tabActive]}
          >
            <Text style={[styles.tabText, section === s && styles.tabTextActive]}>
              {s === 'subtasks'
                ? (temaLabel.charAt(0).toUpperCase() + temaLabel.slice(1))
                : s.replace('sub', '')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.dynamicContent}>
        <SubContent
          task={task}
          section={section}
          carouselWidth={carouselWidth}
          feedItemId={feedItemId}
          onShareSubItemToStory={onShareSubItemToStory}
          onOpenSubMediaInReels={onOpenSubMediaInReels}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 20,
    padding: 16,
    boxShadow: '0px 1px 1.41px rgba(0,0,0,0.2)',
    elevation: 2,
  },
  taskHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerHeart: { marginRight: 10 },
  groupChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#e7f5ff', maxWidth: '100%' },
  groupChipText: { fontSize: 11, fontWeight: '700', color: '#1971c2', flexShrink: 1 },
  testimonialChip: { backgroundColor: '#f3f0ff' },
  testimonialChipText: { color: '#7048e8' },
  groupReview: { fontSize: 11, fontWeight: '700', color: '#e67700' },
  groupRejected: { color: '#e03131' },
  avatar: { width: 38, height: 38, borderRadius: 19, marginRight: 12, backgroundColor: '#eee' },
  avatarWrap: { marginRight: 12 },
  avatarInRing: { marginRight: 0 },
  taskTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  taskUser: { fontSize: 12, color: '#4dabf7', fontWeight: '600' },
  taskDescription: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  categoriesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15 },
  categoryBadge: { backgroundColor: '#e3f2fd', color: '#4dabf7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 11, fontWeight: '600' },
  categoryBadgeApproved: { backgroundColor: '#d3f9d8', color: '#2b8a3e', borderWidth: 1, borderColor: '#69db7c' },
  taggedUsersRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  taggedUsersLabel: { color: '#868e96', fontSize: 12, marginRight: 4 },
  taggedUserName: { color: '#845ef7', fontSize: 12, fontWeight: '600' },
  sectionTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#4dabf7' },
  tabText: { fontSize: 11, color: '#999', fontWeight: 'bold' },
  tabTextActive: { color: '#4dabf7' },
  dynamicContent: { minHeight: 40 },
  carouselContainer: { width: '100%', overflow: 'hidden' },
  subItem: { marginBottom: 10, paddingHorizontal: 5 },
  subItemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  subItemHeading: { flex: 1, paddingRight: 8 },
  subItemEyebrow: { fontSize: 10, color: '#4dabf7', fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  subItemTitle: { fontSize: 16, color: '#222', fontWeight: '700' },
  subItemDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginTop: 8 },
  subShareButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  subShareText: { fontSize: 11, color: '#1f9d5a', fontWeight: '700' },
  subMediaWrapper: { width: '100%', height: 240, marginTop: 12, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f3f5' },
  subMedia: { width: '100%', height: '100%', backgroundColor: '#f1f3f5' },
  subImage: { width: '100%', height: 240, marginTop: 12, borderRadius: 14, backgroundColor: '#f1f3f5' },
  videoTouchSurface: { ...StyleSheet.absoluteFillObject },
  videoControls: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, backgroundColor: 'rgba(0,0,0,0.62)' },
  videoControlButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  videoProgress: { flex: 1, height: 40, marginHorizontal: 4 },
  expandVideoButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  carouselMeta: { alignItems: 'center', marginTop: 2 },
  carouselHint: { fontSize: 10, color: '#adb5bd', marginBottom: 5 },
  carouselDots: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  carouselDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#cbd5e1' },
  noContent: { fontSize: 12, color: '#bbb', fontStyle: 'italic', textAlign: 'center' },
  taskFooter: { marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  statsContainer: { flexDirection: 'row', gap: 20 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 13, color: '#666', fontWeight: '600' },
});

export default TaskPostCard;
