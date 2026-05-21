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
import { useAppTheme } from '@/context/ThemeContext';
import {
  getUserEvents,
  Event as FirestoreEvent,
  getApprovedSharedEventsForUser,
  getUserBusinesses,
  getTopRatedBusinesses,
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
  const { colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
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
          event.parentId || undefined,
          event.title || 'Untitled Event', 
          event.createdBy || undefined,
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
    if (!user) {
      setEvents([]);
      setBusinesses([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const ownIdentifiers = [user.uid];
      if (user.email) ownIdentifiers.push(user.email);
      if (user.phone) ownIdentifiers.push(user.phone);

      const [fetchedEvents, approvedSharedEvents, fetchedBusinesses] = await Promise.all([
        getUserEvents(ownIdentifiers, 'main'),
        getApprovedSharedEventsForUser(ownIdentifiers),
        getTopRatedBusinesses(10)
      ]);

      const visibleEvents = Array.from(
        new Map([...fetchedEvents, ...approvedSharedEvents].map((e) => [e.id, e])).values()
      ).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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
        colors={isDark ? ['#0f172a', '#020617'] : [colors.deepSlate, colors.background]}
        style={styles.header}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>WedAlbum</Text>
          <Text style={styles.tagline}>Let's capture moments ✨</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIconButton} 
            activeOpacity={0.7}
            onPress={() => Alert.alert("Notifications", "Coming Soon: Updates on your albums, events, and shortlist activity.")}
          >
            <IconSymbol name="bell.fill" size={18} color={colors.white} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>
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
              <View style={[styles.section, { backgroundColor: colors.background }]}>
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionLabel}>Events</Text>
                    <Text style={styles.sectionSub}>Memories curated for you</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.catchyActionPill}
                    activeOpacity={0.8}
                    onPress={() => setShowJoinModal(true)}
                  >
                    <IconSymbol name="plus.circle.fill" size={12} color={'#020617'} />
                    <Text style={styles.catchyActionPillText}>Join Event</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={styles.eventsScrollContainer}
                  decelerationRate="fast"
                  snapToInterval={CARD_W + 16}
                >
                  {events.slice(0, 3).map((event) => (
                    <TouchableOpacity 
                      key={event.id} 
                      style={styles.recentEventCard}
                      activeOpacity={0.9}
                      onPress={() => router.push(`/events/${event.id}?mode=visitor`)}
                    >
                      <ExpoImage 
                        source={{ uri: event.coverImage }} 
                        style={StyleSheet.absoluteFill} 
                        contentFit="cover"
                        transition={400}
                      />
                      <LinearGradient 
                        colors={['transparent', 'rgba(2,6,23,0.9)']} 
                        style={StyleSheet.absoluteFill} 
                      />
                      <View style={styles.recentEventInfo}>
                        <Text style={styles.recentEventTitle} numberOfLines={1}>{event.title}</Text>
                        <View style={styles.recentEventMeta}>
                          <IconSymbol name="calendar" size={10} color="rgba(255,255,255,0.6)" />
                          <Text style={styles.recentEventDate}>{event.date.split(',')[0]}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  <TouchableOpacity 
                    style={styles.viewAllMemoriesCard}
                    activeOpacity={0.8}
                    onPress={() => router.push('/your-events')}
                  >
                    <ExpoImage 
                      source={require('@/assets/images/memories_bg.png')} 
                      style={StyleSheet.absoluteFill} 
                      contentFit="cover"
                      transition={400}
                    />
                    <LinearGradient 
                      colors={['rgba(2,6,23,0.3)', 'rgba(2,6,23,0.95)']} 
                      style={StyleSheet.absoluteFill} 
                    />
                    <View style={styles.viewAllMemoriesContent}>
                       <View style={{ alignItems: 'center', gap: 4, marginBottom: 14, zIndex: 1 }}>
                         <Text style={[styles.viewAllMemoriesText, { fontSize: 18 }]}>Your memories</Text>
                         <View style={styles.countPill}>
                           <Text style={styles.viewAllMemoriesSub}>{events.length} Collections</Text>
                         </View>
                       </View>
                       
                       <View style={styles.miniGalleryBtn}>
                          <Text style={styles.miniGalleryBtnText}>Explore All</Text>
                          <IconSymbol name="arrow.right" size={14} color={'#020617'} />
                       </View>
                    </View>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              <LinearGradient 
                colors={isDark ? ['#020617', '#0f172a'] : [colors.background, colors.deepSlate]} 
                style={[styles.section, { paddingTop: 40 }]}
              >
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionLabel}>Services near you</Text>
                    <Text style={styles.sectionSub}>Photographers, venues & more</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.catchyActionPill, { backgroundColor: isDark ? '#818cf8' : '#6366f1' }]}
                    activeOpacity={0.8}
                    onPress={() => router.push('/shortlist')}
                  >
                    <IconSymbol name="heart.fill" size={12} color="#ffffff" />
                    <Text style={[styles.catchyActionPillText, { color: '#ffffff' }]}>Shortlist</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={styles.eventsScrollContainer}
                  decelerationRate="fast"
                  snapToInterval={CARD_W + 16}
                >
                  {businesses.slice(0, 3).map((biz) => (
                    <TouchableOpacity 
                      key={biz.id} 
                      style={styles.recentBusinessCard}
                      activeOpacity={0.9}
                      onPress={() => router.push(`/(tabs)/explore-business`)}
                    >
                      <ExpoImage 
                        source={{ uri: biz.coverImage }} 
                        style={StyleSheet.absoluteFill} 
                        contentFit="cover"
                        transition={400}
                      />
                      <LinearGradient 
                        colors={isDark ? ['transparent', 'rgba(15,23,42,0.9)'] : ['transparent', 'rgba(248,250,252,0.9)']} 
                        style={StyleSheet.absoluteFill} 
                      />
                      <View style={styles.recentEventInfo}>
                        <Text style={[styles.recentEventTitle, { color: colors.white }]} numberOfLines={1}>{biz.name}</Text>
                        <View style={styles.recentEventMeta}>
                          <IconSymbol name="tag.fill" size={10} color={isDark ? 'rgba(129,140,248,0.6)' : 'rgba(99,102,241,0.6)'} />
                          <Text style={[styles.recentEventDate, { color: isDark ? 'rgba(129,140,248,0.8)' : 'rgba(99,102,241,0.8)' }]}>{biz.type}</Text>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} />
                          <IconSymbol name="star.fill" size={10} color="#d4af37" />
                          <Text style={[styles.recentEventDate, { color: colors.slate400 }]}>{biz.rating}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  <TouchableOpacity 
                    style={[styles.viewAllMemoriesCard, { borderColor: isDark ? 'rgba(129,140,248,0.3)' : 'rgba(99,102,241,0.15)', shadowColor: isDark ? '#818cf8' : '#6366f1' }]}
                    activeOpacity={0.8}
                    onPress={() => router.push('/(tabs)/explore-business')}
                  >
                    <ExpoImage 
                      source={require('@/assets/images/marketplace_bg.png')} 
                      style={StyleSheet.absoluteFill} 
                      contentFit="cover"
                      transition={400}
                    />
                    <LinearGradient 
                      colors={isDark ? ['rgba(15,23,42,0.3)', 'rgba(15,23,42,0.95)'] : ['rgba(248,250,252,0.3)', 'rgba(248,250,252,0.95)']} 
                      style={StyleSheet.absoluteFill} 
                    />
                    <View style={styles.viewAllMemoriesContent}>
                       <View style={{ alignItems: 'center', gap: 4, marginBottom: 14, zIndex: 1 }}>
                         <Text style={[styles.viewAllMemoriesText, { fontSize: 18, color: colors.white }]}>Marketplace</Text>
                         <View style={[styles.countPill, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }]}>
                           <Text style={[styles.viewAllMemoriesSub, { color: '#ffffff' }]}>{businesses.length > 0 ? businesses.length : '50+'}+ Vendors</Text>
                         </View>
                       </View>
                       
                       <View style={[styles.miniGalleryBtn, { backgroundColor: isDark ? '#818cf8' : '#6366f1' }]}>
                          <Text style={[styles.miniGalleryBtnText, { color: '#fff' }]}>Explore All</Text>
                          <IconSymbol name="arrow.right" size={14} color="#fff" />
                       </View>
                    </View>
                  </TouchableOpacity>
                </ScrollView>
              </LinearGradient>

              {/* ── SECTION 3: HOST AN EVENT ── */}
              <TouchableOpacity 
                activeOpacity={0.9} 
                style={styles.heroCard}
                onPress={() => router.push('/(tabs)/gallery')}
              >
                <LinearGradient
                  colors={['rgba(212, 175, 55, 0.95)', 'rgba(184, 134, 11, 1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroGradient}
                >
                  <View style={styles.heroContent}>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeText}>FOR HOSTS</Text>
                    </View>
                    <Text style={styles.heroTitle}>Host an Event</Text>
                    <Text style={styles.heroSubtitle}>
                      Create a stunning private gallery for weddings, parties or corporate meets.
                    </Text>
                    <View style={styles.heroBtn}>
                      <Text style={styles.heroBtnText}>Create Now</Text>
                      <IconSymbol name="chevron.right" size={12} color="#ffffff" />
                    </View>
                  </View>
                  <View style={styles.heroIconContainer}>
                    <IconSymbol name="calendar.badge.plus" size={60} color="rgba(255,255,255,0.2)" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* ── SECTION 4: EXPAND BUSINESS ── */}
              <TouchableOpacity 
                activeOpacity={0.9} 
                style={[styles.heroCard, { marginBottom: 80 }]}
                onPress={() => router.push('/manage-business')}
              >
                <LinearGradient
                  colors={['#4f46e5', '#3730a3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroGradient}
                >
                  <View style={styles.heroContent}>
                    <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                      <Text style={styles.heroBadgeText}>FOR PARTNERS</Text>
                    </View>
                    <Text style={styles.heroTitle}>Expand Your Business</Text>
                    <Text style={styles.heroSubtitle}>
                      Promote your brand and reach thousands of local event organizers.
                    </Text>
                    <View style={[styles.heroBtn, { backgroundColor: '#1e1b4b' }]}>
                      <Text style={styles.heroBtnText}>Manage Hub</Text>
                      <IconSymbol name="chevron.right" size={12} color="#ffffff" />
                    </View>
                  </View>
                  <View style={styles.heroIconContainer}>
                    <IconSymbol name="briefcase.fill" size={60} color="rgba(255,255,255,0.15)" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

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

const CARD_W = width * 0.55;
const CARD_H = 155;

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: colors.background },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { fontSize: 13, color: colors.slate400, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 1.2 },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.04)',
    borderWidth: 1, borderColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.1)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  datePillText: { fontSize: 10, color: colors.gold, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },
  headerTitle: { fontSize: 32, fontFamily: 'Yellowtail_400Regular', color: colors.white, letterSpacing: 0.5 },
  tagline: { fontSize: 13, color: colors.slate400, fontFamily: 'Inter_400Regular', marginTop: 4 },
  avatarRingHeader: {
    padding: 3, borderRadius: 30,
    borderWidth: 1.5, borderColor: colors.gold,
  },
  avatarHeader: { width: 54, height: 54, borderRadius: 27 },
  avatarFallbackHeader: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 22, color: colors.gold, fontFamily: 'Outfit_800ExtraBold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: colors.background,
  },

  // ── Sections ──
  section: { paddingTop: 8, paddingBottom: 28 },
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24, marginBottom: 18,
  },
  sectionLabel: { fontSize: 22, color: colors.white, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, color: colors.slate400, fontFamily: 'Inter_400Regular', marginTop: -2 },
  viewAllPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.04)',
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
  },
  viewAllLabel: { fontSize: 11, color: colors.gold, fontFamily: 'Outfit_700Bold' },
  catchyActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  catchyActionPillText: {
    fontSize: 10,
    color: '#020617',
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ── Event/Biz Card ──
  eventCard: {
    width: CARD_W, height: CARD_H,
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.4 : 0.05,
    shadowRadius: 16,
    elevation: 12,
  },
  vignetteTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 70 },
  vignetteBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  eventCardBody: { position: 'absolute', bottom: 14, left: 18, right: 18 },
  eventCardTitle: {
    fontSize: 16, color: colors.white,
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
    borderWidth: 1, borderColor: colors.border,
  },
  ratingText: { fontSize: 10, color: colors.gold, fontFamily: 'Outfit_700Bold' },

  // ── Empty State ──
  emptySlate: {
    marginHorizontal: 24, paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1, borderColor: colors.slate800,
    borderRadius: 20, borderStyle: 'dashed',
  },
  emptyIconRing: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.slate900, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 15, color: colors.white, fontFamily: 'Outfit_700Bold' },
  emptyBody: { fontSize: 12, color: colors.slate400, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4, paddingHorizontal: 40 },

  // ── Divider ──
  hairline: { marginHorizontal: 24, height: 1, backgroundColor: colors.slate900 },

  // ── CTA ──
  // Hero Banner Styles
  heroCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
  },
  heroGradient: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroContent: {
    flex: 1,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroBadgeText: {
    color: isDark ? '#ffffff' : '#0f172a',
    fontSize: 9,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: isDark ? '#ffffff' : '#0f172a',
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 2,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
    lineHeight: 16,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.slate900,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: isDark ? '#ffffff' : '#0f172a',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  heroIconContainer: {
    marginLeft: 8,
  },

  // ── Modal Styles ──
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: colors.slate900, width: '100%', borderRadius: 28, padding: 28, borderWidth: 1, borderColor: colors.border },
  modalTitle: { fontSize: 24, color: colors.white, fontFamily: 'Outfit_800ExtraBold', marginBottom: 12, letterSpacing: -0.5 },
  modalText: { fontSize: 16, color: colors.slate400, fontFamily: 'Inter_400Regular', lineHeight: 26, marginBottom: 28 },
  modalCloseBtn: { backgroundColor: colors.gold, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  modalCloseBtnText: { color: '#0f172a', fontFamily: 'Outfit_800ExtraBold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.8 },

  // ── Join Event Modal Specific ──
  joinModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  joinModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 23, 0.8)' },
  joinModalContent: { 
    backgroundColor: colors.slate900, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, color: colors.gold, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { 
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)', 
    padding: 16, 
    borderRadius: 16, 
    color: colors.white, 
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  submitBtn: { 
    backgroundColor: colors.gold, 
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
    borderColor: colors.gold, 
    backgroundColor: isDark ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.02)' 
  },
  scanBtnText: { color: colors.gold, fontSize: 16, fontFamily: 'Outfit_700Bold' },
  scannerContainer: { width: '100%', height: 350, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center' },
  scanner: { flex: 1 },
  scannerCloseBtn: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  scannerCloseText: { color: colors.white, fontFamily: 'Inter_700Bold', fontSize: 12 },
  permissionText: { color: colors.white, textAlign: 'center', marginBottom: 20, fontFamily: 'Inter_500Medium' },

  // ── All Events Card Styles ──
  allEventsCard: {
    marginHorizontal: 24,
    backgroundColor: colors.slate900,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.3 : 0.05,
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
    backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.04)',
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
    backgroundColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countBadgeText: {
    color: colors.gold,
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  allEventsTitle: {
    fontSize: 18,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  allEventsSub: {
    fontSize: 13,
    color: colors.slate400,
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
    backgroundColor: colors.gold,
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActionBtnSecondaryText: {
    color: colors.gold,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },

  // ── Recent Events Scroll ──
  eventsScrollContainer: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 10,
  },
  recentBusinessCard: {
    width: CARD_W,
    height: 165,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.slate900,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.4 : 0.05,
    shadowRadius: 12,
  },
  recentEventCard: {
    width: CARD_W,
    height: 165,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.slate900,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.4 : 0.05,
    shadowRadius: 12,
  },
  recentEventInfo: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
  },
  recentEventTitle: {
    fontSize: 16,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  recentEventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  recentEventDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter_500Medium',
  },
  viewAllMemoriesCard: {
    width: width * 0.45,
    height: 165,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.slate900,
    borderWidth: 1.5,
    borderColor: colors.border,
    elevation: 12,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 16,
  },
  cardGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.04)',
    filter: 'blur(30px)',
  },
  watermarkContainer: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    transform: [{ rotate: '-15deg' }],
  },
  viewAllMemoriesContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  viewAllIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 8,
  },
  viewAllMemoriesText: {
    fontSize: 16,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.2,
  },
  countPill: {
    backgroundColor: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  viewAllMemoriesSub: {
    fontSize: 10,
    color: colors.gold,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    width: '100%',
  },
  miniGalleryBtnText: {
    fontSize: 12,
    color: '#020617',
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
