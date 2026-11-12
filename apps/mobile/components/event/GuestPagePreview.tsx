import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { loadGuestPreviewSnapshot, type GuestPreviewSnapshot } from '@/lib/guestPreviewSnapshot';
import { supabase } from '@/lib/supabase';
import { getGalleryWebUrl, getWebBaseUrl } from '@/lib/webLinks';
import { Fonts, MidnightColors } from '../../constants/theme';

const PHONE_SCREEN_WIDTH = 160;

// The screen size the guest page is drawn at before it is shrunk: a laptop's (the website's Guest Home Preview uses
// the same)
const PAGE = { width: 1280, height: 800 };

// When the website's phone app screen is switched on (NEXT_PUBLIC_MOBILE_APP_GATE, src/lib/appGate.ts), phones and
// tablets get "Get the EveBash app" instead of the page, so the page is asked for as a computer's browser would
const COMPUTER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Where supabase-js keeps the website's sign-in: sb-<project ref>-auth-token (the app and website share one project)
const projectRef = /^https?:\/\/([^./]+)\./.exec(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')?.[1];
const WEBSITE_SESSION_KEY = projectRef ? `sb-${projectRef}-auth-token` : null;

type WebSession = Record<string, unknown> | null;

// Runs before the page's own code. It signs the page in with the app's access token so private galleries open, but
// never with the refresh token: the page can't renew or replace the app's sign-in, and it goes stale after an hour
// (the preview reloads when the app renews it). Calls to sign out are dropped, since signing out would end the
// app's session too.
function signInScript(session: WebSession): string {
  const save = WEBSITE_SESSION_KEY && session
    ? `try { localStorage.setItem(${JSON.stringify(WEBSITE_SESSION_KEY)}, ${JSON.stringify(JSON.stringify(session))}); } catch (e) {}`
    : '';
  return `(function () {
  ${save}
  var pageFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = String((input && input.url) || input || '');
    if (url.indexOf('/auth/v1/logout') !== -1) return Promise.resolve(new Response(null, { status: 204 }));
    return pageFetch.apply(this, arguments);
  };
})();
true;`;
}

interface GuestPagePreviewProps {
  eventId: string;
  /** The event's template now: a picture taken with another one is out of date */
  templateId: string | null;
  /** Changes after the host saves a design change, so the page loads again with it */
  refreshKey?: number;
  /** The host view's colours (useAppTheme), for the card around the preview */
  colors: typeof MidnightColors;
}

// What guests see, small: the app (guests who use it) as a picture of its guest home, taken when the host last had
// it open with Preview Guest Theme (lib/guestPreviewSnapshot.ts; the app's guest view is part of the event screen and
// can't be drawn small), and the website guest page itself on a computer, drawn at a computer's size and shrunk to
// fit. The page opens with ?preview=1 (no edit mode, no "Open in app" banner) and takes no touches.
export function GuestPagePreview({ eventId, templateId, refreshKey = 0, colors }: GuestPagePreviewProps) {
  const [reloads, setReloads] = useState(0);
  const [session, setSession] = useState<WebSession | undefined>(undefined);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [width, setWidth] = useState(0);
  const [snapshot, setSnapshot] = useState<GuestPreviewSnapshot | null | undefined>(undefined);
  const screen = useWindowDimensions();
  const phoneScreenHeight = Math.round(PHONE_SCREEN_WIDTH * (screen.height / screen.width));
  const snapshotOutOfDate = !!snapshot && (snapshot.templateId ?? null) !== templateId;

  // The picture is taken while this card isn't shown (the guest view replaces it), so it's read each time the card opens
  useEffect(() => {
    let active = true;
    loadGuestPreviewSnapshot(eventId).then((saved) => { if (active) setSnapshot(saved); });
    return () => { active = false; };
  }, [eventId]);

  // A new access token (the app renews it about once an hour) loads the page again with it
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') setSessionVersion((version) => version + 1);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession()
      .then(({ data }) => {
        const current = data.session;
        if (!active) return;
        setSession(current ? {
          access_token: current.access_token,
          token_type: current.token_type,
          expires_in: current.expires_in,
          expires_at: current.expires_at,
          refresh_token: '',
          user: current.user,
        } : null);
      })
      .catch(() => { if (active) setSession(null); });
    return () => { active = false; };
  }, [sessionVersion]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.white }]}>Guest Home Preview</Text>
          <Text style={[styles.subtitle, { color: colors.slate400 }]}>
            What guests see: this app, and the website on a computer.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setReloads((count) => count + 1)}
          style={[styles.reload, { borderColor: colors.cardBorder }]}
          accessibilityRole="button"
          accessibilityLabel="Reload preview"
          hitSlop={8}
        >
          <IconSymbol name="arrow.clockwise" size={16} color={colors.gold} />
        </TouchableOpacity>
      </View>

      <View style={styles.column}>
        <View style={styles.phoneBezel}>
          <View style={[styles.phoneScreen, { width: PHONE_SCREEN_WIDTH, height: phoneScreenHeight }]}>
            {snapshot ? (
              <Image
                source={{ uri: snapshot.uri }}
                style={[StyleSheet.absoluteFill, snapshotOutOfDate && styles.outOfDate]}
                contentFit="cover"
                contentPosition="top"
                accessibilityLabel="Picture of the app's guest home"
              />
            ) : snapshot === null ? (
              <Text style={styles.phoneEmpty}>Open Preview Guest Theme once to see the app here.</Text>
            ) : null}
          </View>
        </View>
        <Text style={[styles.caption, { color: colors.slate400 }]}>App</Text>
        {snapshot && (
          <Text style={[styles.note, { color: snapshotOutOfDate ? colors.gold : colors.slate400 }]}>
            {snapshotOutOfDate
              ? 'The theme changed since this picture. Open Preview Guest Theme to update it.'
              : `Picture from ${new Date(snapshot.takenAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. Preview Guest Theme updates it.`}
          </Text>
        )}
      </View>

      <View style={styles.column}>
        <View style={styles.browser}>
          <View style={styles.browserBar}>
            <View style={styles.browserDots}>
              <View style={[styles.browserDot, { backgroundColor: '#ff5f57' }]} />
              <View style={[styles.browserDot, { backgroundColor: '#febc2e' }]} />
              <View style={[styles.browserDot, { backgroundColor: '#28c840' }]} />
            </View>
            <Text style={styles.browserAddress} numberOfLines={1}>
              {getWebBaseUrl().replace(/^https?:\/\/(www\.)?/, '')}/events/{eventId}
            </Text>
          </View>
          <View onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}>
            {width > 0 && session !== undefined && (
              <PageFrame key={`${eventId}:${refreshKey}:${reloads}:${sessionVersion}`} eventId={eventId} script={signInScript(session)} width={width} />
            )}
          </View>
        </View>
        <Text style={[styles.caption, { color: colors.slate400 }]}>Website on a computer</Text>
      </View>
    </View>
  );
}

