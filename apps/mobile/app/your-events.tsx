import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { MidnightColors, Fonts } from '../constants/theme';
import { getUserEvents, getApprovedSharedEventsForUser } from '@/lib/firestore';
import { FirestoreEvent } from '@/types/event';

const { width } = Dimensions.get('window');

export default function YourEventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [events, setEvents] = useState<FirestoreEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ownIdentifiers = [user.uid];
      if (user.email) ownIdentifiers.push(user.email);
      
      const [fetchedMy, fetchedShared] = await Promise.all([
        getUserEvents(ownIdentifiers, 'main'),
        getApprovedSharedEventsForUser(ownIdentifiers),
      ]);

      const allEvents = Array.from(
        new Map([...fetchedMy, ...fetchedShared].map((e) => [e.id, e])).values()
      );
      setEvents(allEvents);
    } catch (err) {
      console.error('[YourEvents] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderEventCard = (event: FirestoreEvent) => (
    <TouchableOpacity
      key={event.id}
      style={styles.eventCard}
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
        colors={['rgba(2,6,23,0.3)', 'rgba(2,6,23,0.85)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{event.date.split(',')[0]}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.avatarStack}>
             {/* Placeholder for participant count if available */}
             <IconSymbol name="person.2.fill" size={10} color={MidnightColors.gold} />
             <Text style={styles.participantText}>Memories</Text>
          </View>
          <View style={styles.arrowIcon}>
            <IconSymbol name="chevron.right" size={10} color="#000" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>All Memories</Text>
            <Text style={styles.headerSubtitle}>{events.length} Collections</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <IconSymbol name="bell.fill" size={20} color="#d4af37" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MidnightColors.gold} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SEARCH & FILTER ── */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <IconSymbol name="magnifyingglass" size={18} color="#64748b" />
            <TextInput 
              style={styles.searchInput}
              placeholder="Search memories..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.filterBtn}>
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M10 5H3"/><Path d="M12 19H3"/><Path d="M14 3v4"/><Path d="M16 17v4"/><Path d="M21 12h-9"/><Path d="M21 19h-5"/><Path d="M21 5h-7"/><Path d="M8 10v4"/><Path d="M8 12H3"/>
            </Svg>
          </TouchableOpacity>
        </View>

        {/* ── HOST CTA BANNER ── */}
        <TouchableOpacity 
          style={styles.hostBanner}
          activeOpacity={0.9}
          onPress={() => router.push('/(tabs)/gallery')}
        >
          <LinearGradient
            colors={['rgba(212,175,55,0.15)', 'rgba(15,23,42,0.9)']}
            style={styles.hostBannerGradient}
          >
            <View style={styles.hostBannerContent}>
              <View>
                <Text style={styles.hostBannerTitle}>Host Your Own Event</Text>
                <Text style={styles.hostBannerSub}>Create a private gallery for any occasion</Text>
              </View>
              <View style={styles.hostBannerBtn}>
                <IconSymbol name="plus" size={16} color="#020617" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {loading && !refreshing ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={MidnightColors.gold} size="large" />
            <Text style={styles.loadingText}>Fetching your memories...</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <IconSymbol name="photo.on.rectangle.angled" size={48} color={MidnightColors.slate700} />
                </View>
                <Text style={styles.emptyTitle}>No Memories Found</Text>
                <Text style={styles.emptyBody}>
                  {searchQuery 
                    ? `No events matching "${searchQuery}" found in your collection.`
                    : "The events you host or join will appear here as beautiful digital albums."}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity 
                    style={styles.emptyActionBtn}
                    onPress={() => router.push('/(tabs)/dashboard')}
                  >
                    <Text style={styles.emptyActionText}>Join an Event</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.cardsWrapper}>
                {filteredEvents.map(renderEventCard)}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60, paddingTop: 10 },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#020617',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
  },
  headerTitle: {
    fontSize: 28,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    marginTop: -2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },

  // Host Banner
  hostBanner: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  hostBannerGradient: {
    padding: 20,
  },
  hostBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hostBannerTitle: {
    fontSize: 20,
    color: '#fff',
    fontFamily: Fonts.outfit.extraBold,
    marginBottom: 4,
  },
  hostBannerSub: {
    fontSize: 13,
    color: MidnightColors.slate400,
    fontFamily: Fonts.inter.regular,
  },
  hostBannerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: MidnightColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search & Filter
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.inter.regular,
  },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Grid / Layout
  grid: { paddingHorizontal: 20 },
  cardsWrapper: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  
  // Event Card
  eventCard: {
    width: (width - 54) / 2, height: 260,
    borderRadius: 28, overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
    marginBottom: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  cardContent: { flex: 1, padding: 16, justifyContent: 'flex-end' },
  cardHeader: { position: 'absolute', top: 16, left: 16 },
  dateBadge: {
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dateBadgeText: { fontSize: 10, color: '#fff', fontFamily: Fonts.inter.bold, textTransform: 'uppercase' },
  cardTitle: { fontSize: 18, color: '#fff', fontFamily: Fonts.outfit.bold, marginBottom: 12, lineHeight: 22 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarStack: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantText: { fontSize: 10, color: MidnightColors.slate400, fontFamily: Fonts.inter.medium },
  arrowIcon: {
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: MidnightColors.gold,
    alignItems: 'center', justifyContent: 'center',
  },

  // States
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  loadingText: { marginTop: 16, color: MidnightColors.slate400, fontSize: 14, fontFamily: Fonts.inter.medium },
  emptyState: { width: '100%', alignItems: 'center', paddingTop: 80 },
  emptyIconContainer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(212,175,55,0.05)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.1)',
  },
  emptyTitle: { fontSize: 24, color: '#fff', fontFamily: Fonts.outfit.bold },
  emptyBody: { fontSize: 15, color: MidnightColors.slate400, fontFamily: Fonts.inter.regular, textAlign: 'center', marginTop: 12, paddingHorizontal: 30, lineHeight: 22 },
  emptyActionBtn: {
    marginTop: 32,
    backgroundColor: MidnightColors.gold,
    paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: 16,
  },
  emptyActionText: { color: '#020617', fontFamily: Fonts.outfit.extraBold, fontSize: 16 },
});
