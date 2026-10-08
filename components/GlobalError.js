/**
 * GlobalError.js
 *
 * Banner animado flotante que detecta el estado de la conexión a internet
 * y muestra feedback visual al usuario:
 *
 *  🔴 Sin conexión  → banner rojo desliza desde arriba con ícono y texto
 *  🟢 Reconectado   → banner verde aparece 2 segundos y desaparece solo
 *
 * Uso: envuelve la app en App.js con <GlobalErrorContext.Provider> y
 *      monta <GlobalError /> dentro del NavigationContainer.
 */

import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { GlobalErrorContext } from '../App';

// Altura del banner (ajusta si cambias el padding)
const BANNER_HEIGHT = 48;

// useNativeDriver no está disponible en web — usamos JS-based animation
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

const GlobalError = () => {
  const { isConnected } = useContext(GlobalErrorContext);

  // 'offline' | 'restored' | null. El aviso verde se oculta solo tras 2.5 s.
  const [mode, setMode] = useState(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      wasOffline.current = true;
      setMode('offline');
      return undefined;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      setMode('restored');
      const t = setTimeout(() => setMode(null), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isConnected]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: mode ? 1 : 0,
      duration: 250,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [mode, slideAnim]);
  // Transforma la animación en movimiento vertical
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-BANNER_HEIGHT - 10, 0],
  });

  // Color del banner según el estado
  const backgroundColor = mode !== 'offline' ? '#2ecc71' : '#e74c3c';
  const icon = mode !== 'offline' ? '✓' : '✕';
  const message = mode !== 'offline' ? 'Conexión restaurada' : 'Sin conexión a internet';

  // En web no hay StatusBar nativa — compensamos el offset
  const topOffset = Platform.OS === 'web' ? 0 : (StatusBar.currentHeight || 0);

  if (!mode) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        {
          backgroundColor,
          transform: [{ translateY }],
          top: topOffset,
          // pointerEvents como style (props.pointerEvents está deprecado en RN Web)
          pointerEvents: 'none',
        },
      ]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 20,
    // Sombra sutil para que se vea sobre el contenido
    // boxShadow para web, shadow* para nativo (StyleSheet los maneja ambos)
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.25)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
    }),
  },
  icon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default GlobalError;
