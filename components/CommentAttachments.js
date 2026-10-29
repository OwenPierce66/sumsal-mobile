import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video } from 'expo-av';
import { getImageUrl } from '@api';
import { isVideoAsset } from '../utils/mediaUpload';

/**
 * Clip junto al campo de comentario: abre un menú con las tres formas de acompañar un
 * comentario o respuesta. `active` lo resalta si ya lleva algo adjunto.
 */
export const CommentAttachMenu = ({ onPickAportacion, onTag, onPickMedia, active = false, mediaDisabled = false }) => {
  const [open, setOpen] = useState(false);
  const choose = (action) => () => {
    setOpen(false);
    action?.();
  };
  const options = [
    ['bookmark-outline', 'Comentar con una publicación guardada', onPickAportacion, '#7048e8'],
    ['person-add-outline', 'Etiquetar personas', onTag, '#1971c2'],
    ...(mediaDisabled ? [] : [['image-outline', 'Adjuntar foto o video', onPickMedia, '#2f9e44']]),
  ];
  return (
    <>
      <TouchableOpacity
        style={[styles.clip, active && styles.clipActive]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Adjuntar al comentario"
      >
        <Ionicons name="attach" size={22} color={active ? '#fff' : '#7048e8'} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {options.map(([icon, label, action, color]) => (
              <TouchableOpacity
                key={label}
                style={styles.option}
                onPress={choose(action)}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Ionicons name={icon} size={20} color={color} />
                <Text style={styles.optionText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancel} onPress={() => setOpen(false)} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

/** La foto o el video elegido, antes de enviar el comentario. */
export const CommentMediaChip = ({ media, onRemove }) => {
  if (!media) return null;
  const video = isVideoAsset(media);
  return (
    <View style={styles.chip}>
      {video ? (
        <View style={[styles.chipThumb, styles.chipVideo]}>
          <Ionicons name="videocam" size={18} color="#fff" />
        </View>
      ) : (
        <Image source={{ uri: media.uri }} style={styles.chipThumb} contentFit="cover" />
      )}
      <Text style={styles.chipText}>{video ? 'Video adjunto' : 'Foto adjunta'}</Text>
      <TouchableOpacity onPress={onRemove} accessibilityLabel="Quitar foto o video" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={20} color="#868e96" />
      </TouchableOpacity>
    </View>
  );
};

/** Foto o video que trae un comentario (`attachment_url` / `attachment_type`). */
export const CommentAttachmentView = ({ comment, compact = false }) => {
  const uri = getImageUrl(comment?.attachment_url);
  if (!uri) return null;
  const height = compact ? 150 : 200;
  if (comment.attachment_type === 'video') {
    return (
      <Video
        source={{ uri }}
        style={[styles.media, { height }]}
        useNativeControls
        resizeMode="contain"
        isLooping={false}
      />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.media, { height }]}
      contentFit="cover"
      accessibilityLabel="Foto del comentario"
    />
  );
};

const styles = StyleSheet.create({
  clip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f0ff' },
  clipActive: { backgroundColor: '#7048e8' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#dee2e6', marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8, backgroundColor: '#f5f5f5' },
  optionText: { fontSize: 15, marginLeft: 14, color: '#333', fontWeight: '500' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#e03131', fontWeight: '600', fontSize: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', padding: 6, borderRadius: 12, backgroundColor: '#ebfbee' },
  chipThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#e9ecef' },
  chipVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#2f9e44' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#2b8a3e' },
  media: { width: '100%', marginTop: 6, borderRadius: 12, backgroundColor: '#000' },
});
