import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { type ClassicHeroProps } from '@/components/classic/ClassicHero';
import { coverContentPosition, coverZoomStyle } from '@/lib/coverStyle';
import { Fonts } from '@/constants/theme';
import { EditChip, useGuestEditSpots } from '@/components/event/guestEdit/EditChip';
import { displayCoupleTitle, splitCoupleNames } from '../../../../shared/text/coupleNames';
import {
  CONFETTI_COLORS,
  CONFETTI_COVER_SPECKS,
  confettiMessage,
  confettiNameSize,
  confettiTagLine,
  confettiTagSize,
  splitConfettiDate,
} from '../../../../shared/themes/confettiCircle';
import { ConfettiGradientLine, ConfettiSpecks, ConfettiTear } from './ConfettiBits';
import { type ConfettiFontSet } from './confettiFonts';

// Confetti Circle cover for phones, from the website (src/components/TemplateConfetti.tsx, confetti-circle.css): the
// cover photo fills the screen with a big see-through white circle holding the couple's names in pink-to-orange
// capitals, "- and -" between them, the date as "March | 28 | 2025" and the place. A dark tag on the circle's top edge
// holds a red heart and the gallery's message (italic, in quotes), paint specks fall round the circle, and a torn-paper
// edge leads into the gallery. Back and Share sit at the top, where the website has its navbar; the round dark arrow at
// the bottom opens the gallery.

export interface ConfettiHeroProps {
  /** The gallery being shown: its date, place, message and cover */
  gallery: ClassicHeroProps['gallery'] & { location?: string; description?: string };
  /** The main event's title, on the cover in the main gallery and in every album */
  mainTitle?: string;
  /** The main event's category, which picks the tag's line when there is no message */
  mainCategory?: string;
  /** An album: the circle's names are then its main event's, so edit mode leaves the title pencil to the gallery header */
  isAlbum?: boolean;
  coverSource?: ImageSourcePropType | null;
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
  fonts: ConfettiFontSet;
  onOpenGallery: () => void;
  onBack: () => void;
  onShare: () => void;
}

const NAME_SIZES = { '': 0.19, long: 0.14, xlong: 0.1 } as const;
const TAG_WIDTHS = { '': 0.27, long: 0.34, xlong: 0.4 } as const;