// The page in a web view at its real size, scaled down to `width`
function PageFrame({ eventId, script, width }: { eventId: string; script: string; width: number }) {
  const [loaded, setLoaded] = useState(false);
  const scale = width / PAGE.width;
  const siteBase = getWebBaseUrl();

  // Only the guest page itself loads here; links elsewhere don't open (the page takes no touches anyway)
  const stayOnSite = (request: { url: string; isTopFrame?: boolean }) =>
    request.isTopFrame === false || request.url.startsWith(siteBase);

  return (
    <View style={[styles.frame, { height: Math.round(PAGE.height * scale) }]} pointerEvents="none">
      <View style={{ width: PAGE.width, height: PAGE.height, transform: [{ scale }], transformOrigin: 'top left' }}>
        <WebView
          source={{ uri: `${getGalleryWebUrl(eventId)}?preview=1` }}
          userAgent={COMPUTER_USER_AGENT}
          injectedJavaScriptBeforeContentLoaded={script}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={stayOnSite}
          onLoadEnd={() => setLoaded(true)}
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          setSupportMultipleWindows={false}
          mediaPlaybackRequiresUserAction
          style={styles.webView}
        />
      </View>
      {!loaded && (
        <View style={styles.loading}>
          <ActivityIndicator color="#8a8a8f" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, padding: 16, borderRadius: 14, borderWidth: 1, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 15, fontFamily: Fonts.outfit.bold },
  subtitle: { fontSize: 12, fontFamily: Fonts.inter.regular, marginTop: 2, lineHeight: 17 },
  reload: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  column: { alignItems: 'center', gap: 8 },
  phoneBezel: { padding: 6, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: '#050505' },
  phoneScreen: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#0b0b0c', alignItems: 'center', justifyContent: 'center' },
  phoneEmpty: { color: '#94a3b8', fontSize: 11, fontFamily: Fonts.inter.medium, textAlign: 'center', lineHeight: 16, paddingHorizontal: 18 },
  outOfDate: { opacity: 0.45 },
  caption: { fontSize: 9.5, fontFamily: Fonts.inter.medium, textTransform: 'uppercase', letterSpacing: 1.5 },
  note: { fontSize: 11, fontFamily: Fonts.inter.regular, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
  browser: { alignSelf: 'stretch', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', backgroundColor: '#1c1c1f' },
  browserBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)' },
  browserDots: { flexDirection: 'row', gap: 5 },
  browserDot: { width: 8, height: 8, borderRadius: 4 },
  browserAddress: { flex: 1, marginRight: 34, color: '#94a3b8', fontSize: 10, fontFamily: Fonts.inter.medium, textAlign: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', borderRadius: 6, overflow: 'hidden', paddingVertical: 3, paddingHorizontal: 8 },
  frame: { overflow: 'hidden', backgroundColor: '#0b0b0c' },
  webView: { flex: 1, backgroundColor: '#0b0b0c' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
