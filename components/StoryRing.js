import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useStoryRing } from '@hooks/useStoryRing';

export const STORY_RING_UNSEEN = '#4dabf7';
export const STORY_RING_SEEN = '#ced4da';

/**
 * Envuelve un avatar de `size` px con el aro de historia de `userId`:
 * azul si tiene historias sin ver, gris si ya las viste todas y sin aro si no ha subido.
 * Con historia, tocar el avatar abre el visor; sin ella se usa `onPress` (si lo hay).
 */
const StoryRing = ({ userId, size, navigation, onPress, children, style }) => {
  const ring = useStoryRing(userId);
  const big = size >= 60;
  const gap = big ? 5 : 3;
  const border = big ? 3 : 2;
  const openStory = ring && navigation ? () => navigation.navigate('Stories', { openStoryId: ring.storyId }) : null;
  const handlePress = openStory || onPress;

  const content = (
    <>
      {children}
      {ring ? (
        <View
          pointerEvents="none"
          testID={ring.seen ? 'story-ring-seen' : 'story-ring'}
          style={[
            styles.ring,
            {
              top: -gap, left: -gap, width: size + gap * 2, height: size + gap * 2,
              borderRadius: (size + gap * 2) / 2, borderWidth: border,
              borderColor: ring.seen ? STORY_RING_SEEN : STORY_RING_UNSEEN,
            },
          ]}
        />
      ) : null}
    </>
  );

  if (!handlePress) return <View style={[{ width: size, height: size }, style]}>{content}</View>;
  return (
    <TouchableOpacity
      style={[{ width: size, height: size }, style]}
      activeOpacity={0.8}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={openStory ? (ring.seen ? 'Ver historia (ya vista)' : 'Ver historia nueva') : undefined}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  ring: { position: 'absolute' },
});

export default StoryRing;
