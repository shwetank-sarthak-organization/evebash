import * as React from 'react';

// Use require to get the mutable CommonJS exports object
const RN = require('react-native');

// Respect the phone's text-size setting, but cap it so fixed-height layouts don't clip.
// Any component can still override this with its own allowFontScaling / maxFontSizeMultiplier.
const MAX_FONT_SCALE = 1.2;

const OriginalText = RN.Text;
const CustomText = React.forwardRef((props: any, ref: any) => {
  return <OriginalText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} ref={ref} />;
});
(CustomText as any).displayName = 'Text';
Object.assign(CustomText, OriginalText);

const OriginalTextInput = RN.TextInput;
const CustomTextInput = React.forwardRef((props: any, ref: any) => {
  return <OriginalTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} ref={ref} />;
});
(CustomTextInput as any).displayName = 'TextInput';
Object.assign(CustomTextInput, OriginalTextInput);

try {
  Object.defineProperty(RN, 'Text', {
    get() {
      return CustomText;
    },
    configurable: true,
    enumerable: true,
  });
} catch (e) {
  console.error('Failed to override RN.Text globally:', e);
}

try {
  Object.defineProperty(RN, 'TextInput', {
    get() {
      return CustomTextInput;
    },
    configurable: true,
    enumerable: true,
  });
} catch (e) {
  console.error('Failed to override RN.TextInput globally:', e);
}
