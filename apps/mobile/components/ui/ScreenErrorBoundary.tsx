import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAppTheme } from '@/context/ThemeContext';
import { reportError } from '@/lib/sentry';

/**
 * Shown instead of closing the app when a screen fails to draw (issue #184). A route turns it on by exporting it as
 * ErrorBoundary. The root layout's copy sits outside the theme and auth providers, so nothing here can use auth; the
 * theme falls back to the dark look there (useAppTheme).
 * It only catches errors while drawing: one thrown in a button press or a timer doesn't reach it.
 */
export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();
  const { colors } = useAppTheme();

  useEffect(() => {
    console.error('[ScreenErrorBoundary] Screen failed to draw:', error);
    reportError(error);
  }, [error]);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/dashboard');
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      {/* A failed screen never sets its own header, which would leave the raw route name showing */}
      <Stack.Screen options={{ headerShown: false }} />
      <ErrorState
        title="Something went wrong"
        message="This page couldn't open. Try again, or go back."
        icon="exclamationmark.triangle.fill"
        onRetry={() => void retry()}
        secondaryLabel="Go back"
        onSecondary={leave}
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
