import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, MidnightColors } from '../../constants/theme';

/** Why a gallery link can't be opened yet (from open_gallery), or that the lookup failed */
export type GalleryGateState = 'login_required' | 'none' | 'pending' | 'rejected' | 'error';

const COPY: Record<GalleryGateState, { heading: string; body: string }> = {
  login_required: { heading: 'This gallery is private', body: 'Log in or create an account to ask the host for access.' },
  none: { heading: 'This gallery is private', body: "Ask the host to let you in. You'll see the photos as soon as they approve." },
  pending: { heading: 'Waiting for the host', body: 'Your request has been sent. You can open the gallery once the host approves it.' },
  rejected: { heading: 'Access not granted', body: "The host hasn't given you access to this gallery. Contact them if you think this is a mistake." },
  error: { heading: "We couldn't open this gallery", body: 'Check your connection and try again.' },
};

const ICONS: Record<GalleryGateState, 'lock.fill' | 'clock.fill' | 'exclamationmark.triangle.fill'> = {
  login_required: 'lock.fill',
  none: 'lock.fill',
  pending: 'clock.fill',
  rejected: 'lock.fill',
  error: 'exclamationmark.triangle.fill',
};

interface GalleryAccessGateProps {
  state: GalleryGateState;
  title?: string;
  requesting?: boolean;
  onLogin: () => void;
  onRequestAccess: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export function GalleryAccessGate({ state, title, requesting = false, onLogin, onRequestAccess, onRetry, onBack }: GalleryAccessGateProps) {
  const primary = state === 'login_required'
    ? { label: 'Log in', onPress: onLogin }
    : state === 'none'
      ? { label: 'Request access', onPress: onRequestAccess }
      : state === 'pending'
        ? { label: 'Check again', onPress: onRetry }
        : state === 'error'
          ? { label: 'Try again', onPress: onRetry }
          : null;

  return (
    <View style={{ flex: 1, backgroundColor: MidnightColors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(202, 156, 104, 0.14)', marginBottom: 20 }}>
        <IconSymbol name={ICONS[state]} size={28} color={MidnightColors.gold} />
      </View>
      {!!title && state !== 'error' && (
        <Text style={{ color: MidnightColors.slate400, fontSize: 12, fontFamily: Fonts.inter.bold, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
          {title}
        </Text>
      )}
      <Text accessibilityRole="header" style={{ color: MidnightColors.text, fontSize: 22, fontFamily: Fonts.outfit.bold, marginBottom: 10, textAlign: 'center' }}>
        {COPY[state].heading}
      </Text>
      <Text style={{ color: MidnightColors.slate300, fontSize: 15, fontFamily: Fonts.inter.regular, lineHeight: 22, textAlign: 'center', marginBottom: 28, maxWidth: 360 }}>
        {COPY[state].body}
      </Text>
      {primary && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={primary.onPress}
          disabled={requesting}
          style={{ minWidth: 200, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999, backgroundColor: MidnightColors.gold, opacity: requesting ? 0.6 : 1 }}
        >
          {requesting
            ? <ActivityIndicator color={MidnightColors.background} />
            : <Text style={{ color: MidnightColors.background, fontSize: 15, fontFamily: Fonts.inter.bold }}>{primary.label}</Text>}
        </TouchableOpacity>
      )}
      <TouchableOpacity accessibilityRole="button" onPress={onBack} style={{ marginTop: 14, paddingHorizontal: 20, paddingVertical: 10 }}>
        <Text style={{ color: MidnightColors.slate400, fontSize: 14, fontFamily: Fonts.inter.bold }}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}
