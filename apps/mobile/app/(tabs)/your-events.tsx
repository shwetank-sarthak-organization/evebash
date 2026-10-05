import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TabScreenHeader, HeaderAction } from '@/components/ui/TabScreenHeader';
import { EventGridCard } from '@/components/ui/EventGridCard';
import { HostEventBanner } from '@/components/ui/HostEventBanner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { MidnightColors, Fonts } from '@/constants/theme';
import { EventGrid, getEventGridCardWidth } from '@/constants/layout';
import { getUserEvents, getApprovedSharedEventsForUser, Event as DatabaseEvent } from '@/lib/database';

const { width } = Dimensions.get('window');

type SortKey = 'recent' | 'date_desc' | 'date_asc' | 'name';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recently added' },
  { key: 'date_desc', label: 'Event date: newest first' },
  { key: 'date_asc', label: 'Event date: oldest first' },
  { key: 'name', label: 'Name: A to Z' },
];

const ALL_TYPES = 'All';

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Event dates are stored as display text ("26 September 2026"); returns a timestamp, or null if unreadable. */
function eventDateValue(date?: string): number | null {
  const text = date?.trim();
  if (!text) return null;
  const verbal = text.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (verbal) {
    const month = MONTH_NAMES.findIndex((m) => verbal[2].toLowerCase().startsWith(m));
    if (month !== -1) return new Date(Number(verbal[3]), month, Number(verbal[1])).getTime();
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function sortEvents(list: DatabaseEvent[], sortKey: SortKey): DatabaseEvent[] {
  const sorted = [...list];
  if (sortKey === 'name') {
    return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
  }
  if (sortKey === 'date_desc' || sortKey === 'date_asc') {
    const direction = sortKey === 'date_desc' ? -1 : 1;
    return sorted.sort((a, b) => {
      const da = eventDateValue(a.date);
      const db = eventDateValue(b.date);
      // Events without a readable date go last either way
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return (da - db) * direction;
    });
  }
  return sorted.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export default function YourEventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [events, setEvents] = useState<DatabaseEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);

  // Only offer the types the user's events actually have
  const availableTypes = React.useMemo(() => {
    const types = new Map<string, string>();
    events.forEach((event) => {
      const category = event.category?.trim();
      if (category && !types.has(category.toLowerCase())) types.set(category.toLowerCase(), category);
    });
    return Array.from(types.values()).sort((a, b) => a.localeCompare(b));
  }, [events]);

  // A type that no longer exists after a refresh falls back to All
  const activeType = availableTypes.some((t) => t.toLowerCase() === typeFilter.toLowerCase()) ? typeFilter : ALL_TYPES;
  const filtersActive = sortKey !== 'recent' || activeType !== ALL_TYPES;

  const trimmedQuery = searchQuery.trim();
  const filteredEvents = sortEvents(
    events.filter((event) =>
      event.title.toLowerCase().includes(trimmedQuery.toLowerCase()) &&
      (activeType === ALL_TYPES || event.category?.trim().toLowerCase() === activeType.toLowerCase())
    ),
    sortKey
  );

  const clearFilters = () => {
    setSortKey('recent');
    setTypeFilter(ALL_TYPES);
    setSearchQuery('');
  };

  // Bumped on every fetch so a slower, older request can't overwrite newer results
  const fetchSeq = React.useRef(0);

  const fetchData = async () => {
    const seq = ++fetchSeq.current;
    if (!user) {
      setEvents([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const ownIdentifiers = [user.uid];
      if (user.email) ownIdentifiers.push(user.email);
      if (user.phone) ownIdentifiers.push(user.phone);

      const [fetchedMy, fetchedShared] = await Promise.all([
        getUserEvents(ownIdentifiers, 'main', undefined, undefined, { throwOnError: true }),
        getApprovedSharedEventsForUser(ownIdentifiers),
      ]);
      if (seq !== fetchSeq.current) return;

      const allEvents = Array.from(
        new Map([...fetchedMy, ...fetchedShared].map((e) => [e.id, e])).values()
      );
      setEvents(allEvents);
      setLoadError(false);
    } catch (err) {
      if (seq === fetchSeq.current) {
        console.error('[YourEvents] Fetch error:', err);
        setLoadError(true);
      }
    } finally {
      if (seq === fetchSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.grid} accessible accessibilityLabel="Loading your events">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton height={EventGrid.imageHeight} radius={0} />
              <View style={{ padding: 12, gap: 8 }}>
                <Skeleton width="70%" height={13} />
                <Skeleton width="50%" height={10} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (loadError && events.length === 0) {
      return (
        <ErrorState
          title="Couldn't load your events"
          onRetry={() => fetchData()}
          retrying={loading}
        />
      );
    }

    if (events.length === 0) {
      return (
        <View style={styles.emptyState}>
          <IconSymbol name="photo.on.rectangle" size={40} color={colors.slate400} />
          <Text style={styles.emptyTitle}>No events yet</Text>
          <Text style={styles.emptyBody}>Events you host or join will appear here.</Text>
          <Button
            title="Join an Event"
            variant="secondary"
            icon="qrcode.viewfinder"
            fullWidth={false}
            onPress={() => router.push('/(tabs)/dashboard')}
            style={{ marginTop: 16 }}
          />
        </View>
      );
    }

    if (filteredEvents.length === 0) {
      return (
        <View style={styles.emptyState}>
          <IconSymbol name="magnifyingglass" size={40} color={colors.slate400} />
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>No events match your search or filters.</Text>
          <Button
            title="Clear filters"
            variant="secondary"
            fullWidth={false}
            onPress={clearFilters}
            style={{ marginTop: 16 }}
          />
        </View>
      );
    }

    return (
      <View style={styles.grid}>
        {filteredEvents.map((event) => (
          <EventGridCard
            key={event.id}
            title={event.title}
            date={event.date}
            category={event.category}
            coverImage={event.coverImage}
            onPress={() => router.push(`/events/${event.id}?mode=visitor`)}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TabScreenHeader
          title="Gallery"
          right={events.length > 0 ? (
            <HeaderAction
              onPress={() => setShowFilters(true)}
              accessibilityLabel={filtersActive ? 'Sort and filter events, filters on' : 'Sort and filter events'}
              showBadge={filtersActive}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M10 5H3" /><Path d="M12 19H3" /><Path d="M14 3v4" /><Path d="M16 17v4" /><Path d="M21 12h-9" /><Path d="M21 19h-5" /><Path d="M21 5h-7" /><Path d="M8 10v4" /><Path d="M8 12H3" />
              </Svg>
            </HeaderAction>
          ) : undefined}
        />

        {events.length > 0 && (
          <View style={styles.searchSection}>
            <View style={styles.searchBox}>
              <IconSymbol name="magnifyingglass" size={18} color={colors.slate400} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search events..."
                placeholderTextColor={colors.slate400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                accessibilityLabel="Search events"
              />
            </View>
          </View>
        )}

        {renderContent()}

        <HostEventBanner
          style={styles.hostBanner}
          onPress={() => router.push('/(tabs)/gallery')}
        />
      </ScrollView>

      <BottomSheet visible={showFilters} onClose={() => setShowFilters(false)} style={{ backgroundColor: colors.deepSlate }}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Sort & filter</Text>
          {filtersActive && (
            <TouchableOpacity
              onPress={() => { setSortKey('recent'); setTypeFilter(ALL_TYPES); }}
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.sheetReset}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sheetLabel}>SORT BY</Text>
        <View style={styles.sortList}>
          {SORT_OPTIONS.map((option) => {
            const selected = option.key === sortKey;
            return (
              <TouchableOpacity
                key={option.key}
                style={styles.sortRow}
                activeOpacity={0.7}
                onPress={() => setSortKey(option.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.sortText, selected && styles.sortTextSelected]}>{option.label}</Text>
                {selected && <IconSymbol name="checkmark" size={18} color={colors.gold} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {availableTypes.length > 0 && (
          <>
            <Text style={styles.sheetLabel}>EVENT TYPE</Text>
            <View style={styles.chipRow}>
              {[ALL_TYPES, ...availableTypes].map((type) => {
                const selected = type.toLowerCase() === activeType.toLowerCase();
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, selected && styles.chipSelected]}
                    activeOpacity={0.8}
                    onPress={() => setTypeFilter(type)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Button
          title={`Show ${filteredEvents.length} ${filteredEvents.length === 1 ? 'event' : 'events'}`}
          onPress={() => setShowFilters(false)}
          style={{ marginTop: 24 }}
        />
      </BottomSheet>
    </View>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  // Search
  searchSection: {
    paddingHorizontal: EventGrid.sidePadding,
    paddingTop: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.surface : '#ffffff',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: EventGrid.radius,
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.14)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: colors.white,
    fontSize: 14,
    fontFamily: Fonts.inter.regular,
  },

  // Grid (same as the Host tab)
  grid: {
    paddingHorizontal: EventGrid.sidePadding,
    paddingTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  skeletonCard: {
    width: getEventGridCardWidth(width),
    height: EventGrid.cardHeight,
    borderRadius: EventGrid.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104,0.14)',
    backgroundColor: isDark ? colors.surface : '#ffffff',
    marginBottom: EventGrid.rowGap,
  },

  hostBanner: { marginTop: 12 },

  // Sort & filter sheet
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 20, color: colors.white, fontFamily: Fonts.outfit.bold },
  sheetReset: { fontSize: 14, color: colors.gold, fontFamily: Fonts.inter.semiBold },
  sheetLabel: { fontSize: 11, color: colors.slate400, fontFamily: Fonts.inter.bold, letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  sortList: {
    borderRadius: EventGrid.radius,
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.14)',
    overflow: 'hidden',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(202, 156, 104, 0.12)',
  },
  sortText: { fontSize: 14, color: colors.white, fontFamily: Fonts.inter.regular },
  sortTextSelected: { color: colors.gold, fontFamily: Fonts.inter.semiBold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.25)',
  },
  chipSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontSize: 13, color: colors.white, fontFamily: Fonts.inter.medium },
  chipTextSelected: { color: colors.onAccent, fontFamily: Fonts.inter.bold },

  // Empty states (same as the Host tab)
  emptyState: { width: '100%', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, color: colors.white, fontFamily: Fonts.outfit.bold, marginTop: 16 },
  emptyBody: { fontSize: 12, color: colors.slate400, fontFamily: Fonts.inter.regular, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
});
