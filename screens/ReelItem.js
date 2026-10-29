import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, ScrollView, ActivityIndicator, LogBox } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { getImageUrl } from '../api';
import ProgressControls from './ProgressControls';
import ExpandableText from '../components/ExpandableText';
import TouchableUsername from '../components/TouchableUsername';
import FollowHeart from '../components/FollowHeart';
import { useMyRelations } from '../hooks/useMyRelations';
import { TIER_KEYS, TIER_META, followersShown, getTierKey } from '../utils/likeTiers';
import { NameWithBadges } from '../components/UserBadges';

const { buildPlaylists } = require('./reelUtils');

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

// ReelItemComponent ahora es ReelItem
const ReelItemComponent = ({
  item,
  enrichedItem,
  index,
  isActive,
  isMuted,
  paused,
  setPaused,
  selectedReelId,
  isUIVisible,
  expandedDescriptions,
  toggleDescription,
  viewStateById,
  sharedOpenById,
  toggleSharedBy,
  getSharedByInfo,
  cycleViewOnly,
  cycleClipWithinView,
  navigateClip,
  toggleLike,
  likeAnimation,
  navigation,
  toggleFavorite,
  handleRepost,
  handleShowLikes,
  handleShowFollowers,
  openActionModal,
  tema,
}) => {
  // ✅ FIX: Se mueven las definiciones al principio para evitar errores de "undefined".
  const contentItem = useMemo(() => (item.is_original ? item : item.task), [item]);
  const userItem = useMemo(() => (item.is_original ? item.user : (item.task?.user || {})), [item]);
  const playlists = useMemo(() => buildPlaylists(contentItem), [contentItem]);
  const rawState = viewStateById[item.id] || { mode: "main", pos: 0 };
  const mediaRefCount = Math.max(
    playlists.main?.length || 0,
    playlists.factores?.length || 0,
    playlists.fuentes?.length || 0,
    1,
  );

  const videoRefs = useRef([]);
  if (videoRefs.current.length !== mediaRefCount) {
    videoRefs.current = Array(mediaRefCount).fill(null).map((_, i) => videoRefs.current[i] || React.createRef());
  }

  const [playbackStatus, setPlaybackStatus] = useState({});

  const VIEW_ORDER = ["main", "factores", "fuentes"];
  const fallbackMode = VIEW_ORDER.find((m) => (playlists?.[m]?.length || 0) > 0) || "main";
  const effMode = playlists?.[rawState.mode]?.length ? rawState.mode : fallbackMode;
  const len = playlists?.[effMode]?.length || 0;
  const effPos = len ? Math.min(Math.max(0, rawState.pos || 0), len - 1) : 0;

  const list = playlists[effMode] || [];
  const currentEntry = list[effPos] || null;
  const extraCount = (playlists.factores?.length > 0 ? 1 : 0) + (playlists.fuentes?.length > 0 ? 1 : 0);
  const badgeCount = extraCount === 0 ? 0 : extraCount === 1 ? 1 : effMode === "main" ? 2 : 1;
  const viewLabel = effMode === "main" ? tema : effMode === "factores" ? "factor" : "fuente";
  const counterLabel = list.length ? `${effPos + 1}/${list.length}` : "—";

  const heartStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: likeAnimation.value }],
      opacity: likeAnimation.value,
    };
  }, []);

  const sharedByInfo = useMemo(() => getSharedByInfo(item), [item, getSharedByInfo]);
  const isSelectedReel = String(selectedReelId) === String(contentItem?.id);

  const isSharedOpen = sharedOpenById[item.is_original ? item.id : item.task?.id];
  const sharedByList = useMemo(
    () => (Array.isArray(item?.shared_by_list) && item.shared_by_list) || (Array.isArray(item?.task?.shared_by_list) && item.task.shared_by_list) || [],
    [item]
  );

  // Seguidores del autor (el "like" del perfil). El total se ajusta al momento al seguir / dejar de
  // seguir; los números por insignia llegan al recargarse, como los likes de la tarea.
  const { ready: relationsReady, getState: getRelationState } = useMyRelations();
  const relationNow = relationsReady && userItem?.id ? getRelationState(userItem.id) : null;
  const followers = enrichedItem.followers;
  const followersCount = followersShown({ summary: followers, author: userItem, relation: relationNow });
  // El corazón de seguir no sale si solo lo sigues (ni en tu propio reel). Sin corazón, el contador
  // (y en pausa sus números por insignia) sube junto al avatar; con corazón, distancia normal.
  const followHeartVisible = Boolean(relationNow) && relationNow !== 'following';

  // Color del borde del avatar según la insignia del autor (la misma regla que los números y la lista).
  const userTier = useMemo(() => {
      const key = getTierKey(userItem);
      return { key, color: key === 'regular' || key === 'app' ? '#fff' : TIER_META[key].color };
  }, [userItem]);

  const renderTierDigits = (counts, targetId, handler) => {
    if (!counts) return null;
    // Un número por insignia, del color de esa insignia (el mismo que en la lista).
    return TIER_KEYS.map(key => {
      const n = counts[key] || 0;
      if (!n) return null;
      // La insignia de la App es negra: sobre el fondo oscuro del reel va en blanco.
      const meta = { color: key === 'app' ? '#fff' : TIER_META[key].color };
      return (
        <TouchableOpacity key={key} onPress={() => handler(targetId, key)}>
          <Text style={[styles.tierText, { color: meta.color }]}>
            <Ionicons name="ellipse" size={8} color={meta.color} /> {n}
          </Text>
        </TouchableOpacity>
      );
    });
  };

  useEffect(() => {
    LogBox.ignoreLogs(['Non-serializable values were found in the navigation state']);
  }, []);

  // ✅ FIX: Controlamos la reproducción del video de forma más explícita
  useEffect(() => {
    if (currentEntry?.type === 'image') {
      setPlaybackStatus({});
    }
    const player = videoRefs.current[rawState.pos]?.current;
    if (!player) return;
    if (isActive && !paused) {
      player.playAsync();
    } else {
      player.pauseAsync();
    }
  }, [currentEntry?.type, isActive, paused, rawState.pos]);

  return (
    <View style={styles.reelContainer}>
      {/* 🔄 SWIPE HORIZONTAL NATIVO CLÁSICO */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const contentOffset = e.nativeEvent.contentOffset.x;
          const newPos = Math.round(contentOffset / windowWidth);
          const diff = newPos - rawState.pos;
          if (diff !== 0) {
            navigateClip(item, diff);
          }
        }}
        style={StyleSheet.absoluteFill}
      >
        {list.length > 0 ? (
          list.map((entry, clipIdx) => (
            <View key={`${item.id}-clip-${clipIdx}`} style={{ width: windowWidth, height: '100%' }}>
              {entry.type === 'image' ? (
                <Image source={{ uri: getImageUrl(entry.src) }} style={styles.image} contentFit="cover" />
              ) : (
                <Video
                  ref={videoRefs.current[clipIdx]}
                  source={{ uri: getImageUrl(entry.src) }}
                  style={styles.video}
                  resizeMode="cover"
                  shouldPlay={isActive && !paused && rawState.pos === clipIdx}
                  isLooping
                  isMuted={isMuted}
                  progressUpdateIntervalMillis={250}
                  onPlaybackStatusUpdate={(status) => { if (rawState.pos === clipIdx) { setPlaybackStatus(status); } }}
                />
              )}
            </View>
          ))
        ) : (
          <View style={{ width: windowWidth, height: '100%' }}> 
            <Video // 🪵 LOG DE DIAGNÓSTICO: Fallback Video componente
              ref={videoRefs.current[0]} // ✅ Asignamos la primera referencia si no hay lista
              source={{ uri: getImageUrl(item._anyMedia) }}
              style={styles.video}
              resizeMode="cover" 
              shouldPlay={isActive && !paused} // ✅ Usamos la prop `paused` directamente
              isLooping
              isMuted={isMuted}
              progressUpdateIntervalMillis={250}
              onPlaybackStatusUpdate={setPlaybackStatus}
            />
          </View>
        )}
      </ScrollView>

      {isUIVisible ? (
        <> 
          {playbackStatus.isBuffering && (
            <ActivityIndicator style={styles.buffering} color="#fff" />
          )}

          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.publicationRow} pointerEvents="box-none">
              <View style={styles.bottomSection} pointerEvents="box-none">
              {sharedByInfo && (
                <View style={styles.sharedByContainer}>
                  <View style={styles.sharedByTopRow}>
                  <TouchableOpacity
                    style={styles.sharedByRow}
                    onPress={() => {
                      if (sharedByInfo.userId) {
                        navigation.navigate('UserProfile', {
                          userId: sharedByInfo.userId,
                          userName: sharedByInfo.name || 'Usuario',
                          userAvatar: sharedByInfo.avatar,
                        });
                      } else {
                        toggleSharedBy(contentItem.id);
                      }
                    }}
                    onLongPress={() => toggleSharedBy(contentItem.id)}
                  >
                    <Image source={{ uri: sharedByInfo.avatar }} style={styles.sharedByAvatar} />
                    {!isSharedOpen && (
                      <TouchableUsername
                        username={`${sharedByInfo.name} compartió`}
                        userId={sharedByInfo.userId}
                        userImage={sharedByInfo.avatar}
                        navigation={navigation}
                        style={styles.sharedByLabel}
                        textStyle={styles.sharedByName}
                        numberOfLines={1}
                      />
                    )}
                  </TouchableOpacity>
                  {/* Corazón de seguir a quien compartió, al otro extremo de la fila. */}
                  <FollowHeart userId={sharedByInfo.userId} username={sharedByInfo.name} size={16} style={styles.sharedByHeart} iconStyle={styles.followHeartGlow} />
                  </View>
                  {sharedByInfo && sharedByInfo.favoriteSharersCount > 0 && !isSharedOpen && (
                    <Text style={styles.favoriteSharerIndicator}>
                      <Ionicons name="heart" size={10} color="#ff6b6b" /> {sharedByInfo.favoriteSharersCount}
                    </Text>
                  )}
                  {isSelectedReel && isSharedOpen && sharedByInfo.description && (
                    <View style={styles.sharedByExpanded}>
                      <TouchableUsername
                        username={sharedByInfo.name}
                        userId={sharedByInfo.userId}
                        userImage={sharedByInfo.avatar}
                        navigation={navigation}
                        style={styles.sharedByLabel}
                        textStyle={[styles.sharedByName, { marginBottom: 4 }]}
                        numberOfLines={1}
                      />
                      <Text style={{ fontWeight: 'normal', color: '#ddd', fontSize: 12 }}>escribió:</Text>
                      <Text style={styles.sharedByDescription}>{sharedByInfo.description}</Text>
                    </View>
                  )}
                </View>
              )}
              {paused && isSelectedReel && sharedByInfo?.name && (
                <TouchableOpacity
                  style={styles.pausedSharedByLabel}
                  onPress={() => toggleSharedBy(contentItem.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pausedSharedByText}>compartido por {sharedByInfo.name}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.userInfo}
                onPress={() => {
                  navigation.navigate('UserProfile', { userId: userItem?.id, userName: userItem?.username, userAvatar: getImageUrl(userItem?.user_image) });
                }}
              >
                <NameWithBadges userId={userItem?.id} style={styles.username} badgeSize={16}>@{userItem?.username || 'Usuario'}</NameWithBadges>
              </TouchableOpacity>

              {(() => { const entry = list[effPos] || null; return (
              <View>
                {effMode !== 'main' && (
                  <Text style={styles.title} numberOfLines={1}>{entry?.item?.title || viewLabel}</Text>
                )}
                {effMode === 'main' ? (
                  <>
                    <Text style={styles.title} numberOfLines={1}>{contentItem.title}</Text>
                    <ExpandableText
                      lines={3}
                      expanded={!!expandedDescriptions[item.id]}
                      onToggle={() => toggleDescription(item.id)}
                      toggleStyle={styles.seeMore}
                      renderText={(lines) => (
                        <Text style={styles.description} numberOfLines={lines}>
                          {entry?.groupIndex != null && entry?.item?.description ? `${contentItem.description} • ${entry.item.description}` : contentItem.description}
                        </Text>
                      )}
                    />
                  </>
                ) : (
                  <ExpandableText
                    lines={3}
                    expanded={!!expandedDescriptions[item.id]}
                    onToggle={() => toggleDescription(item.id)}
                    toggleStyle={styles.seeMore}
                    renderText={(lines) => <Text style={styles.description} numberOfLines={lines}>{entry?.item?.description}</Text>}
                  />
                )}
              </View>
              );})()}

              {contentItem.categories ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                  {contentItem.categories.split(',').map((cat, idx) => (
                    <View key={idx} style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{cat.trim()}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              </View>

              <View style={styles.rightSection}>
              <View style={[styles.iconButton, !followHeartVisible && styles.avatarWithoutHeart]}>
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('UserProfile', { userId: userItem?.id, userName: userItem?.username, userAvatar: getImageUrl(userItem?.user_image) });
                  }}
                  onLongPress={() => {
                    handleShowFollowers(userItem?.id);
                  }}
                >
                  <Image source={{ uri: getImageUrl(userItem?.user_image) || 'https://ui-avatars.com/api/?name=User' }} style={[styles.avatar, { borderColor: userTier.color }]} contentFit="cover" />
                </TouchableOpacity>
                {/* Corazón de seguir (el mismo de las tarjetas): gris si no lo sigues, negro en favoritos y morado
                    en tu top 5. Va fuera del botón del avatar para que el toque no abra el perfil. */}
                {followHeartVisible ? (
                  <FollowHeart userId={userItem?.id} username={userItem?.username} size={16} style={styles.followBtn} iconStyle={styles.followHeartGlow} />
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.iconButton, paused && styles.followersButtonPaused]}
                onPress={() => handleShowFollowers(userItem?.id, 'all')}
                onLongPress={() => handleShowFollowers(userItem?.id, 'all')}
                accessibilityLabel={`${followersCount} seguidores`}
              >
                <Text style={styles.iconText}>{followersCount}</Text>
                {/* En pausa: seguidores por insignia, como los likes de la tarea. Ocupan su lugar (no se enciman sobre
                    el ícono de cambiar de PCH): quedan con la misma separación de abajo y, sin corazón, junto al avatar. */}
                {paused && followers?.counts?.all > 0 && (
                  <TouchableOpacity onPress={() => handleShowFollowers(userItem?.id, 'all')}>
                    <View style={styles.tierCountersVertical}>{renderTierDigits(followers.counts, userItem?.id, handleShowFollowers)}</View>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <View style={styles.iconButton}>
                <TouchableOpacity onPress={() => cycleViewOnly(item)}>
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="layers" size={26} color="white" />
                    {badgeCount > 0 && ( // ✅ Aplicamos el nuevo estilo al badge
                      <View style={styles.badgeContainer}><Text style={styles.badgeText}>{badgeCount}</Text></View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => cycleClipWithinView(item)}>
                  <Text style={styles.iconText}>{viewLabel}</Text>
                </TouchableOpacity>
                <Text style={[styles.iconText, { fontSize: 10, marginTop: 0 }]}>{counterLabel}</Text>
              </View>

              <TouchableOpacity
                style={[styles.iconButton, { marginBottom: paused && enrichedItem.taskLikes?.status === 'ok' ? 4 : 12 }]}
                onPress={() => toggleLike(item)}
                onLongPress={() => {
                  handleShowLikes(contentItem.id, 'all');
                }}
              >
                <Ionicons name={enrichedItem.user_has_liked ? "heart" : "heart-outline"} size={24} color={enrichedItem.user_has_liked ? "#ff004f" : "white"} />
                <Text style={styles.iconText}>{contentItem.likes_count || 0}</Text>
                {/* ✅ FIX: Añadimos una guarda para evitar el crash si enrichedItem.taskLikes es undefined */}
                {paused && enrichedItem.taskLikes && enrichedItem.taskLikes.status === 'ok' && enrichedItem.taskLikes.counts && (
                  <TouchableOpacity onPress={() => handleShowLikes(contentItem.id, 'all')}>
                    <View style={styles.tierCountersVertical}>{renderTierDigits(enrichedItem.taskLikes.counts, contentItem?.id, handleShowLikes)}</View>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('TaskDetail', { taskId: contentItem.id, isShared: !enrichedItem.is_original })}>
                <Ionicons name="chatbubble-ellipses" size={22} color="white" />
                <Text style={styles.iconText}>{contentItem.comments_count || 0}</Text>
              </TouchableOpacity>

              {/* ✅ CONTADOR DE IMPULSOS (REPOST) */}
              <TouchableOpacity style={[styles.iconButton, { marginBottom: 12 }]} onPress={() => handleRepost(contentItem)}>
                <Ionicons name={contentItem.user_has_reposted ? "trending-up" : "trending-up-outline"} size={24} color={contentItem.user_has_reposted ? "#f59f00" : "white"} />
                <Text style={styles.iconText}>{contentItem.reposts_count || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => openActionModal(item)}>
                <Ionicons name="ellipsis-vertical" size={22} color="white" />
              </TouchableOpacity>
              </View>
            </View>
          </View>

        </>
      ) : null}

      {/* Barra de progreso pegada abajo, siempre visible en videos (se engrosa en pausa o al arrastrar). */}
      {isActive && currentEntry?.type === 'video' && playbackStatus.durationMillis > 0 && (
        <ProgressControls
          status={playbackStatus}
          paused={paused}
          onSeek={(value) => videoRefs.current[effPos]?.current?.setPositionAsync(value)}
        />
      )}

      <Animated.View style={[styles.likeAnimation, heartStyle, { pointerEvents: 'none' }]}>
        <Ionicons name="heart" size={100} color="white" />
      </Animated.View>
    </View>
  );
};

const ReelItem = React.memo(ReelItemComponent);

const styles = StyleSheet.create({
  reelContainer: { width: windowWidth, height: '100%' },
  video: { ...StyleSheet.absoluteFillObject },
  image: { ...StyleSheet.absoluteFillObject },
  sharedByContainer: { padding: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, marginBottom: 10, pointerEvents: 'auto' },
  sharedByTopRow: { flexDirection: 'row', alignItems: 'center' },
  sharedByRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  sharedByHeart: { marginLeft: 'auto', paddingLeft: 10 },
  sharedByAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#eee' },
  sharedByLabel: { flexShrink: 1 },
  sharedByName: { color: '#fff', fontWeight: 'bold', fontSize: 13, textShadow: '1px 1px 3px rgba(0,0,0,0.7)' },
  favoriteSharerIndicator: { color: '#ffc9c9', fontWeight: 'bold', fontSize: 11, marginLeft: 8, textShadow: '1px 1px 3px rgba(0,0,0,0.7)' },
  sharedByExpanded: { marginTop: 4 },
  sharedByDescription: { color: '#fff', fontSize: 13, marginTop: 4, textShadow: '1px 1px 3px rgba(0,0,0,0.7)' },
  pausedSharedByLabel: { marginBottom: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, pointerEvents: 'auto' },
  pausedSharedByText: { color: '#fff', fontSize: 12, fontWeight: '700', textShadow: '1px 1px 3px rgba(0,0,0,0.7)' },
  // La información queda justo encima de la barra de progreso (que va pegada al borde inferior).
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', paddingBottom: 18, zIndex: 1, pointerEvents: 'box-none' },
  publicationRow: { flexDirection: 'row', alignItems: 'flex-end', width: '100%', paddingLeft: 10, paddingRight: 2 },
  bottomSection: { flex: 1, minWidth: 0, padding: 10, paddingRight: 16, justifyContent: 'flex-end' },
  userInfo: { marginBottom: 10, pointerEvents: 'auto' },
  username: { color: '#fff', fontSize: 16, fontWeight: 'bold', textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 6, textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  description: { color: '#fff', fontSize: 14, textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  seeMore: { color: '#fff', opacity: 0.85, marginBottom: 12, textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  categoriesScroll: { flexDirection: 'row', marginBottom: 5 },
  categoryBadge: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  categoryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rightSection: { width: 50, flexShrink: 0, paddingBottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff' },
  followBtn: { position: 'absolute', bottom: -10, justifyContent: 'center', alignItems: 'center', padding: 0 },
  // Sin corazón debajo del avatar, el contador de seguidores sube un poco.
  avatarWithoutHeart: { marginBottom: 4 },
  // En pausa, sus números por insignia quedan más pegados al ícono de cambiar de PCH.
  followersButtonPaused: { marginBottom: 8 },
  // Brillo claro alrededor del corazón para que el negro (favorito) se vea sobre videos oscuros.
  followHeartGlow: Platform.select({
    web: { textShadow: '0px 0px 3px rgba(255,255,255,0.9)' },
    default: { textShadowColor: 'rgba(255,255,255,0.9)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3 },
  }),
  iconButton: { alignItems: 'center', marginBottom: 12, pointerEvents: 'auto' },
  iconText: { color: '#fff', fontSize: 10, marginTop: 3, fontWeight: '600', textShadow: '1px 1px 3px rgba(0,0,0,0.5)' },
  iconTextSmall: { color: '#fff', fontSize: 9, marginTop: 3, fontWeight: '600', textShadow: '1px 1px 3px rgba(0,0,0,0.5)' }, // ✅ Nuevo estilo para el badge
  badgeContainer: { position: 'absolute', top: -3, right: -6, width: 11, height: 11, backgroundColor: 'rgb(255, 255, 255)', zIndex: 1, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  tierCountersVertical: { flexDirection: 'column', gap: 3, alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2 },
  tierText: { fontSize: 10, fontWeight: '900', lineHeight: 10 },
  likeAnimation: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  buffering: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
});

export default ReelItem;