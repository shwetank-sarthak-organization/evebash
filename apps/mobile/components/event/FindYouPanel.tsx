import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { appAlert } from '@/lib/feedback';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  FIND_YOU_CONSENT_ADULT,
  FIND_YOU_CONSENT_AGREE,
  FIND_YOU_CONSENT_POINTS,
  FIND_YOU_CONSENT_REQUIRED_CODE,
  FIND_YOU_CONSENT_TEXT,
  FIND_YOU_CONSENT_TITLE,
  FIND_YOU_CONSENT_VERSION,
} from '../../../../shared/legal/findYouConsent';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_GAP = 3;
const PHOTO_COLS = 3;
const PHOTO_SIZE = (SCREEN_WIDTH - PHOTO_GAP * (PHOTO_COLS + 1)) / PHOTO_COLS;

import PhotoViewer from '../PhotoViewer';
import { getGridThumbnail } from '@/lib/imageUrl';

interface FindYouPanelProps {
  eventId: string;
  legacyId?: string;
  parentId?: string;
  subEvents?: { id: string; legacyId?: string }[];
  selectedTemplate: any;
  styles: any;
  event?: any;
  viewerIdentity?: any;
}

type ConsentState = 'checking' | 'needed' | 'given' | 'signed-out' | 'error';

// PostgREST's "function not found": the consent migration isn't applied yet
const isMissingRpc = (error: { code?: string } | null) => error?.code === 'PGRST202';

interface MatchedPhoto {
  imageId: string;
  imageUrl: string;
  width?: number;
  height?: number;
}

