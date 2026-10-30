/**
 * hooks/useUserLocation.js
 *
 * Pide la ubicación (solo mientras se usa la app) y lee dónde está la persona.
 * - status: 'checking' | 'granted' | 'denied' (se puede volver a pedir) | 'blocked' (solo en Ajustes).
 * - unavailable: hay permiso pero no se pudo leer la posición (p. ej. el GPS está apagado).
 */
import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

const toCoords = (position) => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
});

export function useUserLocation() {
  const [status, setStatus] = useState('checking');
  const [coords, setCoords] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  const readPosition = useCallback(async () => {
    setUnavailable(false);
    let found = false;
    try {
      // La última conocida es inmediata; la actual puede tardar unos segundos.
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        found = true;
        setCoords(toCoords(last));
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      found = true;
      setCoords(toCoords(current));
    } catch {
      if (!found) setUnavailable(true);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    setStatus('checking');
    try {
      const { status: result, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (result === 'granted') {
        setStatus('granted');
        await readPosition();
        return;
      }
      setStatus(canAskAgain === false ? 'blocked' : 'denied');
    } catch {
      setStatus('denied');
    }
  }, [readPosition]);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return { status, coords, unavailable, requestPermission, readPosition };
}
