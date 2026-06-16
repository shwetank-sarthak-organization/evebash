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
  background: '#050505',
  deepSlate: '#101010',
  slate900: '#101010',
  slate800: '#1a1a1a',
  slate700: '#2a2a2a',
  slate400: '#94a3b8',
  gold: '#d4af37',
  white: '#ffffff',
  ghostWhite: '#f8fafc',
  border: 'rgba(212, 175, 55, 0.25)',
  cardBorder: 'rgba(255, 255, 255, 0.05)',
};

export const LightColors = {
  background: '#f8fafc',
  deepSlate: '#ffffff',
  slate900: '#f1f5f9',
  slate800: '#e2e8f0',
  slate700: '#cbd5e1',
  slate400: '#64748b',
  gold: '#d4af37',
  white: '#101010',
  ghostWhite: '#1e293b',
  border: 'rgba(212, 175, 55, 0.25)',
  cardBorder: 'rgba(0, 0, 0, 0.05)',
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
  cormorant: {
    regular: 'CormorantGaramond_400Regular',
    italic: 'CormorantGaramond_400Regular_Italic',
    semiBold: 'CormorantGaramond_600SemiBold',
    bold: 'CormorantGaramond_700Bold',
  },
  lora: {
    regular: 'Lora_400Regular',
    italic: 'Lora_400Regular_Italic',
    semiBold: 'Lora_600SemiBold',
    bold: 'Lora_700Bold',
  },
  nunitoSans: {
    regular: 'NunitoSans_400Regular',
    semiBold: 'NunitoSans_600SemiBold',
    bold: 'NunitoSans_700Bold',
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
  spaceGrotesk: {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semiBold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
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
  },
  syne: {
    bold: 'Syne_700Bold',
  },
  yellowtail: {
    regular: 'Yellowtail_400Regular',
  },
  alexBrush: {
    regular: 'AlexBrush_400Regular',
  },
  cookie: {
    regular: 'Cookie_400Regular',
  },
  grandHotel: {
    regular: 'GrandHotel_400Regular',
  },
  cinzelDecorative: {
    regular: 'CinzelDecorative_400Regular',
    bold: 'CinzelDecorative_700Bold',
  },
  cinzel: {
    regular: 'Cinzel_400Regular',
    bold: 'Cinzel_700Bold',
  }
};
