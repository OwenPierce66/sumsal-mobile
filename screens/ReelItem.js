import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, TouchableOpacity, ScrollView, ActivityIndicator, LogBox } from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { getImageUrl } from '../api';
import ProgressControls from './ProgressControls';

const TIER_ORDER = ['app', 'recommended', 'verified', 'sub_red', 'sub_green', 'regular'];
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
  openShareModal,
  handleShowShares,
  handleShowLikes,
  handleShowProfileLikes,
  openActionModal,
  toggleProfileLike,
  tema,
}) => {
  // ✅ FIX: Se mueven las definiciones al principio para evitar errores de "undefined".
  const contentItem = useMemo(() => (item.is_original ? item : item.task), [item]);
  const userItem = useMemo(() => (item.is_original ? item.user : (item.task?.user || {})), [item]);
  const playlists = useMemo(() => buildPlaylists(contentItem), [contentItem]);
  const rawState = viewStateById[item.id] || { mode: "main", pos: 0 };

  const videoRefs = useRef([]);
  if (videoRefs.current.length !== (playlists.main?.length || 1)) {
    videoRefs.current = Array(playlists.main?.length || 1).fill(null).map((_, i) => videoRefs.current[i] || React.createRef());
  }

  const [playbackStatus, setPlaybackStatus] = useState({});

  const VIEW_ORDER = ["main", "factores", "fuentes"];
  const fallbackMode = VIEW_ORDER.find((m) => (playlists?.[m]?.length || 0) > 0) || "main";
  const effMode = playlists?.[rawState.mode]?.length ? rawState.mode : fallbackMode;
  const len = playlists?.[effMode]?.length || 0;
  const effPos = len ? Math.min(Math.max(0, rawState.pos || 0), len - 1) : 0;

  const list = playlists[effMode] || [];
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

  const isSharedOpen = sharedOpenById[item.is_original ? item.id : item.task?.id];

  // Usamos el `enrichedItem` que ya tiene los datos de likes de perfil actualizados
  const profileLikesCount = enrichedItem.user?.profile?.likes_count ?? 0; // Ya estaba bien
  const viewerHasLikedProfile = enrichedItem.user?.profile?.viewer_has_liked ?? false;

  const userTier = useMemo(() => {
      // ✅ Leemos el perfil directamente del `enrichedItem` que ya tiene los datos actualizados
      const currentProfile = enrichedItem.user?.profile || {};
      if (currentProfile.is_verified) return { key: 'verified', color: '#4dabf7' };
      if (currentProfile.is_recommended) return { key: 'recommended', color: '#f59f00' }; // Naranja para recomendados
      return { key: 'regular', color: '#fff' };
  }, [enrichedItem.user?.profile]);

  const renderTierDigits = (counts, handler) => {
    if (!counts) return null;
    return TIER_ORDER.map(key => {
      const n = counts[key] || 0;
      if (!n) return null;
      const meta = { color: key === 'verified' ? '#4dabf7' : key === 'recommended' ? '#f59f00' : 'grey' };
      return (
        // ✅ Usa el ID del usuario correcto.
        <TouchableOpacity key={key} onPress={() => handler(userItem?.id, key)}>
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
    const player = videoRefs.current[rawState.pos]?.current;
    if (!player) return;

    if (isActive && !paused) {
      player.playAsync();
    } else {
      player.pauseAsync();
    }
  }, [isActive, paused, rawState.pos]); // Ahora depende directamente de la prop `paused`

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
            <View key={`${item.id}-clip-${clipIdx}`} style={{ width: windowWidth, height: windowHeight }}>
              <Video // 🪵 LOG DE DIAGNÓSTICO: Video componente
                ref={videoRefs.current[clipIdx]} // ✅ Asignamos la referencia correcta del array
                source={{ uri: getImageUrl(entry.src) }}
                style={styles.video}
                resizeMode="cover" // ✅ Usamos la prop `paused` directamente
                shouldPlay={isActive && !paused && rawState.pos === clipIdx}
                isLooping
                isMuted={isMuted}
                onPlaybackStatusUpdate={(status) => {
                  if (rawState.pos === clipIdx) {
                    setPlaybackStatus(status);
                  }
                }}
              />
            </View>
          ))
        ) : (
          <View style={{ width: windowWidth, height: windowHeight }}> 
            <Video // 🪵 LOG DE DIAGNÓSTICO: Fallback Video componente
              ref={videoRefs.current[0]} // ✅ Asignamos la primera referencia si no hay lista
              source={{ uri: getImageUrl(item._anyVideo) }}
              style={styles.video}
              resizeMode="cover" 
              shouldPlay={isActive && !paused} // ✅ Usamos la prop `paused` directamente
              isLooping
              isMuted={isMuted}
              onPlaybackStatusUpdate={(status) => {
                setPlaybackStatus(status);
              }}
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
            <View style={styles.bottomSection} pointerEvents="box-none">
              {/* ✅ FIX: Se muestra si es compartido Y si sharedByInfo tiene datos */}
              {!enrichedItem.is_original && sharedByInfo && (
                <TouchableOpacity style={styles.sharedByContainer} onPress={() => toggleSharedBy(contentItem.id)}>
                  <View style={styles.sharedByRow}>
                    <Image source={{ uri: sharedByInfo.avatar }} style={styles.sharedByAvatar} />
                    {!isSharedOpen && (
                      <Text style={styles.sharedByName}>{sharedByInfo.name} compartió</Text>
                    )}
                  </View>
                {/* ✅ INDICADOR DE COMPARTIDOS POR FAVORITOS (Corregido) */}
                {sharedByInfo && sharedByInfo.favoriteSharersCount > 0 && !isSharedOpen && (
                  <Text style={styles.favoriteSharerIndicator}>
                    <Ionicons name="heart" size={10} color="#ff6b6b" /> {sharedByInfo.favoriteSharersCount}
                  </Text>
                )}
                  {isSharedOpen && sharedByInfo.description && (
                    <View style={styles.sharedByExpanded}>
                      <Text style={[styles.sharedByName, { marginBottom: 4 }]}>{sharedByInfo.name} <Text style={{ fontWeight: 'normal', color: '#ddd' }}>escribió:</Text></Text>
                      <Text style={styles.sharedByDescription}>{sharedByInfo.description}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.userInfo} // Ya estaba bien
                onPress={() => navigation.navigate('UserProfile', { userId: userItem?.id, userName: userItem?.username, userAvatar: getImageUrl(userItem?.user_image) })} // Ya estaba bien
              >
                <Text style={styles.username}>@{userItem?.username || 'Usuario'}</Text>
              </TouchableOpacity>

              {(() => { const entry = list[effPos] || null; return (
              <TouchableOpacity onPress={() => toggleDescription(item.id)} activeOpacity={0.8}>
                {effMode !== 'main' && (
                  <Text style={styles.title} numberOfLines={1}>{entry?.item?.title || viewLabel}</Text>
                )}
                {effMode === 'main' ? (
                  <>
                    <Text style={styles.title} numberOfLines={1}>{contentItem.title}</Text>
                    <Text style={styles.description} numberOfLines={expandedDescriptions[item.id] ? undefined : 2}>
                      {entry?.groupIndex != null && entry?.item?.description ? `${contentItem.description} • ${entry.item.description}` : contentItem.description}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.description} numberOfLines={expandedDescriptions[item.id] ? undefined : 2}>{entry?.item?.description}</Text>
                )}
              </TouchableOpacity>
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
              <TouchableOpacity 
                style={styles.iconButton} 
                onPress={() => navigation.navigate('UserProfile', { userId: userItem?.id, userName: userItem?.username, userAvatar: getImageUrl(userItem?.user_image) })}
                onLongPress={() => handleShowProfileLikes(userItem?.id)}
              > 
                <Image source={{ uri: getImageUrl(userItem?.user_image) || 'https://ui-avatars.com/api/?name=User' }} style={[styles.avatar, { borderColor: userTier.color }]} contentFit="cover" />
                <TouchableOpacity
                  style={styles.followBtn}
                  onPress={(e) => { e.stopPropagation(); toggleProfileLike(item); }}
                >
                  {/* Usamos el estado de like del perfil enriquecido */}
                  <Ionicons name={viewerHasLikedProfile ? "heart" : "heart-outline"} size={12} color={viewerHasLikedProfile ? "#ff004f" : "#fff"} />
                </TouchableOpacity>
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onLongPress={() => handleShowProfileLikes(userItem?.id, 'all')}>
                <Text style={styles.iconText}>{profileLikesCount}</Text>
                {/* ✅ FIX: Añadimos una guarda para evitar el crash si enrichedItem.profileLikes es undefined */}
                {paused && enrichedItem.profileLikes && enrichedItem.profileLikes.status === 'ok' && enrichedItem.profileLikes.counts && (
                  <TouchableOpacity onPress={() => handleShowProfileLikes(item.user?.id, 'all')}>
                    <View style={styles.tierCountersVertical}>{renderTierDigits(enrichedItem.profileLikes.counts, handleShowProfileLikes)}</View>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <View style={styles.iconButton}>
                <TouchableOpacity onPress={() => cycleViewOnly(item)}>
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="layers" size={26} color="white" />
                    {badgeCount > 0 && (
                      <View style={styles.badgeContainer}><Text style={styles.badgeText}>{badgeCount}</Text></View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => cycleClipWithinView(item)}>
                  <Text style={styles.iconText}>{viewLabel}</Text>
                </TouchableOpacity>
                <Text style={[styles.iconText, { fontSize: 10, marginTop: 0 }]}>{counterLabel}</Text>
              </View>

              <TouchableOpacity style={styles.iconButton} onPress={() => toggleLike(item)} onLongPress={() => handleShowLikes(contentItem.id, 'all')}>
                <Ionicons name={enrichedItem.user_has_liked ? "heart" : "heart-outline"} size={24} color={enrichedItem.user_has_liked ? "#ff004f" : "white"} />
                <Text style={styles.iconText}>{contentItem.likes_count || 0}</Text>
                {/* ✅ FIX: Añadimos una guarda para evitar el crash si enrichedItem.taskLikes es undefined */}
                {paused && enrichedItem.taskLikes && enrichedItem.taskLikes.status === 'ok' && enrichedItem.taskLikes.counts && (
                  <TouchableOpacity onPress={() => handleShowLikes(contentItem.id, 'all')}>
                    <View style={styles.tierCountersVertical}>{renderTierDigits(enrichedItem.taskLikes.counts, handleShowLikes)}</View>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('TaskDetail', { taskId: contentItem.id, isShared: !enrichedItem.is_original })}>
                <Ionicons name="chatbubble-ellipses" size={22} color="white" />
                <Text style={styles.iconText}>{contentItem.comments_count || 0}</Text>
              </TouchableOpacity>

              {/* ✅ CONTADOR DE IMPULSOS (REPOST) */}
              <TouchableOpacity style={styles.iconButton} onPress={() => handleRepost(contentItem)}>
                <Ionicons name="trending-up" size={24} color="#f59f00" />
                <Text style={styles.iconText}>{contentItem.interaction_score || 0}</Text>
              </TouchableOpacity>

              {/* ✅ CONTADOR DE COMPARTIDOS */}
              <TouchableOpacity style={styles.iconButton} onPress={() => openShareModal(contentItem)} onLongPress={() => handleShowShares(contentItem.id, 'all')}>
                <Ionicons name="arrow-redo" size={24} color="white" />
                <Text style={styles.iconText}>{contentItem.share_count || 0}</Text>
                {paused && enrichedItem.taskShares && enrichedItem.taskShares.status === 'ok' && enrichedItem.taskShares.counts && (
                  <TouchableOpacity onPress={() => handleShowShares(contentItem.id, 'all')}>
                     <View style={styles.tierCountersVertical}>{renderTierDigits(enrichedItem.taskShares.counts, handleShowShares)}</View>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => openActionModal(item)}>
                <Ionicons name="ellipsis-vertical" size={22} color="white" />
              </TouchableOpacity>
            </View>
          </View>

        </>
      ) : null}

      {/* ✅ FIX DEFINITIVO: Solo mostramos los controles si estamos en pausa Y si ya tenemos una duración válida. */}
      {isActive && paused && (
        playbackStatus.durationMillis > 0 && <ProgressControls status={playbackStatus} onSeek={(value) => videoRefs.current[rawState.pos]?.current?.setPositionAsync(value)} />
      )}

      <Animated.View style={[styles.likeAnimation, heartStyle, { pointerEvents: 'none' }]}>
        <Ionicons name="heart" size={100} color="white" />
      </Animated.View>
    </View>
  );
};

const ReelItem = React.memo(ReelItemComponent);

const styles = StyleSheet.create({
  reelContainer: { width: windowWidth, height: windowHeight },
  video: { ...StyleSheet.absoluteFillObject },
  sharedByContainer: { padding: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, marginBottom: 10, pointerEvents: 'auto' },
  sharedByRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sharedByAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#eee' },
  sharedByName: { color: '#fff', fontWeight: 'bold', fontSize: 13, textShadow: '1px 1px 3px rgba(0,0,0,0.7)' },
  favoriteSharerIndicator: { color: '#ffc9c9', fontWeight: 'bold', fontSize: 11, marginLeft: 8, textShadow: '1px 1px 3px rgba(0,0,0,0.7)' },
  sharedByExpanded: { marginTop: 4 },
  sharedByDescription: { color: '#fff', fontSize: 13, marginTop: 4, textShadow: '1px 1px 3px rgba(0,0,0,0.7)' },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: Platform.OS === 'ios' ? 90 : 70, zIndex: 1, pointerEvents: 'none' },
  bottomSection: { flex: 1, padding: 15, paddingRight: 80, justifyContent: 'flex-end' },
  userInfo: { marginBottom: 10, pointerEvents: 'auto' },
  username: { color: '#fff', fontSize: 16, fontWeight: 'bold', textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 6, textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  description: { color: '#fff', fontSize: 14, marginBottom: 12, textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  categoriesScroll: { flexDirection: 'row', marginBottom: 5 },
  categoryBadge: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  categoryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rightSection: { width: 60, paddingBottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff' },
  followBtn: { position: 'absolute', bottom: -5, backgroundColor: 'rgba(0,0,0,0.6)', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  iconButton: { alignItems: 'center', marginBottom: 12, pointerEvents: 'auto' },
  iconText: { color: '#fff', fontSize: 10, marginTop: 3, fontWeight: '600', textShadow: '1px 1px 3px rgba(0,0,0,0.5)' },
  iconTextSmall: { color: '#fff', fontSize: 9, marginTop: 3, fontWeight: '600', textShadow: '1px 1px 3px rgba(0,0,0,0.5)' },
  badgeContainer: { position: 'absolute', top: -3, right: -6, backgroundColor: '#ff004f', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  tierCountersVertical: { flexDirection: 'column', gap: 3, alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2 },
  tierText: { fontSize: 10, fontWeight: '900', lineHeight: 10 },
  likeAnimation: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  buffering: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
});

export default ReelItem;