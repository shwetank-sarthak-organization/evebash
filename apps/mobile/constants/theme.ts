/**
 * Below are the colors that are used in the app.
 */

import { Platform } from 'react-native';

const tintColorDark = '#CA9C68';

export const Colors = {
  light: {
    text: '#FFF7EB',
    background: '#13191F',
    tint: tintColorDark,
    icon: '#CDB89E',
    tabIconDefault: '#CDB89E',
    tabIconSelected: tintColorDark,
  },
  dark: {
    text: '#FFF7EB',
    background: '#13191F',
    tint: tintColorDark,
    icon: '#CDB89E',
    tabIconDefault: '#CDB89E',
    tabIconSelected: tintColorDark,
  },
};

export const MidnightColors = {
  background: '#13191F',
  deepSlate: '#1B211F',
  slate900: '#1B211F',
  slate800: '#2B2F2E',
  slate700: '#594C3D',
  slate600: '#9A8B78',
  slate400: '#CDB89E',
  slate300: '#E6D8C3',
  gold: '#CA9C68',
  white: '#FFF7EB',
  ghostWhite: '#FFF7EB',
  text: '#FFF7EB',
  card: '#1B211F',
  border: 'rgba(202, 156, 104, 0.25)',
  cardBorder: 'rgba(202, 156, 104, 0.12)',
  modalBackdrop: 'rgba(0, 0, 0, 0.65)',
  /** Raised card surface on the page background */
  surface: '#10161C',
  /** Text and icons placed on a gold fill */
  onAccent: '#13191F',
  success: '#22C55E',
  warning: '#FBBF24',
  danger: '#EF4444',
  /** Solid red fills (destructive buttons) */
  dangerStrong: '#DC2626',
  /** Red text and icons on dark backgrounds */
  dangerSoft: '#F87171',
  /** Gold fills (primary buttons, badges, switches); `gold` is for gold text, icons and lines */
  goldFill: '#CA9C68',
  /** The EB logo's gold */
  brandMark: '#CA9C68',
  /** Shadow colour under cards and sheets */
  shadow: '#000',
  /** Soft washes and hairlines: white over the dark look, ink over the light one */
  tint: (alpha: number) => `rgba(255, 255, 255, ${alpha})`,
};

/**
 * The light look (todo #1): the website's light palette (src/app/globals.css,
 * `html[data-site-theme="light"]:not([data-site-noir]) body.site-themed`), so keep the two in step.
 * Warm ivory paper, ink text, and a deeper bronze for gold text and icons: the normal gold is only
 * 2.2:1 on light, #8A6224 is 5.1:1. Gold text belongs on the page, surface or card, not on slate800.
 */
export const LightColors: typeof MidnightColors = {
  background: '#FBF8F3',
  deepSlate: '#FFFFFF',
  slate900: '#FFFFFF',
  slate800: '#EBE3D6',
  slate700: '#D9CDBB',
  slate600: '#6B6358',
  slate400: '#4A443C',
  slate300: '#4A443C',
  gold: '#8A6224',
  white: '#1C1915',
  ghostWhite: '#1C1915',
  text: '#1C1915',
  card: '#FFFFFF',
  border: 'rgba(165, 118, 54, 0.28)',
  cardBorder: 'rgba(165, 118, 54, 0.2)',
  modalBackdrop: 'rgba(28, 25, 21, 0.45)',
  surface: '#F4EEE4',
  onAccent: '#1A1205',
  success: '#166534',
  warning: '#92400E',
  danger: '#B91C1C',
  dangerStrong: '#DC2626',
  dangerSoft: '#B91C1C',
  goldFill: '#CFA461',
  brandMark: '#A57636',
  shadow: 'rgb(92, 64, 24)',
  tint: (alpha: number) => `rgba(28, 25, 21, ${alpha})`,
};

export const RoyalColors = {
  maroon: '#594C3D',
  gold: '#CA9C68',
  cream: '#FFF7EB',
  green: '#2B2F2E',
  slate800: '#2B2F2E',
  slate700: '#594C3D',
  slate400: '#CDB89E',
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
