import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

interface BohemianEqualizerProps {
  accentColor: string;
  styles: any;
}

export function BohemianEqualizer({ accentColor, styles }: BohemianEqualizerProps) {
  const eq1 = useRef(new Animated.Value(1)).current;
  const eq2 = useRef(new Animated.Value(1)).current;
  const eq3 = useRef(new Animated.Value(1)).current;

  const startEqLoop = (val: Animated.Value, minVal: number, maxVal: number, speed: number) => {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(val, {
          toValue: maxVal,
          duration: speed,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(val, {
          toValue: minVal,
          duration: speed,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ])
    );
  };

  useEffect(() => {
    const anim1 = startEqLoop(eq1, 0.3, 1.2, 350);
    const anim2 = startEqLoop(eq2, 0.4, 1.4, 250);
    const anim3 = startEqLoop(eq3, 0.2, 1.0, 450);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  return (
    <View style={styles.bohemianEqContainer}>
      <Animated.View
        style={[
          styles.bohemianEqBar,
          {
            backgroundColor: accentColor,
            transform: [{ scaleY: eq1 }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bohemianEqBar,
          {
            backgroundColor: accentColor,
            transform: [{ scaleY: eq2 }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bohemianEqBar,
          {
            backgroundColor: accentColor,
            transform: [{ scaleY: eq3 }],
          },
        ]}
      />
    </View>
  );
}
