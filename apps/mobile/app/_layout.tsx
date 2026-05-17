import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
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

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  // Ensure any route can link back to `/`
  initialRouteName: 'dashboard',
};

// Auth gate: redirects unauthenticated users to /login
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = router.canGoBack() ? true : true; // Fallback
  
  // Expo Router safe navigation check
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  useEffect(() => {
    setIsNavigationReady(true);
  }, []);

  useEffect(() => {
    if (loading || !isNavigationReady) return;

    const inAuthGroup = segments[0] === 'login';
    const root = segments[0] as string | undefined;
    const tab = segments[1] as string | undefined;
    const isPublicRoute =
      root === undefined ||
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
  }, [user, loading, segments, isNavigationReady]);

  if (loading || !isNavigationReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617' }}>
        <ActivityIndicator size="large" color="#d4af37" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  console.log('RootLayout rendering...');
  const colorScheme = useColorScheme();

  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  console.log('Fonts loaded:', fontsLoaded, 'Font error:', fontError);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      console.log('Hiding splash screen...');
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    console.log('Still waiting for fonts...');
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate>
          <Stack screenOptions={{
            headerBackTitle: '',
            headerTintColor: '#0f172a',
            headerStyle: { backgroundColor: 'transparent' },
            headerShadowVisible: false,
            headerTransparent: true,
          }}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
        </AuthGate>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
