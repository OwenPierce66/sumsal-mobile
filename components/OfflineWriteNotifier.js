/**
 * components/OfflineWriteNotifier.js
 *
 * No renderiza nada. Escucha los fallos de escritura por falta de conexión
 * (emitidos desde api.js) y muestra un toast explicativo.
 * Debe montarse dentro de <ToastProvider>.
 */
import { useEffect, useRef } from 'react';
import { useToast } from '@contexts/ToastContext';
import { onOfflineWrite } from '../utils/offlineEvents';

// Evita apilar toasts si el usuario toca varias veces seguidas
const MIN_INTERVAL_MS = 4000;

export default function OfflineWriteNotifier() {
  const { showToast } = useToast();
  const lastShownRef = useRef(0);

  useEffect(() => {
    const unsubscribe = onOfflineWrite(() => {
      const now = Date.now();
      if (now - lastShownRef.current < MIN_INTERVAL_MS) return;
      lastShownRef.current = now;
      showToast('Sin conexión: no se pudo guardar. Inténtalo de nuevo cuando vuelva la señal.', 'warning');
    });
    return unsubscribe;
  }, [showToast]);

  return null;
}
