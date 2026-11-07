import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HighlightPlayer } from '@/components/event/GalleryHighlightVideo';
import { EditChip, useGuestEditSpots } from '@/components/event/guestEdit/EditChip';
import { GUEST_EDIT_ENABLED } from '@/components/event/guestEdit/useGuestEdit';
import { SOCIAL_ICONS } from '@/components/icons/SocialIcons';
import { Fonts } from '@/constants/theme';
import type { GalleryVideo } from '@/lib/database';
import { splitCoupleNames } from '../../../../shared/text/coupleNames';
import { CONFETTI_COLORS, CONFETTI_FRAME_SPECKS, confettiCoupleHeading } from '../../../../shared/themes/confettiCircle';
import {
  COUPLE_SIDES,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_NAMES,
  coupleSideEditName,
  shownCouple,
  type CoupleBlock,
  type CouplePerson,
  type CoupleSide,
} from '../../../../shared/themes/themeContent';
import { ConfettiSpecks } from './ConfettiBits';
import { type ConfettiFontSet } from './confettiFonts';

// Confetti Circle's section between the cover and the gallery, from the website (src/components/confetti/
// ConfettiCoupleSection.tsx): a big heading, the highlight video (or, without one, the cover photo) in a widescreen frame
// that fades out at its edges, with paint specks and a white "Name ♥ Name" ribbon, then the couple side by side, each
// with a few words and their social links.
//
// The couple comes from the main event's theme content (todo #10): only a side with a name shows, with only what was
// filled in; the ribbon says "Name ♥ Name" once both names are in, else the event's title. Nothing is taken from the
// title. While edit mode is off (EXPO_PUBLIC_GUEST_EDIT_MODE) hosts can't fill it in, so, as on the website, the section
// keeps the two names of a "Name and Name" title with placeholder words and icons.

const PLACEHOLDER_BIO = 'A few words about them will show here once the couple adds them in the theme editor.';
const PLACEHOLDER_NETWORKS = ['facebook', 'instagram', 'x'] as const;

export interface ConfettiCoupleSectionProps {
  /** The main event's title: the ribbon's text until both names are filled in */
  title: string;
  category?: string;
  /** The couple as the host filled it in (the main event's theme content) */
  couple?: CoupleBlock;
  video?: GalleryVideo | null;
  /** The cover, shown in the frame when there is no video */
  coverSource?: ImageSourcePropType | null;
  /** The content's width (the event screen's content has 24px side padding) */
  width: number;
  fonts: ConfettiFontSet;
}

