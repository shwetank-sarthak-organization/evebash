import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Button } from '@/components/ui/Button';
import { MidnightColors } from '@/constants/theme';
import { FontFamily, FontSize } from '@/constants/typography';

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
  icon?: IconSymbolName;
  /** Optional second button under Try again */
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** In-screen error with a Retry button, used instead of an error pop-up when a list fails to load. */
export function ErrorState({
  title = "Couldn't load this",
  message = 'Check your internet connection and try again.',
  onRetry,
  retrying = false,
  icon = 'cloud.fill',
  secondaryLabel,
  onSecondary,
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]} accessibilityRole="alert">
      <View style={styles.iconRing}>
        <IconSymbol name={icon} size={26} color={MidnightColors.gold} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Button
        title="Try again"
        variant="secondary"
        size="md"
        icon="arrow.clockwise"
        fullWidth={false}
        loading={retrying}
        onPress={onRetry}
        style={styles.button}
      />
      {!!secondaryLabel && !!onSecondary && (
        <Button title={secondaryLabel} variant="ghost" size="md" fullWidth={false} onPress={onSecondary} style={styles.secondaryButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
  },
  iconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(202, 156, 104, 0.12)',
    marginBottom: 14,
  },
  title: {
    color: MidnightColors.white,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.headline,
    textAlign: 'center',
    marginBottom: 6,
  },
  message: {
    color: MidnightColors.slate400,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body2,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  button: {
    minWidth: 160,
  },
  secondaryButton: {
    marginTop: 8,
  },
});
