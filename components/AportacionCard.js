import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { getImageUrl } from '@api';
import { PCH_LABELS, PCH_ICONS } from '../utils/aportaciones';

/**
 * Tarjeta compacta de una aportación adjunta a un comentario, o de la que se va
 * a adjuntar en el campo de texto. Recibe el formato de `aportacion_info`
 * ({ id, title, image, pch, username }).
 */
const AportacionCard = ({ info, onPress, onRemove, label = 'Aportación adjunta', style }) => {
  if (!info?.id) return null;
  const thumbnail = getImageUrl(info.image);
  const meta = [info.username && `@${info.username}`, PCH_LABELS[info.pch]].filter(Boolean).join(' · ');
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, style]}
      {...(onPress ? {
        onPress,
        activeOpacity: 0.8,
        accessibilityRole: 'button',
        accessibilityLabel: `${label}: ${info.title || 'Sin título'}. Abrir aportación`,
      } : {})}
    >
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.thumbnail} contentFit="cover" />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Ionicons name={PCH_ICONS[info.pch] || 'document-text-outline'} size={20} color="#4dabf7" />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.title} numberOfLines={2}>{info.title || 'Sin título'}</Text>
        {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {onRemove ? (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Quitar aportación adjunta"
        >
          <Ionicons name="close-circle" size={22} color="#868e96" />
        </TouchableOpacity>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color="#adb5bd" />
      ) : null}
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f8fbff',
    borderWidth: 1,
    borderColor: '#d0ebff',
  },
  thumbnail: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#e9ecef' },
  thumbnailPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7f5ff' },
  body: { flex: 1, minWidth: 0 },
  label: { fontSize: 10, fontWeight: '800', color: '#4dabf7', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontSize: 14, fontWeight: '700', color: '#333', marginTop: 1 },
  meta: { fontSize: 12, color: '#868e96', marginTop: 2 },
});

export default AportacionCard;
