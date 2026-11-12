import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useGlobalSearchParams, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { safeReturnTo } from '@/lib/loginReturn';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { LogBox, Platform, View } from 'react-native';
import { MidnightColors } from '@/constants/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LoadingScreen from '@/components/LoadingScreen';
import AppIntro from '@/components/intro/AppIntro';
import { FeedbackHost } from '@/components/feedback/FeedbackHost';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppThemeProvider, DarkThemeScope, StatusBarOverrideContext, useAppTheme, type StatusBarLook } from '@/context/ThemeContext';
import * as SystemUI from 'expo-system-ui';
import * as SplashScreen from 'expo-splash-screen';
import { initUploadQueue } from '@/lib/uploadQueue';
import { registerDeviceForPushNotifications } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import { SCREEN_ORIENTATION_LOCK, lockScreenOrientation } from '@/lib/screenOrientation';
import { markStartup } from '@/lib/startupTiming';
import { useFonts } from 'expo-font';
// Import each weight from its own file: the package root require()s all 18 weights into the bundle (#105).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Inter_900Black } from '@expo-google-fonts/inter/900Black';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// The native splash is a plain background; it hides as soon as the app-open animation draws its
// first frame (AppIntro), and never later than this in case the animation can't draw.
const SPLASH_MAX_MS = 2000;
let splashHidden = false;

function hideSplash(reason: 'intro' | 'ready' | 'timeout') {
  if (splashHidden) return;
  splashHidden = true;
  markStartup(`splash hidden (${reason})`);
  SplashScreen.hideAsync();
}

LogBox.ignoreLogs([
  "Can't perform a React state update on a component that hasn't mounted yet",
  'AuthRetryableFetchError',
  'network_request_failed',
  'Could not reach Supabase backend',
  'Backend didn\'t respond within 10 seconds',
  'backTitle prop is not available on Android',
  'backTitleFontFamily prop is not available on Android',
  'backTitleVisible prop is not available on Android',
  'disableBackButtonMenu prop is not available on Android',
  'largeTitleFontFamily prop is not available on Android',
  'largeTitleFontWeight prop is not available on Android',
  'largeTitleHideShadow prop is not available on Android',
  'topInsetEnabled prop is not available on Android',
  'userInterfaceStyle prop is not available on Android',
]);

// A screen that fails to draw shows an error page instead of closing the app (#184)
export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ui/ScreenErrorBoundary';

// Screens that keep the dark look whatever the Appearance choice (todo #1): the login screens (left as they are, like the
// website's), guest galleries with their own themes, Vault, and the Phase 2 business pages
const DARK_LOOK_ROUTES = new Set(['login', 'forgot-password', 'events', 'chat', 'customer-chats', 'business-enquiries', 'business-near-you', 'business-portfolio', 'shortlist', 'profile']);
const DARK_LOOK_TAB_ROUTES = new Set(['vault', 'businesses', 'explore-business', 'manage-business', 'business']);

function routeKeepsDarkLook(segments: string[]): boolean {
  // Before the first screen: the dark loading screen
  if (segments.length === 0) return true;
  if (segments[0] === '(tabs)') return DARK_LOOK_TAB_ROUTES.has(segments[1] ?? '');
  return DARK_LOOK_ROUTES.has(segments[0] ?? '');
}

export const unstable_settings = {
  // Ensure any route can link back to `/`
  initialRouteName: 'dashboard',
};

