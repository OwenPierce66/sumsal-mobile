import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@api';

/**
 * Aviso de una aportación en modo oculto (solo la ve su dueño, en su perfil)
 * con el botón para publicarla.
 */
const HiddenTaskBanner = ({ task, onPublished, compact = false }) => {
  const [publishing, setPublishing] = useState(false);
  if (!task?.is_hidden) return null;

  const publish = async () => {
    setPublishing(true);
    try {
      const { data } = await api.patch(`tasks/${task.id}/`, { is_hidden: false });
      onPublished?.(data);
      Alert.alert('¡Publicada!', 'Ahora todos pueden ver tu aportación.');
    } catch (error) {
      Alert.alert('No se pudo publicar', error?.response?.data?.detail || 'Intenta de nuevo en un momento.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={[styles.banner, compact && styles.compact]}>
      <Ionicons name="eye-off" size={16} color="#845ef7" />
      <Text style={styles.text}>
        {compact ? 'Oculta · solo tú la ves' : 'Oculta: solo tú la ves en tu perfil. Así se vería publicada.'}
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={publish}
        disabled={publishing}
        accessibilityRole="button"
        accessibilityLabel="Publicar aportación"
      >
        {publishing ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>Publicar</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginBottom: 10,
    borderRadius: 12, backgroundColor: '#f3f0ff', borderWidth: 1, borderColor: '#e5dbff',
  },
  compact: { padding: 8 },
  text: { flex: 1, fontSize: 12, fontWeight: '600', color: '#5f3dc4' },
  button: { minWidth: 76, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#845ef7' },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

export default HiddenTaskBanner;
