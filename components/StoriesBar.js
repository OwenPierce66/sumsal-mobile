import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '@api';
import { useStories } from '@hooks/useApi';
import StoryUploadModal from './StoryUploadModal';
import { STORY_WINDOW_MS, getStoryMedia, parseCreatedAtMs } from '../screens/Stories24hScreen';

/**
 * Barra horizontal de historias (24h) para el encabezado del feed.
 * Usa la misma consulta (`useStories`) y los mismos filtros que Stories24hScreen,
 * así que comparten caché. Al tocar un círculo abre el visor de historias en esa historia.
 */
const StoriesBar = ({ navigation }) => {
  const { data, refetch } = useStories();
  const [uploadVisible, setUploadVisible] = useState(false);

  const storyUsers = useMemo(() => {
    const now = Date.now();
    const grouped = new Map();
    (Array.isArray(data) ? data : []).forEach((story) => {
      const userId = story?.user?.id || story?.user_id;
      if (!userId || !getStoryMedia(story)) return;
      const createdMs = parseCreatedAtMs(story);
      if (createdMs && now - createdMs > STORY_WINDOW_MS) return;
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          userId,
          username: story?.user?.username || story?.username || 'Usuario',
          avatar: getImageUrl(story?.user?.user_image),
          latestMs: createdMs || 0,
          firstStoryId: story.id,
          firstStoryMs: createdMs || 0,
        });
      }
      const entry = grouped.get(userId);
      entry.latestMs = Math.max(entry.latestMs, createdMs || 0);
      if ((createdMs || 0) < entry.firstStoryMs) {
        entry.firstStoryMs = createdMs || 0;
        entry.firstStoryId = story.id;
      }
    });
    return Array.from(grouped.values()).sort((a, b) => b.latestMs - a.latestMs);
  }, [data]);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        <TouchableOpacity style={styles.bubble} onPress={() => setUploadVisible(true)}>
          <View style={[styles.ring, styles.addRing]}>
            <Ionicons name="add" size={26} color="#51cf66" />
          </View>
          <Text style={styles.name} numberOfLines={1}>Tu historia</Text>
        </TouchableOpacity>

        {storyUsers.map((u) => (
          <TouchableOpacity
            key={`story-user-${u.userId}`}
            style={styles.bubble}
            onPress={() => navigation.navigate('Stories', { openStoryId: u.firstStoryId })}
          >
            <View style={styles.ring}>
              {u.avatar ? (
                <Image source={{ uri: u.avatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={20} color="#bbb" />
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>{u.username}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <StoryUploadModal
        visible={uploadVisible}
        onClose={() => setUploadVisible(false)}
        onUploaded={() => refetch()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fff', paddingTop: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#f1f1f1' },
  strip: { paddingHorizontal: 16, gap: 14 },
  bubble: { width: 72, alignItems: 'center' },
  ring: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#4dabf7',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  addRing: { borderColor: '#51cf66', borderStyle: 'dashed' },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarFallback: { backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 12, color: '#555', maxWidth: 72 },
});

export default StoriesBar;
