import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import api from '../api';

export const NotificationsContext = createContext({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  markOneReadLocally: () => {},
  clearUnreadLocally: () => {},
});

export const NotificationsProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('notifications/unread-count/');
      const count = Number(response.data?.unread_count ?? response.data?.count ?? 0);
      setUnreadCount(Number.isFinite(count) ? Math.max(0, count) : 0);
    } catch (error) {
      console.error('[Notifications] No se pudo cargar el contador:', error.response?.data || error.message);
    }
  }, []);

  const markOneReadLocally = useCallback(() => {
    setUnreadCount((current) => Math.max(0, current - 1));
  }, []);

  const clearUnreadLocally = useCallback(() => {
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 30000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshUnreadCount();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refreshUnreadCount]);

  const value = useMemo(() => ({
    unreadCount,
    refreshUnreadCount,
    markOneReadLocally,
    clearUnreadLocally,
  }), [unreadCount, refreshUnreadCount, markOneReadLocally, clearUnreadLocally]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};
