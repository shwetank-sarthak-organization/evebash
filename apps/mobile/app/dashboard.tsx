import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Share,
  Platform,
  TextInput,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import {
  getUserEvents,
  getSubEvents,
  Event as FirestoreEvent,
  updateEvent,
  deleteEvent,
  createEvent,
  getGuestLogs,
  updateGuestStatus,
  deleteGuest,
  GuestLog,
  getUserById,
  getApprovedSharedEventsForUser,
  getUsers,
  updateUserRole,
  UserProfile
} from '@/lib/firestore';

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1465495910483-34a170a7bb00?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1549413187-0521e7cebcba?q=80&w=1200&auto=format&fit=crop"
];

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'main' | 'data' | 'permissions'>('main');
  const [events, setEvents] = useState<FirestoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMenuEventId, setSelectedMenuEventId] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventCover, setNewEventCover] = useState('');
  const [guestLogs, setGuestLogs] = useState<GuestLog[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [expandedAdmins, setExpandedAdmins] = useState<Set<string>>(new Set());
  const [expandedGuests, setExpandedGuests] = useState<Set<string>>(new Set());
  const [workspaceOwner, setWorkspaceOwner] = useState<{ email?: string; name?: string } | null>(null);
  const [eventOwners, setEventOwners] = useState<Record<string, { email?: string; name?: string }>>({});
  
  // Sub-events state
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeEventTitle, setActiveEventTitle] = useState<string>('');
  const [subEvents, setSubEvents] = useState<FirestoreEvent[]>([]);
  const [loadingSubEvents, setLoadingSubEvents] = useState(false);

  useEffect(() => {
    if (user && activeTab === 'data') {
      fetchEvents();
    }
  }, [user, activeTab, workspaceOwner?.email]);

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

  useEffect(() => {
    if (user && activeTab === 'permissions') {
      fetchPermissionData();
    }
  }, [user, activeTab, workspaceOwner?.email]);

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchUsersList = async () => {
    setLoadingUsers(true);
    try {
      const users = await getUsers();
      setAllUsers(users.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPermissionData = async () => {
    await Promise.all([
      fetchEvents(),
      fetchUsersList(),
      fetchGuestLogs(),
    ]);
  };

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ownIdentifiers = [user.uid];
      if (user.email) ownIdentifiers.push(user.email);
      if (user.phone) ownIdentifiers.push(user.phone);

      const ownerIdentifiers: string[] = [];
      if (user.delegatedBy) ownerIdentifiers.push(user.delegatedBy);
      if (workspaceOwner?.email) ownerIdentifiers.push(workspaceOwner.email);

      const identifiers = user.delegatedBy ? [...ownIdentifiers, ...ownerIdentifiers] : ownIdentifiers;
      const [fetchedEvents, approvedSharedEvents] = await Promise.all([
        getUserEvents(identifiers, 'main'),
        getApprovedSharedEventsForUser(ownIdentifiers),
      ]);

      const managerVisibleEvents = user.roleType === 'event'
        ? fetchedEvents.filter((event) => {
          const assignedEvents = user.assignedEvents || [];
          return (!!event.createdBy && ownIdentifiers.includes(event.createdBy)) || assignedEvents.includes(event.id);
        })
        : fetchedEvents;

      const visibleEvents = Array.from(
        new Map([...managerVisibleEvents, ...approvedSharedEvents].map((event) => [event.id, event])).values()
      );

      setEvents(visibleEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventDescription('');
    setNewEventCover('');
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async () => {
    if (!user) return;
    const title = newEventTitle.trim();
    if (!title) {
      Alert.alert("Missing Title", "Please enter a gallery name.");
      return;
    }

    const baseSlug = createSlug(title);
    if (!baseSlug) {
      Alert.alert("Invalid Title", "Please use at least one letter or number in the title.");
      return;
    }

    const suffix = Date.now().toString(36).slice(-5);
    const id = activeEventId ? `${activeEventId}-${baseSlug}-${suffix}` : `${baseSlug}-${suffix}`;
    const coverImage = newEventCover.trim() || PLACEHOLDER_IMAGES[Math.floor(Math.random() * PLACEHOLDER_IMAGES.length)];

    setCreating(true);
    const success = await createEvent({
      id,
      title,
      date: newEventDate.trim() || "Gallery",
      description: newEventDescription.trim() || (activeEventId ? "A curated set of memories." : "A wedding album collection."),
      coverImage,
      createdBy: user.uid,
      type: activeEventId ? 'sub' : 'main',
      parentId: activeEventId || undefined,
      templateId: activeEventId ? undefined : 'hero'
    });
    setCreating(false);

    if (success) {
      setCreateModalVisible(false);
      if (activeEventId) {
        const fetchedSubs = await getSubEvents(activeEventId);
        setSubEvents(fetchedSubs);
      } else {
        fetchEvents();
      }
    } else {
      Alert.alert("Could Not Create", "Please try again in a moment.");
    }
  };

  const fetchGuestLogs = async () => {
    if (!user) return;
    setLoadingGuests(true);
    try {
      const identifiers = [user.uid];
      if (user.email) identifiers.push(user.email);
      if (user.delegatedBy) identifiers.push(user.delegatedBy);
      const logs = await getGuestLogs(identifiers);
      setGuestLogs(logs);
    } catch (error) {
      console.error("Error fetching guest logs:", error);
    } finally {
      setLoadingGuests(false);
    }
  };

  const handleGuestStatus = async (logId: string, status: 'approved' | 'rejected') => {
    const success = await updateGuestStatus(logId, status);
    if (success) fetchGuestLogs();
  };

  const handleGuestDelete = (logId: string) => {
    Alert.alert("Remove Guest Log", "Remove this guest request from your dashboard?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const success = await deleteGuest(logId);
          if (success) fetchGuestLogs();
        }
      }
    ]);
  };

  const handleManageEvent = (eventId: string) => {
    Alert.alert("Manage Event", "Event management options will open here.");
  };

  const handleUpdateUserRole = async (
    targetUid: string,
    currentRole: string,
    roleType: 'primary' | 'event' = 'primary',
    assignedEvents: string[] = [],
    delegateOwnerId?: string
  ) => {
    if (!user) return;
    const targetUser = allUsers.find((u) => u.id === targetUid);
    const isRevoking = currentRole === 'revoke';
    const ownerId = delegateOwnerId || user.uid;
    const ownerDelegatedCount = allUsers.filter((profile) => profile.delegatedBy === ownerId).length;
    const isNewDelegation = targetUser?.delegatedBy !== ownerId;

    if (!isRevoking && isNewDelegation && ownerDelegatedCount >= 2) {
      Alert.alert('Manager Limit', 'You can only have a maximum of 2 delegated managers.');
      return;
    }

    const success = await updateUserRole(
      targetUid,
      null,
      isRevoking ? undefined : ownerId,
      isRevoking ? undefined : roleType,
      isRevoking ? undefined : assignedEvents
    );

    if (success) {
      Alert.alert('Updated', `User successfully ${isRevoking ? 'revoked' : 'authorized'}.`);
      fetchPermissionData();
    } else {
      Alert.alert('Update Failed', 'Could not update user authorizations.');
    }
  };

  const handleRename = (eventId: string) => {
    setSelectedMenuEventId(null);
    if (Platform.OS === 'ios') {
      Alert.prompt(
        "Rename Event",
        "Enter new name for the gallery:",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Rename", 
            onPress: async (newName?: string) => {
              if (newName) {
                const success = await updateEvent(eventId, { title: newName });
                if (success) {
                  if (activeEventId) {
                    const fetchedSubs = await getSubEvents(activeEventId);
                    setSubEvents(fetchedSubs);
                  } else {
                    fetchEvents();
                  }
                }
              }
            }
          }
        ],
        'plain-text'
      );
    } else {
      // Basic fallback for Android if not using a custom modal
      Alert.alert("Rename", "Rename is currently supported on iOS. Android support coming soon.");
    }
  };

  const handleEditPhotos = (eventId: string) => {
    setSelectedMenuEventId(null);
    router.push(`/events/sub/edit/${eventId}` as any);
  };

  const handleChangeTemplate = (eventId: string) => {
    setSelectedMenuEventId(null);
    Alert.alert(
      "Template",
      "Choose a mobile-friendly public gallery template.",
      [
        { text: "Hero", onPress: async () => { await updateEvent(eventId, { templateId: 'hero' }); fetchEvents(); } },
        { text: "Classic", onPress: async () => { await updateEvent(eventId, { templateId: 'classic' }); fetchEvents(); } },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleVisitWebsite = (eventId: string) => {
    setSelectedMenuEventId(null);
    router.push(`/events/sub/${eventId}` as any);
  };

  const handleShare = async (eventId: string) => {
    setSelectedMenuEventId(null);
    try {
      const shareUrl = `https://wedalbum.com/events/${eventId}?shared=true`;
      await Share.share({
        message: `Check out our wedding album: ${shareUrl}`,
        url: shareUrl,
        title: activeEventTitle || 'Wedding Album'
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleDelete = (eventId: string) => {
    setSelectedMenuEventId(null);
    Alert.alert(
      "Delete Event", 
      "Are you sure you want to permanently delete this event? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const success = await deleteEvent(eventId);
            if (success) {
              if (activeEventId) {
                const fetchedSubs = await getSubEvents(activeEventId);
                setSubEvents(fetchedSubs);
              } else {
                fetchEvents();
              }
            }
          }
        }
      ]
    );
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

  const permissionMainEvents = events.filter((event) => event.type === 'main' || (!event.type && !event.parentId));
  const permissionCreatedEvents = permissionMainEvents.filter((event) => !!event.createdBy && ownEventIdentifiers.has(event.createdBy));
  const permissionOtherEvents = permissionMainEvents.filter((event) => !event.createdBy || !ownEventIdentifiers.has(event.createdBy));
  const primaryManagers = allUsers.filter((profile) =>
    (profile.delegatedBy === user?.uid || profile.id === user?.uid) &&
    (profile.roleType === 'primary' || profile.id === user?.uid)
  );

  const groupedPermissionOtherEvents = permissionOtherEvents.reduce<Record<string, FirestoreEvent[]>>((groups, event) => {
    const ownerEmail = getEventOwnerEmail(event);
    if (!groups[ownerEmail]) groups[ownerEmail] = [];
    groups[ownerEmail].push(event);
    return groups;
  }, {});

  const renderGuestLog = (log: GuestLog, event: FirestoreEvent) => {
    const isEmailMethod = !!log.phone?.includes('@');
    const matchingUser = allUsers.find((profile) =>
      (log.email && profile.email === log.email) ||
      (isEmailMethod && profile.email === log.phone) ||
      (!isEmailMethod && profile.phone === log.phone)
    );
    const eventOwnerId = event.createdBy || user?.uid;
    const delegateOwners = [user?.uid, eventOwnerId].filter(Boolean);
    const isPrimaryAdmin = matchingUser?.roleType === 'primary' && !!matchingUser?.delegatedBy && delegateOwners.includes(matchingUser.delegatedBy);
    const isEventAdmin = matchingUser?.roleType === 'event' &&
      !!matchingUser?.delegatedBy &&
      delegateOwners.includes(matchingUser.delegatedBy) &&
      !!matchingUser?.assignedEvents?.some((eventId) => eventId === event.id || eventId === event.legacyId);
    const isAdmin = isPrimaryAdmin || isEventAdmin;
    const loginDate = log.loginAt?.seconds
      ? new Date(log.loginAt.seconds * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'Unknown';

    return (
      <View key={log.id} style={styles.permissionGuestCard}>
        <View style={styles.permissionGuestTop}>
          <View style={styles.guestAvatar}>
            <Text style={styles.guestAvatarText}>{(log.name || 'G').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.guestInfo}>
            <Text style={styles.guestName}>{log.name || 'Anonymous'}</Text>
            <Text style={styles.guestMeta} numberOfLines={1}>{log.phone || 'N/A'}</Text>
            <Text style={styles.guestPhone}>{isEmailMethod ? 'Email' : 'Mobile'} • {loginDate}</Text>
          </View>
          <View style={[styles.statusPill, styles[`status_${log.status}`] as any]}>
            <Text style={styles.statusText}>{log.status === 'approved' ? 'view access' : log.status}</Text>
          </View>
        </View>

        <View style={styles.permissionActionWrap}>
          {log.status === 'pending' && (
            <>
              <TouchableOpacity style={[styles.permissionAction, styles.approveBtn]} onPress={() => handleGuestStatus(log.id, 'approved')}>
                <Text style={styles.approveBtnText}>Approve View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.permissionAction, styles.rejectBtn]} onPress={() => handleGuestStatus(log.id, 'rejected')}>
                <Text style={styles.rejectBtnText}>Deny</Text>
              </TouchableOpacity>
            </>
          )}

          {matchingUser && (
            isAdmin ? (
              <>
                <View style={styles.adminLabel}>
                  <Text style={styles.adminLabelText}>{isPrimaryAdmin ? 'Primary Admin' : 'Event Admin'}</Text>
                </View>
                <TouchableOpacity style={[styles.permissionAction, styles.rejectBtn]} onPress={() => handleUpdateUserRole(matchingUser.id, 'revoke')}>
                  <Text style={styles.rejectBtnText}>Revoke</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.permissionAction, styles.darkAction]} onPress={() => handleUpdateUserRole(matchingUser.id, 'user', 'event', [event.id], eventOwnerId)}>
                  <Text style={styles.darkActionText}>Make Event Admin</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.permissionAction, styles.goldAction]} onPress={() => handleUpdateUserRole(matchingUser.id, 'user', 'primary', [], eventOwnerId)}>
                  <Text style={styles.goldActionText}>Make Primary Admin</Text>
                </TouchableOpacity>
              </>
            )
          )}

          <TouchableOpacity style={styles.iconAction} onPress={() => handleGuestDelete(log.id)}>
            <IconSymbol name="xmark" size={18} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPermissionEvent = (event: FirestoreEvent, showOwner = false) => {
    const expanded = expandedEvents.has(event.id);
    const adminsExpanded = expandedAdmins.has(event.id);
    const guestsExpanded = expandedGuests.has(event.id);
    const delegateOwners = [user?.uid, event.createdBy].filter(Boolean);
    const eventAdmins = allUsers.filter((profile) =>
      !!profile.delegatedBy &&
      delegateOwners.includes(profile.delegatedBy) &&
      profile.roleType === 'event' &&
      profile.assignedEvents?.some((eventId) => eventId === event.id || eventId === event.legacyId)
    );
    const eventLogs = guestLogs.filter((log) => log.parentEventId === event.id || log.eventId === event.id);
    const pendingCount = eventLogs.filter((log) => log.status === 'pending').length;

    return (
      <View key={event.id} style={styles.permissionEventCard}>
        <TouchableOpacity style={styles.permissionEventHeader} onPress={() => toggleSet(setExpandedEvents, event.id)}>
          <IconSymbol name={expanded ? 'chevron.left' : 'chevron.right'} size={22} color="#64748b" />
          <View style={styles.eventIconBox}>
            <IconSymbol name="calendar" size={20} color="#64748b" />
          </View>
          <View style={{ flex: 1 }}>
            {showOwner && <Text style={styles.sharedByText}>Shared by {getEventOwnerEmail(event)}</Text>}
            <Text style={styles.permissionEventTitle}>{event.title}</Text>
            <Text style={styles.permissionEventMeta}>
              {eventAdmins.length} Admin{eventAdmins.length === 1 ? '' : 's'} • {eventLogs.length} Visit{eventLogs.length === 1 ? '' : 's'}{pendingCount > 0 ? ` • ${pendingCount} Pending` : ''}
            </Text>
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.permissionNested}>
            <TouchableOpacity style={styles.permissionSubHeader} onPress={() => toggleSet(setExpandedAdmins, event.id)}>
              <IconSymbol name={adminsExpanded ? 'chevron.left' : 'chevron.right'} size={18} color="#0d9488" />
              <Text style={styles.adminSectionTitle}>Event Admins ({eventAdmins.length})</Text>
            </TouchableOpacity>
            {adminsExpanded && (
              <View style={styles.permissionSubList}>
                {eventAdmins.length > 0 ? eventAdmins.map((admin) => (
                  <View key={admin.id} style={styles.adminRow}>
                    <View style={styles.adminMiniAvatar}>
                      <Text style={styles.adminMiniAvatarText}>{(admin.name || 'A').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adminName}>{admin.name || 'Unnamed'}</Text>
                      <Text style={styles.adminEmail}>{admin.email}</Text>
                    </View>
                    <TouchableOpacity style={styles.goldSmallBtn} onPress={() => handleUpdateUserRole(admin.id, 'user', 'primary', [], event.createdBy || user?.uid)}>
                      <Text style={styles.goldSmallBtnText}>Primary</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => handleUpdateUserRole(admin.id, 'revoke')}>
                      <IconSymbol name="xmark" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )) : <Text style={styles.emptyInlineText}>No admins assigned.</Text>}
              </View>
            )}

            <TouchableOpacity style={styles.permissionSubHeader} onPress={() => toggleSet(setExpandedGuests, event.id)}>
              <IconSymbol name={guestsExpanded ? 'chevron.left' : 'chevron.right'} size={18} color="#d97706" />
              <Text style={styles.guestSectionTitle}>Guest Users ({eventLogs.length})</Text>
            </TouchableOpacity>
            {guestsExpanded && (
              <View style={styles.permissionSubList}>
                {eventLogs.length > 0
                  ? [...eventLogs].sort((a, b) => (b.loginAt?.seconds || 0) - (a.loginAt?.seconds || 0)).map((log) => renderGuestLog(log, event))
                  : <Text style={styles.emptyInlineText}>No guests recorded.</Text>}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const openEventForManagement = async (event: FirestoreEvent) => {
    setActiveEventId(event.id);
    setActiveEventTitle(event.title);
    setLoadingSubEvents(true);
    try {
      const fetchedSubs = await getSubEvents(event.id, event.legacyId);
      setSubEvents(fetchedSubs);
    } catch (err) {
      console.error("Error fetching sub-events", err);
    } finally {
      setLoadingSubEvents(false);
    }
  };

  const renderManageEventCard = (event: FirestoreEvent, isShared = false) => (
    <TouchableOpacity
      key={event.id}
      style={styles.eventCard}
      activeOpacity={0.9}
      onPress={() => openEventForManagement(event)}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: event.coverImage }}
          style={styles.coverImage}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.overlay} />

        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{event.date}</Text>
          </View>
          <TouchableOpacity
            style={styles.menuIcon}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedMenuEventId(event.id);
            }}
          >
            <IconSymbol name="ellipsis" size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardContent}>
          {isShared && (
            <View style={styles.ownerPill}>
              <Text style={styles.ownerPillText} numberOfLines={1}>Owner: {getEventOwnerEmail(event)}</Text>
            </View>
          )}
          <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: activeTab === 'main' ? 'Dashboard' : activeTab === 'data' ? 'Manage Gallery' : 'Permissions',
        headerBackTitle: '',
        headerBackVisible: false,
        headerStyle: { backgroundColor: '#f8fafc' },
        headerShadowVisible: false,
        headerLeft: activeTab !== 'main' ? () => (
          <TouchableOpacity 
            onPress={() => {
              if (activeTab === 'data' && activeEventId) {
                setActiveEventId(null);
              } else {
                setActiveTab('main');
              }
            }}
            style={styles.nativeBackButton}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <IconSymbol name="chevron.left" size={28} color="#0f172a" />
          </TouchableOpacity>
        ) : undefined,
      }} />
      
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {activeTab === 'main' ? `Welcome back, ${user?.name?.split(' ')[0]}!` : 
             activeTab === 'data' && activeEventId ? activeEventTitle :
             activeTab === 'data' ? 'Manage Galleries' : 'Permissions'}
          </Text>
          <Text style={styles.subtitle}>
            {activeTab === 'main' ? 'Everything you need to manage your personal memories.' : 
             activeTab === 'data' && activeEventId ? 'Manage your sub-events and photos.' :
             activeTab === 'data' ? 'Create events and upload photos to your galleries.' :
             'Control who can access and view your private galleries.'}
          </Text>
        </View>

        {activeTab === 'main' ? (
          <View style={styles.content}>
            {/* View Gallery Option */}
            <TouchableOpacity 
              style={[styles.optionCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/gallery')}
            >
              <View style={[styles.iconBox, { backgroundColor: '#dbeafe' }]}>
                <IconSymbol name="photo.fill" size={24} color="#2563eb" />
              </View>
              <Text style={[styles.optionTitle, { color: '#2563eb' }]}>View Gallery</Text>
              <Text style={styles.optionDesc}>Browse through your captured memories and event albums.</Text>
            </TouchableOpacity>

            {/* Manage Gallery Option */}
            <TouchableOpacity 
              style={[styles.optionCard, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}
              activeOpacity={0.8}
              onPress={() => setActiveTab('data')}
            >
              <View style={[styles.iconBox, { backgroundColor: '#f3e8ff' }]}>
                <IconSymbol name="camera.fill" size={24} color="#9333ea" />
              </View>
              <Text style={[styles.optionTitle, { color: '#9333ea' }]}>Manage Gallery</Text>
              <Text style={styles.optionDesc}>Create events and upload photos to your galleries.</Text>
            </TouchableOpacity>

            {/* Permissions Option */}
            <TouchableOpacity 
              style={[styles.optionCard, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
              activeOpacity={0.8}
              onPress={() => setActiveTab('permissions')}
            >
              <View style={[styles.iconBox, { backgroundColor: '#d1fae5' }]}>
                <IconSymbol name="checkmark" size={24} color="#059669" />
              </View>
              <Text style={[styles.optionTitle, { color: '#059669' }]}>Permissions</Text>
              <Text style={styles.optionDesc}>Control who can access and view your private galleries.</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'data' ? (
          <View style={styles.content}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{activeEventId ? 'Sub-Events' : 'Your Events'}</Text>
              <TouchableOpacity style={styles.addButton} onPress={handleCreateNew}>
                <IconSymbol name="photo" size={14} color="#ffffff" />
                <Text style={styles.addButtonText}>Create New</Text>
              </TouchableOpacity>
            </View>

            {!activeEventId ? (
              loading ? (
                <ActivityIndicator color="#0284c7" style={{ marginTop: 40 }} />
              ) : events.length > 0 ? (
                <View style={styles.manageSections}>
                  {createdEvents.length > 0 && (
                    <View>
                      <View style={styles.manageSectionHeader}>
                        <Text style={styles.manageSectionTitle}>Events Created by You</Text>
                        <Text style={styles.manageSectionCount}>{createdEvents.length} {createdEvents.length === 1 ? 'event' : 'events'}</Text>
                      </View>
                      <View style={styles.grid}>
                        {createdEvents.map((event) => renderManageEventCard(event))}
                      </View>
                    </View>
                  )}

                  {sharedEvents.length > 0 && (
                    <View>
                      <View style={styles.manageSectionHeader}>
                        <Text style={styles.manageSectionTitle}>Shared Events</Text>
                        <Text style={styles.manageSectionCount}>{sharedEvents.length} {sharedEvents.length === 1 ? 'event' : 'events'}</Text>
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
                            <View style={styles.grid}>
                              {ownerEvents.map((event) => renderManageEventCard(event, true))}
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconBox}>
                  <IconSymbol name="photo.on.rectangle" size={32} color="#94a3b8" />
                </View>
                <Text style={styles.emptyTitle}>No events yet</Text>
                <Text style={styles.emptyDesc}>Create your first event to start uploading and sharing memories.</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={handleCreateNew}>
                  <Text style={styles.emptyButtonText}>Create Event</Text>
                </TouchableOpacity>
              </View>
            )
            ) : (
              loadingSubEvents ? (
                <ActivityIndicator color="#0284c7" style={{ marginTop: 40 }} />
              ) : subEvents.length > 0 ? (
                <View style={styles.grid}>
                  {subEvents.map((subEvent) => (
                    <TouchableOpacity 
                      key={subEvent.id} 
                      style={styles.eventCard}
                      activeOpacity={0.9}
                      onPress={() => router.push(`/events/sub/edit/${subEvent.id}` as any)}
                    >
                      <View style={styles.imageContainer}>
                        <Image 
                          source={{ uri: subEvent.coverImage }} 
                          style={styles.coverImage}
                          contentFit="cover"
                          transition={200}
                        />
                        <View style={styles.overlay} />
                        
                        <View style={styles.cardHeader}>
                          <View style={styles.dateBadge}>
                            <Text style={styles.dateText}>{subEvent.date}</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.menuIcon} 
                            onPress={(e) => {
                              // Prevent trigger card onPress
                              e.stopPropagation();
                              setSelectedMenuEventId(subEvent.id);
                            }}
                          >
                            <IconSymbol name="ellipsis" size={20} color="#0f172a" />
                          </TouchableOpacity>
                        </View>
                        
                        <View style={styles.cardContent}>
                          <Text style={styles.eventTitle} numberOfLines={1}>{subEvent.title}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconBox}>
                    <IconSymbol name="photo.on.rectangle" size={32} color="#94a3b8" />
                  </View>
                  <Text style={styles.emptyTitle}>No sub-events yet</Text>
                  <Text style={styles.emptyDesc}>Create sub-events like Haldi or Wedding to organize your photos.</Text>
                  <TouchableOpacity style={styles.emptyButton} onPress={handleCreateNew}>
                    <Text style={styles.emptyButtonText}>Create Sub-Event</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.permissionsHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Permissions & Traffic</Text>
                <Text style={styles.permissionsSubtitle}>Manage team members and guest access.</Text>
              </View>
              <TouchableOpacity style={styles.refreshButton} onPress={fetchPermissionData}>
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {loadingGuests || loadingUsers || loading ? (
              <ActivityIndicator color="#0284c7" style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.permissionStack}>
                <View style={styles.permissionPanel}>
                  <View style={styles.permissionPanelHeader}>
                    <View>
                      <Text style={styles.permissionPanelTitle}>Premium Users (Primary)</Text>
                      <Text style={styles.permissionPanelSub}>Full account management access</Text>
                    </View>
                    <View style={styles.permissionPanelIcon}>
                      <IconSymbol name="shield.fill" size={22} color="#64748b" />
                    </View>
                  </View>

                  {primaryManagers.length > 0 ? (
                    <View style={styles.primaryManagerList}>
                      {primaryManagers.map((manager) => (
                        <View key={manager.id} style={styles.primaryManagerCard}>
                          <View style={styles.primaryAvatar}>
                            <Text style={styles.primaryAvatarText}>{(manager.name || 'U').charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.primaryName}>{manager.name || 'Unnamed'} {manager.id === user?.uid ? '(You)' : ''}</Text>
                            <Text style={styles.primaryEmail}>{manager.email}</Text>
                          </View>
                          {manager.id !== user?.uid && (
                            <TouchableOpacity style={styles.revokeChip} onPress={() => handleUpdateUserRole(manager.id, 'revoke')}>
                              <Text style={styles.revokeChipText}>Revoke</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyInlineText}>No premium users assigned yet.</Text>
                  )}
                </View>

                <View style={styles.permissionPanel}>
                  <View style={styles.permissionPanelHeader}>
                    <View>
                      <Text style={styles.permissionPanelTitle}>Event Administrators & Guests</Text>
                      <Text style={styles.permissionPanelSub}>Management per event</Text>
                    </View>
                    <View style={styles.permissionPanelIcon}>
                      <IconSymbol name="calendar" size={22} color="#64748b" />
                    </View>
                  </View>

                  {permissionMainEvents.length > 0 ? (
                    <View style={styles.permissionEventSections}>
                      {permissionCreatedEvents.length > 0 && (
                        <View>
                          <View style={styles.manageSectionHeader}>
                            <Text style={styles.manageSectionTitle}>Events Created by You</Text>
                            <Text style={styles.manageSectionCount}>{permissionCreatedEvents.length} {permissionCreatedEvents.length === 1 ? 'event' : 'events'}</Text>
                          </View>
                          {permissionCreatedEvents.map((event) => renderPermissionEvent(event))}
                        </View>
                      )}

                      {permissionOtherEvents.length > 0 && (
                        <View>
                          <View style={styles.manageSectionHeader}>
                            <Text style={styles.manageSectionTitle}>Events Created by Others</Text>
                            <Text style={styles.manageSectionCount}>{permissionOtherEvents.length} {permissionOtherEvents.length === 1 ? 'event' : 'events'}</Text>
                          </View>
                          <View style={styles.ownerGroupStack}>
                            {Object.entries(groupedPermissionOtherEvents).map(([ownerEmail, ownerEvents]) => (
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
                                {ownerEvents.map((event) => renderPermissionEvent(event, true))}
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <IconSymbol name="calendar" size={42} color="#e2e8f0" />
                      <Text style={styles.emptyTitle}>No events yet</Text>
                      <Text style={styles.emptyDesc}>Events and guest traffic will appear here.</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
        
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Bottom Sheet Modal for Event Options */}
      <Modal
        visible={selectedMenuEventId !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedMenuEventId(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setSelectedMenuEventId(null)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Event Options</Text>
                <TouchableOpacity onPress={() => setSelectedMenuEventId(null)} style={styles.modalClose}>
                  <IconSymbol name="xmark" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView>
                <TouchableOpacity style={styles.modalOption} onPress={() => handleRename(selectedMenuEventId!)}>
                  <View style={[styles.modalIconBox, { backgroundColor: '#f8fafc' }]}>
                    <IconSymbol name="line.3.horizontal" size={18} color="#64748b" />
                  </View>
                  <Text style={styles.modalOptionText}>Rename</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalOption} onPress={() => handleEditPhotos(selectedMenuEventId!)}>
                  <View style={[styles.modalIconBox, { backgroundColor: '#f0f9ff' }]}>
                    <IconSymbol name="photo.fill" size={18} color="#0284c7" />
                  </View>
                  <Text style={[styles.modalOptionText, { color: '#0284c7' }]}>Edit Photos</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalOption} onPress={() => handleChangeTemplate(selectedMenuEventId!)}>
                  <View style={[styles.modalIconBox, { backgroundColor: '#fdf4ff' }]}>
                    <IconSymbol name="star.fill" size={18} color="#c026d3" />
                  </View>
                  <Text style={styles.modalOptionText}>Change Template</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalOption} onPress={() => handleVisitWebsite(selectedMenuEventId!)}>
                  <View style={[styles.modalIconBox, { backgroundColor: '#eff6ff' }]}>
                    <IconSymbol name="house.fill" size={18} color="#2563eb" />
                  </View>
                  <Text style={styles.modalOptionText}>Visit Website</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalOption} onPress={() => handleShare(selectedMenuEventId!)}>
                  <View style={[styles.modalIconBox, { backgroundColor: '#ecfdf5' }]}>
                    <IconSymbol name="paperplane.fill" size={18} color="#059669" />
                  </View>
                  <Text style={styles.modalOptionText}>Share Link</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalOption, styles.modalOptionLast]} onPress={() => handleDelete(selectedMenuEventId!)}>
                  <View style={[styles.modalIconBox, { backgroundColor: '#fef2f2' }]}>
                    <IconSymbol name="xmark" size={18} color="#dc2626" />
                  </View>
                  <Text style={[styles.modalOptionText, { color: '#dc2626' }]}>Delete</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.createModalOverlay}>
          <TouchableOpacity style={styles.createModalBackdrop} activeOpacity={1} onPress={() => setCreateModalVisible(false)} />
          <View style={styles.createModalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{activeEventId ? 'Create Sub-Gallery' : 'Create Event'}</Text>
                <Text style={styles.modalSubtitle}>{activeEventId ? 'Add a Haldi, Mehendi, Ceremony, or Reception gallery.' : 'Start a new main wedding album.'}</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.modalClose}>
                <IconSymbol name="xmark" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.formInput}
              value={newEventTitle}
              onChangeText={setNewEventTitle}
              placeholder={activeEventId ? "Haldi Night" : "Samarth & Jyoti Wedding"}
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              style={styles.formInput}
              value={newEventDate}
              onChangeText={setNewEventDate}
              placeholder="Date or label"
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              style={[styles.formInput, styles.formTextarea]}
              value={newEventDescription}
              onChangeText={setNewEventDescription}
              placeholder="Short description"
              placeholderTextColor="#94a3b8"
              multiline
            />
            <TextInput
              style={styles.formInput}
              value={newEventCover}
              onChangeText={setNewEventCover}
              placeholder="Cover image URL optional"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />

            <TouchableOpacity style={[styles.createSubmitBtn, creating && styles.createSubmitDisabled]} onPress={handleCreateSubmit} disabled={creating}>
              {creating ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.createSubmitText}>Create Gallery</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  nativeBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: 8,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
  content: {
    paddingHorizontal: 16,
  },
  optionCard: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  optionDesc: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#e0f2fe',
  },
  refreshButtonText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    gap: 24,
  },
  manageSections: {
    gap: 34,
  },
  manageSectionHeader: {
    marginBottom: 14,
  },
  manageSectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  manageSectionCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    justifyContent: 'space-between',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    zIndex: 10,
  },
  dateBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dateText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  menuIcon: {
    backgroundColor: '#ffffff',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    padding: 16,
    zIndex: 10,
  },
  ownerPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 8,
  },
  ownerPillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ownerGroupStack: {
    gap: 24,
  },
  ownerGroup: {
    gap: 14,
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 16,
    fontWeight: '900',
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
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSubtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    maxWidth: 260,
    lineHeight: 18,
  },
  modalClose: {
    padding: 4,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionLast: {
    borderBottomWidth: 0,
  },
  modalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginTop: 20,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  guestList: {
    gap: 14,
  },
  guestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  guestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  guestAvatarText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  guestInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '800',
  },
  guestMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  guestPhone: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  status_pending: {
    backgroundColor: '#fef3c7',
  },
  status_approved: {
    backgroundColor: '#dcfce7',
  },
  status_rejected: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#334155',
    textTransform: 'uppercase',
  },
  guestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  guestActionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  permissionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  permissionsSubtitle: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  permissionStack: {
    gap: 22,
  },
  permissionPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  permissionPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  permissionPanelTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  permissionPanelSub: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  permissionPanelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryManagerList: {
    gap: 12,
  },
  primaryManagerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  primaryAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAvatarText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 15,
  },
  primaryName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  primaryEmail: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  revokeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  revokeChipText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  permissionEventSections: {
    gap: 24,
  },
  permissionEventCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  permissionEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    gap: 10,
  },
  eventIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sharedByText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  permissionEventTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  permissionEventMeta: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
  },
  permissionNested: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  permissionSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  adminSectionTitle: {
    color: '#0d9488',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  guestSectionTitle: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  permissionSubList: {
    gap: 10,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  adminMiniAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminMiniAvatarText: {
    color: '#0d9488',
    fontWeight: '900',
  },
  adminName: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 13,
  },
  adminEmail: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  goldSmallBtn: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  goldSmallBtnText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emptyInlineText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  permissionGuestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  permissionGuestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionActionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  permissionAction: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  darkAction: {
    backgroundColor: '#0f172a',
  },
  darkActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  goldAction: {
    backgroundColor: '#fffbeb',
  },
  goldActionText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  adminLabel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  adminLabelText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {
    backgroundColor: '#ecfdf5',
  },
  approveBtnText: {
    color: '#059669',
    fontWeight: '900',
  },
  rejectBtn: {
    backgroundColor: '#fef2f2',
  },
  rejectBtnText: {
    color: '#dc2626',
    fontWeight: '900',
  },
  removeBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  createModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  createModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  createModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 12,
  },
  formTextarea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  createSubmitBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  createSubmitDisabled: {
    opacity: 0.7,
  },
  createSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
