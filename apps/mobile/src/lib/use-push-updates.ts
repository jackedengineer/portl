import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from './state';
import { enablePush } from './push';
export function usePushUpdates() {
  const { mode, profile } = useAppStore(),
    cache = useQueryClient();
  useEffect(() => {
    if (mode !== 'live' || !profile || Platform.OS === 'web' || Constants.appOwnership === 'expo')
      return;
    let cancelled = false;
    const subscriptions: { remove: () => void }[] = [];
    void import('expo-notifications')
      .then(async (Notifications) => {
        if (cancelled) return;
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
        subscriptions.push(
          Notifications.addNotificationReceivedListener(() => {
            void cache.invalidateQueries({ queryKey: ['overview'] });
          }),
        );
        subscriptions.push(
          Notifications.addNotificationResponseReceivedListener((response) => {
            const societyId = response.notification.request.content.data?.societyId;
            const state = useAppStore.getState();
            const member = state.profile?.memberships.find((m) => m.society.id === societyId);
            if (member)
              state.setContext(
                member.society.id,
                member.roles.includes(state.role) ? state.role : member.roles[0]!,
              );
            void cache.invalidateQueries({ queryKey: ['overview'] });
          }),
        );
        await enablePush(false).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      subscriptions.forEach((s) => s.remove());
    };
  }, [mode, profile, cache]);
}
