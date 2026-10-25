import React from 'react';
import { View, Text, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { coupleInitials, splitCoupleNames } from '../../../../shared/text/coupleNames';
import { RoyalFiligreeFrame, RoyalFlourish, RoyalPaperCard, RoyalScreenCorner, RoyalWaxSeal } from './RoyalOrnaments';
import type { RoyalFontSet } from './royalFonts';

// Royal Emerald hero for phones, from the website design (src/components/TemplateRoyal.tsx): gold corners on an
// emerald screen, the cover in the gold filigree frame (always portrait 4:5), and the ivory title card with the wax
// seal. The website puts the card and frame side by side; a phone stacks them (card under the frame, not touching
// it), sized so the whole hero fits one screen.

function coupleLead(category?: string) {
  const type = (category || '').toLowerCase();
  if (type.includes('anniversary')) return 'The Anniversary of';
  if (type.includes('engagement')) return 'The Engagement of';
  if (type.includes('wedding')) return 'The Wedding of';
  return 'Celebrating';
}

const CORNER = 60;
// Space between the frame and the card, clear of the frame's bottom crest and corner pieces
const CARD_GAP = 20;
const SEAL = 64;
// Same space above and below the card's text, so it sits in the middle; the bottom space clears the seal
const CARD_PAD = SEAL / 2 + 10;
const NAME_LINE = 46;
// Frame and card share the stack's height 70 / 30
const FRAME_SHARE = 0.7;

/** About how tall the card is, so the frame can be sized against it */
function cardHeight(isCouple: boolean, hasDate: boolean) {
  const names = isCouple ? 26 + NAME_LINE : NAME_LINE * 1.6;
  return CARD_PAD + names + 32 + (hasDate ? 16 : 0) + CARD_PAD;
}

export interface RoyalHeroProps {
  /** The gallery being shown (an album shows its own title, without the couple line or initials) */
  gallery: { title?: string; date?: string; category?: string; coverMode?: 'fit' | 'fill'; coverOffset?: number; coverOffsetX?: number; coverScale?: number };
  isAlbum: boolean;
  coverSource: ImageSourcePropType;
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  fonts: RoyalFontSet;
}

/** The host's cover settings, as on the website: the focus point decides which part of a landscape cover shows */
function coverPosition(gallery: RoyalHeroProps['gallery']) {
  const x = Math.max(0, Math.min(100, 50 + (gallery.coverOffsetX || 0)));
  const y = Math.max(0, Math.min(100, 50 + (gallery.coverOffset || 0)));
  return { left: `${x}%`, top: `${y}%` } as const;
}

export function RoyalHero({ gallery, isAlbum, coverSource, width, height, insetTop, insetBottom, fonts }: RoyalHeroProps) {
  const title = (gallery.title || '').trim();
  const couple = isAlbum ? null : splitCoupleNames(title);
  const initials = couple ? coupleInitials(title) : null;

  // Back and Share are in the gallery section below (and the phone's own back works), so no bar up here
  const cornerTop = insetTop + 12;
  // The frame takes what's left of the screen between the corners, at most 300 wide
  // Below the frame: the gap, the card and the half of the seal under it
  const card = cardHeight(!!couple, !!gallery.date);
  const belowFrame = CARD_GAP + card + SEAL / 2;
  // The frame starts below the top corners (its own corner pieces reach a little above it)
  const stackTop = cornerTop + CORNER - 2;
  const room = height - stackTop - insetBottom - 16 - belowFrame;
  // At most 70% of the frame + card height, and what fits the screen
  const ratioHeight = (card * FRAME_SHARE) / (1 - FRAME_SHARE);
  const frameWidth = Math.max(180, Math.min(width - 64, 340, Math.floor(Math.min(room, ratioHeight) / 1.25)));
  // A little narrower than the frame
  const cardWidth = Math.min(width - 140, 260);

  return (
    <View style={{ width, height }}>
      {/* Emerald with a soft light in the middle, like the website */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="bg" cx="50%" cy="38%" r="75%">
            <Stop offset={0} stopColor="#0b3d30" />
            <Stop offset={0.55} stopColor="#02231c" />
            <Stop offset={1} stopColor="#011510" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#bg)" />
      </Svg>

      <RoyalScreenCorner size={CORNER} style={{ position: 'absolute', top: cornerTop, left: 14 }} />
      <RoyalScreenCorner size={CORNER} flip="x" style={{ position: 'absolute', top: cornerTop, right: 14 }} />
      <RoyalScreenCorner size={CORNER} flip="y" style={{ position: 'absolute', bottom: insetBottom + 14, left: 14 }} />
      <RoyalScreenCorner size={CORNER} flip="xy" style={{ position: 'absolute', bottom: insetBottom + 14, right: 14 }} />

      <View style={[local.stack, { top: stackTop, bottom: insetBottom + 16 }]}>
        <RoyalFiligreeFrame width={frameWidth}>
          <ExpoImage
            source={coverSource}
            style={[StyleSheet.absoluteFill, gallery.coverMode !== 'fit' && { transform: [{ scale: gallery.coverScale || 1 }] }]}
            contentFit={gallery.coverMode === 'fit' ? 'contain' : 'cover'}
            contentPosition={coverPosition(gallery)}
            transition={200}
            accessibilityLabel={title || 'Cover photo'}
          />
        </RoyalFiligreeFrame>

        <View style={{ marginTop: CARD_GAP, alignItems: 'center', zIndex: 2 }}>
          <RoyalPaperCard style={[local.card, { width: cardWidth }]}>
            {/* Script swashes reach past the letters, so each line has side padding (Android clips them otherwise) */}
            {couple && <Text style={[local.lead, { fontFamily: fonts.script }]}>{coupleLead(gallery.category)} </Text>}
            {couple ? (
              // One line keeps the card short, so the frame gets 70% of the height
              <Text
                style={[local.names, { fontFamily: fonts.script }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.45}
                accessibilityRole="header"
                accessibilityLabel={`${couple[0]} and ${couple[1]}`}
              >
                {couple[0]}<Text style={[local.amp, { fontFamily: fonts.serifItalic }]}> &amp; </Text>{couple[1]}{' '}
              </Text>
            ) : !!title && (
              <Text
                style={[local.names, local.single, { fontFamily: fonts.script }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                accessibilityRole="header"
              >
                {title}{' '}
              </Text>
            )}
            <View style={{ marginTop: 10, marginBottom: 10 }}><RoyalFlourish width={80} /></View>
            {!!gallery.date && <Text style={[local.date, { fontFamily: fonts.displayBold }]}>{gallery.date.toUpperCase()}</Text>}
          </RoyalPaperCard>
          <View style={{ marginTop: -SEAL / 2 }}>
            <RoyalWaxSeal initials={initials} size={SEAL} fonts={fonts} />
          </View>
        </View>

      </View>
    </View>
  );
}

const local = StyleSheet.create({
  stack: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  card: { paddingTop: CARD_PAD, paddingBottom: CARD_PAD, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  lead: { color: '#a8782b', fontSize: 19, lineHeight: 26, paddingHorizontal: 8, textAlign: 'center', textShadowColor: 'rgba(255,255,255,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  names: { alignSelf: 'stretch', color: '#b0832f', fontSize: 34, lineHeight: NAME_LINE, paddingHorizontal: 10, textAlign: 'center', textShadowColor: 'rgba(255,255,255,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  single: { lineHeight: 46 },
  amp: { color: '#b0832f', fontSize: 22, textAlign: 'center' },
  date: { color: '#8a6a36', fontSize: 11, letterSpacing: 3.5, textAlign: 'center' },
});
