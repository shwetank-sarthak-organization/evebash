/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const MidnightColors = {
  background: '#020617',
  deepSlate: '#0f172a',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate400: '#94a3b8',
  gold: '#d4af37',
  white: '#ffffff',
  ghostWhite: '#f8fafc',
  border: 'rgba(212, 175, 55, 0.25)',
  cardBorder: 'rgba(255, 255, 255, 0.05)',
};

export const RoyalColors = {
  maroon: '#5D001E',
  gold: '#D4AF37',
  cream: '#FFFDD0',
  green: '#005D4B',
  slate800: '#1e293b',
  slate700: '#334155',
  slate400: '#94a3b8',
};

export const Fonts = {
  ...Platform.select({
    ios: {
      sans: 'system-ui',
      serif: 'ui-serif',
    },
    default: {
      sans: 'normal',
      serif: 'serif',
    },
  }),
  playfair: {
    regular: 'PlayfairDisplay_400Regular',
    italic: 'PlayfairDisplay_400Regular_Italic',
    semiBold: 'PlayfairDisplay_600SemiBold',
    bold: 'PlayfairDisplay_700Bold',
  },
  outfit: {
    regular: 'Outfit_400Regular',
    semiBold: 'Outfit_600SemiBold',
    bold: 'Outfit_700Bold',
    extraBold: 'Outfit_800ExtraBold',
  },
  inter: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  monofett: {
    regular: 'Monofett_400Regular',
  },
  bubblegum: {
    regular: 'BubblegumSans_400Regular',
  },
  permanentMarker: {
    regular: 'PermanentMarker_400Regular',
  },
  vt323: {
    regular: 'VT323_400Regular',
  }
};
