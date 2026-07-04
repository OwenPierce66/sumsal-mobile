import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { getImageUrl } from '../api';
import ProgressControls from './ProgressControls';

const TIER_ORDER = ['app', 'recommended', 'verified', 'sub_red', 'sub_green', 'regular'];

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

const ReelItem = ({
  item,
  index,
  isActive,
  isMuted,
  paused,
  videoRefs,
  isUIVisible,
  setPlaybackStatus,
  playbackStatus,
  expandedDescriptions,
  toggleDescription,
  viewStateById,
  sharedOpenById,
  toggleSharedBy,
  getSharedByInfo,
  cycleViewOnly,
  cycleClipWithinView,
  navigateClip,
  toggleLike, // Like de la TAREA
  likeAnimation,
  navigation,
  toggleFavorite,
  openShareModal,
  handleShowShares,
  handleShowLikes,
  handleShowProfileLikes,
  openActionModal,
  toggleProfileLike, // ✅ NUEVO: Like del PERFIL
  handleToggleProfileFavoriteDirect,
  tema,
  playlists,
  taskLikes,
  taskShares,
  profileLikes,
}) => {
  const rawState = viewStateById[item.id] || { mode: "main", pos: 0 };
  const onLayout = (event) => { item.onLayout?.(event.nativeEvent.layout); };
  const VIEW_ORDER = ["main", "factores", "fuentes"];
  const fallbackMode = VIEW_ORDER.find((m) => (playlists?.[m]?.length || 0) > 0) || "main";
  const effMode = playlists?.[rawState.mode]?.length ? rawState.mode : fallbackMode;
  const len = playlists?.[effMode]?.length || 0;
  const effPos = len ? Math.min(Math.max(0, rawState.pos || 0), len - 1) : 0;

  const list = playlists[effMode] || [];
  const entry = list[effPos] || null;
  const videoSrc = entry ? entry.src : item._anyVideo;

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

  const sharedByInfo = getSharedByInfo(item);
  const isSharedOpen = sharedOpenById[item.id];

  // ✅ Lógica para mostrar el contador de likes del perfil en tiempo real
  const profileLikesCount = useMemo(() => {
    // Prioriza el valor actualizado del perfil, si no, usa el que viene en la tarea
    return item.user?.profile?.likes_count ?? item.user?.likes_count ?? 0;
  }, [item.user?.profile?.likes_count, item.user?.likes_count]);

  const userTier = useMemo(() => {
      const profile = item.user?.profile || {};
      if (profile.is_verified) return { key: 'verified', color: '#4dabf7' };
      if (profile.is_recommended) return { key: 'recommended', color: '#f59f00' };
      return { key: 'regular', color: '#fff' };
  }, [item.user]);

  // ✅ Lógica de `ReelsPCH.js` para mostrar los dígitos de tier
  const renderTierDigits = (counts, handler) => {
    if (!counts) return null;
    return TIER_ORDER.map(key => {
      const n = counts[key] || 0;
      if (!n) return null;
      const meta = { color: key === 'verified' ? '#4dabf7' : key === 'recommended' ? '#f59f00' : 'grey' }; // Simplificado
      return (
        <TouchableOpacity key={key} onPress={() => handler(item.id, key)}><Text style={[styles.tierText, { color: meta.color }]}><Ionicons name="ellipse" size={8} color={meta.color} /> {n}</Text></TouchableOpacity>
      );
    });
  };

  return (
    <View style={styles.reelContainer}>
      <Video
        ref={ref => { videoRefs.current[index] = ref; }}
        source={{ uri: getImageUrl(videoSrc) }}
        style={styles.video}
        resizeMode="cover"
        shouldPlay={isActive && !paused}
        isLooping
        isMuted={isMuted}
        onPlaybackStatusUpdate={(status) => {
          if (isActive) { setPlaybackStatus(status); }
        }}
      />

      {isUIVisible ? (
        <>
          {/* ✅ CORRECCIÓN: Se aplica el estilo pointerEvents directamente */}
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.bottomSection} pointerEvents="box-none">
              {/* ⚡️ 2. INDICADOR DE "COMPARTIDO POR" */}
              {sharedByInfo && (
                <TouchableOpacity style={styles.sharedByContainer} onPress={() => toggleSharedBy(item.id)}>
                  <View style={styles.sharedByRow}>
                    <Image source={{ uri: sharedByInfo.avatar }} style={styles.sharedByAvatar} />
                    {!isSharedOpen && (
                      <Text style={styles.sharedByName}>{sharedByInfo.name} compartió</Text>
                    )}
                  </View>
                  {isSharedOpen && sharedByInfo.description && (
                    <View>
                      <Text style={[styles.sharedByName, { marginBottom: 4 }]}>{sharedByInfo.name} escribió:</Text>
                      <Text style={styles.sharedByDescription}>{sharedByInfo.description}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.userInfo}
                onPress={() => navigation.navigate('UserProfile', { userId: item.user?.id, userName: item.user?.username, userAvatar: getImageUrl(item.user?.user_image) })}
              >
                <Text style={styles.username}>@{item.user?.username || 'Usuario'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => toggleDescription(item.id)} activeOpacity={0.8}>
                {effMode !== 'main' && (
                  <Text style={styles.title} numberOfLines={1}>{entry?.item?.title || viewLabel}</Text>
                )}
                {effMode === 'main' ? (
                  <>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.description} numberOfLines={expandedDescriptions[item.id] ? undefined : 2}>
                      {entry?.groupIndex != null && entry?.item?.description ? `${item.description} • ${entry.item.description}` : item.description}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.description} numberOfLines={expandedDescriptions[item.id] ? undefined : 2}>{entry?.item?.description}</Text>
                )}
              </TouchableOpacity>

              {item.categories ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                  {item.categories.split(',').map((cat, idx) => (
                    <View key={idx} style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{cat.trim()}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            <View style={styles.rightSection} onLayout={onLayout}>
              {/* ✅ BOTÓN DE PERFIL: Tap para ir al perfil, Long-press para ver likes */}
              <TouchableOpacity 
                style={styles.iconButton} 
                onPress={() => navigation.navigate('UserProfile', { userId: item.user?.id, userName: item.user?.username, userAvatar: getImageUrl(item.user?.user_image) })}
                onLongPress={() => handleShowProfileLikes(item.user.id)}
              >
                <Image source={{ uri: getImageUrl(item.user?.user_image) || 'https://ui-avatars.com/api/?name=User' }} style={[styles.avatar, { borderColor: userTier.color }]} contentFit="cover" />
                {/* ✅ BOTÓN DE LIKE DE PERFIL (CORAZÓN) */}
                <TouchableOpacity
                  style={styles.followBtn}
                  onPress={(e) => { e.stopPropagation(); toggleProfileLike(item); }}
                >
                  <Ionicons name="heart" size={12} color={item.user?.profile?.viewer_has_liked ? "#ff004f" : "#fff"} />
                </TouchableOpacity>
              </TouchableOpacity>

              {/* ⚡️ 4. CONTADOR DE LIKES DE PERFIL CON DESGLOSE AL PAUSAR */}
              <View style={styles.iconButton}>
                <Text style={styles.iconText}>{profileLikesCount}</Text>
                {paused && profileLikes?.status === 'ok' && profileLikes?.counts && (
                  <TouchableOpacity onPress={() => handleShowProfileLikes(item.user.id, 'all')}>
                    <View style={styles.tierCountersVertical}>{renderTierDigits(profileLikes.counts, handleShowProfileLikes)}</View>
                  </TouchableOpacity>
                )}
              </View>



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

              <TouchableOpacity style={styles.iconButton} onPress={() => toggleLike(item)} onLongPress={() => handleShowLikes(item.id)}>
                <Ionicons name={item.user_has_liked ? "heart" : "heart"} size={24} color={item.user_has_liked ? "#ff004f" : "white"} />
                <Text style={styles.iconText}>{item.likes_count || 0}</Text>
                {paused && taskLikes?.status === 'ok' && taskLikes?.counts && (
                  <TouchableOpacity onPress={() => handleShowLikes(item.id, 'all')}>
                    <View style={styles.tierCountersVertical}>{renderTierDigits(taskLikes.counts, handleShowLikes)}</View>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}>
                <Ionicons name="chatbubble-ellipses" size={22} color="white" />
                <Text style={styles.iconText}>{item.comments_count || 0}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.iconButton} onPress={() => openShareModal(item.id)} onLongPress={() => handleShowShares(item.id)}>
                <Ionicons name="arrow-redo" size={24} color="white" />
                <Text style={styles.iconText}>{item.share_count || 0}</Text>
                {paused && taskShares?.status === 'ok' && taskShares?.counts && (
                  <TouchableOpacity onPress={() => handleShowShares(item.id, 'all')}>
                     <View style={styles.tierCountersVertical}>{renderTierDigits(taskShares.counts, handleShowShares)}</View>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => openActionModal(item)}>
                <Ionicons name="ellipsis-vertical" size={22} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {list.length > 1 && (
            <>
              {effPos > 0 && (
                <TouchableOpacity style={styles.navArrowLeft} onPress={() => navigateClip(item, -1)}>
                  <Ionicons name="chevron-back" size={30} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              )}
              {effPos < list.length - 1 && (
                <TouchableOpacity style={styles.navArrowRight} onPress={() => navigateClip(item, 1)}>
                  <Ionicons name="chevron-forward" size={30} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      ) : null}

      {isActive && paused && (
        <ProgressControls status={playbackStatus} onSeek={(value) => videoRefs.current[index]?.setPositionAsync(value)} />
      )}

      <Animated.View style={[styles.likeAnimation, heartStyle, { pointerEvents: 'none' }]}>
        <Ionicons name="heart" size={100} color="white" />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  reelContainer: { width: windowWidth, height: windowHeight },
  video: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: Platform.OS === 'ios' ? 90 : 70, zIndex: 1, pointerEvents: 'box-none' },
  bottomSection: { flex: 1, padding: 15, paddingRight: 80, justifyContent: 'flex-end' },
  userInfo: { marginBottom: 10, pointerEvents: 'auto' }, // Este ya es correcto
  // ⚡️ 2. ESTILOS PARA "COMPARTIDO POR"
  sharedByContainer: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 10, marginBottom: 10, pointerEvents: 'auto', alignSelf: 'flex-start' },
  sharedByRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sharedByAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#555' },
  sharedByName: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  sharedByDescription: { color: '#eee', fontSize: 13, fontStyle: 'italic' },
  // ---
  username: { color: '#fff', fontSize: 16, fontWeight: 'bold', textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 6, textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  description: { color: '#fff', fontSize: 14, marginBottom: 12, textShadow: '1px 1px 4px rgba(0, 0, 0, 0.75)' },
  categoriesScroll: { flexDirection: 'row', marginBottom: 5 },
  categoryBadge: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  categoryText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  rightSection: { width: 60, paddingBottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#fff' },
  followBtn: { position: 'absolute', bottom: -5, backgroundColor: 'rgba(0,0,0,0.6)', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  iconButton: { alignItems: 'center', marginBottom: 12, pointerEvents: 'auto' }, // ✅ CORRECCIÓN: Aseguramos que los botones capturen el toque
  iconText: { color: '#fff', fontSize: 10, marginTop: 3, fontWeight: '600', textShadow: '1px 1px 3px rgba(0,0,0,0.5)' },
  iconTextSmall: { color: '#fff', fontSize: 9, marginTop: 3, fontWeight: '600', textShadow: '1px 1px 3px rgba(0,0,0,0.5)' },
  badgeContainer: { position: 'absolute', top: -3, right: -6, backgroundColor: '#ff004f', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  // ✅ ESTILOS PORTADOS DE ReelsPCH.scss (.reel-profile-likedigits / .reel-action-digits)
  tierCountersVertical: { flexDirection: 'column', gap: 3, alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2 },
  tierText: { fontSize: 10, fontWeight: '900', lineHeight: 10 },
  likeAnimation: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  navArrowLeft: { position: 'absolute', left: 10, top: '50%', transform: [{ translateY: -20 }], padding: 10, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 25 },
  navArrowRight: { position: 'absolute', right: 10, top: '50%', transform: [{ translateY: -20 }], padding: 10, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 25 },
});


export default ReelItem;
