/**
 * screens/MapScreen.js
 *
 * Pestaña Mapa: Google Maps con el punto azul y el botón "mi ubicación". Al abrirla pide
 * el permiso y se centra en la persona. La versión web está en MapScreen.web.js, porque
 * react-native-maps no funciona en el navegador.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import LocationNotice from '@components/LocationNotice';
import { useUserLocation } from '@hooks/useUserLocation';
import { DEFAULT_REGION, StarLightTheme, USER_REGION_DELTA } from '../utils/mapConfig';

const MapScreen = () => {
  const mapRef = useRef(null);
  const location = useUserLocation();
  const { status, coords } = location;
  // Android solo los activa si el permiso ya está concedido.
  const granted = status === 'granted';

  useEffect(() => {
    if (!coords) return;
    mapRef.current?.animateToRegion(
      { ...coords, latitudeDelta: USER_REGION_DELTA, longitudeDelta: USER_REGION_DELTA },
      600,
    );
  }, [coords]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={StarLightTheme}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={granted}
        showsMyLocationButton={granted}
        showsCompass
        rotateEnabled
      />
      <LocationNotice location={location} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
});

export default MapScreen;
