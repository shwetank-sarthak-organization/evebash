import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getEventById, getSubEvents, logGuestLogin, onGuestStatusChange, Event as FirestoreEvent } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

export default function EventDetailScreen() {
  const { id, shared } = useLocalSearchParams<{ id: string; shared?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isShared = shared === 'true';
  
  const [event, setEvent] = useState<FirestoreEvent | null>(null);
  const [subEvents, setSubEvents] = useState<FirestoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestStatus, setGuestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
  const [submittingGuest, setSubmittingGuest] = useState(false);
  const loggedInGuestIdentifier = user ? (user.email || user.phone || user.uid) : '';
  const isPrivilegedViewer = !!user && !!event && (
    user.role === 'admin' ||
    user.uid === event.createdBy ||
    (user.roleType === 'primary' && user.delegatedBy === event.createdBy) ||
    !!user.assignedEvents?.some((eventId) => eventId === event.id || eventId === event.legacyId)
  );

  useEffect(() => {
    if (!id) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const [eventData, subEventsData] = await Promise.all([
          getEventById(id),
          getSubEvents(id)
        ]);
        setEvent(eventData);
        setSubEvents(subEventsData);
      } catch (err) {
        console.error("Error fetching event details:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!isShared || isPrivilegedViewer || !id) return;
    const guestIdentifier = user ? loggedInGuestIdentifier : guestPhone.trim() ? guestPhone.replace(/\D/g, '') : '';
    if (!guestIdentifier) return;
    const logId = `${guestIdentifier}_${id}`;
    const unsubscribe = onGuestStatusChange(logId, (status) => {
      setGuestStatus(status as any);
    });
    return unsubscribe;
  }, [guestPhone, id, isPrivilegedViewer, isShared, loggedInGuestIdentifier, user]);

  useEffect(() => {
    if (!isShared || !user || !event || !id || isPrivilegedViewer || guestStatus !== 'idle' || !loggedInGuestIdentifier) return;

    let cancelled = false;
    const requestGuestAccess = async () => {
      setSubmittingGuest(true);
      const success = await logGuestLogin(
        user.name || 'Guest',
        loggedInGuestIdentifier,
        id,
        event.parentId || event.id,
        event.title,
        event.createdBy
      );
      if (!cancelled) {
        if (success) setGuestStatus('pending');
        setSubmittingGuest(false);
      }
    };

    requestGuestAccess();
    return () => {
      cancelled = true;
    };
  }, [event, guestStatus, id, isPrivilegedViewer, isShared, loggedInGuestIdentifier, user]);

  const accessGranted = !isShared || isPrivilegedViewer || guestStatus === 'approved';

  const submitGuestRequest = async () => {
    if (!event || !id || !guestName.trim() || !guestPhone.trim()) return;
    const normalizedPhone = guestPhone.replace(/\D/g, '');
    setSubmittingGuest(true);
    await logGuestLogin(
      guestName.trim(),
      normalizedPhone,
      id,
      event.parentId || event.id,
      event.title,
      event.createdBy
    );
    setGuestPhone(normalizedPhone);
    setGuestStatus('pending');
    setSubmittingGuest(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#b8860b" />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Event not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* Header Image */}
          <View style={styles.headerContainer}>
            <Image 
              source={{ uri: event.coverImage || 'https://via.placeholder.com/600x400?text=No+Cover' }} 
              style={styles.headerImage} 
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(15,23,42,1)']}
              style={styles.headerOverlay}
            />
            <TouchableOpacity 
              style={styles.headerBackButton} 
              onPress={() => router.back()}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <View style={styles.backIconContainer}>
                <IconSymbol name="chevron.left" size={24} color="#ffffff" />
              </View>
            </TouchableOpacity>
            
            <View style={styles.headerTextContainer}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDate}>{event.date}</Text>
              {event.description ? (
                <Text style={styles.eventDescription}>{event.description}</Text>
              ) : null}
            </View>
          </View>

          {/* Sub Galleries */}
          <View style={styles.contentContainer}>
            <Text style={styles.sectionTitle}>Sub Galleries</Text>
            
            {!accessGranted ? (
              <View style={styles.emptyContainer}>
                <IconSymbol name="shield.fill" size={48} color="#475569" />
                <Text style={styles.emptyText}>Access approval required.</Text>
              </View>
            ) : subEvents.length > 0 ? (
              <View style={styles.gridContainer}>
                {subEvents.map((subEvent) => (
                  <TouchableOpacity 
                    key={subEvent.id} 
                    style={styles.subEventCard}
                    activeOpacity={0.8}
                    onPress={() => router.push((isShared ? `/events/sub/${subEvent.id}?shared=true` : `/events/sub/${subEvent.id}`) as any)}
                  >
                    <Image 
                      source={{ uri: subEvent.coverImage || 'https://via.placeholder.com/300x300?text=No+Cover' }} 
                      style={styles.subEventImage} 
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.8)']}
                      style={styles.subEventOverlay}
                    >
                      <Text style={styles.subEventTitle}>{subEvent.title}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <IconSymbol name="folder" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No sub-galleries available.</Text>
              </View>
            )}
            
            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </View>
      <GuestAccessModal
        visible={!!event && isShared && !accessGranted && (!user || guestStatus !== 'idle')}
        guestStatus={guestStatus}
        guestName={guestName}
        guestPhone={guestPhone}
        submitting={submittingGuest}
        onNameChange={setGuestName}
        onPhoneChange={setGuestPhone}
        onSubmit={submitGuestRequest}
        onRetry={() => setGuestStatus('idle')}
      />
    </>
  );
}

function GuestAccessModal({
  visible,
  guestStatus,
  guestName,
  guestPhone,
  submitting,
  onNameChange,
  onPhoneChange,
  onSubmit,
  onRetry,
}: {
  visible: boolean;
  guestStatus: 'idle' | 'pending' | 'approved' | 'rejected';
  guestName: string;
  guestPhone: string;
  submitting: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.guestModalOverlay}>
        <View style={styles.guestModal}>
          <View style={styles.guestModalIcon}>
            <IconSymbol name={guestStatus === 'pending' ? 'clock.fill' : 'shield.fill'} size={30} color="#d4af37" />
          </View>
          {guestStatus === 'pending' ? (
            <>
              <Text style={styles.guestModalTitle}>Waiting for approval</Text>
              <Text style={styles.guestModalText}>Your request has been sent to the event admin. This screen will unlock after approval.</Text>
            </>
          ) : guestStatus === 'rejected' ? (
            <>
              <Text style={styles.guestModalTitle}>Access restricted</Text>
              <Text style={styles.guestModalText}>The admin declined this request. You can try again with different details.</Text>
              <TouchableOpacity style={styles.guestSubmitBtn} onPress={onRetry}>
                <Text style={styles.guestSubmitText}>Try Again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.guestModalTitle}>Request gallery access</Text>
              <Text style={styles.guestModalText}>Enter your details so the host can approve this shared gallery.</Text>
              <TextInput style={styles.guestInput} value={guestName} onChangeText={onNameChange} placeholder="Your name" placeholderTextColor="#94a3b8" />
              <TextInput style={styles.guestInput} value={guestPhone} onChangeText={onPhoneChange} placeholder="Phone number" placeholderTextColor="#94a3b8" keyboardType="phone-pad" />
              <TouchableOpacity style={[styles.guestSubmitBtn, submitting && { opacity: 0.7 }]} onPress={onSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.guestSubmitText}>Send Request</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  headerContainer: {
    width: '100%',
    height: width * 1.2,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  headerBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  backIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerTextContainer: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  eventTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  eventDate: {
    fontSize: 16,
    color: '#d4af37',
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eventDescription: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
  },
  contentContainer: {
    padding: 24,
    backgroundColor: '#0f172a',
    minHeight: Dimensions.get('window').height * 0.5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  subEventCard: {
    width: '48%',
    aspectRatio: 0.8,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#1e293b',
  },
  subEventImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  subEventOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 32,
  },
  subEventTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#1e293b',
    borderRadius: 20,
  },
  emptyText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
  guestModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  guestModal: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
  },
  guestModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  guestModalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  guestModalText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
  },
  guestInput: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#0f172a',
    marginBottom: 12,
  },
  guestSubmitBtn: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  guestSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
