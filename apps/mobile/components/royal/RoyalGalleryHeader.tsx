import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GalleryHighlightVideo } from '@/components/event/GalleryHighlightVideo';
import type { GalleryVideo } from '@/lib/database';
import { coupleInitials } from './coupleNames';
import { RoyalCrest, RoyalPlaqueCorner, RoyalTitleRule } from './RoyalOrnaments';
import type { RoyalFontSet } from './royalFonts';

// Top of the gallery section in Royal Emerald, from the website (src/components/royal/RoyalGalleryHeader.tsx):
// crest, title between gold rules, the cinematic highlight video, the welcome plaque, Back and Share, then the
// Photos / Videos switch. On a phone the plaque is full width with Back and Share on a row under it.

type MediaTab = 'photos' | 'videos';

export function RoyalGalleryHeader({
  title,
  message,
  coupleTitle,
  video,
  selectedTemplate,
  fonts,
  onBack,
  onShare,
  tabs,
  activeTab,
  onTabChange,
}: {
  title: string;
  /** The host's welcome message, on the plaque */
  message?: string;
  /** Main gallery title, for the initials on the crest; leave out on album pages (the crest shows a fleur-de-lis) */
  coupleTitle?: string;
  video?: GalleryVideo | null;
  selectedTemplate: any;
  fonts: RoyalFontSet;
  onBack: () => void;
  onShare: () => void;
  tabs: { id: MediaTab; label: string }[];
  activeTab: MediaTab;
  onTabChange: (tab: MediaTab) => void;
}) {
  const initials = coupleTitle ? coupleInitials(coupleTitle) : null;
  const welcome = message?.trim();

  return (
    <View style={local.wrap} accessibilityLabel={`${title} gallery`}>
      <RoyalCrest initials={initials} width={150} fonts={fonts} />

      <View style={local.titleRow}>
        <View style={local.ruleSlot}><RoyalTitleRule /></View>
        <Text style={[local.title, { fontFamily: fonts.serif }]} accessibilityRole="header">{title}</Text>
        <View style={local.ruleSlot}><RoyalTitleRule flip /></View>
      </View>

      {video && <GalleryHighlightVideo video={video} title={title} selectedTemplate={selectedTemplate} />}

      {!!welcome && (
        <View style={local.plaque}>
          <LinearGradient
            colors={['#0f4535', '#073026', '#04211a']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[StyleSheet.absoluteFill, local.plaquePanel]}
          />
          <View style={local.plaqueInnerEdge} pointerEvents="none" />
          <View style={[local.plaqueCorner, { top: -10, left: -10 }]}><RoyalPlaqueCorner size={44} /></View>
          <View style={[local.plaqueCorner, { top: -10, right: -10 }]}><RoyalPlaqueCorner size={44} flip="x" /></View>
          <View style={[local.plaqueCorner, { bottom: -10, left: -10 }]}><RoyalPlaqueCorner size={44} flip="y" /></View>
          <View style={[local.plaqueCorner, { bottom: -10, right: -10 }]}><RoyalPlaqueCorner size={44} flip="xy" /></View>
          <View style={[local.plaqueDiamond, { left: -7 }]} />
          <View style={[local.plaqueDiamond, { right: -7 }]} />
          <Text style={[local.plaqueText, { fontFamily: fonts.serif }]}>{welcome}</Text>
        </View>
      )}

      <View style={local.sideRow}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={local.side} activeOpacity={0.8}>
          <IconSymbol name="chevron.left" size={14} color="#e9cf96" />
          <Text style={[local.sideText, { fontFamily: fonts.displayBold }]}>BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onShare} accessibilityRole="button" accessibilityLabel="Share event" style={local.side} activeOpacity={0.8}>
          <IconSymbol name="square.and.arrow.up" size={14} color="#e9cf96" />
          <Text style={[local.sideText, { fontFamily: fonts.displayBold }]}>SHARE</Text>
        </TouchableOpacity>
      </View>

      <View style={local.tabs} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          const label = <Text style={[local.tabText, { fontFamily: fonts.displayBold }, active && { color: '#1c1406' }]}>{tab.label.toUpperCase()}</Text>;
          return (
            <TouchableOpacity
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onTabChange(tab.id)}
              style={local.tab}
              activeOpacity={0.85}
            >
              {active ? (
                <LinearGradient colors={['#f6dc9a', '#d6ac5c', '#b8873a']} style={local.tabActive}>{label}</LinearGradient>
              ) : (
                <View style={local.tabIdle}>{label}</View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  wrap: { paddingTop: 22, paddingHorizontal: 16, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 4, width: '100%' },
  // The rules take what the title leaves, so the title only wraps between words
  ruleSlot: { flex: 1, minWidth: 20, alignItems: 'stretch' },
  title: {
    flexShrink: 0,
    maxWidth: '76%',
    color: '#e8c87e',
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  plaque: { alignSelf: 'stretch', marginTop: 30, marginHorizontal: 6, paddingVertical: 24, paddingHorizontal: 30 },
  plaquePanel: { borderWidth: 2, borderColor: '#d9b46a' },
  plaqueInnerEdge: { position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderWidth: 1, borderColor: 'rgba(202,156,105,0.6)' },
  plaqueCorner: { position: 'absolute' },
  plaqueDiamond: {
    position: 'absolute',
    top: '50%',
    marginTop: -7,
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: '#d9b46a',
    backgroundColor: '#073026',
    transform: [{ rotate: '45deg' }],
  },
  plaqueText: { color: '#f3eee2', fontSize: 17, lineHeight: 26, textAlign: 'center' },
  sideRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 22 },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(202,156,105,0.28)',
    borderRadius: 4,
    backgroundColor: '#0a2f25',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sideText: { color: '#e9cf96', fontSize: 12, letterSpacing: 1.9 },
  tabs: { flexDirection: 'row', gap: 4, marginTop: 24, marginBottom: 14, padding: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(202,156,105,0.6)', backgroundColor: 'rgba(4,33,26,0.8)' },
  tab: { borderRadius: 999, overflow: 'hidden' },
  tabActive: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  tabIdle: { paddingVertical: 11, paddingHorizontal: 18 },
  tabText: { color: '#e9cf96', fontSize: 12, letterSpacing: 1 },
});
