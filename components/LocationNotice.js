/**
 * components/LocationNotice.js
 *
 * Aviso sobre el mapa cuando no se puede mostrar dónde estás: explica por qué y da la
 * acción que sirve (volver a pedir el permiso, abrir Ajustes o reintentar).
 */
import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const describe = ({ status, unavailable, requestPermission, readPosition }) => {
  if (status === 'denied') {
    return { message: 'Activa tu ubicación para verte en el mapa.', action: 'Permitir', onPress: requestPermission };
  }
  if (status === 'blocked') {
    // Una página web no puede abrir los ajustes del navegador.
    if (Platform.OS === 'web') return { message: 'Permite la ubicación en los ajustes de tu navegador para verte en el mapa.' };
    return { message: 'Activa tu ubicación en Ajustes para verte en el mapa.', action: 'Abrir Ajustes', onPress: () => Linking.openSettings() };
  }
  if (unavailable) {
    return { message: 'No pudimos obtener tu ubicación. Revisa que el GPS esté encendido.', action: 'Reintentar', onPress: readPosition };
  }
  return null;
};

const LocationNotice = ({ location }) => {
  const notice = describe(location);
  if (!notice) return null;
  return (
    <View style={styles.notice}>
      <Text style={styles.message}>{notice.message}</Text>
      {notice.action ? (
        <TouchableOpacity onPress={notice.onPress} accessibilityRole="button">
          <Text style={styles.action}>{notice.action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  notice: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: '#fff', elevation: 4 },
  message: { flex: 1, color: '#343a40', fontSize: 14 },
  action: { color: '#4dabf7', fontSize: 14, fontWeight: '800' },
});

export default LocationNotice;
