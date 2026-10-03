import { Alert, Platform, type AlertButton } from 'react-native';

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
let hostMounted = false;

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
  hostMounted = mounted;
}

export function showToast(
  message: string,
  options: { type?: ToastType; title?: string; duration?: number } = {}
) {
  if (!hostMounted) {
    Alert.alert(options.title ?? '', message);
    return;
  }
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
  if (Platform.OS !== 'android' || !hostMounted) {
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
  if (button?.onPress) {
    // Let the dialog start closing before the handler opens anything new
    setTimeout(() => button.onPress?.(), 0);
  }
}
