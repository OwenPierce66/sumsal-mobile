import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '@api';
import { useStoryUsers } from '@hooks/useStoryRing';
import StoryUploadModal from './StoryUploadModal';
import { STORY_RING_SEEN } from './StoryRing';

/**
 * Barra horizontal de historias (24h) para el encabezado del feed.
 * Usa la misma consulta (`useStories`) y los mismos filtros que Stories24hScreen,
 * así que comparten caché. Al tocar un círculo abre el visor de historias en esa historia.
 */
const StoriesBar = ({ navigation }) => {
  // Primero quien tiene algo sin ver; las ya vistas quedan con el aro gris.
  const { users: storyUsers, refetch } = useStoryUsers();
  const [uploadVisible, setUploadVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        <TouchableOpacity style={styles.bubble} onPress={() => setUploadVisible(true)}>
          <View style={[styles.ring, styles.addRing]}>
            <Ionicons name="add" size={22} color="#51cf66" />
          </View>
          <Text style={styles.name} numberOfLines={1}>Tu historia</Text>
        </TouchableOpacity>

        {storyUsers.map((u) => (
          <TouchableOpacity
            key={`story-user-${u.userId}`}
            style={styles.bubble}
            onPress={() => navigation.navigate('Stories', { openStoryId: u.openStoryId })}
          >
            <View style={[styles.ring, u.allSeen && styles.seenRing]} testID={u.allSeen ? 'story-ring-seen' : 'story-ring'}>
              {u.avatar ? (
                <Image source={{ uri: u.avatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={18} color="#bbb" />
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
  wrap: { backgroundColor: '#fff', paddingTop: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#f1f1f1' },
  strip: { paddingHorizontal: 16, gap: 14 },
  bubble: { width: 62, alignItems: 'center' },
  ring: {
    width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: '#4dabf7',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  seenRing: { borderColor: STORY_RING_SEEN },
  addRing: { borderColor: '#51cf66', borderStyle: 'dashed' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 11, color: '#555', maxWidth: 62 },
});

export default StoriesBar;
