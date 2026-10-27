import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { coverPosition, type ClassicHeroProps } from '@/components/classic/ClassicHero';
import { displayCoupleTitle } from '../../../../shared/text/coupleNames';
import { portraitIntro } from '../../../../shared/themes/portraitIntro';
import { PORTRAIT, type PortraitFontSet } from './portraitFonts';
import { PortraitBoldText } from './PortraitBoldText';

// Sunlit Portrait cover for phones, from the website (src/components/TemplatePortrait.tsx): the cover photo fills the
// screen; at the bottom left "We're getting married" (or "Happily married since" once the wedding date has passed) over
// the date, then the couple's names in Instrument Serif on one line, shrunk to fit; the round white arrow at the bottom
// right opens the gallery. Back and Share sit at the top, where the website has its navbar.

export interface PortraitHeroProps {
  /** The gallery being shown: its date and cover */
  gallery: ClassicHeroProps['gallery'];
  /** The main event's title, on the cover in the main gallery and in every album */
  mainTitle?: string;
  /** The main event's category and date, which pick the small line above the names */
  mainCategory?: string;
  mainDate?: string;
  coverSource?: ImageSourcePropType | null;
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  fonts: PortraitFontSet;
  onOpenGallery: () => void;
  onBack: () => void;
  onShare: () => void;
}

export function PortraitHero({ gallery, mainTitle, mainCategory, mainDate, coverSource, width, height, insetTop, insetBottom, fonts, onOpenGallery, onBack, onShare }: PortraitHeroProps) {
  const title = displayCoupleTitle((mainTitle || gallery.title || '').trim());
  const intro = portraitIntro(mainCategory || gallery.category, mainDate || gallery.date);
  // "Happily married since" is followed by the wedding's date, even in an album with a date of its own
  const date = ((intro.endsWith('since') ? mainDate : undefined) || gallery.date || '').trim();
  const isFit = gallery.coverMode === 'fit';
  // About the website's phone size; long names shrink further to stay on one line
  const titleSize = Math.round(Math.min(width * 0.2, height * 0.12, 96));

  return (
    <View style={[local.screen, { width, height }]}>
      {coverSource ? (
        <>
          {/* "Fit" covers keep the whole photo; a blurred copy fills the sides */}
          {isFit && <ExpoImage source={coverSource} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} accessible={false} />}
          <ExpoImage
            source={coverSource}
            style={[StyleSheet.absoluteFill, !isFit && { transform: [{ scale: gallery.coverScale || 1 }] }]}
            contentFit={isFit ? 'contain' : 'cover'}
            contentPosition={coverPosition(gallery)}
            transition={200}
            accessibilityLabel={title ? `Cover photo of ${title}` : 'Cover photo'}
          />
        </>
      ) : (
        <LinearGradient colors={['#6B6158', PORTRAIT.ink]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      )}

      {/* Darker at the top for Back / Share and at the bottom for the names; the middle of the photo stays as shot */}
      <LinearGradient colors={['rgba(20,16,12,0.45)', 'rgba(20,16,12,0)']} style={[local.shade, { top: 0, height: insetTop + 96 }]} pointerEvents="none" />
      <LinearGradient colors={['rgba(20,16,12,0)', 'rgba(20,16,12,0.25)', 'rgba(20,16,12,0.65)']} locations={[0, 0.45, 1]} style={[local.shade, { bottom: 0, height: height * 0.55 }]} pointerEvents="none" />

      <View style={[local.top, { top: insetTop + 8 }]}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={local.roundGlass} activeOpacity={0.8}>
          <IconSymbol name="chevron.left" size={20} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onShare} accessibilityRole="button" accessibilityLabel="Share event" style={local.roundGlass} activeOpacity={0.8}>
          <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={[local.text, { bottom: insetBottom + 30 }]}>
        {/* On a phone the line and the date take a line each, so no heart between them (as on the website) */}
        {!!intro && <PortraitBoldText style={[local.details, { fontFamily: fonts.serif }]}>{intro}</PortraitBoldText>}
        {!!date && <PortraitBoldText style={[local.details, { fontFamily: fonts.serif }]}>{date}</PortraitBoldText>}
        {!!title && (
          <Text
            style={[local.title, { fontFamily: fonts.serif, fontSize: titleSize, marginTop: Math.round(titleSize * 0.04) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.25}
            accessibilityRole="header"
          >
            {title}
          </Text>
        )}
      </View>

      <TouchableOpacity onPress={onOpenGallery} accessibilityRole="button" accessibilityLabel="Open gallery" style={[local.open, { bottom: insetBottom + 34 }]} activeOpacity={0.85}>
        <IconSymbol name="arrow.down" size={20} color={PORTRAIT.ink} />
      </TouchableOpacity>
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 };

const local = StyleSheet.create({
  screen: { backgroundColor: PORTRAIT.ink, overflow: 'hidden' },
  shade: { position: 'absolute', left: 0, right: 0 },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundGlass: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,16,12,0.28)' },
  text: { position: 'absolute', left: 20, right: 84 },
  details: { color: '#ffffff', fontSize: 21, lineHeight: 26, ...shadow },
  title: { color: '#ffffff', ...shadow, textShadowRadius: 24 },
  open: {
    position: 'absolute',
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
