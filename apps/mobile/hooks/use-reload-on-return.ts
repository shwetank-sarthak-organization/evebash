import { useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';

// Supabase Realtime is off, so screens that list live data (access requests) reload themselves instead (#48).

/**
 * While the screen is focused, calls `reload` when the app comes back from the background, and when a push about an
 * event (any push whose data has an eventId, e.g. "New access request") arrives while the app is open.
 * `reload` should be silent: no full-screen spinner.
 */
export function useReloadOnReturn(reload: () => void, enabled = true) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      let lastState: AppStateStatus = AppState.currentState;
      // Only background -> active: iOS goes 'inactive' for system dialogs and the notification shade
      const appStateSubscription = AppState.addEventListener('change', (state) => {
        if (state === 'active' && lastState === 'background') reloadRef.current();
        lastState = state;
      });

      const pushSubscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as Record<string, unknown> | undefined;
        if (data?.eventId) reloadRef.current();
      });

      return () => {
        appStateSubscription.remove();
        pushSubscription.remove();
      };
    }, [enabled])
  );
}
