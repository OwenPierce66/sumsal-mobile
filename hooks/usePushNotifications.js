import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import api from '../api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(navigationRef) {
  const receivedSub = useRef(null);
  const responseSub = useRef(null);

  useEffect(() => {
    registerForPush();

    receivedSub.current = Notifications.addNotificationReceivedListener(() => {});

    responseSub.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data ?? {};
        if (navigationRef?.isReady?.() && data.notification_id) {
          navigationRef.navigate('Notifications');
        }
      }
    );

    return () => {
      receivedSub.current?.remove();
      responseSub.current?.remove();
    };
  }, []);
}

export async function registerForPush() {
  if (!Device.isDevice) return;

  const { status: current } = await Notifications.getPermissionsAsync();
  let finalStatus = current;

  if (current !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Sumsal',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
    });
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await api.post('/push-tokens/', { token, platform: Platform.OS });
  } catch (err) {
    console.warn('[push] Error registrando token:', err?.message);
  }
}