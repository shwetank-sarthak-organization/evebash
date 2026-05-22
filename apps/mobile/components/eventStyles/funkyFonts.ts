import { Platform } from 'react-native';
import { Fonts } from '../../constants/theme';

export const FunkyFonts = {
  marker: Fonts.permanentMarker?.regular ?? Fonts.outfit.extraBold,
  comic: Fonts.bubblegum?.regular ?? Fonts.outfit.extraBold,
  display: Fonts.monofett?.regular ?? Fonts.outfit.extraBold,
  retro: Platform.select({
    ios: 'American Typewriter',
    android: 'monospace',
    default: 'monospace',
  }),
};
