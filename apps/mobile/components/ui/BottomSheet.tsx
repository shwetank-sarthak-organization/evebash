import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MidnightColors } from '@/constants/theme';

type BottomSheetProps = {
  visible: boolean;
  /** Called on backdrop tap, Android back, or dragging the handle down */
  onClose: () => void;
  children: React.ReactNode;
  /** Extra styles for the sheet container (e.g. maxHeight) */
  style?: StyleProp<ViewStyle>;
};

const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 900;

/**
 * App-wide bottom sheet: dimmed backdrop, drag handle (drag down to close),
 * Android back support, keyboard avoidance and safe-area bottom padding.
 */
export function BottomSheet({ visible, onClose, children, style }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = height;
      translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
      backdrop.value = withTiming(1, { duration: 200 });
    } else {
      backdrop.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(height, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, height, translateY, backdrop]);

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          </Animated.View>
          <Animated.View
            style={[styles.sheet, { paddingBottom: insets.bottom + 20, maxHeight: height * 0.9 }, sheetStyle, style]}
            accessibilityViewIsModal
          >
            <GestureDetector gesture={drag}>
              <View style={styles.handleArea} hitSlop={{ top: 8, bottom: 8 }}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    backgroundColor: MidnightColors.slate900,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: MidnightColors.border,
    paddingHorizontal: 24,
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 14,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 247, 235, 0.25)',
  },
});
