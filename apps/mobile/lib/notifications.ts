import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase } from './supabase';

let Notifications: any = null;
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    if (Notifications) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch (e) {
    console.warn('[Notifications] Failed to load expo-notifications:', e);
  }
} else {
  console.log('[Notifications] Running in Expo Go or Web. Remote push notifications are disabled.');
}

export async function registerDeviceForPushNotifications(userId: string): Promise<string | null> {
  if (!userId) return null;

  if (Platform.OS === 'web' || isExpoGo || !Notifications) {
    console.log('[Notifications] Push notifications are not supported in Expo Go, Web, or if Native Module is missing.');
    return null;
  }

  try {
    // 1. Check & Request Permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Failed to get push token: Permission not granted.');
      return null;
    }

    // 2. Fetch Expo Push Token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.warn(
        '[Notifications] Expo Project ID (EAS Project ID) is not set in app.json. Fetching token might fail.'
      );
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    
    const token = tokenData.data;
    console.log('[Notifications] Push token retrieved successfully:', token);

    // 3. Update Android notification channels
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7A',
      });
    }

    // 4. Save to User Profile in Supabase directly without circular import
    const { error: updateError } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
    const success = !updateError;
    if (success) {
      console.log('[Notifications] Device push token successfully registered in database.');
    } else {
      console.warn('[Notifications] Failed to register device push token in database.');
    }
    devicePushToken = token;
    await claimPushToken(token);

    return token;
  } catch (error: any) {
    if (error?.code === 'E_REGISTRATION_FAILED' || (error?.message && error.message.includes('native push service'))) {
      console.log('[Notifications] Push notifications skipped: Native push service is not configured yet.');
    } else {
      console.warn('[Notifications] Could not register push token:', error?.message || error);
    }
    return null;
  }
}

// This phone's Expo push token, once registerDeviceForPushNotifications has read it
let devicePushToken: string | null = null;

/**
 * Asks the backend to take this phone's token off every other account (issue #104), so a phone only gets the pushes
 * of the account signed in on it. Other accounts' profiles aren't writable from the app once RLS is on. Best effort:
 * if it fails, the token is still saved on this account as before.
 */
async function claimPushToken(token: string) {
  try {
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
    const { data: { session } } = await supabase.auth.getSession();
    if (!apiBaseUrl || !session?.access_token) return;
    const response = await fetch(`${apiBaseUrl}/api/v1/notifications/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) console.warn('[Notifications] Could not move the push token to this account:', response.status);
  } catch (error) {
    console.warn('[Notifications] Could not move the push token to this account:', error);
  }
}

/**
 * Called on logout, before the session ends: takes this phone's push token off the account, so the phone stops
 * getting that account's pushes (issue #104). Only clears it when the account still holds this phone's token, so
 * logging out here never stops pushes to the account's other phone. Best effort, and gives up after 3 s so logout
 * never waits on it.
 */
export async function releasePushToken(userId: string | undefined): Promise<void> {
  if (!userId || Platform.OS === 'web' || isExpoGo || !Notifications) return;
  const release = async () => {
    let token = devicePushToken;
    if (!token) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      token = (await Notifications.getExpoPushTokenAsync({ projectId: projectId || undefined })).data;
    }
    const { error } = await supabase.from('profiles').update({ push_token: null }).eq('id', userId).eq('push_token', token);
    if (error) console.warn('[Notifications] Could not remove the push token on logout:', error.message);
    devicePushToken = null;
  };
  try {
    await Promise.race([release(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  } catch (error) {
    console.warn('[Notifications] Could not remove the push token on logout:', error);
  }
}

export async function sendPushNotificationDirectly(
  recipientId: string,
  title: string,
  body: string,
  data?: object,
  preferenceType?: 'likesAndComments' | 'eventInvites' | 'businessMatches' | 'marketing'
): Promise<boolean> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, notification_preferences')
      .eq('id', recipientId)
      .maybeSingle();

    if (error || !profile || !profile.push_token) return false;

    if (preferenceType && profile.notification_preferences) {
      const prefs = typeof profile.notification_preferences === 'string'
        ? JSON.parse(profile.notification_preferences)
        : profile.notification_preferences;

      if (prefs && prefs[preferenceType] === false) {
        return false;
      }
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: profile.push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
      }),
    });

    return response.ok;
  } catch (e) {
    console.warn('[Notifications] sendPushNotificationDirectly failed:', e);
    return false;
  }
}
