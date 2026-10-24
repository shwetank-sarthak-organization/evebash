import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GalleryHighlightVideo } from '@/components/event/GalleryHighlightVideo';
import type { GalleryVideo } from '@/lib/database';
import { CLASSIC } from './ClassicHero';
import type { ClassicFontSet } from './classicFonts';

// Top of the gallery section in Classic White, from the website (src/components/classic/ClassicGalleryHeader.tsx):
// the gallery name in capitals, the date, the host's gallery message in quotes, the highlight video in a white mat,
// then the [ Photos ] [ Videos ] switch just above the grid. The website puts the video beside the text; a phone
// stacks them, and Back / Share are on the cover (ClassicHero), beside Open Gallery.

type MediaTab = 'photos' | 'videos';

export function ClassicGalleryHeader({
  title,
  details,
  message,
  video,
  selectedTemplate,
  fonts,
  tabs,
  activeTab,
  onTabChange,
}: {
  title: string;
  /** Date line under the title; left out when empty */
  details?: string;
  /** The host's gallery message; left out when empty */
  message?: string;
  video?: GalleryVideo | null;
  selectedTemplate: any;
  fonts: ClassicFontSet;
  tabs: { id: MediaTab; label: string }[];
  activeTab: MediaTab;
  onTabChange: (tab: MediaTab) => void;
}) {
  const text = message?.trim();

  return (
    <View style={local.wrap} accessibilityLabel={`${title} gallery`}>
      <Text style={[local.title, { fontFamily: fonts.serifMedium }]} accessibilityRole="header">{title.toUpperCase()}</Text>
      {!!details && <Text style={[local.details, { fontFamily: fonts.serifItalic }]}>{details}</Text>}
      {!!text && <Text style={[local.message, { fontFamily: fonts.serifItalic }]}>{`“${text}”`}</Text>}

      {video && <GalleryHighlightVideo video={video} title={title} selectedTemplate={selectedTemplate} />}

      <View style={local.tabs} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onTabChange(tab.id)}
              style={[local.tab, active && local.tabActive]}
              activeOpacity={0.8}
            >
              <Text style={[local.tabText, active && { color: CLASSIC.text }]}>
                <Text accessibilityElementsHidden importantForAccessibility="no">[ </Text>
                {tab.label}
                <Text accessibilityElementsHidden importantForAccessibility="no"> ]</Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  wrap: { paddingTop: 28, paddingHorizontal: 16, paddingBottom: 14 },
  title: { color: '#1F2620', fontSize: 34, lineHeight: 38, letterSpacing: -0.2 },
  details: { marginTop: 12, color: CLASSIC.text, fontSize: 18, lineHeight: 24 },
  message: { marginTop: 10, color: CLASSIC.muted, fontSize: 16, lineHeight: 25 },
  tabs: {
    flexDirection: 'row',
    // Centred on the phone screen (the website keeps them under the text, on the left)
    alignSelf: 'center',
    gap: 32,
    marginTop: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(44,53,46,0.18)',
  },
  tab: { paddingBottom: 10, marginBottom: -1, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: CLASSIC.muted },
  tabText: { color: CLASSIC.muted, fontSize: 16 },
});
