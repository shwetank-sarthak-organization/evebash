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
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIconButton} 
            activeOpacity={0.7}
            onPress={() => Alert.alert("Messages", "Coming Soon: Direct messaging with vendors and event hosts.")}
          >
            <IconSymbol name="bubble.right" size={22} color="#f8fafc" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <View style={styles.avatarRing}>
              {user.profileImage
                ? <Image source={{ uri: user.profileImage }} style={styles.avatar} />
                : <View style={styles.avatarFallback}>
                    <IconSymbol name="person.fill" size={16} color="#64748b" />
                  </View>
              }
            </View>
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
              <View style={[styles.section, { backgroundColor: '#020617' }]}>
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
                    <IconSymbol name="plus.circle.fill" size={12} color="#020617" />
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
                       <View style={{ alignItems: 'center', gap: 6, marginBottom: 28, zIndex: 1 }}>
                         <Text style={[styles.viewAllMemoriesText, { fontSize: 22 }]}>Your memories</Text>
                         <View style={styles.countPill}>
                           <Text style={styles.viewAllMemoriesSub}>{events.length} Collections</Text>
                         </View>
                       </View>
                       
                       <View style={styles.miniGalleryBtn}>
                          <Text style={styles.miniGalleryBtnText}>Explore All</Text>
                          <IconSymbol name="arrow.right" size={14} color="#020617" />
                       </View>
                    </View>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              <LinearGradient 
                colors={['#020617', '#0f172a']} 
                style={[styles.section, { paddingTop: 40 }]}
              >
                <View style={styles.sectionHead}>
                  <View>
                    <Text style={styles.sectionLabel}>Services near you</Text>
                    <Text style={styles.sectionSub}>Photographers, venues & more</Text>
                  </View>
                  <TouchableOpacity 
                    style={[styles.catchyActionPill, { backgroundColor: '#818cf8' }]}
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
                      onPress={() => router.push(`/(tabs)/explore-business`)} // Navigate to details or explore
                    >
                      <ExpoImage 
                        source={{ uri: biz.coverImage }} 
                        style={StyleSheet.absoluteFill} 
                        contentFit="cover"
                        transition={400}
                      />
                      <LinearGradient 
                        colors={['transparent', 'rgba(15,23,42,0.9)']} 
                        style={StyleSheet.absoluteFill} 
                      />
                      <View style={styles.recentEventInfo}>
                        <Text style={styles.recentEventTitle} numberOfLines={1}>{biz.name}</Text>
                        <View style={styles.recentEventMeta}>
                          <IconSymbol name="tag.fill" size={10} color="rgba(129,140,248,0.6)" />
                          <Text style={[styles.recentEventDate, { color: 'rgba(129,140,248,0.8)' }]}>{biz.type}</Text>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                          <IconSymbol name="star.fill" size={10} color="#d4af37" />
                          <Text style={styles.recentEventDate}>{biz.rating}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  
                  <TouchableOpacity 
                    style={[styles.viewAllMemoriesCard, { borderColor: 'rgba(129,140,248,0.3)', shadowColor: '#818cf8' }]}
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
                      colors={['rgba(15,23,42,0.3)', 'rgba(15,23,42,0.95)']} 
                      style={StyleSheet.absoluteFill} 
                    />
                    <View style={styles.viewAllMemoriesContent}>
                       <View style={{ alignItems: 'center', gap: 6, marginBottom: 28, zIndex: 1 }}>
                         <Text style={[styles.viewAllMemoriesText, { fontSize: 22 }]}>Marketplace</Text>
                         <View style={[styles.countPill, { backgroundColor: 'rgba(129,140,248,0.1)', borderColor: 'rgba(129,140,248,0.2)' }]}>
                           <Text style={[styles.viewAllMemoriesSub, { color: '#818cf8' }]}>{businesses.length > 0 ? businesses.length : '50+'}+ Vendors</Text>
                         </View>
                       </View>
                       
                       <View style={[styles.miniGalleryBtn, { backgroundColor: '#818cf8' }]}>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d4af37',
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },

  // ── Sections ──
  section: { paddingTop: 8, paddingBottom: 28 },
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24, marginBottom: 18,
  },
  sectionLabel: { fontSize: 22, color: '#f1f5f9', fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, color: '#64748b', fontFamily: 'Inter_400Regular', marginTop: -2 },
  viewAllPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  viewAllLabel: { fontSize: 11, color: '#d4af37', fontFamily: 'Outfit_700Bold' },
  catchyActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d4af37',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
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
  // Hero Banner Styles
  heroCard: {
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#ffffff',
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
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  heroIconContainer: {
    marginLeft: 8,
  },

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

  // ── Recent Events Scroll ──
  eventsScrollContainer: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 10,
  },
  recentBusinessCard: {
    width: CARD_W,
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.1)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  recentEventCard: {
    width: CARD_W,
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  recentEventInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  recentEventTitle: {
    fontSize: 18,
    color: '#fff',
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
    width: width * 0.52,
    height: 200,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.18)',
    elevation: 12,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  cardGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212,175,55,0.1)',
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
    backgroundColor: 'rgba(212,175,55,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    marginBottom: 14,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  viewAllMemoriesText: {
    fontSize: 16,
    color: '#f8fafc',
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.2,
  },
  countPill: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  viewAllMemoriesSub: {
    fontSize: 10,
    color: '#d4af37',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d4af37',
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
