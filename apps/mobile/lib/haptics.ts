import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'error';

const ANDROID_EFFECTS: Record<HapticKind, Haptics.AndroidHaptics> = {
  tap: Haptics.AndroidHaptics.Virtual_Key,
  select: Haptics.AndroidHaptics.Clock_Tick,
  success: Haptics.AndroidHaptics.Confirm,
  warning: Haptics.AndroidHaptics.Reject,
  error: Haptics.AndroidHaptics.Reject,
};

// Confirm / Reject only exist on Android 11+; these are available on every version
const ANDROID_FALLBACKS: Record<HapticKind, Haptics.AndroidHaptics> = {
  tap: Haptics.AndroidHaptics.Virtual_Key,
  select: Haptics.AndroidHaptics.Clock_Tick,
  success: Haptics.AndroidHaptics.Context_Click,
  warning: Haptics.AndroidHaptics.Long_Press,
  error: Haptics.AndroidHaptics.Long_Press,
};

/**
 * Light feedback for meaningful actions. Fire-and-forget; never throws.
 * Android uses the system haptic constants, so it follows the phone's own
 * "touch feedback" setting instead of buzzing the vibration motor.
 */
export function haptic(kind: HapticKind) {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(ANDROID_EFFECTS[kind])
      .catch(() => Haptics.performAndroidHapticsAsync(ANDROID_FALLBACKS[kind]))
      .catch(() => {});
    return;
  }
  if (Platform.OS !== 'ios') return;

  const run =
    kind === 'tap' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    : kind === 'select' ? Haptics.selectionAsync()
    : kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : kind === 'warning' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  run.catch(() => {});
}
