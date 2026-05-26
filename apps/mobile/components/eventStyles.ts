import { StyleSheet, Dimensions, Platform } from 'react-native';
import { MidnightColors, Fonts } from '../constants/theme';

import { baseStyles } from './eventStyles/baseStyles';
import { cyberTechStyles } from './eventStyles/cyberTechStyles';
import { retroArcadeStyles } from './eventStyles/retroArcadeStyles';
import { visitorImmersiveStyles } from './eventStyles/visitorImmersiveStyles';
import { royalStyles } from './eventStyles/royalStyles';
import { classicStyles } from './eventStyles/classicStyles';
import { gardenStyles } from './eventStyles/gardenStyles';
import { bohemianStyles } from './eventStyles/bohemianStyles';
import { museumStyles } from './eventStyles/museumStyles';
import { brutalistStyles } from './eventStyles/brutalistStyles';
import { techSleekStyles } from './eventStyles/techSleekStyles';
import { executiveSuiteStyles } from './eventStyles/executiveSuiteStyles';
import { sportsStyles } from './eventStyles/sportsStyles';
import { FunkyFonts } from './eventStyles/funkyFonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export { FunkyFonts };

export const styles = StyleSheet.create({
  ...baseStyles,
  ...cyberTechStyles,
  ...retroArcadeStyles,
  ...visitorImmersiveStyles,
  ...royalStyles,
  ...classicStyles,
  ...gardenStyles,
  ...bohemianStyles,
  ...museumStyles,
  ...brutalistStyles,
  ...techSleekStyles,
  ...executiveSuiteStyles,
  ...sportsStyles,
} as any);
