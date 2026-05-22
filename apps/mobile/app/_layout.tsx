import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, LogBox, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import * as SplashScreen from 'expo-splash-screen';
import { 
  useFonts, 
  Outfit_400Regular, 
  Outfit_600SemiBold, 
  Outfit_700Bold, 
  Outfit_800ExtraBold 
} from '@expo-google-fonts/outfit';
import { 
  Inter_400Regular, 
  Inter_500Medium, 
  Inter_600SemiBold, 
  Inter_700Bold 
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold
} from '@expo-google-fonts/playfair-display';
import {
  VT323_400Regular
} from '@expo-google-fonts/vt323';
import {
  TiltNeon_400Regular
} from '@expo-google-fonts/tilt-neon';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_600SemiBold,
  Lora_700Bold,
} from '@expo-google-fonts/lora';
import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import {
  Syne_700Bold
} from '@expo-google-fonts/syne';
import {
  CinzelDecorative_400Regular,
  CinzelDecorative_700Bold
} from '@expo-google-fonts/cinzel-decorative';
import {
  Cinzel_400Regular,
  Cinzel_700Bold
} from '@expo-google-fonts/cinzel';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs([
  '@firebase/firestore: Firestore',
  'Could not reach Cloud Firestore backend',
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

export const unstable_settings = {
  // Ensure any route can link back to `/`
  initialRouteName: 'dashboard',
};

// Auth gate: redirects unauthenticated users to /login
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { colors } = useAppTheme();

  useEffect(() => {
    if (loading || !rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === 'login';
    const root = segments[0] as string | undefined;
    const tab = segments[1] as string | undefined;
    
    // Improved public route check
    const isPublicRoute =
      root === undefined ||
      root === 'login' ||
      (root === '(tabs)' && (tab === undefined || tab === 'index' || tab === 'gallery' || tab === 'menu')) ||
      root === 'pricing' ||
      root === 'contact' ||
      root === 'sample-galleries' ||
      root === 'events';

    if (!user && !inAuthGroup && !isPublicRoute) {
      setTimeout(() => router.replace('/login'), 1);
    } else if (user && inAuthGroup) {
      setTimeout(() => router.replace('/(tabs)/dashboard'), 1);
    }
  }, [user, loading, segments, rootNavigationState?.key]);

  if (loading || !rootNavigationState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutContent() {
  const { isDark, colors } = useAppTheme();

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
      <AuthGate>
        <Stack screenOptions={{
          ...(Platform.OS === 'ios' ? { headerBackTitle: '' } : {}),
          headerTintColor: colors.white,
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          headerTransparent: true,
        }}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      </AuthGate>
      <StatusBar style={isDark ? "light" : "dark"} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    VT323_400Regular,
    TiltNeon_400Regular,
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_600SemiBold,
    Lora_700Bold,
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    Syne_700Bold,
    CinzelDecorative_400Regular,
    CinzelDecorative_700Bold,
    Cinzel_400Regular,
    Cinzel_700Bold,
    'Monofett_400Regular': require('../assets/fonts/Monofett-Regular.ttf'),
    'BubblegumSans_400Regular': require('../assets/fonts/BubblegumSans-Regular.ttf'),
    'PermanentMarker_400Regular': require('../assets/fonts/PermanentMarker-Regular.ttf'),
    'Yellowtail_400Regular': require('../assets/fonts/Yellowtail-Regular.ttf'),
    'AlexBrush_400Regular': require('../assets/fonts/AlexBrush-Regular.ttf'),
    'Cookie_400Regular': require('../assets/fonts/Cookie-Regular.ttf'),
    'GrandHotel_400Regular': require('../assets/fonts/GrandHotel-Regular.ttf'),
  });

  console.log('--- Font Diagnostics ---');
  console.log('fontsLoaded:', fontsLoaded);
  console.log('fontError:', fontError);
  console.log('------------------------');

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // We still wait for Auth in AuthGate before showing content, 
      // but we hide splash once fonts are ready to avoid deadlocks.
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    console.log('Still waiting for fonts...');
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AuthProvider>
          <RootLayoutContent />
        </AuthProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
