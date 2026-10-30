/**
 * components/ViewAsBanner.js
 *
 * Franja "Viendo como @usuario" con el botón Salir. Sale en el feed, Reels y Top mientras
 * se ve la app como otra persona (ver hooks/useViewAs.js).
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setViewAs, useViewAs } from '@hooks/useViewAs';

const ViewAsBanner = ({ what = 'el feed', style }) => {
  const viewAs = useViewAs();
  if (!viewAs) return null;
  return (
    <View style={[styles.banner, style]}>
      <Ionicons name="eye-outline" size={16} color="#fff" />
      <Text style={styles.text} numberOfLines={1}>Viendo {what} como @{viewAs.username || 'usuario'}</Text>
      <TouchableOpacity onPress={() => setViewAs(null)} style={styles.exit} accessibilityLabel="Salir de ver como">
        <Text style={styles.exitText}>Salir</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1864ab' },
  text: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 13 },
  exit: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  exitText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});

export default ViewAsBanner;
