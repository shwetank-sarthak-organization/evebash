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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import { MidnightColors, Fonts } from '../constants/theme';
import { getUserEvents, getApprovedSharedEventsForUser } from '@/lib/firestore';
import { FirestoreEvent } from '@/types/event';

const { width } = Dimensions.get('window');

export default function YourEventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [events, setEvents] = useState<FirestoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      activeOpacity={0.85}
      onPress={() => router.push(`/events/${event.id}`)}
    >
      <ExpoImage
        source={{ uri: event.coverImage }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
      />
      <LinearGradient
        colors={['transparent', 'rgba(2, 6, 23, 0.95)']}
        style={styles.cardGradient}
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.cardMeta}>
          <IconSymbol name="calendar" size={10} color={MidnightColors.slate400} />
          <Text style={styles.cardDate}>{event.date}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={20} color={MidnightColors.gold} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>All Memories</Text>
          <Text style={styles.headerSub}>{events.length} Events Total</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MidnightColors.gold} />}
        contentContainerStyle={styles.scrollContent}
      >
        {loading && !refreshing ? (
          <ActivityIndicator color={MidnightColors.gold} style={{ marginTop: 60 }} />
        ) : (
          <View style={styles.grid}>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol name="photo.on.rectangle" size={40} color={MidnightColors.slate700} />
                <Text style={styles.emptyTitle}>No events found</Text>
                <Text style={styles.emptyBody}>You haven't joined or created any events yet.</Text>
              </View>
            ) : (
              events.map(renderEventCard)
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: MidnightColors.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: MidnightColors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 20, color: '#fff', fontFamily: Fonts.outfit.extraBold },
  headerSub: { fontSize: 12, color: MidnightColors.slate400, fontFamily: Fonts.inter.medium, marginTop: 2 },

  // Grid
  grid: { paddingHorizontal: 20, paddingTop: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  eventCard: {
    width: (width - 54) / 2, height: 220,
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: MidnightColors.deepSlate,
    borderWidth: 1, borderColor: MidnightColors.cardBorder,
    marginBottom: 14,
  },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  cardContent: { position: 'absolute', bottom: 14, left: 16, right: 16 },
  cardTitle: { fontSize: 16, color: '#fff', fontFamily: Fonts.outfit.bold, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: 10, color: MidnightColors.slate400, fontFamily: Fonts.inter.medium },

  // Empty State
  emptyState: { width: '100%', alignItems: 'center', paddingVertical: 100 },
  emptyTitle: { fontSize: 18, color: '#fff', fontFamily: Fonts.outfit.bold, marginTop: 16 },
  emptyBody: { fontSize: 13, color: MidnightColors.slate400, fontFamily: Fonts.inter.regular, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
});
