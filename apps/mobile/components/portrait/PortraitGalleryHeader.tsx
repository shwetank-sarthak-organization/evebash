import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HighlightPlayer } from '@/components/event/GalleryHighlightVideo';
import type { GalleryVideo } from '@/lib/database';
import { PORTRAIT, type PortraitFontSet } from './portraitFonts';

// Top of the gallery section in Sunlit Portrait, from the website (src/components/portrait/PortraitGalleryHeader.tsx).
// With a highlight film the opening fills the screen under the gallery tabs, like the cover: the film edge to edge
// with Back / Share on its top edge (hidden while it plays), the date, gallery name and host's message at the bottom
// left and a round play button at the bottom right. Without one, Back / Share sit on a thin line with the name and
// message under it on paper. Then "Photos" and "Videos" in the serif with the count raised, the chosen one marked with a clay dot.

type MediaTab = 'photos' | 'videos';

export interface PortraitGalleryHeaderProps {
  title: string;
  /** Date line above the name; left out when empty */
  details?: string;
  /** The host's gallery message; left out when empty */
  message?: string;
  video?: GalleryVideo | null;
  fonts: PortraitFontSet;
  width: number;
  /** Height of the opening with a film: the screen under the pinned gallery tabs */
  screenHeight: number;
  backLabel: string;
  onBack: () => void;
  onShare: () => void;
  photoCount: string;
  videoCount: string;
  activeTab: MediaTab;
  onTabChange: (tab: MediaTab) => void;
}

function Strip({ onFilm, backLabel, onBack, onShare, fonts }: { onFilm: boolean } & Pick<PortraitGalleryHeaderProps, 'backLabel' | 'onBack' | 'onShare' | 'fonts'>) {
  const color = onFilm ? '#ffffff' : PORTRAIT.ink;
  const text = [local.link, { fontFamily: fonts.serif, color }, onFilm && local.onFilmShadow];
  return (
    <View style={[local.strip, onFilm ? local.stripOnFilm : local.stripOnPaper]}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" style={local.linkRow} activeOpacity={0.7} hitSlop={8}>
        <IconSymbol name="chevron.left" size={16} color={color} />
        <Text style={text}>{backLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onShare} accessibilityRole="button" accessibilityLabel="Share event" style={local.linkRow} activeOpacity={0.7} hitSlop={8}>
        <Text style={text}>Share</Text>
        <IconSymbol name="square.and.arrow.up" size={15} color={color} />
      </TouchableOpacity>
    </View>
  );
}

function Intro({ onFilm, title, details, message, fonts, width }: { onFilm: boolean } & Pick<PortraitGalleryHeaderProps, 'title' | 'details' | 'message' | 'fonts' | 'width'>) {
  const size = Math.round(Math.min(width * 0.2, 88));
  return (
    <View>
      {!!details && <Text style={[local.details, onFilm && { color: '#ffffff' }]}>{details.toUpperCase()}</Text>}
      {/* Always one line: a long gallery name shrinks to the width */}
      <Text
        style={[local.title, { fontFamily: fonts.serif, fontSize: size, color: onFilm ? '#ffffff' : PORTRAIT.ink }, onFilm && local.onFilmShadow]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.3}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {!!message && (
        <Text style={[local.quote, { fontFamily: fonts.serif, color: onFilm ? 'rgba(255,255,255,0.92)' : PORTRAIT.muted }, onFilm && local.onFilmShadow]} numberOfLines={onFilm ? 4 : undefined}>
          {`“${message}”`}
        </Text>
      )}
    </View>
  );
}

