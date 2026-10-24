import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { galleryActionText } from '../../constants/galleryContrast';
import type { GalleryVideo } from '@/lib/database';

// The gallery's cinematic highlight video, under the welcome message (website: GalleryHighlightVideo and the Royal
// Emerald frame in RoyalGalleryHeader). Royal Emerald gets a gold double frame, Classic White a white mat with a
// caption (website: ClassicGalleryHeader), other themes their own colours.

export function HighlightPlayer({ src }: { src: string }) {
  const player = useVideoPlayer(src, (p) => { p.play(); });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={StyleSheet.absoluteFill}
    />
  );
}

export function GalleryHighlightVideo({ video, title, selectedTemplate }: {
  video: GalleryVideo;
  title: string;
  selectedTemplate: any;
}) {
  const [playing, setPlaying] = useState(false);
  const isRoyal = selectedTemplate?.id === 'royal';
  const isClassic = selectedTemplate?.id === 'classic';
  const accent: string = selectedTemplate?.accent || '#ffffff';
  const radius = isRoyal ? 2 : isClassic ? 0 : 12;
  // Royal Emerald draws the video inside its gallery header, which has its own side padding

  const screen = (
    <View style={[localStyles.screen, { borderRadius: radius, backgroundColor: isRoyal ? '#010d0a' : '#000' }, isClassic && localStyles.classicScreen]}>
      {playing ? (
        <HighlightPlayer src={video.streamUrl} />
      ) : (
        <Pressable
          onPress={() => setPlaying(true)}
          accessibilityRole="button"
          accessibilityLabel={`Play the ${title} highlight video`}
          style={localStyles.start}
        >
          {video.posterUrl && (
            <ExpoImage source={{ uri: video.posterUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          )}
          {isRoyal ? (
            <LinearGradient colors={['#f3dc9a', '#b8873a']} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 1 }} style={[localStyles.play, localStyles.royalPlay]}>
              <IconSymbol name="play.fill" size={26} color="#1c1406" />
            </LinearGradient>
          ) : isClassic ? (
            <View style={[localStyles.play, localStyles.classicPlay]}>
              <IconSymbol name="play.fill" size={26} color="#ffffff" />
            </View>
          ) : (
            <View style={[localStyles.play, { backgroundColor: accent, borderColor: 'transparent' }]}>
              <IconSymbol name="play.fill" size={24} color={galleryActionText(accent)} />
            </View>
          )}
        </Pressable>
      )}
    </View>
  );

  if (isRoyal) {
    // Polished gold edge with a soft glow, as on the website (.royal-video)
    return (
      <View style={[localStyles.wrap, localStyles.royalWrap]}>
        <LinearGradient
          colors={['#fff1c4', '#c99a46', '#7a5418', '#ecd08a', '#8d6421']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={localStyles.royalEdge}
        >
          {screen}
        </LinearGradient>
      </View>
    );
  }

  if (isClassic) {
    // Mounted like a print: white mat, the screen inside it, the caption on the mat's bottom edge
    return (
      <View style={localStyles.classicMat}>
        {screen}
        <Text style={localStyles.classicCaption}>Highlight film</Text>
      </View>
    );
  }

  return (
    <View style={localStyles.wrap}>
      <View style={[localStyles.themedFrame, { borderColor: `${selectedTemplate?.text || '#ffffff'}29`, borderRadius: radius + 1 }]}>
        {screen}
      </View>
    </View>
  );
}

const ROYAL_GLOW = '#ca9c69';

const localStyles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 16, marginTop: 20 },
  screen: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' },
  start: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  royalWrap: { paddingHorizontal: 0, marginTop: 26 },
  royalEdge: {
    padding: 4,
    borderRadius: 4,
    shadowColor: ROYAL_GLOW,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  royalPlay: { width: 70, height: 70, borderRadius: 35, borderColor: 'rgba(246,227,176,0.7)', borderWidth: 2 },
  themedFrame: { borderWidth: 1, overflow: 'hidden' },
  classicMat: {
    alignSelf: 'stretch',
    marginTop: 28,
    paddingTop: 14,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E6E6E0',
    shadowColor: '#2C352E',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  classicScreen: { aspectRatio: 16 / 10, backgroundColor: '#FCFCFA' },
  classicPlay: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.28)', borderColor: 'rgba(255,255,255,0.55)', borderWidth: 1 },
  classicCaption: { paddingTop: 12, paddingBottom: 14, color: '#596653', fontSize: 14, textAlign: 'center' },
});
