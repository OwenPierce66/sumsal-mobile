/**
 * ErrorBoundary.js
 *
 * Componente de clase que captura errores de render no controlados en el árbol
 * de componentes hijo. Si React lanza un error durante el render, este componente
 * muestra una pantalla de recuperación en lugar de una pantalla blanca.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureError } from '../sentry';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el estado para que el siguiente render muestre la UI de fallback
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Reportar a Sentry en producción
    captureError(error, { boundary: 'ErrorBoundary', componentStack: errorInfo?.componentStack?.slice(0, 200) ?? '' });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = __DEV__;
    const errorMessage = this.state.error?.message || 'Error desconocido';
    const componentStack = this.state.errorInfo?.componentStack || '';

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Ionicons name="warning-outline" size={64} color="#e74c3c" style={styles.icon} />

          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.subtitle}>
            Ocurrió un error inesperado. Puedes intentar reiniciar la pantalla.
          </Text>

          {isDev && (
            <View style={styles.debugBox}>
              <Text style={styles.debugLabel}>Error (modo desarrollo):</Text>
              <Text style={styles.debugText} numberOfLines={6}>
                {errorMessage}
              </Text>
              {componentStack ? (
                <Text style={styles.debugStack} numberOfLines={10}>
                  {componentStack.trim()}
                </Text>
              ) : null}
            </View>
          )}

          <TouchableOpacity style={styles.resetButton} onPress={this.handleReset}>
            <Ionicons name="refresh-outline" size={20} color="#fff" />
            <Text style={styles.resetText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#222',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  debugBox: {
    width: '100%',
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#ffd0d0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 28,
  },
  debugLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#c0392b',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  debugText: {
    fontSize: 12,
    color: '#c0392b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 8,
  },
  debugStack: {
    fontSize: 10,
    color: '#888',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4dabf7',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  resetText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ErrorBoundary;
