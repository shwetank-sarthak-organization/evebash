import { StyleSheet, Dimensions, Platform } from 'react-native';
import { MidnightColors, Fonts } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const royalStyles = {
// Premium Royal Gold Splash Overlay Styles
  royalHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 40,
  },
  royalFrame: {
    position: 'absolute',
    top: 60,
    bottom: 30,
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: 8,
    pointerEvents: 'none',
  },
  royalCenterContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  royalTitle: {
    fontSize: 34,
    fontFamily: Fonts.serif,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 36,
    lineHeight: 46,
    letterSpacing: 2,
  },
  royalDateText: {
    fontSize: 13,
    fontFamily: Fonts.inter.bold,
    marginTop: 14,
    letterSpacing: 2,
  },
  royalButton: {
    marginTop: 32,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  royalButtonText: {
    fontSize: 12,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 2,
  },
  royalBottomContent: {
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  brandLogoContainer: {
    alignItems: 'center',
  },
  royalBrandLogoScript: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontStyle: 'italic',
    color: '#fff',
    marginBottom: 4,
  },
  royalCircleLetters: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  royalCircleLetterBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  royalCircleLetterText: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  royalBrandSubText: {
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 3,
  },
  royalChevron: {
    opacity: 0.85,
  },
};