// Auth gate: redirects unauthenticated users to /login
function AuthGate({ children, onReady }: { children: React.ReactNode; onReady: () => void }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { returnTo } = useGlobalSearchParams<{ returnTo?: string }>();
  // Login opened from a gallery: the login screen returns there itself
  const loginReturnsToGallery = !!safeReturnTo(returnTo);

  useEffect(() => {
    if (loading || !rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === 'login';
    const root = segments[0] as string | undefined;
    const tab = segments[1] as string | undefined;
    
    // Improved public route check
    const isPublicRoute =
      root === undefined ||
      root === 'login' ||
      // Linked from the login screen, and people who can't sign in are the ones who need it
      root === 'forgot-password' ||
      (root === '(tabs)' && (tab === undefined || tab === 'gallery' || tab === 'menu' || tab === 'business')) ||
      root === 'business' ||
      root === 'profile' ||
      root === 'pricing' ||
      root === 'contact' ||
      root === 'sample-galleries' ||
      root === 'events' ||
      // Legal pages are linked from the login screen, so they must open while signed out
      root === 'terms-and-conditions' ||
      root === 'privacy-policy';

    if (!user && !inAuthGroup && !isPublicRoute) {
      const timeoutId = setTimeout(() => router.replace('/login'), 1);
      return () => clearTimeout(timeoutId);
    } else if (user && inAuthGroup && !loginReturnsToGallery) {
      const timeoutId = setTimeout(() => router.replace('/(tabs)/dashboard'), 1);
      return () => clearTimeout(timeoutId);
    }
  }, [user, loading, segments, rootNavigationState?.key, router, loginReturnsToGallery]);

  // Register push notifications when user is signed in
  useEffect(() => {
    if (user?.uid) {
      registerDeviceForPushNotifications(user.uid);
    }
  }, [user?.uid]);

  // Handle notification taps — route user to the right screen
  useEffect(() => {
    const openFromNotification = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.roomId) {
        router.push({ pathname: '/chat', params: { roomId: data.roomId, ...(data.senderName ? { otherUserName: data.senderName } : {}) } });
      } else if (data?.type === 'album_proof' && data.eventId) {
        router.push(`/events/${data.eventId}?tab=album${data.albumId ? `&album=${data.albumId}` : ''}` as any);
      } else if (data?.type === 'event_transfer') {
        // Transfer requests show on the Dashboard; the receiver can't open the event itself until they accept
        router.push('/(tabs)/dashboard');
      } else if (data?.eventId) {
        router.push(`/events/${data.eventId}` as any);
      } else if (data?.enquiryId && data.businessId) {
        // Enquiry pushes sent before businessId was added can't open the page, which needs the business
        router.push({ pathname: '/business-enquiries', params: { id: data.businessId } });
      }
    };

    // Handle tap when app is already open
    const tapSubscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);

    // Handle tap when app was closed / in background
    Notifications.getLastNotificationResponseAsync().then(openFromNotification);

    return () => tapSubscription.remove();
  }, [router]);

  useEffect(() => {
    if (!loading && rootNavigationState?.key) {
      hideSplash('ready');
      onReady();
    }
  }, [loading, rootNavigationState?.key, onReady]);

  if (loading || !rootNavigationState?.key) {
    return <LoadingScreen message="Loading your account" />;
  }

  return <>{children}</>;
}

