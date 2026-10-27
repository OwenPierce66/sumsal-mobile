/**
 * hooks/useSubscriptionCheckout.js
 *
 * Abre el pago de Stripe Checkout en el navegador y, al volver a la app,
 * confirma con el backend si ya quedó pagado (sin esperar al webhook).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import api from '@api';
import { invalidateUserBadges } from './useUserBadges';

// Si la persona vuelve varias veces sin pagar, se deja de preguntar.
const MAX_SYNC_ATTEMPTS = 5;

export function useSubscriptionCheckout() {
  const queryClient = useQueryClient();
  const pendingRef = useRef(null);
  const [isStarting, setIsStarting] = useState(false);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['subscriptionStatus'] });
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['me'] });
    // La insignia de suscripción junto a los nombres también cambia.
    invalidateUserBadges();
  }, [queryClient]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', async (state) => {
      const pending = pendingRef.current;
      if (state !== 'active' || !pending) return;
      pending.attempts += 1;
      try {
        const { data } = await api.post(`subscriptions/${pending.id}/sync/`);
        if (data?.is_active || pending.attempts >= MAX_SYNC_ATTEMPTS) pendingRef.current = null;
      } catch {
        if (pending.attempts >= MAX_SYNC_ATTEMPTS) pendingRef.current = null;
      } finally {
        refresh();
      }
    });
    return () => listener.remove();
  }, [refresh]);

  /** body: { amount, currency, auto_renew, recipient_id? }. Lanza el error del backend. */
  const startCheckout = useCallback(async (body) => {
    setIsStarting(true);
    try {
      const { data } = await api.post('subscriptions/checkout/', body);
      pendingRef.current = data.subscription?.id ? { id: data.subscription.id, attempts: 0 } : null;
      await Linking.openURL(data.checkout_url);
      return data.subscription;
    } finally {
      setIsStarting(false);
    }
  }, []);

  return { startCheckout, isStarting };
}
