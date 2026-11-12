import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Fonts } from '@/constants/theme';
import { coupleInitials, displayCoupleTitle } from '../../../../shared/text/coupleNames';
import { CONFETTI_COLORS, CONFETTI_FOOTER_TEAR_PAPER_PATH, CONFETTI_FOOTER_TEAR_SHADOW_PATH } from '../../../../shared/themes/confettiCircle';
import { type ConfettiFontSet } from './confettiFonts';

// Confetti Circle footer, from the website (src/components/confetti/ConfettiFooter.tsx): a torn-paper edge, then the
// couple's initials "S ♥ R" with "Made with EveBash" under them, and the EveBash links at the far left and the legal
// ones at the far right (the app's own screens, in the website's order). Titles that aren't two names show the title.

const LEFT_LINKS: { label: string; href: Href }[] = [
  { label: 'Create your own event', href: { pathname: '/(tabs)/gallery', params: { create: '1' } } },
  { label: 'Sample galleries', href: '/sample-galleries' },
  { label: 'Pricing', href: '/(tabs)/pricing' },
];
const RIGHT_LINKS: { label: string; href: Href }[] = [
  { label: 'Privacy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms-and-conditions' },
  { label: 'Contact us', href: '/contact' },
];

export function ConfettiFooter({ title, fonts, bottomInset }: { title?: string; fonts: ConfettiFontSet; bottomInset: number }) {
  const router = useRouter();
  // The torn edge runs the screen's full width (a percentage width would leave out the footer's side padding)
  const { width: screenWidth } = useWindowDimensions();
  const initials = title ? coupleInitials(title) : null;

  const links = (items: typeof LEFT_LINKS, align: 'left' | 'right') => (
    <View style={[local.links, { alignItems: align === 'left' ? 'flex-start' : 'flex-end' }]}>
      {items.map((link) => (
        <TouchableOpacity key={link.label} onPress={() => router.push(link.href)} accessibilityRole="link" hitSlop={6}>
          <Text style={[local.link, { textAlign: align }]}>{link.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[local.footer, { paddingBottom: bottomInset + 28 }]}>
      <LinearGradient colors={['#e4e0de', '#ebe7e4', '#f3f0ed']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      {/* The torn edge faces up into the page: the paper above, a soft grey shadow just under it */}
      <Svg width={screenWidth} height={28} viewBox="0 0 1440 60" preserveAspectRatio="none" style={[local.tear, { transform: [{ scaleY: -1 }] }]}>
        <Path d={CONFETTI_FOOTER_TEAR_SHADOW_PATH} fill="#c3bcb9" opacity={0.9} />
        <Path d={CONFETTI_FOOTER_TEAR_PAPER_PATH} fill={CONFETTI_COLORS.paper} />
      </Svg>

      <View style={local.middle}>
        {initials ? (
          <View style={local.coupleRow} accessible accessibilityLabel={`${initials[0]} and ${initials[1]}`}>
            <Text style={[local.couple, { fontFamily: fonts.display }]}>{initials[0]}</Text>
            <Text style={local.heart}>♥</Text>
            <Text style={[local.couple, { fontFamily: fonts.display }]}>{initials[1]}</Text>
          </View>
        ) : !!title && (
          <Text style={[local.coupleTitle, { fontFamily: fonts.display }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
            {displayCoupleTitle(title).toUpperCase()}
          </Text>
        )}
        <View style={local.madeRow}>
          <Text style={local.made}>Made with </Text>
          <TouchableOpacity onPress={() => router.push('/')} accessibilityRole="link">
            <Text style={local.brand}>EveBash</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={local.linkRow}>
        {links(LEFT_LINKS, 'left')}
        {links(RIGHT_LINKS, 'right')}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  // Edge to edge and down to the bottom: the event screen's content has 24px padding all round
  footer: { marginTop: 8, marginHorizontal: -24, marginBottom: -24, paddingTop: 56, paddingHorizontal: 20, overflow: 'hidden' },
  tear: { position: 'absolute', top: -1, left: 0, right: 0 },
  middle: { alignItems: 'center' },
  coupleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  couple: { color: CONFETTI_COLORS.ink, fontSize: 56, lineHeight: 58 },
  coupleTitle: { color: CONFETTI_COLORS.ink, fontSize: 34, lineHeight: 36, textAlign: 'center' },
  heart: { color: CONFETTI_COLORS.pink, fontSize: 30 },
  madeRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  made: { color: '#6b6262', fontFamily: Fonts.inter.regular, fontSize: 14 },
  // The EveBash name in its brand font, as on the website
  brand: { color: CONFETTI_COLORS.ink, fontSize: 19, fontFamily: 'AkayaKanadakaHeader_400Regular' },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  links: { gap: 10 },
  link: { color: '#4a4444', fontFamily: Fonts.inter.medium, fontSize: 15 },
});
