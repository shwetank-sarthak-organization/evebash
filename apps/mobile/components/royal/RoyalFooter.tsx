import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { displayCoupleTitle } from './coupleNames';
import { ROYAL_GOLD, RoyalCrown } from './RoyalOrnaments';
import type { RoyalFontSet } from './royalFonts';

// Royal Emerald footer, from the website (TemplateRoyal.tsx): crown, the title and "Made with EveBash". The app
// leaves out the website's EveBash and help/legal links.

export function RoyalFooter({ title, fonts, bottomInset }: { title?: string; fonts: RoyalFontSet; bottomInset: number }) {
  const router = useRouter();

  return (
    <View style={[local.footer, { paddingBottom: bottomInset + 14 }]}>
      <RoyalCrown size={22} />
      {/* Trailing space and side padding keep Android from clipping the script swashes */}
      {!!title && (
        <Text style={[local.title, { fontFamily: fonts.script }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
          {displayCoupleTitle(title)}{' '}
        </Text>
      )}
      <View style={local.madeRow}>
        <Text style={[local.made, { fontFamily: fonts.serif }]}>Made with </Text>
        <TouchableOpacity onPress={() => router.push('/')} accessibilityRole="link">
          <Text style={local.brand}>EveBash</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  // Edge to edge and down to the bottom: the event screen's content has 24px padding all round
  footer: { marginTop: 4, marginHorizontal: -24, marginBottom: -24, paddingTop: 18, paddingHorizontal: 20, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(202,156,105,0.2)', backgroundColor: '#021a15' },
  title: { alignSelf: 'stretch', marginTop: 2, paddingHorizontal: 10, color: '#e8c87e', fontSize: 30, lineHeight: 40, textAlign: 'center' },
  madeRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  made: { color: 'rgba(243,238,226,0.75)', fontSize: 15 },
  // The EveBash name in its brand font, as on the website
  brand: { color: ROYAL_GOLD, fontSize: 19, fontFamily: 'AkayaKanadakaHeader_400Regular' },
});
