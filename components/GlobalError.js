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

import React, { useContext, useEffect, useRef } from 'react';
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

const GlobalError = () => {
  const { isConnected, wasDisconnected } = useContext(GlobalErrorContext);

  // Valor animado: 0 = oculto arriba, 1 = visible
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ─── Cuando cambia la conexión, anima el banner ───────────────────────────
  useEffect(() => {
    if (!isConnected) {
      // Sin conexión → deslizar hacia abajo (mostrar)
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else if (wasDisconnected) {
      // Reconectado → mostrar brevemente y ocultar
      Animated.sequence([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.delay(2000),
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
      ]).start();
    } else {
      // Conectado desde el inicio → mantener oculto
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    }
  }, [isConnected, wasDisconnected, slideAnim]);

  // Transforma la animación en movimiento vertical
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-BANNER_HEIGHT - 10, 0],
  });

  // Color del banner según el estado
  const backgroundColor = isConnected ? '#2ecc71' : '#e74c3c';
  const icon = isConnected ? '✓' : '✕';
  const message = isConnected ? 'Conexión restaurada' : 'Sin conexión a internet';

  // En web no hay StatusBar nativa — compensamos el offset
  const topOffset = Platform.OS === 'web' ? 0 : (StatusBar.currentHeight || 0);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor,
          transform: [{ translateY }],
          top: topOffset,
        },
      ]}
      pointerEvents="none"
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
