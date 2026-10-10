import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from './api';
import { useAppStore } from './state';
export async function enablePush(prompt = true) {
  if (useAppStore.getState().mode === 'demo')
    throw new Error(
      'Push notifications require a connected account. Demo updates are available in the notification inbox.',
    );
  if (Platform.OS === 'web' || !Device.isDevice)
    throw new Error('Open Portl on an iPhone or Android device to enable push notifications.');
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('gate', {
      name: 'Gate & community',
      importance: Notifications.AndroidImportance.HIGH,
    });
  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === 'granted' || !prompt
      ? existing
      : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error('Notifications are turned off. You can enable them in your phone settings.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error('Push notifications will be available once this build is connected to EAS.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await apiRequest('/v1/devices', 'POST', { token });
  await SecureStore.setItemAsync('portl.push-token', token);
  useAppStore.setState({ pushToken: token });
}

export async function unregisterPush() {
  const token =
    useAppStore.getState().pushToken ??
    (Platform.OS === 'web' ? null : await SecureStore.getItemAsync('portl.push-token'));
  if (token) await apiRequest('/v1/devices', 'DELETE', { token });
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync('portl.push-token');
  useAppStore.setState({ pushToken: null });
}
