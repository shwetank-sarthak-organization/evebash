import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type TextProps, type ViewStyle } from 'react-native';

// Sunlit Portrait's small labels (the cover's date line, Back / Share, the gallery tabs) in Instrument Serif, which has
// only one weight. The website makes them read as bold with a hairline stroke (--sp-label-stroke in
// src/app/sunlit-portrait.css); React Native can't draw a text stroke, so the text is drawn twice, the second copy
// 0.6pt to the right, which thickens every stroke the same way (#166). Pass margins in containerStyle, not style, so
// both copies line up.

const STROKE = 0.6;

export function PortraitBoldText({ style, containerStyle, children, ...rest }: TextProps & { containerStyle?: StyleProp<ViewStyle> }) {
  return (
    <View style={containerStyle}>
      <Text style={style} {...rest}>{children}</Text>
      <Text
        style={[style, local.copy]}
        numberOfLines={rest.numberOfLines}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        {children}
      </Text>
    </View>
  );
}

const local = StyleSheet.create({
  // Same box as the first copy, moved right; no second shadow
  copy: { position: 'absolute', top: 0, bottom: 0, left: STROKE, right: -STROKE, textShadowColor: 'transparent' },
});
