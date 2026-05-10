import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import { Event as FirestoreEvent, getApprovedSharedEventsForUser, getUserById, getUserEvents } from '@/lib/firestore';

type OwnerProfile = {
  email?: string;
  name?: string;
};

export default function GalleryTabScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<FirestoreEvent[]>([]);
  const [workspaceOwner, setWorkspaceOwner] = useState<OwnerProfile | null>(null);
  const [eventOwners, setEventOwners] = useState<Record<string, OwnerProfile>>({});
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const fetchWorkspaceOwner = async () => {
      if (!user?.delegatedBy) {
        setWorkspaceOwner(null);
        return;
      }

      const owner = await getUserById(user.delegatedBy);
      setWorkspaceOwner(owner);
    };

    if (user) fetchWorkspaceOwner();
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [user, authLoading, workspaceOwner?.email]);

  useEffect(() => {
    const fetchEventOwners = async () => {
      const ownerIds = Array.from(new Set(
        events
          .map((event) => event.createdBy)
          .filter((ownerId): ownerId is string => !!ownerId && !ownerId.includes('@'))
      ));

      if (ownerIds.length === 0) {
        setEventOwners({});
        return;
      }

      const entries = await Promise.all(
        ownerIds.map(async (ownerId) => {
          const owner = await getUserById(ownerId);
          return [ownerId, { email: owner?.email, name: owner?.name }] as const;
        })
      );

      setEventOwners(Object.fromEntries(entries));
    };

    fetchEventOwners();
  }, [events]);

  const fetchEvents = async () => {
    if (authLoading) return;
    if (!user?.uid) {
      setEvents([]);
      setLoadingEvents(false);
      return;
    }

    setLoadingEvents(true);
    try {
      const ownIdentifiers = [user.uid];
      if (user.email) ownIdentifiers.push(user.email);
      if (user.phone) ownIdentifiers.push(user.phone);

      const ownerIdentifiers: string[] = [];
      if (user.delegatedBy) ownerIdentifiers.push(user.delegatedBy);
      if (workspaceOwner?.email) ownerIdentifiers.push(workspaceOwner.email);

      const identifiers = user.delegatedBy ? [...ownIdentifiers, ...ownerIdentifiers] : ownIdentifiers;
      const [rawEvents, approvedSharedEvents] = await Promise.all([
        getUserEvents(identifiers, 'main'),
        getApprovedSharedEventsForUser(ownIdentifiers),
      ]);

      const managerVisibleEvents = user.roleType === 'event'
        ? rawEvents.filter((event) => {
          const assignedEvents = user.assignedEvents || [];
          return (!!event.createdBy && ownIdentifiers.includes(event.createdBy)) || assignedEvents.includes(event.id);
        })
        : rawEvents;

      const visibleEvents = Array.from(
        new Map([...managerVisibleEvents, ...approvedSharedEvents].map((event) => [event.id, event])).values()
      );

      setEvents(visibleEvents);
    } catch (error) {
      console.error('Error fetching gallery events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const ownEventIdentifiers = new Set([user?.uid, user?.email].filter(Boolean) as string[]);
  const createdEvents = events.filter((event) => !!event.createdBy && ownEventIdentifiers.has(event.createdBy));
  const sharedEvents = events.filter((event) => !event.createdBy || !ownEventIdentifiers.has(event.createdBy));

  const getEventOwnerEmail = (event: FirestoreEvent) => {
    if (!event.createdBy) return 'Unknown owner';
    if (event.createdBy.includes('@')) return event.createdBy;
    return eventOwners[event.createdBy]?.email || workspaceOwner?.email || event.createdBy;
  };

  const groupedSharedEvents = sharedEvents.reduce<Record<string, FirestoreEvent[]>>((groups, event) => {
    const ownerEmail = getEventOwnerEmail(event);
    if (!groups[ownerEmail]) groups[ownerEmail] = [];
    groups[ownerEmail].push(event);
    return groups;
  }, {});

  const renderEventCard = (event: FirestoreEvent, isShared = false) => (
    <TouchableOpacity
      key={event.id}
      style={styles.albumCard}
      activeOpacity={0.85}
      onPress={() => router.push(`/events/${event.id}` as any)}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: event.coverImage || 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1200&auto=format&fit=crop' }}
          style={styles.coverImage}
          contentFit="cover"
          transition={300}
        />
        <View style={styles.overlay} />
        {isShared && (
          <View style={styles.ownerPill}>
            <Text style={styles.ownerPillText} numberOfLines={1}>Owner: {getEventOwnerEmail(event)}</Text>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.metaRow}>
          <Text style={styles.category}>{isShared ? 'Shared Event' : 'Created Event'}</Text>
          <Text style={styles.year}>{event.date || 'Gallery'}</Text>
        </View>
        <Text style={styles.albumName} numberOfLines={2}>{event.title}</Text>

        <View style={styles.viewRow}>
          <Text style={styles.viewText}>View Galleries</Text>
          <IconSymbol name="chevron.right" size={16} color="#0284c7" />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Your Events</Text>
          <Text style={styles.subtitle}>
            View galleries you created and events shared with you.
          </Text>
        </View>

        {loadingEvents ? (
          <ActivityIndicator color="#0284c7" style={{ marginTop: 40 }} />
        ) : !user ? (
          <View style={styles.emptyState}>
            <IconSymbol name="person.fill" size={42} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Sign in to view galleries</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/login')}>
              <Text style={styles.emptyButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="photo.on.rectangle" size={42} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No events found</Text>
            <Text style={styles.emptyDesc}>Created and shared events will appear here.</Text>
          </View>
        ) : (
          <View style={styles.sectionStack}>
            {createdEvents.length > 0 && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Your Created Events</Text>
                  <Text style={styles.sectionCount}>{createdEvents.length} {createdEvents.length === 1 ? 'event' : 'events'}</Text>
                </View>
                <View style={styles.gridContainer}>
                  {createdEvents.map((event) => renderEventCard(event))}
                </View>
              </View>
            )}

            {sharedEvents.length > 0 && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Shared Events</Text>
                  <Text style={styles.sectionCount}>{sharedEvents.length} {sharedEvents.length === 1 ? 'event' : 'events'}</Text>
                </View>
                <View style={styles.ownerGroupStack}>
                  {Object.entries(groupedSharedEvents).map(([ownerEmail, ownerEvents]) => (
                    <View key={ownerEmail} style={styles.ownerGroup}>
                      <View style={styles.ownerHeader}>
                        <View style={styles.ownerAvatar}>
                          <Text style={styles.ownerAvatarText}>{ownerEmail.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.ownerInfo}>
                          <Text style={styles.ownerEmail} numberOfLines={1}>{ownerEmail}</Text>
                          <Text style={styles.ownerCount}>{ownerEvents.length} shared {ownerEvents.length === 1 ? 'event' : 'events'}</Text>
                        </View>
                      </View>
                      <View style={styles.gridContainer}>
                        {ownerEvents.map((event) => renderEventCard(event, true))}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
  sectionStack: {
    gap: 34,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  sectionCount: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 4,
  },
  gridContainer: {
    paddingHorizontal: 20,
    gap: 20,
  },
  albumCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 10,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  ownerPill: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  ownerPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoContainer: {
    padding: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  category: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  year: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  albumName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 14,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
  ownerGroupStack: {
    gap: 24,
  },
  ownerGroup: {
    gap: 12,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  ownerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ownerAvatarText: {
    color: '#059669',
    fontWeight: '900',
    fontSize: 16,
  },
  ownerInfo: {
    flex: 1,
  },
  ownerEmail: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  ownerCount: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyState: {
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 12,
  },
  emptyDesc: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginTop: 18,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
});
