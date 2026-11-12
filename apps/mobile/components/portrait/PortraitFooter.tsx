import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { displayCoupleTitle } from '../../../../shared/text/coupleNames';
import { PORTRAIT, type PortraitFontSet } from './portraitFonts';

// Sunlit Portrait footer, from the website (src/components/portrait/PortraitFooter.tsx): on the cover's ink, the
// couple's names in Instrument Serif on one line and "Made with EveBash". Like Royal Emerald's app footer, it leaves
// out the website's EveBash and legal links.

export function PortraitFooter({ title, fonts, bottomInset }: { title?: string; fonts: PortraitFontSet; bottomInset: number }) {
  const router = useRouter();

  return (
    <View style={[local.footer, { paddingBottom: bottomInset + 18 }]}>
      {!!title && (
        <Text style={[local.title, { fontFamily: fonts.serif }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
          {displayCoupleTitle(title)}
        </Text>
      )}
      <View style={local.madeRow}>
        <Text style={local.made}>Made with </Text>
        <TouchableOpacity onPress={() => router.push('/')} accessibilityRole="link">
          <Text style={local.brand}>EveBash</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  // Edge to edge and down to the bottom: the event screen's content has 24px padding all round
  footer: { marginTop: 8, marginHorizontal: -24, marginBottom: -24, paddingTop: 24, paddingHorizontal: 20, alignItems: 'center', backgroundColor: PORTRAIT.ink },
  title: { alignSelf: 'stretch', color: '#ffffff', fontSize: 40, lineHeight: 48, textAlign: 'center' },
  madeRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  made: { color: 'rgba(251,248,243,0.7)', fontSize: 14 },
  // The EveBash name in its brand font, as on the website
  brand: { color: '#ffffff', fontSize: 18, fontFamily: 'AkayaKanadakaHeader_400Regular' },
});
