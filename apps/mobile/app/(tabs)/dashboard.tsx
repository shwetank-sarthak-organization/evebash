import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import {
  getUserEvents,
  Event as FirestoreEvent,
  getApprovedSharedEventsForUser,
  getUserBusinesses,
  Business as FirestoreBusiness,
  getEventByJoinId,
  logGuestLogin,
} from '@/lib/firestore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import CakeIcon from '@/components/icons/CakeIcon';
import HandshakeIcon from '@/components/icons/HandshakeIcon';

const { width, height } = Dimensions.get('window');

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<FirestoreEvent[]>([]);
  const [businesses, setBusinesses] = useState<FirestoreBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; content: string }>({
    visible: false,
    title: '',
    content: '',
  });

  // Join Event State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [joining, setJoining] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleJoinEvent = async (code?: string) => {
    const finalCode = (code || joinCode).trim().toUpperCase();
    if (!finalCode) return;
    
    if (!user) {
      Alert.alert("Error", "You must be logged in to join an event.");
      return;
    }

    setJoining(true);
    try {
      console.log('[Join] Looking for event with code:', finalCode);
      const event = await getEventByJoinId(finalCode);
      
      if (event) {
        console.log('[Join] Event found:', event.title);
        
        // Submit access request
        const guestName = user.name || 'Anonymous Guest';
        const guestId = user.phone || user.email || user.uid;
        
        if (!guestId) {
          throw new Error("User identifier not found.");
        }

        const success = await logGuestLogin(
          guestName, 
          guestId, 
          event.id, 
          event.parentId || null, 
          event.title || 'Untitled Event', 
          event.createdBy || null,
          'pending'
        );

        if (success) {
          Alert.alert(
            "Request Sent", 
            "Your request to join this event has been sent to the admin. You will see the event in your collections once approved.",
            [{ text: "OK", onPress: () => {
              setShowJoinModal(false);
              setIsScanning(false);
              setJoinCode('');
            }}]
          );
        } else {
          Alert.alert("Error", "The join request could not be submitted. Please try again.");
        }
      } else {
        Alert.alert("Invalid Code", "We couldn't find an event with that Join ID. Please check the code and try again.");
      }
    } catch (err: any) {
      console.error('[Join] Error:', err);
      Alert.alert("Join Error", "An unexpected error occurred while joining. Please try again later.");
    } finally {
      setJoining(false);
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (data.includes('wedalbum.app/events/')) {
      const parts = data.split('/');
      const eventId = parts[parts.length - 1];
      if (eventId) {
        setShowJoinModal(false);
        setIsScanning(false);
        router.push(`/events/${eventId}`);
      }
    } else {
      handleJoinEvent(data);
    }
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ownIdentifiers = [user.uid];
      if (user.email) ownIdentifiers.push(user.email);
      if (user.phone) ownIdentifiers.push(user.phone);

      const [fetchedEvents, approvedSharedEvents, fetchedBusinesses] = await Promise.all([
        getUserEvents(ownIdentifiers, 'main'),
        getApprovedSharedEventsForUser(ownIdentifiers),
        getUserBusinesses(user.uid)
      ]);

      const visibleEvents = Array.from(
        new Map([...fetchedEvents, ...approvedSharedEvents].map((e) => [e.id, e])).values()
      );
      setEvents(visibleEvents);
      setBusinesses(fetchedBusinesses);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── FIXED HEADER ── */}
      <LinearGradient
        colors={['#0f172a', '#020617']}
        style={styles.header}
      >
        <View>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <View style={styles.planChip}>
              <IconSymbol name="crown.fill" size={8} color="#d4af37" />
              <Text style={styles.planChipText}>{user.role || 'Elite'}</Text>
            </View>
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user.name?.split(' ')[0]}</Text>
          </View>
        </View>
        <TouchableOpacity activeOpacity={0.8}>
          <View style={styles.avatarRing}>
            {user.profileImage
              ? <Image source={{ uri: user.profileImage }} style={styles.avatar} />
              : <View style={styles.avatarFallback}>
                  <IconSymbol name="person.fill" size={16} color="#64748b" />
                </View>
            }
          </View>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />}
      >
        {loading && !refreshing
          ? <ActivityIndicator color="#d4af37" style={{ marginTop: 60 }} />
          : <>
              {/* ── SECTION 1: EVENTS (Deep Midnight) ── */}
              <View style={[styles.section, { backgroundColor: '#020617' }]}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionLabel}>Events</Text>
                    <Text style={styles.sectionSub}>Memories curated for you</Text>
                  </View>
                </View>

                <View style={styles.allEventsCard}>
                  <LinearGradient 
                    colors={['rgba(212,175,55,0.15)', 'rgba(15,23,42,0.8)']} 
                    style={StyleSheet.absoluteFill} 
                  />
                  <View style={styles.allEventsContent}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.allEventsHeaderRow}>
                        <Text style={styles.allEventsTitle}>All Memories</Text>
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{events.length}</Text>
                        </View>
                      </View>
                      <Text style={styles.allEventsSub}>
                        Access every event you've hosted or joined in one place.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity 
                      style={styles.cardActionBtnMain}
                      onPress={() => router.push('/your-events')}
                    >
                      <Text style={styles.cardActionBtnMainText}>Open Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.cardActionBtnSecondary}
                      onPress={() => setShowJoinModal(true)}
                    >
                      <Text style={styles.cardActionBtnSecondaryText}>Join Event</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* ── SECTION 3: SERVICES NEAR YOU ── */}
              <LinearGradient 
                colors={['#020617', '#0f172a']} 
                style={[styles.section, { paddingTop: 40 }]}
              >
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionLabel}>Services near you</Text>
                    <Text style={styles.sectionSub}>Photographers, venues, catering & more</Text>
                  </View>
                </View>

                <View style={styles.allEventsCard}>
                  <LinearGradient 
                    colors={['rgba(129,140,248,0.1)', 'rgba(15,23,42,0.8)']} 
                    style={StyleSheet.absoluteFill} 
                  />
                  <View style={styles.allEventsContent}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.allEventsHeaderRow}>
                        <Text style={styles.allEventsTitle}>Marketplace</Text>
                        <View style={[styles.countBadge, { backgroundColor: 'rgba(129,140,248,0.2)', borderColor: 'rgba(129,140,248,0.3)' }]}>
                          <Text style={[styles.countBadgeText, { color: '#818cf8' }]}>{businesses.length}+</Text>
                        </View>
                      </View>
                      <Text style={styles.allEventsSub}>
                        Discover top-rated vendors and exclusive local deals.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity 
                      style={[styles.cardActionBtnMain, { backgroundColor: '#818cf8' }]}
                      onPress={() => router.push('/(tabs)/explore-business')}
                    >
                      <Text style={[styles.cardActionBtnMainText, { color: '#fff' }]}>Explore All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.cardActionBtnSecondary}
                      onPress={() => router.push('/shortlist')}
                    >
                      <Text style={[styles.cardActionBtnSecondaryText, { color: '#818cf8' }]}>Shortlist</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>

              {/* ── SECTION 3: HOST AN EVENT ── */}
              <LinearGradient 
                colors={['#0f172a', '#1e293b']}
                style={[styles.ctaSection, { paddingTop: 40 }]}
              >
                <View style={styles.ctaHeaderRow}>
                  <View style={[styles.ctaIcon, { backgroundColor: 'rgba(212,175,55,0.1)', borderColor: 'rgba(212,175,55,0.2)' }]}>
                    <CakeIcon size={18} color="#d4af37" strokeWidth={1.8} />
                  </View>
                  <Text style={styles.ctaTitle}>Host an Event</Text>
                </View>
                <Text style={styles.ctaBody}>
                  From weddings and birthdays to sports tournaments and corporate meets. Create a stunning gallery for any occasion.
                </Text>
                <View style={styles.ctaActionsRow}>
                  <TouchableOpacity
                    style={styles.ctaBtnGold}
                    activeOpacity={0.85}
                    onPress={() => router.push('/(tabs)/gallery')}
                  >
                    <Text style={styles.ctaBtnGoldText}>Create Event</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.ctaBtnOutline}
                    activeOpacity={0.7}
                    onPress={() => setInfoModal({
                      visible: true,
                      title: 'Host Any Event',
                      content: 'Whether it is a wedding, a birthday party, a corporate summit, or a football tournament, you can create private galleries to collect and share photos from every participant seamlessly.'
                    })}
                  >
                    <Text style={[styles.ctaBtnOutlineText, { color: '#d4af37' }]}>Learn More</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* ── SECTION 4: EXPAND BUSINESS (Liquid Transition S3 -> S4) ── */}
              <LinearGradient 
                colors={['#1e293b', '#111827']}
                style={[styles.ctaSection, { paddingBottom: 80, paddingTop: 40 }]}
              >
                <View style={styles.ctaHeaderRow}>
                  <View style={[styles.ctaIcon, { backgroundColor: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)' }]}>
                    <HandshakeIcon size={18} color="#818cf8" strokeWidth={1.8} />
                  </View>
                  <Text style={styles.ctaTitle}>Expand Your Business</Text>
                </View>
                <Text style={styles.ctaBody}>
                  Promote your brand with stunning photos, real-time announcements, and exclusive offers for your local community.
                </Text>
                <View style={styles.ctaActionsRow}>
                  <TouchableOpacity
                    style={[styles.ctaBtnGold, { backgroundColor: '#818cf8' }]}
                    activeOpacity={0.85}
                    onPress={() => router.push('/manage-business')}
                  >
                    <Text style={[styles.ctaBtnGoldText, { color: '#fff' }]}>Manage Business</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.ctaBtnOutline}
                    activeOpacity={0.7}
                    onPress={() => setInfoModal({
                      visible: true,
                      title: 'Promote Your Brand',
                      content: 'Use our business suite to share high-quality photos of your products, post real-time updates and announcements, and attract new customers with exclusive offers and neighborhood deals.'
                    })}
                  >
                    <Text style={[styles.ctaBtnOutlineText, { color: '#818cf8' }]}>Learn More</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* ── INFO MODAL ── */}
              <Modal
                animationType="fade"
                transparent={true}
                visible={infoModal.visible}
                onRequestClose={() => setInfoModal({ ...infoModal, visible: false })}
              >
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{infoModal.title}</Text>
                    <Text style={styles.modalText}>{infoModal.content}</Text>
                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={() => setInfoModal({ ...infoModal, visible: false })}
                    >
                      <Text style={styles.modalCloseBtnText}>Got it</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* ── JOIN EVENT MODAL ── */}
              <Modal visible={showJoinModal} transparent animationType="slide">
                <KeyboardAvoidingView 
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                  style={styles.joinModalOverlay}
                >
                  <TouchableOpacity 
                    style={styles.joinModalBackdrop} 
                    activeOpacity={1} 
                    onPress={() => { setShowJoinModal(false); setIsScanning(false); }} 
                  />
                  <View style={styles.joinModalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Join Event</Text>
                      <TouchableOpacity onPress={() => { setShowJoinModal(false); setIsScanning(false); }}>
                        <IconSymbol name="xmark.circle.fill" size={24} color="#64748b" />
                      </TouchableOpacity>
                    </View>

                    {isScanning ? (
                      <View style={styles.scannerContainer}>
                        {!permission?.granted ? (
                          <View style={styles.centered}>
                            <Text style={styles.permissionText}>Camera permission is required</Text>
                            <TouchableOpacity style={styles.viewAllPill} onPress={requestPermission}>
                              <Text style={styles.viewAllLabel}>Grant Permission</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <CameraView
                            style={styles.scanner}
                            onBarcodeScanned={handleBarCodeScanned}
                            barcodeScannerSettings={{
                              barcodeTypes: ['qr'],
                            }}
                          />
                        )}
                        <TouchableOpacity 
                          style={styles.scannerCloseBtn} 
                          onPress={() => setIsScanning(false)}
                        >
                          <Text style={styles.scannerCloseText}>Use Code Instead</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.form}>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Enter Join ID</Text>
                          <TextInput 
                            style={[styles.input, { letterSpacing: 4, fontSize: 20, textAlign: 'center', fontFamily: 'Outfit_700Bold' }]} 
                            value={joinCode} 
                            onChangeText={setJoinCode} 
                            placeholder="E.G. A1B2C3" 
                            placeholderTextColor="#334155"
                            autoCapitalize="characters"
                          />
                        </View>

                        <TouchableOpacity 
                          style={[styles.submitBtn, joining && { opacity: 0.7 }]} 
                          onPress={() => handleJoinEvent()}
                          disabled={joining}
                        >
                          {joining ? (
                            <ActivityIndicator color="#0f172a" />
                          ) : (
                            <Text style={styles.submitBtnText}>Join with Code</Text>
                          )}
                        </TouchableOpacity>

                        <View style={styles.modalDivider}>
                          <View style={styles.dividerLine} />
                          <Text style={styles.dividerText}>OR</Text>
                          <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity 
                          style={styles.scanBtn} 
                          onPress={() => setIsScanning(true)}
                        >
                          <IconSymbol name="qrcode.viewfinder" size={20} color="#d4af37" />
                          <Text style={styles.scanBtnText}>Scan QR Code</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </KeyboardAvoidingView>
              </Modal>
            </>
        }
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_W = width * 0.65;
const CARD_H = 180;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#020617' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#020617',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { fontSize: 13, color: '#94a3b8', fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 1.2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  userName: { fontSize: 32, color: '#f8fafc', fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.5, marginTop: 2 },
  planChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20,
    marginTop: -2, // Slight adjustment for baseline alignment with greeting
  },
  planChipText: { fontSize: 9, color: '#d4af37', fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  avatarRing: {
    padding: 2, borderRadius: 22,
    borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.3)',
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
  },

  // ── Sections ──
  section: { paddingTop: 8, paddingBottom: 28 },
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', paddingHorizontal: 24, marginBottom: 18,
  },
  sectionLabel: { fontSize: 22, color: '#f1f5f9', fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, color: '#64748b', fontFamily: 'Inter_400Regular', marginTop: 3 },
  viewAllPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  viewAllLabel: { fontSize: 11, color: '#d4af37', fontFamily: 'Outfit_700Bold' },

  // ── Event/Biz Card ──
  eventCard: {
    width: CARD_W, height: CARD_H,
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#020617',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  vignetteTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 70 },
  vignetteBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  eventCardBody: { position: 'absolute', bottom: 14, left: 18, right: 18 },
  eventCardTitle: {
    fontSize: 16, color: '#fff',
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  eventCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  eventCardDate: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_500Medium' },
  ratingBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
  },
  ratingText: { fontSize: 10, color: '#d4af37', fontFamily: 'Outfit_700Bold' },

  // ── Empty State ──
  emptySlate: {
    marginHorizontal: 24, paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1, borderColor: '#1e293b',
    borderRadius: 20, borderStyle: 'dashed',
  },
  emptyIconRing: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 15, color: '#f1f5f9', fontFamily: 'Outfit_700Bold' },
  emptyBody: { fontSize: 12, color: '#64748b', fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4, paddingHorizontal: 40 },

  // ── Divider ──
  hairline: { marginHorizontal: 24, height: 1, backgroundColor: '#0f172a' },

  // ── CTA ──
  ctaSection: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28 },
  ctaHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  ctaIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  ctaTitle: { fontSize: 22, color: '#f1f5f9', fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.3 },
  ctaBody: { fontSize: 14, color: '#94a3b8', fontFamily: 'Inter_400Regular', lineHeight: 22, marginTop: 6 },
  ctaActionsRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  ctaBtnGold: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#d4af37',
    paddingVertical: 12, borderRadius: 12,
  },
  ctaBtnGoldText: { fontSize: 14, fontFamily: 'Outfit_800ExtraBold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5 },
  ctaBtnOutline: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#1e293b',
  },
  ctaBtnOutlineText: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: '#94a3b8' },

  // ── Modal Styles ──
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#0f172a', width: '100%', borderRadius: 28, padding: 28, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle: { fontSize: 24, color: '#f8fafc', fontFamily: 'Outfit_800ExtraBold', marginBottom: 12, letterSpacing: -0.5 },
  modalText: { fontSize: 16, color: '#94a3b8', fontFamily: 'Inter_400Regular', lineHeight: 26, marginBottom: 28 },
  modalCloseBtn: { backgroundColor: '#d4af37', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  modalCloseBtnText: { color: '#0f172a', fontFamily: 'Outfit_800ExtraBold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.8 },

  // ── Join Event Modal Specific ──
  joinModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  joinModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 23, 0.8)' },
  joinModalContent: { 
    backgroundColor: '#0f172a', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, color: '#d4af37', fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { 
    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
    padding: 16, 
    borderRadius: 16, 
    color: '#fff', 
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  submitBtn: { 
    backgroundColor: '#d4af37', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18, 
    borderRadius: 20, 
    marginTop: 10,
  },
  submitBtnText: { color: '#0f172a', fontFamily: 'Outfit_800ExtraBold', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
  modalDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: '#475569', fontSize: 12, fontFamily: 'Inter_700Bold' },
  scanBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    paddingVertical: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#d4af37', 
    backgroundColor: 'rgba(212,175,55,0.05)' 
  },
  scanBtnText: { color: '#d4af37', fontSize: 16, fontFamily: 'Outfit_700Bold' },
  scannerContainer: { width: '100%', height: 350, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center' },
  scanner: { flex: 1 },
  scannerCloseBtn: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  scannerCloseText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 12 },
  permissionText: { color: '#fff', textAlign: 'center', marginBottom: 20, fontFamily: 'Inter_500Medium' },

  // ── All Events Card Styles ──
  allEventsCard: {
    marginHorizontal: 24,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  allEventsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  allEventsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allEventsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  countBadge: {
    backgroundColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  countBadgeText: {
    color: '#d4af37',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  allEventsTitle: {
    fontSize: 18,
    color: '#f8fafc',
    fontFamily: 'Outfit_700Bold',
  },
  allEventsSub: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cardActionBtnMain: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#d4af37',
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cardActionBtnMainText: {
    color: '#020617',
    fontSize: 14,
    fontFamily: 'Outfit_800ExtraBold',
  },
  cardActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  cardActionBtnSecondaryText: {
    color: '#d4af37',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
});
