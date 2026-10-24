import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { displayCoupleTitle } from '@/components/royal/coupleNames';
import { classicCoverLine } from '../../../../shared/themes/classicCoverLine';
import type { ClassicFontSet } from './classicFonts';

// Classic White cover for phones, from the website (src/components/TemplateClassic.tsx and
// src/components/classic/ClassicCoverPrint.tsx): date, the title in capitals ("X & Y"), a sage divider, the cover
// as a tilted print in a white mount with the theme's line on a card over its top edge, and "Open Gallery".
// The website's print is landscape; a phone has height to spare, so here it is portrait (4:5 to 2:3) and takes
// whatever height the rest leaves. Back and Share are in the gallery header below (and the phone's own back works).

export const CLASSIC = {
  background: '#FCFCFA',
  card: '#F6F6F2',
  line: '#E6E6E0',
  text: '#2C352E',
  muted: '#596653',
  sage: '#8B9A6E',
  sprig: '#7D8C61',
  outline: 'rgba(44,53,46,0.28)',
} as const;

// Widest and tallest shapes of the print (width / height)
const PRINT_RATIO = 4 / 5;
const TALLEST_RATIO = 2 / 3;
// The card overlaps the print's top edge by this much
const CARD_OVERLAP = 14;

/** Small sage sprig for the card corners (same drawing as the website); `flip` mirrors it for the right side */
function Sprig({ flip }: { flip?: boolean }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 40 40" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Path d="M5 35 C 13 27, 21 19, 35 5" fill="none" stroke={CLASSIC.sprig} strokeWidth={1.2} strokeLinecap="round" />
      {[[11, 29, -60], [16, 24, 30], [19, 21, -55], [24, 16, 35], [27, 13, -50], [31, 9, 40]].map(([x, y, r]) => (
        <Ellipse key={`${x}-${y}`} cx={x} cy={y} rx={4.2} ry={1.9} rotation={r} origin={`${x}, ${y}`} fill={CLASSIC.sprig} opacity={0.75} />
      ))}
    </Svg>
  );
}

/** Sage line, diamond, line (the same divider as the website) */
export function ClassicDivider({ style }: { style?: object }) {
  return (
    <View style={[local.divider, style]} accessible={false}>
      <View style={local.dividerLine} />
      <View style={local.dividerDiamond} />
      <View style={local.dividerLine} />
    </View>
  );
}

/** The host's cover settings, as on the website: the focus point decides which part of the cover shows */
function coverPosition(gallery: ClassicHeroProps['gallery']) {
  const x = Math.max(0, Math.min(100, 50 + (gallery.coverOffsetX || 0)));
  const y = Math.max(0, Math.min(100, 50 + (gallery.coverOffset || 0)));
  return { left: `${x}%`, top: `${y}%` } as const;
}

/** Capitals run wide, so longer titles get a smaller size and keep the print's room */
function titleSize(title: string) {
  if (title.length > 32) return 21;
  if (title.length > 22) return 25;
  if (title.length > 14) return 30;
  return 36;
}

export interface ClassicHeroProps {
  /** The gallery being shown (an album shows its own title) */
  gallery: { title?: string; date?: string; category?: string; coverMode?: 'fit' | 'fill'; coverOffset?: number; coverOffsetX?: number; coverScale?: number };
  coverSource?: ImageSourcePropType | null;
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  fonts: ClassicFontSet;
  onOpenGallery: () => void;
}

