import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { type ClassicHeroProps } from '@/components/classic/ClassicHero';
import { coverContentPosition, coverZoomStyle } from '@/lib/coverStyle';
import { Fonts } from '@/constants/theme';
import { EditChip, useGuestEditSpots } from '@/components/event/guestEdit/EditChip';
import { coupleInitials, displayCoupleTitle, splitCoupleNames } from '../../../../shared/text/coupleNames';
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

// Confetti Circle cover for phones, from the design's phone layout (website: src/components/TemplateConfetti.tsx,
// confetti-circle.css): a soft-white top bar with Back, the couple's initials "S ♥ R" and Share; under it a band of the
// cover photo with a big see-through white circle holding the couple's names in pink-to-orange capitals, "- and -"
// between them, the date as "March | 28 | 2025" and the place. A dark tag hangs from the top bar onto the circle's top
// edge with a red heart and the gallery's message (italic, in quotes); paint specks fall round the circle and a
// torn-paper edge leads straight into the gallery tabs.

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
  fonts: ConfettiFontSet;
  onBack: () => void;
  onShare: () => void;
}

const NAME_SIZES = { '': 0.19, long: 0.14, xlong: 0.1 } as const;
// The top bar under the clock, and the circle's size: about 80% of the screen's width, as in the design's phone layout
const BAR_HEIGHT = 52;
const confettiCircleSize = (width: number) => Math.round(width * 0.8);

/** The cover's height for this screen: the top bar, the part of the tag above the circle, the circle, room for the
 *  specks and the torn edge. The event screen sizes the cover with it. */
export function confettiHeroHeight(width: number, insetTop: number): number {
  const circle = confettiCircleSize(width);
  return insetTop + BAR_HEIGHT + Math.round(circle * 0.09) + circle + 30;
}
const TAG_WIDTHS = { '': 0.27, long: 0.34, xlong: 0.4 } as const;

export function ConfettiHero({ gallery, mainTitle, mainCategory, isAlbum = false, coverSource, width, height, insetTop, fonts, onBack, onShare }: ConfettiHeroProps) {
  // The cover image's size, to zoom it around the focus point (lib/coverStyle.ts)
  const [coverSize, setCoverSize] = React.useState<{ width: number; height: number }>();
  const rawTitle = (mainTitle || gallery.title || '').trim();
  const couple = splitCoupleNames(rawTitle);
  const initials = coupleInitials(rawTitle);
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

  // The photo starts under the top bar; the tag hangs from the bar, the circle's top edge 9% of its width below it
  const photoTop = insetTop + BAR_HEIGHT;
  const tagTop = photoTop;
  const circle = confettiCircleSize(width);
  const circleTop = tagTop + Math.round(circle * 0.09);
  const pct = (share: number) => Math.round(circle * share * 10) / 10;
  const lineWidth = pct(0.84);

  const longest = couple ? Math.max(couple[0].length, couple[1].length) : title.length;
  const nameSize = pct(NAME_SIZES[confettiNameSize(longest)]);
  // A title that isn't two names: up to two balanced lines
  const singleLines = couple ? null : balancedLines(title);

  return (
    <View style={[local.screen, { width, height }]}>
      <View style={[local.photo, { top: photoTop }]}>
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
      </View>

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

      {/* Top bar: Back, the couple's initials, Share */}
      <View style={[local.bar, { height: photoTop, paddingTop: insetTop }]}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={local.barButton} activeOpacity={0.7} hitSlop={6}>
          <IconSymbol name="chevron.left" size={20} color={CONFETTI_COLORS.ink} />
        </TouchableOpacity>
        {initials ? (
          <View style={local.initials} accessible accessibilityRole="header" accessibilityLabel={`${initials[0]} and ${initials[1]}`}>
            <Text style={[local.initial, { fontFamily: fonts.display }]}>{initials[0]}</Text>
            {/* In the system font: Bebas Neue has no heart */}
            <Text style={local.initialsHeart}>♥</Text>
            <Text style={[local.initial, { fontFamily: fonts.display }]}>{initials[1]}</Text>
          </View>
        ) : <View />}
        <TouchableOpacity onPress={onShare} accessibilityRole="button" accessibilityLabel="Share event" style={local.barButton} activeOpacity={0.7} hitSlop={6}>
          <IconSymbol name="square.and.arrow.up" size={18} color={CONFETTI_COLORS.ink} />
        </TouchableOpacity>
      </View>
      {/* On the photo, under Share */}
      <EditChip field="cover" label={coverSource ? 'Cover' : 'Add cover photo'} adding={!coverSource} at={{ top: photoTop + 10, right: 12 }} />

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
  screen: { backgroundColor: CONFETTI_COLORS.paper, overflow: 'hidden' },
  photo: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: '#d9c7bd' },
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8,
    backgroundColor: CONFETTI_COLORS.paper,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(42,39,39,0.12)',
  },
  barButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  initials: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  initial: { color: CONFETTI_COLORS.ink, fontSize: 30, lineHeight: 34 },
  initialsHeart: { color: CONFETTI_COLORS.pink, fontSize: 16, fontFamily: Fonts.inter.bold },
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
});
