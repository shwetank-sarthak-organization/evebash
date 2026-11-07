import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAppTheme } from '@/context/ThemeContext';

/** Shown for a link or notification that points at a page the app doesn't have (issue #191), instead of the router's plain "Unmatched Route" page */
export default function NotFoundScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const canGoBack = router.canGoBack();
  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ErrorState
        title="Page not found"
        message="This link goes to a page that doesn't exist or has moved."
        icon="questionmark.circle.fill"
        retryLabel="Go to Home"
        retryIcon="house.fill"
        onRetry={() => router.replace('/(tabs)/dashboard')}
        secondaryLabel={canGoBack ? 'Go back' : undefined}
        onSecondary={canGoBack ? () => router.back() : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
  },
});
