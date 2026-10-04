import React, { useEffect, useRef, useSyncExternalStore } from 'react';
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

const DANGER = '#DC2626';

// Cached "reduce motion" setting so the toast can skip its slide
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduceMotion = value; }).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { reduceMotion = value; });
const SUCCESS = '#22C55E';

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

function Toast({ toast }: { toast: ToastItem }) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    const timer = setTimeout(() => {
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => hideToast(toast.id));
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [progress, toast]);

  const icon = toast.type === 'error' ? 'exclamationmark.triangle.fill' : toast.type === 'info' ? 'info.circle' : 'checkmark.circle.fill';
  const iconColor = toast.type === 'error' ? DANGER : toast.type === 'info' ? MidnightColors.gold : SUCCESS;

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
          variant === 'primary' && { color: MidnightColors.background },
          variant === 'danger' && { color: '#FFFFFF' },
          variant === 'secondary' && { color: MidnightColors.white },
        ]}
        numberOfLines={1}
      >
        {button.text ?? 'OK'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: MidnightColors.deepSlate,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MidnightColors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  toastTitle: {
    color: MidnightColors.white,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginBottom: 2,
  },
  toastMessage: {
    color: MidnightColors.slate300,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: MidnightColors.deepSlate,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: MidnightColors.border,
    padding: Spacing.xl,
  },
  dialogTitle: {
    color: MidnightColors.white,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.headline,
    lineHeight: 24,
    marginBottom: 8,
  },
  dialogMessage: {
    color: MidnightColors.slate300,
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
    backgroundColor: MidnightColors.gold,
  },
  buttonDanger: {
    backgroundColor: DANGER,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 247, 235, 0.16)',
  },
  buttonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
});