function Person({ side, person, placeholder, editName, fonts }: {
  side: CoupleSide;
  person: CouplePerson;
  placeholder?: boolean;
  /** What the pencil calls this side ("bride"); set only while editing */
  editName?: string;
  fonts: ConfettiFontSet;
}) {
  const networks = placeholder ? PLACEHOLDER_NETWORKS : SOCIAL_NETWORKS.filter((network) => person.links[network]);
  return (
    <View style={local.person}>
      {!!person.label && <Text style={[local.role, { fontFamily: fonts.display }]}>{person.label.toUpperCase()}</Text>}
      <Text style={[local.name, { fontFamily: fonts.display }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
        {person.name.toUpperCase()}
      </Text>
      {!!person.about && <Text style={local.bio}>{person.about}</Text>}
      {networks.length > 0 && (
        <View style={local.socials} accessibilityLabel={placeholder ? `${person.name}'s social links (not added yet)` : `${person.name}'s social links`}>
          {networks.map((network) => {
            const Icon = SOCIAL_ICONS[network];
            const url = person.links[network];
            const label = `${person.name} on ${SOCIAL_NETWORK_NAMES[network]}`;
            return placeholder || !url ? (
              <View key={network} style={local.social} accessibilityLabel={`${SOCIAL_NETWORK_NAMES[network]} (not added yet)`}>
                <Icon size={16} color={CONFETTI_COLORS.ink} />
              </View>
            ) : (
              <TouchableOpacity key={network} style={local.social} onPress={() => { void Linking.openURL(url); }} accessibilityRole="link" accessibilityLabel={label} hitSlop={4}>
                <Icon size={16} color={CONFETTI_COLORS.ink} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {!!editName && (
        <View style={local.personEdit}>
          <EditChip field="couple" part={side} label={editName.charAt(0).toUpperCase() + editName.slice(1)} />
        </View>
      )}
    </View>
  );
}

export function ConfettiCoupleSection({ title, category, couple, video, coverSource, width, fonts }: ConfettiCoupleSectionProps) {
  const [playing, setPlaying] = useState(false);
  const heading = confettiCoupleHeading(category);
  // Edit mode (todo #11): a pencil on each side, or, for an empty side, only a place to add it; guests see none
  const editing = useGuestEditSpots();

  // Edit mode off: the names of a "Name and Name" title with placeholders, as on the website before todo #10
  const titleNames = GUEST_EDIT_ENABLED ? null : splitCoupleNames(title);
  // Edit mode on: only the sides the host named
  const shown = GUEST_EDIT_ENABLED ? shownCouple(couple) : {};
  const people: { side: CoupleSide; person?: CouplePerson; placeholder?: boolean }[] = titleNames
    ? [
      { side: 'left', person: { label: 'The Bride', name: titleNames[0], about: PLACEHOLDER_BIO, links: {} }, placeholder: true },
      { side: 'right', person: { label: 'The Groom', name: titleNames[1], about: PLACEHOLDER_BIO, links: {} }, placeholder: true },
    ]
    // While editing, both sides (an empty one as a place to add it)
    : COUPLE_SIDES.flatMap((side) => (shown[side] || editing ? [{ side, person: shown[side] }] : []));
  const ribbonNames = titleNames || (shown.left && shown.right ? [shown.left.name, shown.right.name] : null);

  const frameHeight = Math.round((width * 9) / 16);
  const still: ImageSourcePropType | null | undefined = video?.posterUrl ? { uri: video.posterUrl } : coverSource;
  const ribbonWidth = Math.round(width * 0.74);
  const ribbonFont = Math.max(16, Math.round(width * 0.052));
  const ribbonHeight = ribbonFont + Math.round(width * 0.052);

  return (
    <View style={local.section} accessibilityLabel={heading}>
      <Text style={[local.heading, { fontFamily: fonts.display }]} accessibilityRole="header">{heading.toUpperCase()}</Text>

      <View style={{ width, paddingBottom: Math.round(width * 0.06) }}>
        {video && playing ? (
          // Playing: the whole film in a plain box, so its controls aren't faded
          <View style={[local.playing, { aspectRatio: video.width && video.height ? video.width / video.height : 16 / 9 }]}>
            <HighlightPlayer src={video.streamUrl} />
          </View>
        ) : (
          <View style={{ width, height: frameHeight }}>
            <ConfettiSpecks specks={CONFETTI_FRAME_SPECKS} width={width} style={{ top: '-6%', bottom: '-6%', left: '-4%', right: '-4%' }} />
            {still ? (
              <ExpoImage source={still} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
            ) : (
              <LinearGradient colors={['#efe1d6', '#c9b1a5']} style={StyleSheet.absoluteFill} />
            )}
            {/* Soft on all four sides, fading into the paper */}
            <LinearGradient colors={[CONFETTI_COLORS.paper, 'rgba(252,252,250,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[local.fade, { left: 0, top: 0, bottom: 0, width: width * 0.09 }]} pointerEvents="none" />
            <LinearGradient colors={['rgba(252,252,250,0)', CONFETTI_COLORS.paper]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[local.fade, { right: 0, top: 0, bottom: 0, width: width * 0.09 }]} pointerEvents="none" />
            <LinearGradient colors={[CONFETTI_COLORS.paper, 'rgba(252,252,250,0)']} style={[local.fade, { left: 0, right: 0, top: 0, height: frameHeight * 0.12 }]} pointerEvents="none" />
            <LinearGradient colors={['rgba(252,252,250,0)', CONFETTI_COLORS.paper]} style={[local.fade, { left: 0, right: 0, bottom: 0, height: frameHeight * 0.12 }]} pointerEvents="none" />
            {video && (
              <TouchableOpacity onPress={() => setPlaying(true)} accessibilityRole="button" accessibilityLabel="Play the highlight video" style={local.play} activeOpacity={0.85}>
                <IconSymbol name="play.fill" size={22} color={CONFETTI_COLORS.pink} />
              </TouchableOpacity>
            )}
            {/* Edit mode (todo #11): the highlight video, or a place to add one (the frame shows the cover until then) */}
            <EditChip field="video" label={video ? 'Video' : 'Add highlight video'} adding={!video} at={{ top: 10, right: 10 }} />
          </View>
        )}

        {/* White ribbon with slanted ends over the bottom of the photo */}
        <View
          style={[
            local.ribbon,
            { width: ribbonWidth, height: ribbonHeight },
            // Over the photo's bottom edge; under the film while it plays
            video && playing ? local.ribbonPlaying : { position: 'absolute', left: (width - ribbonWidth) / 2, bottom: Math.round(width * 0.03) },
          ]}
        >
          <Svg width={ribbonWidth} height={ribbonHeight} style={StyleSheet.absoluteFill}>
            <Polygon points={`0,0 ${ribbonWidth},0 ${ribbonWidth * 0.96},${ribbonHeight} ${ribbonWidth * 0.04},${ribbonHeight}`} fill="#ffffff" />
          </Svg>
          <Text style={[local.ribbonText, { fontFamily: fonts.display, fontSize: ribbonFont }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {ribbonNames ? (
              <>
                {ribbonNames[0].toUpperCase()}
                {/* In the system font: Bebas Neue has no heart */}
                <Text style={{ color: CONFETTI_COLORS.pink, fontSize: ribbonFont * 0.7, fontFamily: Fonts.inter.bold }}>{'  ♥  '}</Text>
                {ribbonNames[1].toUpperCase()}
              </>
            ) : title.toUpperCase()}
          </Text>
        </View>
      </View>

      {people.length > 0 && (
        <View style={local.people}>
          {people.map(({ side, person, placeholder }) => person ? (
            <Person key={side} side={side} person={person} placeholder={placeholder} editName={editing ? coupleSideEditName(couple, side, category) : undefined} fonts={fonts} />
          ) : (
            <View key={side} style={local.person}>
              <EditChip field="couple" part={side} label={`Add ${coupleSideEditName(couple, side, category)}`} adding />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  section: { alignItems: 'center', paddingTop: 8, paddingBottom: 48 },
  heading: { color: CONFETTI_COLORS.ink, fontSize: 40, lineHeight: 42, letterSpacing: 0.4, textAlign: 'center', marginBottom: 28 },
  fade: { position: 'absolute' },
  play: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 56,
    height: 56,
    marginLeft: -28,
    marginTop: -28,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  playing: { width: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
  ribbon: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 9, shadowOffset: { width: 0, height: 6 } },
  ribbonPlaying: { alignSelf: 'center', marginTop: -6 },
  ribbonText: { color: CONFETTI_COLORS.ink, letterSpacing: 1.2 },
  people: { flexDirection: 'row', alignSelf: 'stretch', gap: 20, marginTop: 12 },
  person: { flex: 1, alignItems: 'center', minWidth: 0 },
  personEdit: { marginTop: 14 },
  role: { color: CONFETTI_COLORS.pink, fontSize: 17, letterSpacing: 1, marginBottom: 4 },
  name: { color: CONFETTI_COLORS.ink, fontSize: 30, lineHeight: 32, textAlign: 'center' },
  bio: { marginTop: 12, color: '#5d5555', fontFamily: Fonts.inter.regular, fontSize: 14, lineHeight: 23, textAlign: 'center' },
  socials: { flexDirection: 'row', gap: 8, marginTop: 16 },
  social: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(42,39,39,0.14)', alignItems: 'center', justifyContent: 'center' },
});
