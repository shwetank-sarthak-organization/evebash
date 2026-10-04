import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Placeholder block shown while content loads. Pulses gently, and stays still
 * when the phone's "reduce motion" setting is on. Hidden from screen readers;
 * pair it with an accessible "Loading" label on the container.
 */
export function Skeleton({ width = '100%', height = 16, radius = 10, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.55)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: 'rgba(255, 247, 235, 0.08)', opacity },
        style,
      ]}
    />
  );
}
