import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { haptic as playHaptic } from '@/lib/haptics';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { MidnightColors } from '@/constants/theme';
import { Radius } from '@/constants/layout';
import { FontFamily, FontSize } from '@/constants/typography';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'md' | 'lg';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** SF Symbol name; mapped to Material Icons on Android */
  icon?: IconSymbolName;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Light haptic tap on press (default on for primary/destructive) */
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const DANGER = '#DC2626';

const VARIANTS: Record<ButtonVariant, { bg: string; border: string; text: string; spinner: string }> = {
  primary: { bg: MidnightColors.gold, border: MidnightColors.gold, text: MidnightColors.background, spinner: MidnightColors.background },
  secondary: { bg: 'rgba(202, 156, 104, 0.08)', border: 'rgba(202, 156, 104, 0.45)', text: MidnightColors.gold, spinner: MidnightColors.gold },
  ghost: { bg: 'transparent', border: 'transparent', text: MidnightColors.slate300, spinner: MidnightColors.slate300 },
  destructive: { bg: DANGER, border: DANGER, text: '#FFFFFF', spinner: '#FFFFFF' },
};

/**
 * The app's standard button: one look per variant, a 48pt+ touch target,
 * press feedback, loading and disabled states, and screen-reader support.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = true,
  haptic,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
}: ButtonProps) {
  const colors = VARIANTS[variant];
  const isDisabled = disabled || loading;
  const useHaptic = haptic ?? (variant === 'primary' || variant === 'destructive');
  const iconSize = size === 'lg' ? 18 : 16;

  const handlePress = () => {
    if (useHaptic) playHaptic('tap');
    onPress();
  };

  const iconNode = icon ? <IconSymbol name={icon} size={iconSize} color={colors.text} /> : null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={size === 'md' ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        fullWidth && styles.fullWidth,
        { backgroundColor: colors.bg, borderColor: colors.border },
        variant === 'ghost' && styles.ghost,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.spinner} />
      ) : (
        <View style={styles.content}>
          {iconPosition === 'left' && iconNode}
          <Text
            style={[styles.text, size === 'lg' ? styles.textLg : styles.textMd, { color: colors.text }, textStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {title}
          </Text>
          {iconPosition === 'right' && iconNode}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  lg: {
    minHeight: 54,
  },
  md: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  ghost: {
    borderWidth: 0,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontFamily: FontFamily.bold,
    letterSpacing: 0.2,
  },
  textLg: {
    fontSize: FontSize.callout,
  },
  textMd: {
    fontSize: FontSize.body,
  },
});
