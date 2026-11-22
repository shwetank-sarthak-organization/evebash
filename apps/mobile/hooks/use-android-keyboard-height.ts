import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * The open keyboard's height (0 when closed), so a sheet or panel can lift itself above it.
 *
 * Android: KeyboardAvoidingView's 'height' mode re-measures its own frame and, with a floating keyboard
 * (e.g. Gboard's toolbar when a hardware keyboard is attached), flips between two sizes forever, so the view
 * flickers (#45). A floating keyboard reports a height of 0 or less, so the view stays put.
 *
 * iOS (only when `ios` is true): KeyboardAvoidingView does nothing for an absolutely positioned panel inside a
 * Modal, so the keyboard covered the photo viewer's comment box (#242). Uses the "will" events so the panel
 * moves together with the keyboard.
 */
export function useKeyboardHeight(active = true, { ios = false }: { ios?: boolean } = {}) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const enabled = Platform.OS === 'android' || (Platform.OS === 'ios' && ios);
    if (!enabled || !active) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(Math.max(0, e.endCoordinates.height));
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
      setKeyboardHeight(0);
    };
  }, [active, ios]);

  return keyboardHeight;
}

/** Android only (always 0 on iOS): see useKeyboardHeight. */
export function useAndroidKeyboardHeight(active = true) {
  return useKeyboardHeight(active);
}
