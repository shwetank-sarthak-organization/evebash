import { AccessibilityInfo, Alert, Platform, type AlertButton } from 'react-native';
import { haptic } from './haptics';

/**
 * Branded replacements for Alert.alert.
 *
 * - showToast(): short, non-blocking confirmation (e.g. "Event renamed").
 * - appAlert(): same signature as Alert.alert. On Android it renders the themed dialog from
 *   FeedbackHost; on iOS it keeps the native alert, which reliably appears above open RN modals
 *   (a root-mounted RN Modal cannot be presented over another modal on iOS).
 *
 * Both fall back to the native Alert until FeedbackHost has mounted.
 */

export type ToastType = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  message: string;
  title?: string;
  type: ToastType;
  duration: number;
};

export type DialogItem = {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  cancelable: boolean;
};

type FeedbackState = {
  toast: ToastItem | null;
  dialogs: DialogItem[];
};

let state: FeedbackState = { toast: null, dialogs: [] };
const listeners = new Set<() => void>();
let nextId = 1;
// Number of mounted hosts (the root one, plus toast-only ones inside full-screen modals)
let mountedHosts = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeFeedback(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFeedbackState() {
  return state;
}

export function setFeedbackHostMounted(mounted: boolean) {
  mountedHosts = Math.max(0, mountedHosts + (mounted ? 1 : -1));
}

export function showToast(
  message: string,
  options: { type?: ToastType; title?: string; duration?: number } = {}
) {
  if (mountedHosts === 0) {
    Alert.alert(options.title ?? '', message);
    return;
  }
  // Done here, not in the toast view, so it happens once even if two hosts render the toast
  if (options.type !== 'info') haptic(options.type === 'error' ? 'error' : 'success');
  AccessibilityInfo.announceForAccessibility(options.title ? `${options.title}. ${message}` : message);
  state = {
    ...state,
    toast: {
      id: nextId++,
      message,
      title: options.title,
      type: options.type ?? 'success',
      duration: options.duration ?? 2600,
    },
  };
  emit();
}

export function hideToast(id: number) {
  if (state.toast?.id !== id) return;
  state = { ...state, toast: null };
  emit();
}

export function appAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: { cancelable?: boolean }
) {
  if (Platform.OS !== 'android' || mountedHosts === 0) {
    Alert.alert(title, message, buttons, options);
    return;
  }
  state = {
    ...state,
    dialogs: [
      ...state.dialogs,
      {
        id: nextId++,
        title,
        message,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
        cancelable: options?.cancelable ?? false,
      },
    ],
  };
  emit();
}

/** Closes a dialog, then runs the chosen button's handler (like the native alert does). */
export function resolveDialog(id: number, button?: AlertButton) {
  state = { ...state, dialogs: state.dialogs.filter((dialog) => dialog.id !== id) };
  emit();
  if (button?.style === 'destructive') haptic('warning');
  if (button?.onPress) {
    // Let the dialog start closing before the handler opens anything new
    setTimeout(() => button.onPress?.(), 0);
  }
}
