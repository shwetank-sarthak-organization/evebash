import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Android only: the open keyboard's height (0 when closed, and always 0 on iOS), so a sheet or panel can lift
 * itself above it. KeyboardAvoidingView's 'height' mode re-measures its own frame and, with a floating keyboard
 * (e.g. Gboard's toolbar when a hardware keyboard is attached), flips between two sizes forever, so the view
 * flickers (#45). A floating keyboard reports a height of 0 or less, so the view stays put.
 */
export function useAndroidKeyboardHeight(active = true) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android' || !active) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(Math.max(0, e.endCoordinates.height));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
      setKeyboardHeight(0);
    };
  }, [active]);

  return keyboardHeight;
}