function RootLayoutContent({ onReady }: { onReady: () => void }) {
  const { isDark, colors } = useAppTheme();
  const keepsDarkLook = routeKeepsDarkLook(useSegments());
  // Set by the host's event screen, whose top is a cover photo and then the page (see useStatusBarOverride)
  const [statusBarOverride, setStatusBarOverride] = useState<StatusBarLook | null>(null);

  // The window behind the screens follows the look (the dark one matches app.json's backgroundColor)
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  useEffect(() => {
    initUploadQueue().catch(err => console.error('[RootLayout] Queue init failed:', err));
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    void lockScreenOrientation(SCREEN_ORIENTATION_LOCK.PORTRAIT_UP);
  }, []);

  const customTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    dark: isDark,
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.gold,
      background: colors.background,
      card: colors.deepSlate,
      text: colors.white,
      border: colors.cardBorder,
    }
  };

  return (
    <ThemeProvider value={customTheme}>
      <StatusBarOverrideContext.Provider value={setStatusBarOverride}>
        <AuthGate onReady={onReady}>
          <Stack screenOptions={{
            ...(Platform.OS === 'ios' ? { headerBackTitle: '' } : {}),
            headerTintColor: colors.white,
            headerStyle: { backgroundColor: 'transparent' },
            headerShadowVisible: false,
            headerTransparent: true,
          }}>
            {/* Redirect-only route; without this its default header ("index") flashes at startup */}
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
        </AuthGate>
      </StatusBarOverrideContext.Provider>
      <StatusBar style={statusBarOverride ?? (isDark || keepsDarkLook ? "light" : "dark")} />
      {/* App-wide toasts and the themed alert dialog (see lib/feedback.ts) */}
      {/* A screen that sets its own status bar (the host's event screen) also follows the chosen look for toasts */}
      <DarkThemeScope enabled={keepsDarkLook && !statusBarOverride}>
        <FeedbackHost />
      </DarkThemeScope>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    Outfit_400Regular: Inter_400Regular,
    Outfit_500Medium: Inter_500Medium,
    Outfit_600SemiBold: Inter_600SemiBold,
    Outfit_700Bold: Inter_700Bold,
    Outfit_800ExtraBold: Inter_800ExtraBold,
    Outfit_900Black: Inter_900Black,
    PlayfairDisplay_400Regular: Inter_400Regular,
    PlayfairDisplay_400Regular_Italic: Inter_400Regular,
    PlayfairDisplay_600SemiBold: Inter_600SemiBold,
    PlayfairDisplay_700Bold: Inter_700Bold,
    VT323_400Regular: Inter_400Regular,
    TiltNeon_400Regular: Inter_400Regular,
    CormorantGaramond_400Regular: Inter_400Regular,
    CormorantGaramond_400Regular_Italic: Inter_400Regular,
    CormorantGaramond_600SemiBold: Inter_600SemiBold,
    CormorantGaramond_700Bold: Inter_700Bold,
    Lora_400Regular: Inter_400Regular,
    Lora_400Regular_Italic: Inter_400Regular,
    Lora_600SemiBold: Inter_600SemiBold,
    Lora_700Bold: Inter_700Bold,
    NunitoSans_400Regular: Inter_400Regular,
    NunitoSans_600SemiBold: Inter_600SemiBold,
    NunitoSans_700Bold: Inter_700Bold,
    Syne_700Bold: Inter_700Bold,
    CinzelDecorative_400Regular: Inter_400Regular,
    CinzelDecorative_700Bold: Inter_700Bold,
    Cinzel_400Regular: Inter_400Regular,
    Cinzel_700Bold: Inter_700Bold,
    SpaceGrotesk_400Regular: Inter_400Regular,
    SpaceGrotesk_500Medium: Inter_500Medium,
    SpaceGrotesk_600SemiBold: Inter_600SemiBold,
    SpaceGrotesk_700Bold: Inter_700Bold,
    AkayaKanadakaHeader_400Regular: require('../assets/fonts/AkayaKanadaka-Regular.ttf'),
    AkayaKanadaka_400Regular: Inter_400Regular,
    Monofett_400Regular: Inter_400Regular,
    BubblegumSans_400Regular: Inter_400Regular,
    PermanentMarker_400Regular: Inter_400Regular,
    Yellowtail_400Regular: Inter_400Regular,
    AlexBrush_400Regular: Inter_400Regular,
    Cookie_400Regular: Inter_400Regular,
    GrandHotel_400Regular: Inter_400Regular,
  });

  useEffect(() => {
    if (fontError) console.warn('[Fonts] Failed to load:', fontError);
  }, [fontError]);

  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady) markStartup('fonts ready');
  }, [fontsReady]);

  useEffect(() => {
    const timer = setTimeout(() => hideSplash('timeout'), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  // The app-open animation plays once per cold start. The account check starts right away, but the
  // screens are only built once the animation reaches the still logo: building them while it moves
  // makes it stutter.
  const [appReady, setAppReady] = useState(false);
  const [introPlayed, setIntroPlayed] = useState(Platform.OS === 'web');
  const [introDone, setIntroDone] = useState(Platform.OS === 'web');
  const markAppReady = useCallback(() => setAppReady(true), []);
  const finishIntro = useCallback(() => {
    markStartup('intro finished');
    setIntroDone(true);
  }, []);
  const introShown = useCallback(() => hideSplash('intro'), []);
  const introPlayedOut = useCallback(() => {
    markStartup('intro played');
    setIntroPlayed(true);
  }, []);

  // AuthProvider mounts before fonts finish loading so the session check starts right away
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AuthProvider>
          {!introPlayed
            ? <View style={{ flex: 1, backgroundColor: MidnightColors.background }} />
            : fontsReady ? <RootLayoutContent onReady={markAppReady} /> : <LoadingScreen message="Starting up" />}
        </AuthProvider>
      </AppThemeProvider>
      {!introDone && (
        <AppIntro ready={appReady} onFinish={finishIntro} onShown={introShown} onPlayed={introPlayedOut} />
      )}
    </GestureHandlerRootView>
  );
}

