import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';

type ZoomablePhotoProps = {
  uri: string;
  /** Changes when a different photo is shown, which resets zoom and drag state */
  resetKey: string;
  /** Whether horizontal swipes should move to the previous/next photo */
  canSwipe: boolean;
  onSwipe: (dir: 'prev' | 'next') => void;
  /** Called when the photo is dragged down far enough to close the viewer */
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
};

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 800;
const DISMISS_DISTANCE = 140;
const DISMISS_VELOCITY = 1000;

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

/**
 * Full-screen photo with pinch and double-tap zoom, panning while zoomed,
 * finger-following swipes between photos, and drag-down to close.
 * Must be rendered inside a GestureHandlerRootView (RN Modals need their own).
 */
export function ZoomablePhoto({ uri, resetKey, canSwipe, onSwipe, onDismiss, style }: ZoomablePhotoProps) {
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPanX = useSharedValue(0);
  const savedPanY = useSharedValue(0);
  // Offsets used only at 1x: horizontal paging and pull-down-to-close
  const swipeX = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    panX.value = 0;
    panY.value = 0;
    savedPanX.value = 0;
    savedPanY.value = 0;
    dragY.value = 0;
    // swipeX is left alone so the slide-in animation for the new photo can finish
  }, [resetKey, scale, savedScale, panX, panY, savedPanX, savedPanY, dragY]);

  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    panX.value = withTiming(0);
    panY.value = withTiming(0);
    savedPanX.value = 0;
    savedPanY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.01) resetZoom();
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value > 1.01 || scale.value > 1.01) {
        panX.value = savedPanX.value + e.translationX;
        panY.value = savedPanY.value + e.translationY;
        return;
      }
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        if (canSwipe) swipeX.value = e.translationX;
      } else if (e.translationY > 0) {
        dragY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1.01 || scale.value > 1.01) {
        // Keep the zoomed photo from being dragged off screen
        const maxX = (width * (scale.value - 1)) / 2;
        const maxY = (height * (scale.value - 1)) / 2;
        savedPanX.value = clamp(panX.value, -maxX, maxX);
        savedPanY.value = clamp(panY.value, -maxY, maxY);
        panX.value = withSpring(savedPanX.value, { damping: 20 });
        panY.value = withSpring(savedPanY.value, { damping: 20 });
        return;
      }

      if (dragY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(onDismiss)();
        return;
      }
      dragY.value = withSpring(0, { damping: 18 });

      const swipedFar = Math.abs(swipeX.value) > SWIPE_DISTANCE || Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (canSwipe && swipedFar && swipeX.value !== 0) {
        const dir = swipeX.value < 0 ? 'next' : 'prev';
        const exitTo = swipeX.value < 0 ? -width : width;
        swipeX.value = withTiming(exitTo, { duration: 140 }, (finished) => {
          if (!finished) return;
          runOnJS(onSwipe)(dir);
          // Enter the next photo from the opposite side
          swipeX.value = -exitTo * 0.35;
          swipeX.value = withTiming(0, { duration: 180 });
        });
      } else {
        swipeX.value = withSpring(0, { damping: 18 });
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1.01) {
        resetZoom();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(dragY.value / 600, 0.5),
    transform: [
      { translateX: panX.value + swipeX.value },
      { translateY: panY.value + dragY.value },
      { scale: scale.value * (1 - Math.min(dragY.value / 2000, 0.15)) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, style]} collapsable={false}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <ExpoImage
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="memory-disk"
            accessibilityRole="image"
            accessibilityHint="Pinch or double-tap to zoom. Swipe to change photo, drag down to close."
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
});