export function PortraitGalleryHeader(props: PortraitGalleryHeaderProps) {
  const { title, details, message, video, fonts, width, screenHeight, photoCount, videoCount, activeTab, onTabChange } = props;
  const [playing, setPlaying] = useState(false);
  const quote = message?.trim();

  return (
    <View accessibilityLabel={`${title} gallery`}>
      {video ? (
        // The film runs edge to edge (the event screen's content has 24px side padding) and starts right under the tabs
        <View style={[local.film, { height: Math.max(screenHeight, 420) }]}>
          {playing ? (
            <HighlightPlayer src={video.streamUrl} />
          ) : (
            <>
              {video.posterUrl ? (
                <ExpoImage source={{ uri: video.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              ) : (
                <LinearGradient colors={['#6B6158', PORTRAIT.ink]} style={StyleSheet.absoluteFill} />
              )}
              <LinearGradient colors={['rgba(20,16,12,0)', 'rgba(20,16,12,0.3)', 'rgba(20,16,12,0.7)']} locations={[0, 0.4, 1]} style={[local.shade, { bottom: 0, height: '60%' }]} pointerEvents="none" />
              <View style={local.filmText}>
                <Intro onFilm title={title} details={details} message={quote} fonts={fonts} width={width - 96} />
              </View>
              <TouchableOpacity onPress={() => setPlaying(true)} accessibilityRole="button" accessibilityLabel={`Play the ${title} highlight film`} style={local.play} activeOpacity={0.85}>
                <IconSymbol name="play.fill" size={22} color={PORTRAIT.ink} />
              </TouchableOpacity>
            </>
          )}
          {/* Back / Share on the film's top edge, over a soft shade; they step aside while the film plays, where the
              player puts its own full-screen, picture-in-picture and volume buttons */}
          {!playing && (
            <>
              <LinearGradient colors={['rgba(20,16,12,0.5)', 'rgba(20,16,12,0)']} style={[local.shade, { top: 0, height: 96 }]} pointerEvents="none" />
              <Strip onFilm {...props} />
            </>
          )}
        </View>
      ) : (
        <View>
          <Strip onFilm={false} {...props} />
          <View style={{ marginTop: 28 }}>
            <Intro onFilm={false} title={title} details={details} message={quote} fonts={fonts} width={width - 48} />
          </View>
        </View>
      )}

      <View style={[local.tabs, video && { marginTop: 28 }]} accessibilityRole="tablist">
        {([
          { id: 'photos', label: 'Photos', count: photoCount },
          { id: 'videos', label: 'Videos', count: videoCount },
        ] as const).map((tab) => {
          const active = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${tab.label} (${tab.count})`}
              onPress={() => onTabChange(tab.id)}
              style={local.tab}
              activeOpacity={0.8}
            >
              <View style={local.tabRow}>
                <Text style={[local.tabText, { fontFamily: fonts.serif, color: active ? PORTRAIT.ink : PORTRAIT.muted }]}>{tab.label}</Text>
                <Text style={[local.count, { color: active ? PORTRAIT.ink : PORTRAIT.muted }]}>{tab.count}</Text>
              </View>
              <View style={[local.dot, !active && { opacity: 0 }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  onFilmShadow: { textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 },
  strip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stripOnPaper: { paddingTop: 2, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: PORTRAIT.line },
  stripOnFilm: { position: 'absolute', top: 0, left: 20, right: 20, paddingTop: 16 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { fontSize: 20, lineHeight: 26 },
  details: { marginBottom: 2, color: PORTRAIT.clay, fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 2.6 },
  title: { letterSpacing: -0.5 },
  quote: { marginTop: 10, fontSize: 20, lineHeight: 26 },
  film: { marginHorizontal: -24, marginTop: -24, overflow: 'hidden', backgroundColor: PORTRAIT.ink },
  shade: { position: 'absolute', left: 0, right: 0 },
  filmText: { position: 'absolute', left: 20, right: 76, bottom: 32 },
  play: {
    position: 'absolute',
    right: 20,
    bottom: 36,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tabs: { flexDirection: 'row', gap: 32, marginTop: 30, marginBottom: 18 },
  tab: { alignItems: 'center' },
  tabRow: { flexDirection: 'row', alignItems: 'flex-start' },
  tabText: { fontSize: 28, lineHeight: 32 },
  count: { marginLeft: 3, marginTop: 1, fontSize: 11, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, backgroundColor: PORTRAIT.clay },
});
