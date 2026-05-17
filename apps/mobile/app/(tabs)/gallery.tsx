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
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Share,
  Linking,
  useColorScheme,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import { MidnightColors, Fonts } from '../../constants/theme';
import { MOBILE_TEMPLATE_THEMES } from '../../constants/templates';
import { 
  Event as FirestoreEvent, 
  getUserEvents,
  getApprovedSharedEventsForUser,
  getUserTotalStorage,
  getGuestLogs,
  updateGuestStatus,
  GuestLog,
  createEvent,
  getEventByJoinId,
  logGuestLogin,
  updateEvent,
  deleteEvent
} from '@/lib/firestore';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width } = Dimensions.get('window');

const PLACEHOLDER_IMAGES = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1465495910483-34a170a7bb00?q=80&w=1200&auto=format&fit=crop"
];


function createSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export default function PortfolioTabScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [activeTab, setActiveTab] = useState<'my' | 'shared' | 'requests'>('my');
  const [events, setEvents] = useState<FirestoreEvent[]>([]);
  const [sharedEvents, setSharedEvents] = useState<FirestoreEvent[]>([]);
  const [guestLogs, setGuestLogs] = useState<GuestLog[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  // Creation State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [targetEvent, setTargetEvent] = useState<FirestoreEvent | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  // Welcome Settings State
  const [welcomeEditVisible, setWelcomeEditVisible] = useState(false);
  const [welcomeText, setWelcomeText] = useState('');
  const [showWelcomeCard, setShowWelcomeCard] = useState(true);

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
    // Check if it's a WedAlbum URL
    if (data.includes('wedalbum.app/events/')) {
      const parts = data.split('/');
      const eventId = parts[parts.length - 1];
      if (eventId) {
        setShowJoinModal(false);
        setIsScanning(false);
        router.push(`/events/${eventId}`);
      }
    } else {
      // Maybe it's just the Join ID
      handleJoinEvent(data);
    }
  };

  const fetchData = async () => {
    if (!user) {
      setEvents([]);
      setSharedEvents([]);
      setGuestLogs([]);
      setStorageUsed(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const identifiers = [user.uid];
      if (user.email) identifiers.push(user.email);
      if (user.phone) identifiers.push(user.phone);

      const [myEvts, shEvts, storage] = await Promise.all([
        getUserEvents(identifiers, 'main'),
        getApprovedSharedEventsForUser(identifiers, true),
        getUserTotalStorage(identifiers)
      ]);

      setEvents(myEvts);
      setSharedEvents(shEvts);
      setStorageUsed(storage);

      if (activeTab === 'requests') {
        const logs = await getGuestLogs(user.uid);
        setGuestLogs(logs);
      }
    } catch (error) {
      console.error('[Portfolio] Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateSubmit = async () => {
    if (!user) return;
    const title = newEventTitle.trim();
    if (!title) return Alert.alert("Missing Title", "Please enter an event name.");

    const baseSlug = createSlug(title);
    const id = `${baseSlug}-${Math.random().toString(36).slice(-5)}`;
    const coverImage = PLACEHOLDER_IMAGES[Math.floor(Math.random() * PLACEHOLDER_IMAGES.length)];

    setCreating(true);
    try {
      const success = await createEvent({
        id,
        title,
        date: newEventDate.trim() || new Date().toLocaleDateString(),
        description: `Memories from ${title}`,
        coverImage,
        createdBy: user.uid,
        type: 'main',
        templateId: 'hero',
        category: 'Wedding'
      });

      if (success) {
        setCreateModalVisible(false);
        setNewEventTitle('');
        setNewEventDate('');
        fetchData();
        Alert.alert("Success", "Your event has been created! ✨");
      }
    } catch (err) {
      console.error('[CreateEvent] Error:', err);
      Alert.alert("Error", "Failed to create event.");
    } finally {
      setCreating(false);
    }
  };

  const handleVisitWebsite = (event: FirestoreEvent) => {
    const url = `https://wedalbum.app/events/${event.id}`;
    Linking.openURL(url).catch(err => console.error('Could not open URL', err));
  };

  const handleShareLink = async (event: FirestoreEvent) => {
    try {
      const url = `https://wedalbum.app/events/${event.id}`;
      await Share.share({
        message: `Check out the ${event.title} gallery: ${url}`,
        url: url,
      });
    } catch (error) {
      console.error('Sharing error:', error);
    }
  };

  const handleDeleteEvent = async (event: FirestoreEvent) => {
    Alert.alert(
      "Delete Event",
      `Are you sure you want to delete "${event.title}"? This will permanently remove all photos and sub-events.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            setLoading(true);
            const success = await deleteEvent(event.id);
            if (success) {
              fetchData();
              Alert.alert("Success", "Event deleted successfully.");
            } else {
              Alert.alert("Error", "Failed to delete event.");
            }
            setLoading(false);
          } 
        }
      ]
    );
  };

  const handleRenameSubmit = async () => {
    if (!targetEvent || !editTitle.trim()) return;
    setLoading(true);
    const success = await updateEvent(targetEvent.id, { title: editTitle.trim() });
    if (success) {
      setRenameVisible(false);
      setTargetEvent(null);
      fetchData();
      Alert.alert("Success", "Event renamed successfully.");
    } else {
      Alert.alert("Error", "Failed to rename event.");
    }
    setLoading(false);
  };

  const handleWelcomeEditSubmit = async () => {
    if (!targetEvent) return;
    setLoading(true);
    const success = await updateEvent(targetEvent.id, { 
      description: welcomeText.trim(), 
      showWelcomeCard: showWelcomeCard 
    });
    if (success) {
      setWelcomeEditVisible(false);
      setTargetEvent(null);
      fetchData();
      Alert.alert("Success", "Welcome card settings updated.");
    } else {
      Alert.alert("Error", "Failed to update settings.");
    }
    setLoading(false);
  };

  const handleTemplateSelect = async (templateId: string) => {
    if (!targetEvent) return;

    const updatedEvent = { ...targetEvent, templateId };
    setTargetEvent(updatedEvent);
    setEvents((prev) => prev.map((event) => event.id === targetEvent.id ? { ...event, templateId } : event));
    setSharedEvents((prev) => prev.map((event) => event.id === targetEvent.id ? { ...event, templateId } : event));

    try {
      const success = await updateEvent(targetEvent.id, { templateId });
      if (!success) {
        Alert.alert("Error", "Failed to update template.");
        fetchData();
        return;
      }
      setTemplateVisible(false);
      setOptionsVisible(false);
      Alert.alert("Success", "Template updated!");
    } catch (error) {
      console.error('[Portfolio] Template update error:', error);
      Alert.alert("Error", "Failed to update template.");
      fetchData();
    }
  };

  const renderEventCard = (event: FirestoreEvent) => (
    <View
      key={event.id}
      style={styles.eventCard}
    >
      <TouchableOpacity
        style={styles.cardOpenArea}
        activeOpacity={0.85}
        onPress={() => router.push(`/events/${event.id}?mode=admin`)}
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
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── HEADER ── */}
      <LinearGradient
        colors={['#0f172a', '#020617']}
        style={styles.header}
      >
        <View>
          <Text style={styles.headerName}>Host Event</Text>
          <Text style={styles.headerGreeting}>Management</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.createBtnHeader, { backgroundColor: MidnightColors.gold }]} onPress={() => setCreateModalVisible(true)}>
            <Text style={[styles.createBtnText, { color: MidnightColors.background }]}>Create</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MidnightColors.gold} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── USAGE STATS ── */}
        <View style={styles.storageSection}>
          {/* Storage Row */}
          <View style={styles.storageHeader}>
            <View>
              <Text style={styles.storageLabel}>Cloud Storage</Text>
              <Text style={styles.storageSub}>{(storageUsed / (1024 * 1024)).toFixed(1)} MB / 5 GB</Text>
            </View>
            <TouchableOpacity 
              style={styles.upgradeBtn}
              onPress={() => router.push('/pricing' as any)}
            >
              <Text style={styles.upgradeText}>Upgrade</Text>
              <IconSymbol name={"arrow.up.right" as any} size={10} color={MidnightColors.gold} />
            </TouchableOpacity>
          </View>
          <View style={styles.storageBarContainer}>
            <View style={[styles.storageBar, { width: `${Math.min((storageUsed / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }]} />
          </View>

          <View style={{ height: 16 }} />

          {/* Events Row */}
          <View style={styles.storageHeader}>
            <View>
              <Text style={styles.storageLabel}>Event Limit</Text>
              <Text style={styles.storageSub}>
                {events.length} / {user?.role === 'premium' || user?.role === 'elite' ? '∞' : (user?.role === 'standard' ? '20' : (user?.role === 'basic' ? '5' : '2'))} Events
              </Text>
            </View>
          </View>
          <View style={styles.storageBarContainer}>
            <View 
              style={[
                styles.storageBar, 
                { 
                  width: `${Math.min((events.length / (user?.role === 'standard' ? 20 : (user?.role === 'basic' ? 5 : (user?.role === 'premium' || user?.role === 'elite' ? events.length || 1 : 2)))) * 100, 100)}%`,
                  backgroundColor: '#818cf8' 
                }
              ]} 
            />
          </View>
        </View>

        {/* ── TABS (Segmented Control Style) ── */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'my' && styles.tabButtonActive]}
            onPress={() => setActiveTab('my')}
          >
            <IconSymbol 
              name="camera.fill" 
              size={14} 
              color={activeTab === 'my' ? MidnightColors.gold : MidnightColors.slate400} 
            />
            <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>Host</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'shared' && styles.tabButtonActive]}
            onPress={() => setActiveTab('shared')}
          >
            <IconSymbol 
              name="person.2.fill" 
              size={14} 
              color={activeTab === 'shared' ? MidnightColors.gold : MidnightColors.slate400} 
            />
            <Text style={[styles.tabText, activeTab === 'shared' && styles.tabTextActive]}>Shared</Text>
          </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'requests' && styles.tabButtonActive]}
              onPress={() => setActiveTab('requests')}
            >
              <IconSymbol 
                name="envelope.fill" 
                size={14} 
                color={activeTab === 'requests' ? MidnightColors.gold : MidnightColors.slate400} 
              />
              <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>Requests</Text>
              
              {guestLogs.filter(l => l.status === 'pending').length > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {guestLogs.filter(l => l.status === 'pending').length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator color={MidnightColors.gold} style={{ marginTop: 60 }} />
        ) : (
          <View style={styles.grid}>
            {activeTab === 'my' && (
              events.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="photo.on.rectangle" size={40} color={MidnightColors.slate700} />
                  <Text style={styles.emptyTitle}>No events yet</Text>
                  <Text style={styles.emptyBody}>Create your first album to see it here.</Text>
                </View>
              ) : (
                events.map(renderEventCard)
              )
            )}

            {activeTab === 'shared' && (
              sharedEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="person.2.fill" size={40} color={MidnightColors.slate700} />
                  <Text style={styles.emptyTitle}>Nothing shared</Text>
                  <Text style={styles.emptyBody}>Events shared with you will appear here.</Text>
                </View>
              ) : (
                sharedEvents.map(renderEventCard)
              )
            )}

            {activeTab === 'requests' && (
              guestLogs.filter(l => l.status === 'pending').length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name={"checkmark.circle.fill" as any} size={40} color="rgba(16, 185, 129, 0.2)" />
                  <Text style={styles.emptyTitle}>All caught up!</Text>
                  <Text style={styles.emptyBody}>New access requests will appear here.</Text>
                </View>
              ) : (
                <View style={{ width: '100%', gap: 12 }}>
                  {guestLogs.filter(l => l.status === 'pending').map(log => (
                    <TouchableOpacity 
                      key={log.id} 
                      style={styles.requestCard}
                      onPress={() => setSelectedRequest(log)}
                    >
                      <View style={styles.requestAvatar}>
                        <Text style={styles.avatarTextSmall}>{log.name.charAt(0)}</Text>
                      </View>
                      
                      <View style={styles.requestInfo}>
                        <Text style={styles.requestName}>{log.name}</Text>
                        <View style={styles.requestEventRow}>
                          <Text style={styles.requestEventTitle} numberOfLines={1}>{log.eventTitle || 'Untitled Event'}</Text>
                        </View>
                      </View>

                      <View style={styles.requestActionsMini}>
                        <TouchableOpacity 
                          style={styles.miniActionBtnRed}
                          onPress={() => updateGuestStatus(log.id, 'rejected').then(fetchData)}
                        >
                          <IconSymbol name="xmark" size={12} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.miniActionBtnGreen}
                          onPress={() => updateGuestStatus(log.id, 'approved').then(fetchData)}
                        >
                          <IconSymbol name="checkmark" size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}

          {/* ── REQUEST DETAIL MODAL ── */}
          <Modal visible={!!selectedRequest} transparent animationType="fade">
            <View style={styles.modalBackdrop}>
              <View style={styles.ironCladWrapper}>
                <LinearGradient 
                  colors={['#0f172a', '#020617']} 
                  style={styles.premiumRequestModal}
                >
                  <View style={styles.modalHeader}>
                    <View style={styles.largeAvatar}>
                      <LinearGradient colors={[MidnightColors.gold, '#b8860b']} style={styles.avatarGradient}>
                        <Text style={styles.largeAvatarText}>{selectedRequest?.name.charAt(0)}</Text>
                      </LinearGradient>
                    </View>
                    <Text style={styles.modalRequestTitle}>{selectedRequest?.name}</Text>
                    <Text style={styles.modalRequestSub}>Wants to join your event</Text>
                  </View>

                  <View style={styles.modalBody}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Event</Text>
                      <Text style={styles.detailValue}>{selectedRequest?.eventTitle}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Phone / ID</Text>
                      <Text style={styles.detailValue}>{selectedRequest?.phone}</Text>
                    </View>
                  </View>

                  <View style={styles.modalFooter}>
                    <TouchableOpacity 
                      style={[styles.modalActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                      onPress={() => {
                        if (selectedRequest) {
                          updateGuestStatus(selectedRequest.id, 'rejected').then(() => {
                            setSelectedRequest(null);
                            fetchData();
                          });
                        }
                      }}
                    >
                      <Text style={[styles.modalActionText, { color: '#ef4444' }]}>Reject</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.modalActionBtnApprove}
                      onPress={() => {
                        if (selectedRequest) {
                          updateGuestStatus(selectedRequest.id, 'approved').then(() => {
                            setSelectedRequest(null);
                            fetchData();
                          });
                        }
                      }}
                    >
                      <LinearGradient 
                        colors={['#10b981', '#059669']} 
                        style={styles.approveGradient}
                      >
                        <Text style={styles.modalActionTextWhite}>Approve Access</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    style={styles.modalCloseLink}
                    onPress={() => setSelectedRequest(null)}
                  >
                    <Text style={styles.modalCloseLinkText}>Close</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </Modal>
          </View>
        )}
      </ScrollView>

      {/* ── JOIN EVENT MODAL ── */}
      <Modal visible={showJoinModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => { setShowJoinModal(false); setIsScanning(false); }} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Join Event</Text>
              <TouchableOpacity onPress={() => { setShowJoinModal(false); setIsScanning(false); }}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>

            {isScanning ? (
              <View style={styles.scannerContainer}>
                {!permission?.granted ? (
                  <View style={styles.centered}>
                    <Text style={styles.permissionText}>Camera permission is required</Text>
                    <TouchableOpacity style={styles.upgradeBtn} onPress={requestPermission}>
                      <Text style={styles.upgradeText}>Grant Permission</Text>
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
                    style={[styles.input, { letterSpacing: 4, fontSize: 20, textAlign: 'center', fontFamily: Fonts.outfit.bold }]} 
                    value={joinCode} 
                    onChangeText={setJoinCode} 
                    placeholder="E.G. A1B2C3" 
                    placeholderTextColor={MidnightColors.slate700}
                    autoCapitalize="characters"
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.submitBtn, joining && { opacity: 0.7 }]} 
                  onPress={() => handleJoinEvent()}
                  disabled={joining}
                >
                  {joining ? (
                    <ActivityIndicator color={MidnightColors.background} />
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
                  <IconSymbol name={"qrcode.viewfinder" as any} size={20} color={MidnightColors.gold} />
                  <Text style={styles.scanBtnText}>Scan QR Code</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EVENT OPTIONS MODAL ── */}
      <Modal visible={optionsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => {
              if (templateVisible) return;
              setOptionsVisible(false);
            }} 
          />
          <View style={[styles.modalContent, { paddingBottom: Platform.OS === 'ios' ? 40 : 24 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{templateVisible ? 'Choose Template' : targetEvent?.title}</Text>
                <Text style={styles.headerGreeting}>{templateVisible ? '10 gallery themes' : 'Event Management'}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setTemplateVisible(false);
                setOptionsVisible(false);
              }}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>

            {templateVisible ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.templateModalContent}>
                {MOBILE_TEMPLATE_THEMES.map((template, index) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templateOptionCard,
                      { borderColor: (targetEvent?.templateId || 'hero') === template.id ? template.accent : 'rgba(255,255,255,0.08)' },
                    ]}
                    onPress={() => { handleTemplateSelect(template.id); setTemplateVisible(false); }}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.templatePreview, { backgroundColor: isDark ? template.background.dark : template.background.light }]}>
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />
                      <Text style={[styles.templatePreviewLabel, { color: template.accent }]}>Template {index + 1}</Text>
                      <Text style={[styles.templatePreviewTitle, { color: isDark ? template.text.dark : template.text.light }]}>{template.label}</Text>
                    </View>
                    <View style={styles.templateMeta}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.templateName}>{template.label}</Text>
                        <Text style={styles.templateDesc}>{template.desc}</Text>
                      </View>
                      {(targetEvent?.templateId || 'hero') === template.id && (
                        <View style={[styles.templateCheck, { backgroundColor: template.accent }]}>
                          <IconSymbol name="checkmark" size={14} color={template.background === '#000000' ? '#000000' : '#ffffff'} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.optionsList}>
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    setEditTitle(targetEvent?.title || '');
                    setRenameVisible(true);
                  }}
                >
                  <IconSymbol name="pencil" size={20} color={MidnightColors.gold} />
                  <Text style={styles.optionText}>Rename Event</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    router.push({ pathname: `/events/${targetEvent?.id}`, params: { tab: 'photos', mode: 'admin' } } as any);
                  }}
                >
                  <IconSymbol name="photo.fill" size={20} color={MidnightColors.gold} />
                  <Text style={styles.optionText}>Edit Photos</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => setTemplateVisible(true)}
                >
                  <IconSymbol name="paintbrush.fill" size={20} color={MidnightColors.gold} />
                  <Text style={styles.optionText}>Change Template</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    if (targetEvent) handleVisitWebsite(targetEvent);
                  }}
                >
                  <IconSymbol name="globe" size={20} color={MidnightColors.gold} />
                  <Text style={styles.optionText}>Visit Website</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    if (targetEvent) handleShareLink(targetEvent);
                  }}
                >
                  <IconSymbol name="square.and.arrow.up" size={20} color={MidnightColors.gold} />
                  <Text style={styles.optionText}>Share Link</Text>
                </TouchableOpacity>

                <View style={styles.modalDivider} />

                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => {
                    setOptionsVisible(false);
                    if (targetEvent) handleDeleteEvent(targetEvent);
                  }}
                >
                  <IconSymbol name="trash.fill" size={20} color="#ef4444" />
                  <Text style={[styles.optionText, { color: '#ef4444' }]}>Delete Event</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── RENAME MODAL ── */}
      <Modal visible={renameVisible} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setRenameVisible(false)} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rename Event</Text>
              <TouchableOpacity onPress={() => setRenameVisible(false)}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Event Name</Text>
                <TextInput 
                  style={styles.input} 
                  value={editTitle} 
                  onChangeText={setEditTitle} 
                  placeholder="Enter new name..." 
                  placeholderTextColor={MidnightColors.slate700}
                  autoFocus
                />
              </View>

              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={handleRenameSubmit}
              >
                <Text style={styles.submitBtnText}>Update Name</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CREATE EVENT MODAL ── */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setCreateModalVisible(false)} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Event</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Event Name</Text>
                <TextInput 
                  style={styles.input} 
                  value={newEventTitle} 
                  onChangeText={setNewEventTitle} 
                  placeholder="e.g. Wedding of John & Jane" 
                  placeholderTextColor={MidnightColors.slate700}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date</Text>
                <TextInput 
                  style={styles.input} 
                  value={newEventDate} 
                  onChangeText={setNewEventDate} 
                  placeholder="e.g. June 12, 2025" 
                  placeholderTextColor={MidnightColors.slate700}
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, creating && { opacity: 0.7 }]} 
                onPress={handleCreateSubmit}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={MidnightColors.background} />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Create Event</Text>
                    <IconSymbol name="sparkles" size={16} color={MidnightColors.background} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: MidnightColors.background },
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 40 },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: MidnightColors.border,
  },
  headerGreeting: { fontSize: 12, color: MidnightColors.slate400, fontFamily: Fonts.inter.medium, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerName: { fontSize: 32, color: MidnightColors.white, fontFamily: Fonts.outfit.extraBold, letterSpacing: -0.5, marginTop: 2 },
  createBtnHeader: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 14, 
    backgroundColor: 'rgba(212,175,55,0.1)', 
    borderWidth: 1, 
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  createBtnText: { 
    fontSize: 13, 
    color: MidnightColors.gold, 
    fontFamily: Fonts.outfit.bold, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },

  // Tabs
  tabContainer: { 
    flexDirection: 'row', 
    marginHorizontal: 20, 
    marginTop: 24, 
    padding: 6, 
    backgroundColor: MidnightColors.deepSlate, 
    borderRadius: 24,
    borderWidth: 1,
    borderColor: MidnightColors.cardBorder,
  },
  tabButton: { 
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12, 
    borderRadius: 20,
    position: 'relative',
    overflow: 'visible'
  },
  tabBadge: { position: 'absolute', top: 4, right: 8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: MidnightColors.background },
  tabBadgeText: { color: '#fff', fontSize: 9, fontFamily: Fonts.inter.bold },
  tabButtonActive: { 
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  tabText: { fontSize: 13, color: MidnightColors.slate400, fontFamily: Fonts.inter.medium },
  tabTextActive: { color: MidnightColors.gold, fontFamily: Fonts.inter.bold },

  // Grid
  grid: { paddingHorizontal: 20, paddingTop: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  eventCard: {
    width: (width - 54) / 2, height: 220,
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: MidnightColors.deepSlate,
    borderWidth: 1, borderColor: MidnightColors.cardBorder,
    marginBottom: 14,
  },
  cardOpenArea: { ...StyleSheet.absoluteFillObject },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  cardContent: { position: 'absolute', bottom: 14, left: 16, right: 16 },
  cardTitle: { fontSize: 16, color: '#fff', fontFamily: Fonts.outfit.bold, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: 10, color: MidnightColors.slate400, fontFamily: Fonts.inter.medium },
  cardAction: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 5, elevation: 5 },

  // Empty State
  emptyState: { width: '100%', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, color: '#fff', fontFamily: Fonts.outfit.bold, marginTop: 16 },
  emptyBody: { fontSize: 12, color: MidnightColors.slate400, fontFamily: Fonts.inter.regular, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },

  // Requests Tab Styles
  requestCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderRadius: 24, 
    padding: 12, 
    width: '100%',
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 16,
    marginBottom: 12
  },
  requestAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(212, 175, 55, 0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  avatarTextSmall: { color: MidnightColors.gold, fontSize: 20, fontFamily: Fonts.outfit.bold },
  requestInfo: { flex: 1, gap: 2 },
  requestName: { color: '#fff', fontSize: 16, fontFamily: Fonts.outfit.bold },
  requestEventRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestEventLabel: { color: MidnightColors.slate700, fontSize: 10, fontFamily: Fonts.inter.medium },
  requestEventTitle: { color: MidnightColors.gold, fontSize: 10, fontFamily: Fonts.inter.bold, flex: 1 },
  requestActionsMini: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  miniActionBtnGreen: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  miniActionBtnRed: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },

  // Request Modal Styles
  ironCladWrapper: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  premiumRequestModal: { width: width * 0.85, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', marginBottom: 16 },
  avatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  largeAvatarText: { color: MidnightColors.background, fontSize: 32, fontFamily: Fonts.outfit.extraBold },
  modalRequestTitle: { color: '#fff', fontSize: 22, fontFamily: Fonts.outfit.bold, textAlign: 'center' },
  modalRequestSub: { color: MidnightColors.slate400, fontSize: 12, fontFamily: Fonts.inter.medium, marginTop: 4 },
  modalBody: { gap: 16, marginBottom: 24, marginTop: 24 },
  detailRow: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 20 },
  detailLabel: { color: MidnightColors.slate700, fontSize: 10, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { color: '#fff', fontSize: 15, fontFamily: Fonts.inter.medium },
  modalFooter: { flexDirection: 'row', gap: 12 },
  modalActionBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalActionBtnApprove: { flex: 2, borderRadius: 16, overflow: 'hidden' },
  approveGradient: { flex: 1, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  modalActionText: { fontSize: 14, fontFamily: Fonts.outfit.bold },
  modalActionTextWhite: { color: '#fff', fontSize: 14, fontFamily: Fonts.outfit.bold },
  modalCloseLink: { marginTop: 20, alignSelf: 'center' },
  modalCloseLinkText: { color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.inter.medium },

  // Storage
  storageSection: { 
    marginHorizontal: 20, 
    marginTop: 20, 
    padding: 16, 
    backgroundColor: MidnightColors.deepSlate, 
    borderRadius: 24, 
    borderWidth: 1, 
    borderColor: MidnightColors.cardBorder 
  },
  storageHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  storageLabel: { fontSize: 14, color: '#fff', fontFamily: Fonts.outfit.bold },
  upgradeBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    backgroundColor: 'rgba(212, 175, 55, 0.1)', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  upgradeText: { fontSize: 11, color: MidnightColors.gold, fontFamily: Fonts.outfit.bold, textTransform: 'uppercase' },
  storageBarContainer: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  storageBar: { height: '100%', backgroundColor: MidnightColors.gold, borderRadius: 3 },
  storageSub: { fontSize: 11, color: MidnightColors.slate400, fontFamily: Fonts.inter.regular, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 23, 0.8)' },
  modalContent: { 
    backgroundColor: '#0f172a', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, color: '#fff', fontFamily: Fonts.outfit.extraBold },
  form: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, color: MidnightColors.gold, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { 
    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
    padding: 16, 
    borderRadius: 16, 
    color: '#fff', 
    fontFamily: Fonts.inter.regular,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  submitBtn: { 
    backgroundColor: MidnightColors.gold, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18, 
    borderRadius: 20, 
    marginTop: 10,
    shadowColor: MidnightColors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: { color: MidnightColors.background, fontFamily: Fonts.outfit.extraBold, fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },

  // Join Specific
  scannerContainer: { width: '100%', height: 350, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000', justifyContent: 'center' },
  scanner: { flex: 1 },
  scannerCloseBtn: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  scannerCloseText: { color: '#fff', fontFamily: Fonts.inter.bold, fontSize: 12 },
  permissionText: { color: '#fff', textAlign: 'center', marginBottom: 20, fontFamily: Fonts.inter.medium },
  modalDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: MidnightColors.slate700, fontSize: 12, fontFamily: Fonts.inter.bold },
  scanBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    paddingVertical: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: MidnightColors.gold, 
    backgroundColor: 'rgba(212,175,55,0.05)' 
  },
  scanBtnText: { color: MidnightColors.gold, fontSize: 16, fontFamily: Fonts.outfit.bold },
  
  // Options List
  optionsList: { gap: 4, marginTop: 8 },
  optionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16, 
    paddingVertical: 16, 
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  optionText: { fontSize: 16, color: '#fff', fontFamily: Fonts.inter.medium },
  templateModalContent: {
    maxHeight: '82%',
  },
  templateOptionCard: {
    borderWidth: 2,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  templatePreview: {
    height: 112,
    justifyContent: 'flex-end',
    padding: 16,
    overflow: 'hidden',
  },
  templatePreviewLabel: {
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  templatePreviewTitle: {
    fontSize: 22,
    fontFamily: Fonts.outfit.extraBold,
    marginTop: 4,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  templateName: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.outfit.bold,
  },
  templateDesc: {
    color: MidnightColors.slate400,
    fontSize: 12,
    fontFamily: Fonts.inter.medium,
    marginTop: 3,
  },
  templateCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
