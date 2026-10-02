/**
 * ToastContext.js
 *
 * Sistema de notificaciones Toast no bloqueantes para toda la app.
 *
 * Uso:
 *   // En cualquier componente:
 *   const { showToast } = useToast();
 *   showToast('Tarea guardada', 'success');
 *   showToast('Sin conexión', 'error');
 *   showToast('Cargando...', 'info');
 *
 * Tipos disponibles: 'success' | 'error' | 'info' | 'warning'
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Offset seguro sin depender de SafeAreaProvider
const SAFE_TOP = Platform.OS === 'ios' ? 44 : Platform.OS === 'android' ? 24 : 0;

// ─── Configuración ────────────────────────────────────────────────────────────

const DURATION_MS = 3500;   // Tiempo visible antes de auto-dismiss
const ANIM_MS     = 280;    // Duración de la animación entrada/salida

const TYPE_CONFIG = {
  success: { icon: 'checkmark-circle',  bg: '#2ecc71', text: '#fff' },
  error:   { icon: 'close-circle',      bg: '#e74c3c', text: '#fff' },
  info:    { icon: 'information-circle', bg: '#4dabf7', text: '#fff' },
  warning: { icon: 'warning',           bg: '#f39c12', text: '#fff' },
};

// ─── Contexto ─────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>');
  }
  return ctx;
}

// ─── Componente Toast individual ─────────────────────────────────────────────

function ToastItem({ toast, onDismiss }) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const timerRef   = useRef(null);

  const config = TYPE_CONFIG[toast.type] ?? TYPE_CONFIG.info;

  // Animación de entrada
  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
        tension: 80,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ANIM_MS,
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(() => dismiss(), DURATION_MS);
    return () => clearTimeout(timerRef.current);
  }, []);

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: ANIM_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIM_MS,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(toast.id));
  }, [onDismiss, toast.id]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: config.bg },
        {
          transform: [{ translateY }],
          opacity,
          top: SAFE_TOP + 12,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={config.icon} size={22} color={config.text} style={styles.toastIcon} />
      <Text style={[styles.toastText, { color: config.text }]} numberOfLines={3}>
        {toast.message}
      </Text>
      <TouchableOpacity onPress={dismiss} style={styles.toastClose} accessibilityLabel="Cerrar">
        <Ionicons name="close" size={18} color={config.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

let _nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  /**
   * Muestra un toast.
   * @param {string} message - Texto a mostrar
   * @param {'success'|'error'|'info'|'warning'} type - Tipo visual
   */
  const showToast = useCallback((message, type = 'info') => {
    const id = _nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </ToastContext.Provider>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    zIndex: 9999,
    gap: 8,
  },
  toastIcon: {
    flexShrink: 0,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  toastClose: {
    padding: 2,
    flexShrink: 0,
  },
});
