/**
 * screens/MapScreen.web.js
 *
 * Pestaña Mapa en el navegador: react-native-maps no funciona en la web, así que se
 * muestra OpenStreetMap, centrado en la persona cuando se conoce su ubicación.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import LocationNotice from '@components/LocationNotice';
import { useUserLocation } from '@hooks/useUserLocation';
import { DEFAULT_REGION, USER_REGION_DELTA } from '../utils/mapConfig';

export function openStreetMapUrl(coords) {
  const { latitude, longitude } = coords || DEFAULT_REGION;
  const delta = coords ? USER_REGION_DELTA : DEFAULT_REGION.latitudeDelta;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(',');
  const marker = coords ? `&marker=${latitude},${longitude}` : '';
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${marker}`;
}

const MapScreen = () => {
  const location = useUserLocation();
  return (
    <View style={styles.container}>
      <iframe title="Mapa" src={openStreetMapUrl(location.coords)} style={{ border: 0, flex: 1, width: '100%', height: '100%' }} />
      <LocationNotice location={location} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default MapScreen;