export function FindYouPanel({
  eventId,
  legacyId,
  parentId,
  subEvents = [],
  selectedTemplate,
  styles: themeStyles,
  event = null,
  viewerIdentity = { id: 'anonymous', name: 'Guest' },
}: FindYouPanelProps) {
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'searching' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Upload a selfie to find your photos');
  const [matchedPhotos, setMatchedPhotos] = useState<any[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const [consent, setConsent] = useState<ConsentState>('checking');
  const [consentAdult, setConsentAdult] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [consentRetry, setConsentRetry] = useState(0);

  const isBusy = status === 'uploading' || status === 'searching';

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (active) setConsent('signed-out');
        return;
      }
      const { data, error } = await supabase.rpc('get_find_you_consent');
      if (!active) return;
      if (error) {
        if (isMissingRpc(error)) setConsent('needed');
        else { setConsent('error'); setConsentError('We could not check your Find You consent. Please retry.'); }
        return;
      }
      if (data?.version !== FIND_YOU_CONSENT_VERSION) {
        setConsent('error');
        setConsentError('Please update the app to review the latest Find You consent.');
        return;
      }
      setConsent(data.consented === true ? 'given' : 'needed');
    })();
    return () => { active = false; };
  }, [consentRetry]);

  const giveConsent = async () => {
    if (!consentAdult || !consentAgreed || consentBusy) return;
    setConsentBusy(true);
    setConsentError('');
    const { error } = await supabase.rpc('give_find_you_consent', {
      p_version: FIND_YOU_CONSENT_VERSION,
      p_platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      p_adult: true,
      p_text: FIND_YOU_CONSENT_TEXT,
    });
    setConsentBusy(false);
    if (error && !isMissingRpc(error)) {
      setConsentError('Your consent could not be saved. Please try again.');
      return;
    }
    setConsent('given');
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      let result;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          appAlert('Permission Required', 'Camera access is needed to take a selfie.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          cameraType: ImagePicker.CameraType.front,
          base64: true,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          appAlert('Permission Required', 'Photo library access is needed to select a selfie.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          base64: true,
        });
      }

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setSelfieUri(asset.uri);
      setMatchedPhotos([]);

      if (!asset.base64) {
        throw new Error('Could not read photo data. Please try again.');
      }

      // Prepend data URL prefix if not present
      const base64Data = asset.base64.startsWith('data:') 
        ? asset.base64 
        : `data:image/jpeg;base64,${asset.base64}`;

      await runFaceSearch(base64Data);
    } catch (err: any) {
      console.error('[FindYouPanel] Image picker error:', err);
      setStatus('error');
      setStatusMessage(err.message || 'Could not open image picker. Please try again.');
    }
  };

  const runFaceSearch = async (selfieBase64: string) => {
    try {
      setStatus('searching');
      setStatusMessage('Searching this event\'s photos...');

      // Build event IDs to search
      const eventIds = [eventId];
      if (parentId) eventIds.push(parentId);
      if (legacyId) eventIds.push(legacyId);
      // Include the sub-galleries, as the website does
      for (const sub of subEvents) {
        eventIds.push(sub.id);
        if (sub.legacyId) eventIds.push(sub.legacyId);
      }

      // Resolve API Base URL dynamically (supports production configuration and local Expo dev server)
      const getApiBaseUrl = () => {
        const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
        if (apiBase) return apiBase.replace(/\/+$/, '');
        
        try {
          const Constants = require('expo-constants').default;
          const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest2?.extra?.expoGo?.developer?.hostUri;
          const devHost = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
          if (devHost) {
            return `http://${devHost}:8080`;
          }
        } catch (e) {}

        try {
          const { Platform } = require('react-native');
          if (Platform.OS === 'android') {
            return 'http://10.0.2.2:8080';
          }
        } catch (e) {}

        return 'http://localhost:8080';
      };

      const appUrl = getApiBaseUrl();
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${appUrl}/api/find-you`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          selfieBase64,
          eventIds: Array.from(new Set(eventIds.filter(Boolean))),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (err.code === FIND_YOU_CONSENT_REQUIRED_CODE) {
          setStatus('idle');
          setSelfieUri(null);
          setConsentAdult(false);
          setConsentAgreed(false);
          setConsent('needed');
          return;
        }
        throw new Error(err.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      const photos: MatchedPhoto[] = result.matches || [];

      console.log('[FindYouPanel] Search debug details:', result.debug);

      setMatchedPhotos(photos);
      setStatus('done');

      if (photos.length === 0) {
        if (result.error) {
          setStatusMessage(result.error);
        } else {
          setStatusMessage('No matching photos found. Try a clearer selfie!');
        }
      } else {
        setStatusMessage(`Found ${photos.length} photo${photos.length === 1 ? '' : 's'} of you.`);
      }

    } catch (err: any) {
      console.error('[FindYouPanel] Face search error:', err);
      setStatus('error');
      setStatusMessage(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={panelStyles.scrollContent}
      >
        {/* Header */}
        <View style={panelStyles.header}>
          <Text style={[
            panelStyles.title,
            selectedTemplate?.useSerif && { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' },
            { color: selectedTemplate?.text || '#111' },
          ]}>
            Find You
          </Text>
          <Text style={[panelStyles.subtitle, { color: selectedTemplate?.muted || '#666' }]}>
            AI-Powered Photo Search
          </Text>
        </View>

        {/* Selfie Preview */}
        {selfieUri && (
          <View style={panelStyles.selfieContainer}>
            <ExpoImage
              source={{ uri: selfieUri }}
              style={[panelStyles.selfieImage, { borderColor: selectedTemplate?.accent || '#cca43b' }]}
              contentFit="cover"
            />
            {isBusy && (
              <View style={panelStyles.selfieOverlay}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            )}
          </View>
        )}

        {consent !== 'given' && (
          <View style={[panelStyles.consentCard, { borderColor: selectedTemplate?.accent ? `${selectedTemplate.accent}55` : '#cca43b55' }]}>
            <Text style={[panelStyles.consentTitle, { color: selectedTemplate?.text || '#111' }]}>{FIND_YOU_CONSENT_TITLE}</Text>
            {consent === 'checking' && <ActivityIndicator color={selectedTemplate?.accent || '#cca43b'} />}
            {consent === 'signed-out' && (
              <Text style={[panelStyles.consentText, { color: selectedTemplate?.muted || '#555' }]}>Log in to your EveBash account to use Find You.</Text>
            )}
            {consent === 'error' && (
              <>
                <Text accessibilityRole="alert" style={[panelStyles.consentText, { color: '#ef4444' }]}>{consentError}</Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => { setConsent('checking'); setConsentError(''); setConsentRetry((n) => n + 1); }}>
                  <Text style={[panelStyles.consentLink, { color: selectedTemplate?.accent || '#cca43b' }]}>Retry</Text>
                </TouchableOpacity>
              </>
            )}
            {consent === 'needed' && (
              <>
                {FIND_YOU_CONSENT_POINTS.map((point) => (
                  <Text key={point} style={[panelStyles.consentText, { color: selectedTemplate?.muted || '#555' }]}>{'\u2022'} {point}</Text>
                ))}
                <TouchableOpacity accessibilityRole="link" onPress={() => { void Linking.openURL('https://www.evebash.com/privacy-policy').catch(() => undefined); }}>
                  <Text style={[panelStyles.consentLink, { color: selectedTemplate?.accent || '#cca43b' }]}>Read the Privacy Policy (section 4)</Text>
                </TouchableOpacity>
                {[
                  { label: FIND_YOU_CONSENT_ADULT, checked: consentAdult, toggle: () => setConsentAdult((v) => !v) },
                  { label: FIND_YOU_CONSENT_AGREE, checked: consentAgreed, toggle: () => setConsentAgreed((v) => !v) },
                ].map((box) => (
                  <TouchableOpacity
                    key={box.label}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: box.checked, disabled: consentBusy }}
                    disabled={consentBusy}
                    onPress={box.toggle}
                    style={panelStyles.consentCheckRow}
                  >
                    <Text style={[panelStyles.consentCheckbox, { color: selectedTemplate?.accent || '#cca43b' }]}>{box.checked ? '\u2611' : '\u2610'}</Text>
                    <Text style={[panelStyles.consentText, { flex: 1, marginBottom: 0, color: selectedTemplate?.text || '#111' }]}>{box.label}</Text>
                  </TouchableOpacity>
                ))}
                {!!consentError && <Text accessibilityRole="alert" style={[panelStyles.consentText, { color: '#ef4444' }]}>{consentError}</Text>}
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={!consentAdult || !consentAgreed || consentBusy}
                  onPress={() => void giveConsent()}
                  style={[
                    panelStyles.consentButton,
                    { backgroundColor: selectedTemplate?.accent || '#cca43b' },
                    (!consentAdult || !consentAgreed || consentBusy) && { opacity: 0.4 },
                  ]}
                >
                  <Text style={[panelStyles.consentButtonText, { color: selectedTemplate?.background || '#fff' }]}>
                    {consentBusy ? 'Saving…' : 'Agree and continue'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Description / Instructions */}
        {consent === 'given' && !selfieUri && (
          <View style={panelStyles.descContainer}>
            <View style={panelStyles.descIcon}>
              <IconSymbol name="magnifyingglass" size={40} color={selectedTemplate?.accent || '#cca43b'} />
            </View>
            <Text style={[panelStyles.descText, { color: selectedTemplate?.muted || '#555' }]}>
              Upload a clear selfie and our AI will find all your photos from this event instantly.
            </Text>
          </View>
        )}

        {/* Buttons */}
        {consent === 'given' && <View style={panelStyles.buttonRow}>
          <TouchableOpacity
            style={[
              panelStyles.button,
              {
                borderColor: selectedTemplate?.accent ? `${selectedTemplate.accent}66` : '#cca43b66',
                backgroundColor: selectedTemplate?.background || '#fff',
              },
              isBusy && { opacity: 0.5 },
            ]}
            onPress={() => !isBusy && pickImage(false)}
            disabled={isBusy}
          >
            <IconSymbol name="photo" size={22} color={selectedTemplate?.accent || '#cca43b'} />
            <Text style={[panelStyles.buttonText, { color: selectedTemplate?.accent || '#cca43b' }]}>
              Upload Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              panelStyles.button,
              {
                borderColor: selectedTemplate?.accent ? `${selectedTemplate.accent}66` : '#cca43b66',
                backgroundColor: selectedTemplate?.background || '#fff',
              },
              isBusy && { opacity: 0.5 },
            ]}
            onPress={() => !isBusy && pickImage(true)}
            disabled={isBusy}
          >
            <IconSymbol name="camera.fill" size={22} color={selectedTemplate?.accent || '#cca43b'} />
            <Text style={[panelStyles.buttonText, { color: selectedTemplate?.accent || '#cca43b' }]}>
              Take Selfie
            </Text>
          </TouchableOpacity>
        </View>}

        {/* Status Message */}
        {status !== 'idle' && (
          <View style={panelStyles.statusRow}>
            {isBusy && (
              <ActivityIndicator
                size="small"
                color={selectedTemplate?.accent || '#cca43b'}
                style={{ marginRight: 8 }}
              />
            )}
            <Text style={[
              panelStyles.statusText,
              { color: status === 'error' ? '#ef4444' : (matchedPhotos.length > 0 ? '#16a34a' : (selectedTemplate?.accent || '#cca43b')) },
            ]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Results Grid */}
        {matchedPhotos.length > 0 && (
          <View style={panelStyles.resultsContainer}>
            <Text style={[
              panelStyles.resultsTitle,
              selectedTemplate?.useSerif && { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' },
              { color: selectedTemplate?.text || '#111' },
            ]}>
              Your Photos
            </Text>
            <Text style={[panelStyles.resultsSubtitle, { color: selectedTemplate?.muted || '#666' }]}>
              {matchedPhotos.length} match{matchedPhotos.length === 1 ? '' : 'es'} found in this event
            </Text>

            <View style={panelStyles.photoGrid}>
              {matchedPhotos.map((photo, index) => (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open matched photo ${index + 1}`}
                  key={photo.id || photo.imageId || index}
                  style={panelStyles.photoItem}
                  activeOpacity={0.85}
                  onPress={() => {
                    setCurrentPhotoIndex(index);
                    setViewerVisible(true);
                  }}
                >
                  <ExpoImage
                    source={{ uri: getGridThumbnail(photo.url || photo.imageUrl, photo.thumbnailUrl) }}
                    style={panelStyles.photoImage}
                    contentFit="cover"
                    transition={300}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {matchedPhotos.length > 0 && (
        <PhotoViewer
          visible={viewerVisible}
          onClose={() => setViewerVisible(false)}
          photos={matchedPhotos}
          initialIndex={currentPhotoIndex}
          viewerIdentity={viewerIdentity}
          event={event}
          selectedTemplate={selectedTemplate}
        />
      )}
    </>
  );
}

const panelStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  selfieContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  selfieImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
  },
  selfieOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  consentTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  consentText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  consentLink: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginBottom: 12,
  },
  consentCheckRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  consentCheckbox: {
    fontSize: 22,
    lineHeight: 22,
  },
  consentButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  consentButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  descContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  descIcon: {
    marginBottom: 12,
  },
  descText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  resultsContainer: {
    marginTop: 24,
  },
  resultsTitle: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GAP,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
});