export function ConfettiHero({ gallery, mainTitle, mainCategory, isAlbum = false, coverSource, width, height, insetTop, insetBottom, fonts, onOpenGallery, onBack, onShare }: ConfettiHeroProps) {
  // The cover image's size, to zoom it around the focus point (lib/coverStyle.ts)
  const [coverSize, setCoverSize] = React.useState<{ width: number; height: number }>();
  const rawTitle = (mainTitle || gallery.title || '').trim();
  const couple = splitCoupleNames(rawTitle);
  const title = displayCoupleTitle(rawTitle);
  const message = confettiMessage(gallery.description);
  const tagText = message || confettiTagLine(mainCategory || gallery.category);
  const tagSize = confettiTagSize(tagText);
  const date = (gallery.date || '').trim();
  const dateParts = date ? splitConfettiDate(date) : null;
  const location = (gallery.location || '').trim();
  const isFit = gallery.coverMode === 'fit';
  // Edit mode (todo #11): pencils on the cover, the circle's names and date and the tag's message; nothing for guests
  const editing = useGuestEditSpots();

  // As on the website: the tag starts at the top of the screen (Back / Share sit beside it), the circle as big as the
  // room down to the arrow and torn edge allows, and never wider than the screen
  const tagTop = insetTop + 8;
  const bottomRoom = insetBottom + 92;
  const circle = Math.round(Math.min(width * 0.92, (height - tagTop - bottomRoom) / 1.09));
  const circleTop = tagTop + Math.round(circle * 0.09);
  const pct = (share: number) => Math.round(circle * share * 10) / 10;
  const lineWidth = pct(0.84);

  const longest = couple ? Math.max(couple[0].length, couple[1].length) : title.length;
  const nameSize = pct(NAME_SIZES[confettiNameSize(longest)]);
  // A title that isn't two names: up to two balanced lines
  const singleLines = couple ? null : balancedLines(title);

  return (
    <View style={[local.screen, { width, height }]}>
      {coverSource ? (
        <>
          {/* "Fit" covers keep the whole photo; a blurred copy fills the sides */}
          {isFit && <ExpoImage source={coverSource} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} accessible={false} />}
          <ExpoImage
            source={coverSource}
            style={[StyleSheet.absoluteFill, coverZoomStyle(gallery, coverSize)]}
            onLayout={(event) => setCoverSize(event.nativeEvent.layout)}
            contentFit={isFit ? 'contain' : 'cover'}
            contentPosition={coverContentPosition(gallery)}
            transition={200}
            accessibilityLabel={title ? `Cover photo of ${title}` : 'Cover photo'}
          />
        </>
      ) : (
        <LinearGradient colors={['#efe1d6', '#c9b1a5']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      {/* A little darker at the top for Back / Share */}
      <LinearGradient colors={['rgba(20,16,12,0.35)', 'rgba(20,16,12,0)']} style={[local.shade, { top: 0, height: insetTop + 80 }]} pointerEvents="none" />

      {/* The circle, its specks and its tag */}
      <View style={[local.circleBox, { top: circleTop, left: (width - circle) / 2, width: circle, height: circle }]}>
        <ConfettiSpecks specks={CONFETTI_COVER_SPECKS} width={circle} />
        <View style={[local.circle, { width: circle, height: circle, borderRadius: circle / 2 }]}>
          <View style={{ alignItems: 'center', paddingTop: pct(0.16) }}>
            {couple ? (
              <>
                <ConfettiGradientLine text={couple[0]} size={nameSize} width={lineWidth} fontFamily={fonts.display} />
                <Text style={[local.and, { fontFamily: fonts.display, fontSize: pct(0.044), marginTop: pct(0.012), marginBottom: pct(0.006) }]}>- and -</Text>
                <ConfettiGradientLine text={couple[1]} size={nameSize} width={lineWidth} fontFamily={fonts.display} reverse />
              </>
            ) : singleLines?.map((line, index) => (
              <ConfettiGradientLine key={index} text={line} size={nameSize} width={lineWidth} fontFamily={fonts.display} reverse={index === 1} />
            ))}

            {dateParts ? (
              <View style={[local.dateRow, { marginTop: pct(0.045), gap: pct(0.026) }]}>
                <Text style={[local.dateSide, { fontSize: Math.max(12, pct(0.028)) }]}>{dateParts[0]}</Text>
                <View style={[local.dateRule, { height: pct(0.08) }]} />
                <Text style={[local.day, { fontFamily: fonts.display, fontSize: pct(0.09), lineHeight: pct(0.09) }]}>{dateParts[1]}</Text>
                <View style={[local.dateRule, { height: pct(0.05) }]} />
                <Text style={[local.dateSide, { fontSize: Math.max(12, pct(0.028)) }]}>{dateParts[2]}</Text>
              </View>
            ) : !!date && (
              <Text style={[local.dateSide, { marginTop: pct(0.045), fontSize: Math.max(12, pct(0.028)) }]}>{date}</Text>
            )}
            {!!location && (
              <Text style={[local.place, { marginTop: pct(0.016), maxWidth: pct(0.64), fontSize: Math.max(11, pct(0.023)) }]} numberOfLines={1}>
                {location.toUpperCase()}
              </Text>
            )}
            {editing && (
              <View style={local.editRow}>
                {!isAlbum && <EditChip field="title" label="Title" />}
                <EditChip field="date" label={date ? 'Date' : 'Add date'} adding={!date} />
                <EditChip field="message" label={message ? 'Message' : 'Add message'} adding={!message} />
              </View>
            )}
          </View>
        </View>
      </View>

      <View
        style={[
          local.tag,
          { top: tagTop, left: (width - pct(TAG_WIDTHS[tagSize])) / 2, width: pct(TAG_WIDTHS[tagSize]), minHeight: pct(0.26), paddingVertical: pct(tagSize === 'xlong' ? 0.024 : 0.03), paddingHorizontal: pct(0.02), gap: pct(tagSize === 'xlong' ? 0.012 : 0.018) },
        ]}
      >
        <Text style={[local.heart, { fontSize: pct(tagSize === 'xlong' ? 0.06 : 0.08), lineHeight: pct(tagSize === 'xlong' ? 0.07 : 0.09) }]} accessible={false}>♥</Text>
        {/* The host's message is italic in quotes; the fallback line is plain capitals */}
        <Text
          style={[local.tagline, message ? local.taglineMessage : local.taglineCaps, { fontSize: Math.max(message ? 9 : 8, pct(tagSize === 'xlong' ? 0.0175 : 0.019)) }]}
          numberOfLines={tagSize ? 4 : 2}
        >
          {message ? `“${message}”` : tagText.toUpperCase()}
        </Text>
      </View>

      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={[local.roundGlass, { top: insetTop + 8, left: 16 }]} activeOpacity={0.8}>
        <IconSymbol name="chevron.left" size={20} color="#ffffff" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onShare} accessibilityRole="button" accessibilityLabel="Share event" style={[local.roundGlass, { top: insetTop + 8, right: 16 }]} activeOpacity={0.8}>
        <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
      </TouchableOpacity>
      {/* Under Share */}
      <EditChip field="cover" label={coverSource ? 'Cover' : 'Add cover photo'} adding={!coverSource} at={{ top: insetTop + 62, right: 16 }} />

      <TouchableOpacity onPress={onOpenGallery} accessibilityRole="button" accessibilityLabel="Open gallery" style={[local.open, { bottom: insetBottom + 34, left: width / 2 - 25 }]} activeOpacity={0.85}>
        <IconSymbol name="arrow.down" size={20} color="#ffffff" />
      </TouchableOpacity>

      <ConfettiTear height={22} />
    </View>
  );
}

/** A title that isn't two names on one line, or two lines of about equal length */
function balancedLines(title: string): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  if (title.length <= 12 || words.length < 2) return [title];
  let best = 1;
  let bestGap = Number.POSITIVE_INFINITY;
  for (let split = 1; split < words.length; split += 1) {
    const gap = Math.abs(words.slice(0, split).join(' ').length - words.slice(split).join(' ').length);
    if (gap < bestGap) { best = split; bestGap = gap; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

const local = StyleSheet.create({
  screen: { backgroundColor: '#d9c7bd', overflow: 'hidden' },
  shade: { position: 'absolute', left: 0, right: 0 },
  circleBox: { position: 'absolute' },
  circle: {
    // See-through, so the photo shows behind the names (the website's 70% white)
    backgroundColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#3c1e1e',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
  },
  and: { color: CONFETTI_COLORS.ink, letterSpacing: 1.5 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateSide: { color: CONFETTI_COLORS.ink, fontFamily: Fonts.inter.medium },
  dateRule: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(42,39,39,0.35)' },
  day: { color: CONFETTI_COLORS.ink },
  place: { color: '#6b5f5f', fontFamily: Fonts.inter.medium, letterSpacing: 1.6, textAlign: 'center' },
  editRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  tag: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: CONFETTI_COLORS.ink },
  heart: { color: CONFETTI_COLORS.red },
  tagline: { color: '#ffffff', textAlign: 'center', lineHeight: undefined },
  taglineCaps: { fontFamily: Fonts.inter.semiBold, letterSpacing: 0.9 },
  taglineMessage: { fontFamily: Fonts.inter.medium, fontStyle: 'italic', letterSpacing: 0.2 },
  roundGlass: { position: 'absolute', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,16,12,0.32)' },
  open: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CONFETTI_COLORS.ink,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
