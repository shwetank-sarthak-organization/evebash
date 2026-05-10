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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import {
  getUserTotalStorage,
  getUserEventCount,
  getUserEvents,
  getUserVisits,
  getUserById,
  Event as FirestoreEvent,
} from '@/lib/firestore';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [storageUsed, setStorageUsed] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [myGalleries, setMyGalleries] = useState<FirestoreEvent[]>([]);
  const [sharedGalleries, setSharedGalleries] = useState<any[]>([]);
  const [sharedGalleryOwners, setSharedGalleryOwners] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'settings'>('activity');
  const [galleryTab, setGalleryTab] = useState<'my' | 'shared'>('my');

  const fetchData = async () => {
    if (!user) return;
    console.log("[Profile] Fetching data for user:", user.uid, "Role:", user.role);
    try {
      const identifiers = [user.uid];
      if (user.email) identifiers.push(user.email);

      const [storage, count, events, visits] = await Promise.all([
        getUserTotalStorage(identifiers),
        getUserEventCount(user.uid),
        getUserEvents(user.uid),
        user.email ? getUserVisits(user.email) : Promise.resolve([]),
      ]);

      setStorageUsed(storage);
      setEventCount(count);
      setMyGalleries(events);

      // Deduplicate shared galleries and remove events the user created themselves
      const seen = new Set<string>();
      const myEventIds = new Set(events.map(e => e.id));

      const unique = visits.filter((v: any) => {
        if (seen.has(v.eventId)) return false;
        if (myEventIds.has(v.eventId)) return false; // Hide own events
        seen.add(v.eventId);
        return true;
      });
      setSharedGalleries(unique);

      const ownerIds = Array.from(new Set(
        unique
          .map((visit: any) => visit.parentEventOwnerId || visit.ownerId || visit.createdBy)
          .filter(Boolean)
      ));

      const ownerEntries = await Promise.all(
        ownerIds.map(async (ownerId: string) => {
          if (ownerId.includes('@')) return [ownerId, ownerId] as const;
          const owner = await getUserById(ownerId);
          return [ownerId, owner?.email || ownerId] as const;
        })
      );

      setSharedGalleryOwners(Object.fromEntries(ownerEntries));
    } catch (err) {
      console.error('Error fetching profile data:', err);
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

  const getPlanLabel = (role?: string) => {
    const r = role?.toLowerCase();
    switch (r) {
      case 'admin': return 'Super Admin';
      case 'elite': return 'Elite Plan';
      case 'premium': return 'Premium Plan';
      case 'standard': return 'Standard Plan';
      case 'basic': return 'Basic Plan';
      case 'user': return 'Free Plan';
      default: return 'Free Plan';
    }
  };

  const getStorageLimit = (role?: string) => {
    const r = role?.toLowerCase().trim() || 'free';
    const limits: Record<string, number> = {
      'free': 1 * 1024 * 1024 * 1024,
      'user': 1 * 1024 * 1024 * 1024,
      'basic': 15 * 1024 * 1024 * 1024,
      'standard': 60 * 1024 * 1024 * 1024,
      'premium': 200 * 1024 * 1024 * 1024,
      'elite': 1024 * 1024 * 1024 * 1024,
      'admin': 1024 * 1024 * 1024 * 1024, // Admin gets 1TB or unlimited
    };
    return limits[r] || limits['free'];
  };

  const getEventLimitText = (role?: string, count: number = 0) => {
    const r = role?.toLowerCase().trim() || 'free';
    if (r === 'admin' || r === 'premium' || r === 'elite') return `${count} / Unlimited`;
    const limits: Record<string, number> = { 'free': 2, 'user': 2, 'basic': 5, 'standard': 20 };
    return `${count} / ${limits[r] || 2}`;
  };

  const storageLimit = getStorageLimit(user?.role);
  const storagePercentage = Math.min((storageUsed / storageLimit) * 100, 100);

  const getSharedGalleryOwnerEmail = (visit: any) => {
    const ownerId = visit.parentEventOwnerId || visit.ownerId || visit.createdBy;
    if (!ownerId) return 'Unknown owner';
    if (String(ownerId).includes('@')) return ownerId;
    return sharedGalleryOwners[ownerId] || ownerId;
  };

  const sharedGalleriesByOwner = sharedGalleries.reduce<Record<string, any[]>>((groups, visit) => {
    const ownerEmail = getSharedGalleryOwnerEmail(visit);
    if (!groups[ownerEmail]) groups[ownerEmail] = [];
    groups[ownerEmail].push(visit);
    return groups;
  }, {});

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#b8860b" />
        }
      >
        <View style={{ backgroundColor: '#fef3c7', padding: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: '#92400e', fontWeight: 'bold' }}>
            {`DEBUG: Role: "${user.role}" | UID: ${user.uid.slice(0, 8)}... | v1.2`}
          </Text>
        </View>
        {/* Header / Identity */}
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerGradient}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {user.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <IconSymbol name="person.fill" size={40} color="#94a3b8" />
                </View>
              )}
              {user.role === 'admin' && (
                <View style={styles.adminBadge}>
                  <IconSymbol name="shield.fill" size={12} color="#ffffff" />
                </View>
              )}
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
            <View style={styles.planBadge}>
              <Text style={styles.planText}>{getPlanLabel(user.role)}</Text>
            </View>

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={16} color="#ef4444" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Usage Stats Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Storage Usage</Text>
            <View style={styles.storageRow}>
              <Text style={styles.storageText}>
                {(storageUsed / (1024 * 1024)).toFixed(1)} MB used
              </Text>
              <Text style={styles.storageLimitText}>
                of {(user.role?.toLowerCase().trim() === 'admin' || user.role?.toLowerCase().trim() === 'elite') ? '1 TB' : `${(storageLimit / (1024 * 1024 * 1024)).toFixed(0)} GB`}
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { width: `${storagePercentage}%`, backgroundColor: storagePercentage > 90 ? '#ef4444' : '#b8860b' }
                ]} 
              />
            </View>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{getEventLimitText(user.role, eventCount)}</Text>
                <Text style={styles.statLabel}>Events</Text>
              </View>
              <View style={[styles.statItem, styles.statItemBorder]}>
                <Text style={styles.statValue}>{myGalleries.length}</Text>
                <Text style={styles.statLabel}>Galleries</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.upgradeButton}
            onPress={() => router.push('/pricing')} 
          >
            <IconSymbol name="star.fill" size={16} color="#d4af37" />
            <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
          </TouchableOpacity>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'activity' && styles.tabButtonActive]}
              onPress={() => setActiveTab('activity')}
            >
              <Text style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>My Galleries</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'settings' && styles.tabButtonActive]}
              onPress={() => setActiveTab('settings')}
            >
              <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>Account Settings</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'activity' ? (
            <View>
              {/* Sub-tab switcher */}
              <View style={styles.subTabContainer}>
                <TouchableOpacity 
                  style={[styles.subTabButton, galleryTab === 'my' && styles.subTabButtonActive]}
                  onPress={() => setGalleryTab('my')}
                >
                  <IconSymbol name="photo.fill" size={14} color={galleryTab === 'my' ? '#0f172a' : '#94a3b8'} />
                  <Text style={[styles.subTabText, galleryTab === 'my' && styles.subTabTextActive]}>
                    Your Created ({myGalleries.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.subTabButton, galleryTab === 'shared' && styles.subTabButtonActive]}
                  onPress={() => setGalleryTab('shared')}
                >
                  <IconSymbol name="person.2.fill" size={14} color={galleryTab === 'shared' ? '#0f172a' : '#94a3b8'} />
                  <Text style={[styles.subTabText, galleryTab === 'shared' && styles.subTabTextActive]}>
                    Shared With Me ({sharedGalleries.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {loading ? (
                <ActivityIndicator color="#b8860b" style={{ marginTop: 20 }} />
              ) : galleryTab === 'my' ? (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Your Created Galleries</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)')}>
                      <Text style={styles.seeAllText}>Explore All</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {myGalleries.length > 0 ? (
                    myGalleries.map((event) => (
                      <TouchableOpacity 
                        key={event.id} 
                        style={styles.galleryItem}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/events/${event.id}` as any)}
                      >
                        <Image source={{ uri: event.coverImage }} style={styles.galleryImage} />
                        <View style={styles.galleryInfo}>
                          <Text style={styles.galleryTitle}>{event.title}</Text>
                          <Text style={styles.galleryDate}>{event.date}</Text>
                        </View>
                        <IconSymbol name="chevron.right" size={16} color="#cbd5e1" />
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyContainer}>
                      <IconSymbol name="photo.on.rectangle" size={48} color="#e2e8f0" />
                      <Text style={styles.emptyText}>No galleries created yet.</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Shared With Me</Text>
                  </View>
                  
                  {sharedGalleries.length > 0 ? (
                    Object.entries(sharedGalleriesByOwner).map(([ownerEmail, visits]) => (
                      <View key={ownerEmail} style={styles.ownerGroup}>
                        <View style={styles.ownerHeader}>
                          <View style={styles.ownerAvatar}>
                            <Text style={styles.ownerAvatarText}>{ownerEmail.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={styles.ownerInfo}>
                            <Text style={styles.ownerEmail} numberOfLines={1}>{ownerEmail}</Text>
                            <Text style={styles.ownerCount}>
                              {visits.length} shared {visits.length === 1 ? 'gallery' : 'galleries'}
                            </Text>
                          </View>
                        </View>

                        {visits.map((visit) => (
                          <TouchableOpacity
                            key={visit.id}
                            style={[styles.galleryItem, styles.sharedGalleryItem]}
                            activeOpacity={0.7}
                            onPress={() => { if (visit.eventId) router.push(`/events/${visit.eventId}` as any); }}
                          >
                            <View style={[styles.galleryImage, styles.sharedGalleryIcon]}>
                              <IconSymbol name="person.2.fill" size={24} color="#22c55e" />
                            </View>
                            <View style={styles.galleryInfo}>
                              <Text style={styles.galleryTitle}>{visit.eventTitle || "Untitled Event"}</Text>
                              <Text style={styles.galleryDate}>
                                {visit.loginAt?.toDate?.().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) || 'Approved'} • Approved
                              </Text>
                            </View>
                            <IconSymbol name="chevron.right" size={16} color="#cbd5e1" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyContainer}>
                      <IconSymbol name="person.2.fill" size={48} color="#e2e8f0" />
                      <Text style={styles.emptyText}>No shared galleries yet.</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.settingsContainer}>
              <Text style={styles.settingsTitle}>Personal Information</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FULL NAME</Text>
                <View style={styles.inputBox}>
                  <Text style={styles.inputText}>{user.name}</Text>
                </View>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{user.email ? 'EMAIL ADDRESS' : 'PHONE NUMBER'}</Text>
                <View style={styles.inputBox}>
                  <Text style={styles.inputText}>{user.email || user.phone || ''}</Text>
                </View>
              </View>

              <View style={styles.settingsDivider} />
              
              <Text style={styles.settingsDisclaimer}>
                To change your account details, please contact our support team.
              </Text>
            </View>
          )}
        </View>
        
        <View style={{ height: 40 }} />
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
  headerGradient: {
    paddingTop: 40,
    paddingBottom: 60,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  adminBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#b8860b',
    padding: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  planBadge: {
    backgroundColor: 'rgba(184, 134, 11, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(184, 134, 11, 0.3)',
  },
  planText: {
    color: '#d4af37',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: 24,
    marginTop: -30,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  storageText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
  },
  storageLimitText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  seeAllText: {
    fontSize: 14,
    color: '#b8860b',
    fontWeight: 'bold',
  },
  galleryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  galleryImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 16,
  },
  galleryInfo: {
    flex: 1,
  },
  galleryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  galleryDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  ownerGroup: {
    marginBottom: 18,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ownerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ownerAvatarText: {
    color: '#059669',
    fontSize: 15,
    fontWeight: '900',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerEmail: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  ownerCount: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sharedGalleryItem: {
    marginLeft: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#bbf7d0',
  },
  sharedGalleryIcon: {
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
  },
  emptyText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 24,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  upgradeButtonText: {
    color: '#d4af37',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 16,
  },
  tabButtonActive: {
    backgroundColor: '#f8fafc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: '#1e293b',
  },
  subTabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  subTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 8,
  },
  subTabButtonActive: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  subTabTextActive: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  settingsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: 8,
  },
  inputBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  inputText: {
    fontSize: 16,
    color: '#334155',
  },
  settingsDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  settingsDisclaimer: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
