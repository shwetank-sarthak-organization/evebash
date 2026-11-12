import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { EditChip, useGuestEditSpots } from '@/components/event/guestEdit/EditChip';
import { displayCoupleTitle } from '../../../../shared/text/coupleNames';
import { CONFETTI_COLORS, CONFETTI_TAG_LONG_MESSAGE } from '../../../../shared/themes/confettiCircle';
import { type ConfettiFontSet } from './confettiFonts';

// Top of the gallery section in Confetti Circle, from the website (src/components/confetti/ConfettiGalleryHeader.tsx):
// Back / Share in a thin row, the gallery's name big in the theme's capitals, then "PHOTO GALLERY | VIDEO GALLERY"
// under it as on the website's phone layout (the chosen one pink). A message too long for the cover's tag is shown in
// full under them, in italics.

type MediaTab = 'photos' | 'videos';

export interface ConfettiGalleryHeaderProps {
  /** The gallery's name ("Captured moments" if empty); "A and B" shows as "A & B" like the cover */
  title?: string;
  /** The gallery's message; shown here only when the cover's tag had to cut it */
  message?: string;
  fonts: ConfettiFontSet;
  backLabel: string;
  onBack: () => void;
  onShare: () => void;
  photoCount: string;
  videoCount: string;
  activeTab: MediaTab;
  onTabChange: (tab: MediaTab) => void;
}

export function ConfettiGalleryHeader({ title, message, fonts, backLabel, onBack, onShare, photoCount, videoCount, activeTab, onTabChange }: ConfettiGalleryHeaderProps) {
  const heading = displayCoupleTitle((title || '').trim()) || 'Captured moments';
  const trimmed = (message || '').trim();
  const fullMessage = trimmed.length > CONFETTI_TAG_LONG_MESSAGE ? trimmed : '';
  // Edit mode (todo #11): a pencil on the gallery's name (the message and video have theirs on the cover and the film)
  const editing = useGuestEditSpots();

  const tab = (id: MediaTab, label: string, count: string, divider: boolean) => {
    const active = id === activeTab;
    return (
      <TouchableOpacity
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${label} (${count})`}
        onPress={() => onTabChange(id)}
        style={[local.tab, divider && local.tabDivider]}
        activeOpacity={0.8}
      >
        <Text style={[local.tabText, { fontFamily: fonts.display, color: active ? CONFETTI_COLORS.pink : 'rgba(42,39,39,0.5)' }]}>{label.toUpperCase()}</Text>
        <Text style={[local.count, { color: active ? CONFETTI_COLORS.pink : 'rgba(42,39,39,0.5)' }]}>{count}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={local.header} accessibilityLabel={`${heading} gallery`}>
      <View style={local.actions}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" style={local.action} activeOpacity={0.7} hitSlop={8}>
          <IconSymbol name="chevron.left" size={14} color={CONFETTI_COLORS.ink} />
          <Text style={[local.actionText, { fontFamily: fonts.display }]}>{backLabel.toUpperCase()}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onShare} accessibilityRole="button" accessibilityLabel="Share event" style={local.action} activeOpacity={0.7} hitSlop={8}>
          <IconSymbol name="square.and.arrow.up" size={14} color={CONFETTI_COLORS.ink} />
          <Text style={[local.actionText, { fontFamily: fonts.display }]}>SHARE EVENT</Text>
        </TouchableOpacity>
      </View>

      <Text style={[local.title, { fontFamily: fonts.display }]} accessibilityRole="header">{heading.toUpperCase()}</Text>
      {editing && <View style={local.editRow}><EditChip field="title" label="Title" /></View>}

      <View style={local.tabs} accessibilityRole="tablist">
        {tab('photos', 'Photo gallery', photoCount, true)}
        {tab('videos', 'Video gallery', videoCount, false)}
      </View>

      {!!fullMessage && <Text style={local.message}>{`“${fullMessage}”`}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 22 },
  actions: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6 },
  actionText: { color: CONFETTI_COLORS.ink, fontSize: 17, letterSpacing: 1 },
  title: { color: CONFETTI_COLORS.ink, fontSize: 40, lineHeight: 42, letterSpacing: 0.4, textAlign: 'center' },
  editRow: { marginTop: 10 },
  tabs: { flexDirection: 'row', marginTop: 14 },
  tab: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingVertical: 6, paddingHorizontal: 14 },
  tabDivider: { borderRightWidth: 1, borderRightColor: 'rgba(42,39,39,0.16)' },
  tabText: { fontSize: 20, letterSpacing: 0.8 },
  count: { fontFamily: Fonts.inter.semiBold, fontSize: 12 },
  message: { marginTop: 18, color: '#5d5555', fontFamily: Fonts.inter.regular, fontStyle: 'italic', fontSize: 15, lineHeight: 25, textAlign: 'center' },
});