export function ClassicHero({ gallery, coverSource, width, height, insetTop, insetBottom, fonts, onOpenGallery }: ClassicHeroProps) {
  const title = displayCoupleTitle((gallery.title || '').trim());
  const date = (gallery.date || '').trim();
  const size = titleSize(title);
  const [space, setSpace] = useState({ width: 0, height: 0 });

  const onSpaceLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w !== space.width || h !== space.height) setSpace({ width: w, height: h });
  };

  // A little narrower and shorter than the space, so the tilted corners stay inside it. On tall phones the width
  // runs out first, so the print grows taller (up to 2:3) to fill the height instead of leaving a gap below it.
  const usableHeight = space.height * 0.96;
  const mountWidth = Math.max(0, Math.min(space.width * 0.9, usableHeight * PRINT_RATIO));
  const mountHeight = mountWidth ? Math.min(usableHeight, mountWidth / TALLEST_RATIO) : 0;
  const mountPad = Math.max(14, Math.round(mountWidth * 0.05));

  return (
    <View style={[local.screen, { width, height, paddingTop: insetTop + 16, paddingBottom: insetBottom + 16 }]}>
      {!!date && (
        <Text style={local.details} numberOfLines={1}>{date.toUpperCase()}</Text>
      )}
      {!!title && (
        <Text
          style={[local.title, { fontFamily: fonts.serif, fontSize: size, lineHeight: Math.round(size * 1.12) }]}
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          accessibilityRole="header"
        >
          {title.toUpperCase()}
        </Text>
      )}
      <ClassicDivider style={{ marginTop: 14 }} />

      <View style={local.print}>
        <View style={[local.card, coverSource ? { marginBottom: -CARD_OVERLAP } : null, mountWidth ? { maxWidth: mountWidth * 0.92 } : null]}>
          <View style={[local.sprig, { left: 8 }]}><Sprig /></View>
          <Text style={[local.cardText, { fontFamily: fonts.serifItalic }]}>{classicCoverLine(gallery.category)}</Text>
          <View style={[local.sprig, { right: 8 }]}><Sprig flip /></View>
        </View>

        {coverSource ? (
          <View style={local.space} onLayout={onSpaceLayout}>
            {mountWidth > 0 && (
              <View style={[local.mount, { width: mountWidth, height: mountHeight, padding: mountPad, marginLeft: -mountWidth / 2 }]}>
                <View style={local.photo}>
                  <ExpoImage
                    source={coverSource}
                    style={[StyleSheet.absoluteFill, gallery.coverMode !== 'fit' && { transform: [{ scale: gallery.coverScale || 1 }] }]}
                    contentFit={gallery.coverMode === 'fit' ? 'contain' : 'cover'}
                    contentPosition={coverPosition(gallery)}
                    transition={200}
                    accessibilityLabel={title || 'Cover photo'}
                  />
                </View>
              </View>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      <TouchableOpacity onPress={onOpenGallery} accessibilityRole="button" style={local.open} activeOpacity={0.8}>
        <Text style={local.openText}>Open Gallery</Text>
      </TouchableOpacity>
    </View>
  );
}

const local = StyleSheet.create({
  screen: { backgroundColor: CLASSIC.background, paddingHorizontal: 16, alignItems: 'center' },
  details: { color: CLASSIC.text, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 3, textAlign: 'center' },
  title: { marginTop: 8, color: CLASSIC.text, letterSpacing: 0.6, textAlign: 'center', alignSelf: 'stretch' },
  divider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  dividerLine: { width: 48, height: StyleSheet.hairlineWidth * 2, backgroundColor: 'rgba(139,154,110,0.5)' },
  dividerDiamond: { width: 6, height: 6, backgroundColor: CLASSIC.sage, transform: [{ rotate: '45deg' }] },
  print: { flex: 1, alignSelf: 'stretch', alignItems: 'center', marginTop: 18, minHeight: 200 },
  card: {
    zIndex: 2,
    paddingVertical: 12,
    paddingHorizontal: 44,
    backgroundColor: CLASSIC.card,
    borderWidth: 1,
    borderColor: CLASSIC.line,
    transform: [{ rotate: '1deg' }],
    shadowColor: CLASSIC.text,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  cardText: { color: CLASSIC.text, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  sprig: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  space: { flex: 1, alignSelf: 'stretch' },
  mount: {
    position: 'absolute',
    top: 0,
    left: '50%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: CLASSIC.line,
    transform: [{ rotate: '-2.2deg' }],
    shadowColor: CLASSIC.text,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  photo: { flex: 1, overflow: 'hidden', backgroundColor: CLASSIC.background, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(44,53,46,0.12)' },
  open: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 22, borderWidth: 1, borderColor: CLASSIC.outline, borderRadius: 2 },
  openText: { color: CLASSIC.text, fontSize: 15 },
});
