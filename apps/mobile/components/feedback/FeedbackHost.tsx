import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AlertButton,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MidnightColors } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';
import {
  getFeedbackState,
  hideToast,
  resolveDialog,
  setFeedbackHostMounted,
  subscribeFeedback,
  type DialogItem,
  type ToastItem,
} from '@/lib/feedback';
import { Radius, Spacing } from '@/constants/layout';
import { FontFamily, FontSize } from '@/constants/typography';

// Cached "reduce motion" setting so the toast can skip its slide
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduceMotion = value; }).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { reduceMotion = value; });

/**
 * Renders the app-wide toast and (on Android) the themed alert dialog. Mount once at the root.
 * Full-screen RN Modals cover the root, so they can mount a `toastOnly` host to show toasts above themselves.
 */
export function FeedbackHost({ toastOnly = false }: { toastOnly?: boolean }) {
  const { toast, dialogs } = useSyncExternalStore(subscribeFeedback, getFeedbackState, getFeedbackState);

  useEffect(() => {
    setFeedbackHostMounted(true);
    return () => setFeedbackHostMounted(false);
  }, []);

  return (
    <>
      {toast && <Toast key={toast.id} toast={toast} />}
      {!toastOnly && dialogs[0] && <ThemedDialog key={dialogs[0].id} dialog={dialogs[0]} />}
    </>
  );
}

function useFeedbackStyles() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  return { colors, styles };
}

function Toast({ toast }: { toast: ToastItem }) {
  const insets = useSafeAreaInsets();
  const { colors, styles } = useFeedbackStyles();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    const timer = setTimeout(() => {
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => hideToast(toast.id));
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [progress, toast]);

  const icon = toast.type === 'error' ? 'exclamationmark.triangle.fill' : toast.type === 'info' ? 'info.circle' : 'checkmark.circle.fill';
  const iconColor = toast.type === 'error' ? colors.dangerStrong : toast.type === 'info' ? colors.gold : colors.success;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastWrap,
        {
          top: insets.top + 8,
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : -24, 0] }) }],
        },
      ]}
    >
      <Pressable
        onPress={() => hideToast(toast.id)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={styles.toast}
      >
        <IconSymbol name={icon} size={20} color={iconColor} />
        <View style={{ flex: 1 }}>
          {toast.title ? <Text style={styles.toastTitle}>{toast.title}</Text> : null}
          <Text style={styles.toastMessage}>{toast.message}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ThemedDialog({ dialog }: { dialog: DialogItem }) {
  const { styles } = useFeedbackStyles();
  const cancelButton = dialog.buttons.find((button) => button.style === 'cancel');
  // Cancel goes first (left / bottom), the main action last, matching Android's native order
  const ordered = [
    ...dialog.buttons.filter((button) => button.style === 'cancel'),
    ...dialog.buttons.filter((button) => button.style !== 'cancel'),
  ];
  const stacked = ordered.length > 2;

  const handleBack = () => {
    if (cancelButton) resolveDialog(dialog.id, cancelButton);
    else if (dialog.cancelable || dialog.buttons.length === 1) resolveDialog(dialog.id, dialog.buttons.length === 1 ? dialog.buttons[0] : undefined);
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={handleBack}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dialog.cancelable ? () => resolveDialog(dialog.id, cancelButton) : undefined}
          accessible={false}
        />
        <View style={styles.dialog} accessibilityViewIsModal>
          {!!dialog.title && (
            <Text style={styles.dialogTitle} accessibilityRole="header">
              {dialog.title}
            </Text>
          )}
          {!!dialog.message && <Text style={styles.dialogMessage}>{dialog.message}</Text>}
          <View style={[styles.buttonRow, stacked && styles.buttonColumn]}>
            {(stacked ? [...ordered].reverse() : ordered).map((button, index) => (
              <DialogButton
                key={`${button.text}-${index}`}
                button={button}
                fill={!stacked}
                onPress={() => resolveDialog(dialog.id, button)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DialogButton({ button, fill, onPress }: { button: AlertButton; fill: boolean; onPress: () => void }) {
  const variant = button.style === 'cancel' ? 'secondary' : button.style === 'destructive' ? 'danger' : 'primary';
  const { colors, styles } = useFeedbackStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        fill && { flex: 1 },
        variant === 'primary' && styles.buttonPrimary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'secondary' && styles.buttonSecondary,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && { color: colors.onAccent },
          variant === 'danger' && { color: '#FFFFFF' },
          variant === 'secondary' && { color: colors.white },
        ]}
        numberOfLines={1}
      >
        {button.text ?? 'OK'}
      </Text>
    </Pressable>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10000,
    elevation: 10000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.deepSlate,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.35 : 0.18,
    shadowRadius: 16,
  },
  toastTitle: {
    color: colors.white,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginBottom: 2,
  },
  toastMessage: {
    color: colors.slate300,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  backdrop: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : colors.modalBackdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.deepSlate,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.xl,
  },
  dialogTitle: {
    color: colors.white,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.headline,
    lineHeight: 24,
    marginBottom: 8,
  },
  dialogMessage: {
    color: colors.slate300,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.goldFill,
  },
  buttonDanger: {
    backgroundColor: colors.dangerStrong,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 247, 235, 0.16)' : colors.tint(0.16),
  },
  buttonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
});
