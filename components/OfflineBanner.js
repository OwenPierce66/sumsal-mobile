/**
 * components/OfflineBanner.js
 *
 * Franja global "Sin conexión" visible mientras no hay red. Se monta una sola
 * vez en App.js. Respeta el área segura superior y no intercepta toques.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useIsOnline } from '../hooks/useIsOnline';

export default function OfflineBanner() {
  const isOnline = useIsOnline();
  if (isOnline) return null;

  return (
    <View style={styles.banner} pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.text}>Sin conexión · mostrando datos guardados</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'web' ? 0 : 56,
    zIndex: 9999,
    backgroundColor: '#343a40',
    paddingVertical: 6,
    alignItems: 'center',
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
