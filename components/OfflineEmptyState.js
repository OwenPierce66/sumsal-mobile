/**
 * components/OfflineEmptyState.js
 *
 * Estado vacío para listas que no cargaron. Por defecto indica falta de
 * conexión; con `offline={false}` muestra un error genérico con reintento.
 * Evita mensajes engañosos como "No hay posts aún" cuando en realidad la
 * lista no cargó. `dark` adapta los colores a pantallas con fondo negro.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OfflineEmptyState({ onRetry, message, offline = true, dark = false }) {
  const titleColor = dark ? '#f1f3f5' : '#555';
  const textColor = dark ? '#adb5bd' : '#999';
  const iconColor = dark ? '#868e96' : '#ccc';
  const defaultMessage = offline
    ? 'No hay datos guardados para mostrar. Revisa tu conexión e inténtalo de nuevo.'
    : 'Ocurrió un problema al cargar. Inténtalo de nuevo.';

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={56} color={iconColor} />
      <Text style={[styles.title, { color: titleColor }]}>{offline ? 'Sin conexión' : 'No se pudo cargar'}</Text>
      <Text style={[styles.subtitle, { color: textColor }]}>{message || defaultMessage}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.button} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.buttonText}>Reintentar</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 50, paddingHorizontal: 32 },
  title: { marginTop: 16, fontSize: 16, fontWeight: '700' },
  subtitle: { marginTop: 6, fontSize: 13, textAlign: 'center' },
  button: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#4dabf7',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
