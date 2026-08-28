/**
 * Below are the colors that are used in the app.
 */

import { Platform } from 'react-native';

const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
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
      sans: 'Inter_400Regular',
      serif: 'Inter_400Regular',
    },
    default: {
      sans: 'Inter_400Regular',
      serif: 'Inter_400Regular',
    },
  }),
  playfair: {
    regular: 'Inter_400Regular',
    italic: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  cormorant: {
    regular: 'Inter_400Regular',
    italic: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  lora: {
    regular: 'Inter_400Regular',
    italic: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  nunitoSans: {
    regular: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  outfit: {
    regular: 'Inter_400Regular',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extraBold: 'Inter_800ExtraBold',
  },
  inter: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extraBold: 'Inter_800ExtraBold',
    black: 'Inter_900Black',
  },
  spaceGrotesk: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  monofett: {
    regular: 'Inter_400Regular',
  },
  bubblegum: {
    regular: 'Inter_400Regular',
  },
  permanentMarker: {
    regular: 'Inter_400Regular',
  },
  vt323: {
    regular: 'Inter_400Regular',
  },
  syne: {
    bold: 'Inter_700Bold',
  },
  yellowtail: {
    regular: 'Inter_400Regular',
  },
  alexBrush: {
    regular: 'Inter_400Regular',
  },
  cookie: {
    regular: 'Inter_400Regular',
  },
  grandHotel: {
    regular: 'Inter_400Regular',
  },
  cinzelDecorative: {
    regular: 'Inter_400Regular',
    bold: 'Inter_700Bold',
  },
  cinzel: {
    regular: 'Inter_400Regular',
    bold: 'Inter_700Bold',
  }
};
