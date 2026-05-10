import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Share } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getEventById, getSubEvents, logGuestLogin, onGuestStatusChange, Event as FirestoreEvent, updateEvent, createEvent, getGuestLogs, updateGuestStatus, updateGuestPermissions, deleteGuest } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import { MidnightColors, Fonts } from '../../constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { uploadEventImage } from '@/lib/storage';

const { width } = Dimensions.get('window');

export default function EventDetailScreen() {
  const { id, shared, guestView, tab, share, mode } = useLocalSearchParams<{ id: string; shared?: string; guestView?: string; tab?: string; share?: string; mode?: 'admin' | 'visitor' }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [event, setEvent] = useState<FirestoreEvent | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<GuestLog | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<GuestLog | null>(null);
  const [subEvents, setSubEvents] = useState<FirestoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestStatus, setGuestStatus] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState<'galleries' | 'photos' | 'permissions' | 'design'>((tab as any) || 'galleries');
  const [guestLogs, setGuestLogs] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  
  // Decide which view to show
  // We show Admin view ONLY if mode=admin AND user is owner.
  // Otherwise, we default to the premium Visitor view.
  const showAdminView = mode === 'admin' && isOwner;
  
  // Modals
  const [showSubEventModal, setShowSubEventModal] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(share === 'true');
  const [showApproved, setShowApproved] = useState(false);

  const [activeSubEvent, setActiveSubEvent] = useState<FirestoreEvent | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  const loadEvent = async () => {
    setLoading(true);
    try {
      const eventData = await getEventById(id);
      if (eventData) {
        // Ensure joinId exists
        if (!eventData.joinId) {
          const shortId = eventData.id.slice(0, 6).toUpperCase();
          await updateEvent(eventData.id, { joinId: shortId });
          eventData.joinId = shortId;
        }
        
        setEvent(eventData);
        setIsOwner(user?.uid === eventData.createdBy);
        const subs = await getSubEvents(id, eventData.legacyId);
        setSubEvents(subs);
        
        // Auto-load photos for main event initially
        loadPhotos(eventData.id, eventData.legacyId);

        if (user?.uid === eventData.createdBy) {
          const logs = await getGuestLogs([user.uid]);
          setGuestLogs(logs.filter(l => l.eventId === id || l.parentEventId === id));
        }
      }
    } catch (err) {
      console.error('[EventDetail] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPhotos = async (eventId: string, legacyId?: string) => {
    setLoadingPhotos(true);
    try {
      const { getEventPhotos } = await import('@/lib/firestore');
      const eventPhotos = await getEventPhotos(eventId, legacyId);
      setPhotos(eventPhotos);
    } catch (err) {
      console.error('[EventDetail] Photos load error:', err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const handleSubEventChange = (sub: FirestoreEvent | null) => {
    setActiveSubEvent(sub);
    if (sub) {
      loadPhotos(sub.id, sub.legacyId);
    } else if (event) {
      loadPhotos(event.id, event.legacyId);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    const shareUrl = `https://wedalbum.app/events/${event.id}`;
    try {
      await Share.share({
        message: `Join our event "${event.title}" on WedAlbum!\nJoin ID: ${event.joinId}\nLink: ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error('Sharing failed', error);
    }
  };

  useEffect(() => {
    if (!id) return;
    loadEvent();
  }, [id, user]);

  const handleGuestAccess = async () => {
    if (!guestName || !guestPhone) return;
    const logId = `${guestPhone}_${id}`;
    setUpdating(true);
    try {
      await logGuestLogin(guestName, guestPhone, id, event?.parentId, event?.title, event?.createdBy, 'pending');
      onGuestStatusChange(logId, (status) => setGuestStatus(status));
    } catch (err) {
      Alert.alert("Error", "Failed to send request.");
    } finally {
      setUpdating(false);
    }
  };

  const handleChangeCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && event) {
      setUpdating(true);
      try {
        const file = { uri: result.assets[0].uri, name: 'cover.jpg', type: 'image/jpeg' } as any;
        const upload = await uploadEventImage(file, event.id, user?.uid || 'anon');
        await updateEvent(event.id, { coverImage: upload.url });
        loadEvent();
        Alert.alert("Success", "Cover image updated!");
      } catch (err) {
        Alert.alert("Error", "Failed to update cover.");
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleCreateSubEvent = async () => {
    if (!newSubTitle.trim() || !event) return;
    setUpdating(true);
    try {
      const subId = `${newSubTitle.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).slice(-4)}`;
      await createEvent({
        id: subId,
        title: newSubTitle,
        date: event.date,
        coverImage: event.coverImage,
        description: `Gallery for ${event.title}`,
        createdBy: user?.uid,
        type: 'sub',
        parentId: event.id,
        templateId: event.templateId || 'hero'
      });
      setNewSubTitle('');
      setShowSubEventModal(false);
      loadEvent();
    } catch (err) {
      Alert.alert("Error", "Failed to create gallery.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateTemplate = async (templateId: string) => {
    if (!event) return;
    setUpdating(true);
    try {
      await updateEvent(event.id, { templateId });
      setShowTemplateModal(false);
      loadEvent();
      Alert.alert("Success", "Theme updated!");
    } catch (err) {
      Alert.alert("Error", "Failed to update theme.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateCategory = async (category: string) => {
    if (!event) return;
    setUpdating(true);
    try {
      await updateEvent(event.id, { category });
      loadEvent();
      Alert.alert("Success", `Event type set to ${category}!`);
    } catch (err) {
      Alert.alert("Error", "Failed to update event type.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator color={MidnightColors.gold} size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.safeArea, styles.centered]}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── VISITOR NAVIGATION ──
  const renderVisitorHeader = () => {
    return (
      <View style={styles.visitorHeaderContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.visitorHeaderContent}
        >
          <TouchableOpacity 
            style={[styles.visitorTab, !activeSubEvent && styles.visitorTabActive]}
            onPress={() => handleSubEventChange(null)}
          >
            <IconSymbol name="house.fill" size={16} color={!activeSubEvent ? MidnightColors.background : MidnightColors.gold} />
            <Text style={[styles.visitorTabText, !activeSubEvent && styles.visitorTabTextActive]}>Home</Text>
          </TouchableOpacity>

          {subEvents.map((sub) => (
            <TouchableOpacity 
              key={sub.id}
              style={[styles.visitorTab, activeSubEvent?.id === sub.id && styles.visitorTabActive]}
              onPress={() => handleSubEventChange(sub)}
            >
              <Text style={[styles.visitorTabText, activeSubEvent?.id === sub.id && styles.visitorTabTextActive]}>
                {sub.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Immersive Top Nav for Guests */}
      {!showAdminView && renderVisitorHeader()}

      <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
        {/* ── HERO ── */}
        <View style={styles.hero}>
          <Image source={{ uri: activeSubEvent?.coverImage || event.coverImage }} style={styles.heroImage} />
          <LinearGradient
            colors={['rgba(2, 6, 23, 0.3)', 'rgba(2, 6, 23, 1)']}
            style={styles.heroGradient}
          />
          <TouchableOpacity style={styles.floatingBack} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={20} color={MidnightColors.gold} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.floatingShare} onPress={() => setShowShareModal(true)}>
            <IconSymbol name="square.and.arrow.up" size={18} color={MidnightColors.gold} />
          </TouchableOpacity>

          {showAdminView && (
            <TouchableOpacity style={styles.editCoverBtn} onPress={handleChangeCover} disabled={updating}>
              <IconSymbol name="camera.fill" size={16} color="#fff" />
              <Text style={styles.editCoverText}>{updating ? 'Updating...' : 'Change Cover'}</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{activeSubEvent?.title || event.title}</Text>
            <View style={styles.heroMeta}>
              <IconSymbol name="calendar" size={12} color={MidnightColors.gold} />
              <Text style={styles.heroDate}>{activeSubEvent?.date || event.date}</Text>
            </View>
          </View>
        </View>

        {/* ── CONTENT ── */}
        <View style={styles.content}>
          {showAdminView ? (
            <>
              {/* Owner Tabs */}
              <View style={styles.tabBar}>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'galleries' && styles.activeTab]} 
                  onPress={() => setActiveTab('galleries')}
                >
                  <Text style={[styles.tabText, activeTab === 'galleries' && styles.activeTabText]}>Galleries</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'photos' && styles.activeTab]} 
                  onPress={() => setActiveTab('photos')}
                >
                  <Text style={[styles.tabText, activeTab === 'photos' && styles.activeTabText]}>Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'permissions' && styles.activeTab]} 
                  onPress={() => setActiveTab('permissions')}
                >
                  <Text style={[styles.tabText, activeTab === 'permissions' && styles.activeTabText]}>Permissions</Text>
                  {guestLogs.filter(l => l.status === 'pending').length > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{guestLogs.filter(l => l.status === 'pending').length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'design' && styles.activeTab]} 
                  onPress={() => setActiveTab('design')}
                >
                  <Text style={[styles.tabText, activeTab === 'design' && styles.activeTabText]}>Design</Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'galleries' && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Sub-Events</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setShowSubEventModal(true)}>
                      <IconSymbol name="plus" size={14} color={MidnightColors.gold} />
                      <Text style={styles.addBtnText}>Add Gallery</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.subGrid}>
                    {subEvents.map((sub) => (
                      <TouchableOpacity 
                        key={sub.id} 
                        style={styles.subCard}
                        onPress={() => router.push(`/events/${sub.id}`)}
                      >
                        <Image source={{ uri: sub.coverImage }} style={styles.subImage} />
                        <View style={styles.subInfo}>
                          <Text style={styles.subTitle} numberOfLines={1}>{sub.title}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {activeTab === 'photos' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Media Management</Text>
                  <TouchableOpacity 
                    style={styles.viewGalleryBtn}
                    onPress={() => router.push(`/gallery/${event.id}` as any)}
                  >
                    <LinearGradient colors={[MidnightColors.gold, '#b8860b']} style={styles.viewGalleryGradient}>
                      <IconSymbol name="photo.fill" size={18} color={MidnightColors.background} />
                      <Text style={styles.viewGalleryText}>Manage Photos</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <Text style={styles.emptyText}>Tap above to manage all photos and videos in this event.</Text>
                </View>
              )}

              {activeTab === 'permissions' && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Guest List</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => setShowShareModal(true)}>
                      <IconSymbol name="square.and.arrow.up" size={14} color={MidnightColors.gold} />
                      <Text style={styles.addBtnText}>Share Event</Text>
                    </TouchableOpacity>
                  </View>

                  {/* ── PENDING REQUESTS ── */}
                  <View style={{ gap: 12 }}>
                    {guestLogs.filter(l => l.status === 'pending').map(log => (
                      <TouchableOpacity 
                        key={log.id} 
                        style={styles.requestCardItem}
                        onPress={() => setSelectedRequest(log)}
                      >
                        <View style={styles.requestAvatar}>
                          <Text style={styles.avatarTextSmall}>{log.name.charAt(0)}</Text>
                        </View>
                        
                        <View style={{ flex: 1 }}>
                          <Text style={styles.requestName}>{log.name}</Text>
                          <Text style={styles.requestPhone}>{log.phone}</Text>
                        </View>

                        <View style={styles.requestActionsMini}>
                          <TouchableOpacity 
                            style={styles.miniActionBtnRed}
                            onPress={() => updateGuestStatus(log.id, 'rejected').then(loadEvent)}
                          >
                            <IconSymbol name="xmark" size={12} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.miniActionBtnGreen}
                            onPress={() => updateGuestStatus(log.id, 'approved').then(loadEvent)}
                          >
                            <IconSymbol name="checkmark" size={12} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* ── APPROVED MEMBERS ── */}
                  {guestLogs.filter(l => l.status === 'approved').length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 16, marginTop: 10 }]}>Member Registry</Text>
                      {guestLogs
                        .filter(l => l.status === 'approved')
                        .sort((a, b) => (b.canAdmin ? 1 : 0) - (a.canAdmin ? 1 : 0))
                        .map((log, index) => (
                        <TouchableOpacity 
                          key={log.id} 
                          style={styles.memberCard}
                          onPress={() => setSelectedGuest(log)}
                        >
                          {/* Left: Avatar */}
                          <View style={styles.memberAvatar}>
                            <Text style={styles.avatarText}>{log.name.charAt(0)}</Text>
                          </View>

                          {/* Center: Info & Permissions */}
                          <View style={styles.memberMain}>
                            <Text style={styles.memberName}>{log.name}</Text>
                            
                            {/* Secondary Row (Phone & Permissions) */}
                            <View style={styles.memberSecondary}>
                              <Text style={styles.memberPhone}>{log.phone}</Text>
                              <View style={styles.grantedRowSmall}>
                                {log.canAdmin && <View style={styles.miniIcon}><IconSymbol name="shield.fill" size={8} color={MidnightColors.gold} /></View>}
                                {log.canUpload && <View style={styles.miniIcon}><IconSymbol name="camera.fill" size={8} color={MidnightColors.gold} /></View>}
                                {log.canComment && <View style={styles.miniIcon}><IconSymbol name="bubble.left.fill" size={8} color={MidnightColors.gold} /></View>}
                                {log.canChat && <View style={styles.miniIcon}><IconSymbol name="message.fill" size={8} color={MidnightColors.gold} /></View>}
                              </View>
                            </View>
                          </View>

                          {/* Right: Number & Actions */}
                          <View style={styles.memberActions}>
                            <Text style={styles.memberNumber}>#{String(index + 1).padStart(2, '0')}</Text>
                            <TouchableOpacity 
                              style={styles.memberDelete}
                              onPress={() => deleteGuest(log.id).then(loadEvent)}
                            >
                              <IconSymbol name="trash.fill" size={16} color="rgba(239, 68, 68, 0.4)" />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {guestLogs.length === 0 && (
                    <View style={styles.emptyContainer}>
                      <IconSymbol name="person.2.fill" size={48} color="rgba(255, 255, 255, 0.05)" />
                      <Text style={styles.emptyText}>No guests yet.</Text>
                    </View>
                  )}
                </View>
              )}

              {/* ── PREMIUM MEMBER PERMISSIONS MODAL ── */}
              <Modal visible={!!selectedGuest} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                  <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                    <LinearGradient 
                      colors={['#0f172a', '#020617']} 
                      style={styles.premiumModalContent}
                    >
                      {/* Header: Member Identity */}
                      <View style={styles.premiumModalHeader}>
                        <View style={styles.premiumAvatar}>
                          <LinearGradient colors={[MidnightColors.gold, '#b8860b']} style={styles.avatarGradient}>
                            <Text style={styles.premiumAvatarText}>{selectedGuest?.name.charAt(0)}</Text>
                          </LinearGradient>
                        </View>
                        <View style={{ flex: 1, marginLeft: 16 }}>
                          <Text style={styles.premiumModalTitle}>{selectedGuest?.name}</Text>
                          <Text style={styles.premiumModalSub}>Member #0{guestLogs.filter(l => l.status === 'approved').findIndex(l => l.id === selectedGuest?.id) + 1}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedGuest(null)} style={styles.closeModalCircle}>
                          <IconSymbol name="xmark" size={16} color={MidnightColors.slate400} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.permissionsScroll}>
                        <Text style={styles.permissionsGroupLabel}>Member Privileges</Text>
                        
                        {[
                          { id: 'canAdmin', label: 'Admin Access', desc: 'Manage event, sub-galleries, and other guests', icon: 'shield.fill' },
                          { id: 'canUpload', label: 'Allow Uploads', desc: 'Can add photos and videos to the event', icon: 'camera.fill' },
                          { id: 'canComment', label: 'Allow Comments', desc: 'Can react and post comments on any media', icon: 'bubble.left.fill' },
                          { id: 'canChat', label: 'Allow Chat', desc: 'Can participate in the real-time event feed', icon: 'message.fill' },
                        ].map((perm) => {
                          const isActive = (selectedGuest as any)?.[perm.id];
                          return (
                            <TouchableOpacity 
                              key={perm.id} 
                              style={[styles.richPermCard, isActive && styles.richPermCardActive]}
                              onPress={() => {
                                if (selectedGuest) {
                                  const newPerms = { [perm.id]: !isActive };
                                  updateGuestPermissions(selectedGuest.id, newPerms).then(() => {
                                    setSelectedGuest({ ...selectedGuest, ...newPerms });
                                    loadEvent();
                                  });
                                }
                              }}
                            >
                              <View style={[styles.richPermIconBox, isActive && { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
                                <IconSymbol name={perm.icon as any} size={20} color={isActive ? MidnightColors.gold : MidnightColors.slate700} />
                              </View>
                              
                              <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={[styles.richPermLabel, isActive && { color: '#fff' }]}>{perm.label}</Text>
                                <Text style={styles.richPermDesc} numberOfLines={2}>{perm.desc}</Text>
                              </View>

                              <View style={[styles.customToggle, isActive && styles.customToggleActive]}>
                                <View style={[styles.customToggleThumb, isActive && styles.customToggleThumbActive]} />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TouchableOpacity 
                        style={styles.premiumDoneBtn}
                        onPress={() => setSelectedGuest(null)}
                      >
                        <LinearGradient 
                          colors={[MidnightColors.gold, '#b8860b']} 
                          start={{ x: 0, y: 0 }} 
                          end={{ x: 1, y: 0 }}
                          style={styles.premiumDoneGradient}
                        >
                          <Text style={styles.premiumDoneText}>Save Permissions</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                </View>
              </Modal>

              {/* ── PREMIUM REQUEST DETAIL MODAL ── */}
              <Modal visible={!!selectedRequest} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                  <View style={styles.ironCladWrapper}>
                    <LinearGradient 
                      colors={['#0f172a', '#020617']} 
                      style={styles.premiumRequestModal}
                    >
                      <View style={styles.modalHeaderCentered}>
                        <View style={styles.largeAvatar}>
                          <LinearGradient colors={[MidnightColors.gold, '#b8860b']} style={styles.avatarGradient}>
                            <Text style={styles.largeAvatarText}>{selectedRequest?.name.charAt(0)}</Text>
                          </LinearGradient>
                        </View>
                        <Text style={styles.modalRequestTitle}>{selectedRequest?.name}</Text>
                        <Text style={styles.modalRequestSub}>Requesting Access</Text>
                      </View>

                      <View style={styles.modalBody}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Contact Info</Text>
                          <Text style={styles.detailValue}>{selectedRequest?.phone}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Target Event</Text>
                          <Text style={styles.detailValue}>{event.title}</Text>
                        </View>
                      </View>

                      <View style={styles.modalFooter}>
                        <TouchableOpacity 
                          style={[styles.modalActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                          onPress={() => {
                            if (selectedRequest) {
                              updateGuestStatus(selectedRequest.id, 'rejected').then(() => {
                                setSelectedRequest(null);
                                loadEvent();
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
                                loadEvent();
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
                        <Text style={styles.modalCloseLinkText}>Cancel</Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                </View>
              </Modal>

              {activeTab === 'design' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Event Design</Text>
                  
                  {/* Step 1: Event Type */}
                  <TouchableOpacity style={styles.designCard} onPress={() => setShowCategoryModal(true)}>
                    <View style={styles.designInfo}>
                      <Text style={styles.designLabel}>1. Event Type</Text>
                      <Text style={styles.designValue}>{event.category || 'Select Type'}</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={20} color={MidnightColors.gold} />
                  </TouchableOpacity>

                  {/* Step 2: Theme (Only if type selected) */}
                  {event.category ? (
                    <TouchableOpacity 
                      style={[styles.designCard, { marginTop: 16 }]} 
                      onPress={() => setShowTemplateModal(true)}
                    >
                      <View style={styles.designInfo}>
                        <Text style={styles.designLabel}>2. Visual Theme</Text>
                        <Text style={styles.designValue}>{event.templateId || 'Hero (Default)'}</Text>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={MidnightColors.gold} />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.designCard, { marginTop: 16, opacity: 0.5 }]}>
                      <View style={styles.designInfo}>
                        <Text style={styles.designLabel}>2. Visual Theme</Text>
                        <Text style={styles.designValue}>Select event type first</Text>
                      </View>
                      <IconSymbol name="lock.fill" size={20} color={MidnightColors.slate400} />
                    </View>
                  )}
                </View>
              )}
            </>
          ) : (
            <>
              {/* ── VISITOR IMMERSIVE CONTENT ── */}
              <View style={styles.visitorContent}>
                {!activeSubEvent && (
                  <View style={styles.mainInfoBox}>
                    <Text style={styles.visitorDescription}>{event.description}</Text>
                    {event.category && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{event.category}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.galleryHeader}>
                  <Text style={styles.galleryTitle}>
                    {activeSubEvent ? activeSubEvent.title : 'Highlights'}
                  </Text>
                  <Text style={styles.photoCount}>
                    {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
                  </Text>
                </View>

                {loadingPhotos ? (
                  <View style={styles.photoLoading}>
                    <ActivityIndicator color={MidnightColors.gold} />
                  </View>
                ) : (
                  <View style={styles.photoGrid}>
                    {photos.length === 0 ? (
                      <View style={styles.emptyGallery}>
                        <IconSymbol name="photo.on.rectangle" size={40} color="rgba(255,255,255,0.05)" />
                        <Text style={styles.emptyText}>No photos yet.</Text>
                      </View>
                    ) : (
                      photos.map((photo, i) => (
                        <TouchableOpacity 
                          key={photo.id} 
                          style={styles.photoCard}
                          activeOpacity={0.9}
                          onPress={() => router.push({ pathname: '/gallery/[id]', params: { id: activeSubEvent?.id || event.id, photoId: photo.id } } as any)}
                        >
                          <Image source={{ uri: photo.url }} style={styles.galleryImg} />
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}

                {/* Join Prompt for non-logged in users */}
                {!user && (
                  <View style={styles.guestSection}>
                    <Text style={styles.guestTitle}>Enter the Celebration</Text>
                    <Text style={styles.guestSub}>Join to view all photos and interactions</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="Your Name" 
                      placeholderTextColor={MidnightColors.slate400}
                      value={guestName}
                      onChangeText={setGuestName}
                    />
                    <TextInput 
                      style={styles.input} 
                      placeholder="Phone Number" 
                      placeholderTextColor={MidnightColors.slate400}
                      keyboardType="phone-pad"
                      value={guestPhone}
                      onChangeText={setGuestPhone}
                    />
                    <TouchableOpacity style={styles.accessBtn} onPress={handleGuestAccess}>
                      <Text style={styles.accessBtnText}>Request Access</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── CREATE SUB-EVENT MODAL ── */}
      <Modal visible={showSubEventModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSubEventModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Gallery</Text>
            <TextInput 
              style={styles.input} 
              value={newSubTitle} 
              onChangeText={setNewSubTitle} 
              placeholder="e.g. Wedding Reception" 
              placeholderTextColor={MidnightColors.slate400}
              autoFocus
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateSubEvent} disabled={updating}>
              <Text style={styles.submitBtnText}>{updating ? 'Creating...' : 'Create Gallery'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CATEGORY MODAL ── */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCategoryModal(false)} />
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Event Type</Text>
            <ScrollView>
              {['Wedding', 'Birthday', 'Anniversary', 'Engagement', 'Reception', 'Corporate', 'Other'].map((cat) => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.templateOption, event?.category === cat && styles.activeTemplate]}
                  onPress={() => {
                    handleUpdateCategory(cat);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[styles.templateText, event?.category === cat && styles.activeTemplateText]}>{cat}</Text>
                  {event?.category === cat && <IconSymbol name="checkmark" size={16} color={MidnightColors.background} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── TEMPLATE MODAL ── */}
      <Modal visible={showTemplateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowTemplateModal(false)} />
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Choose Style</Text>
            <ScrollView>
              {['hero', 'classic', 'royal', 'editorial', 'polaroid', 'museum'].map((t) => (
                <TouchableOpacity 
                  key={t} 
                  style={[styles.templateOption, event?.templateId === t && styles.activeTemplate]}
                  onPress={() => handleUpdateTemplate(t)}
                >
                  <Text style={[styles.templateText, event?.templateId === t && styles.activeTemplateText]}>{t.toUpperCase()}</Text>
                  {event?.templateId === t && <IconSymbol name="checkmark" size={16} color={MidnightColors.background} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* ── SHARE MODAL ── */}
      <Modal visible={showShareModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowShareModal(false)} />
          <View style={styles.shareModalContent}>
            <Text style={styles.modalTitle}>Share Event</Text>
            
            <View style={styles.qrContainer}>
              <Image 
                source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://wedalbum.app/events/${event.id}` }} 
                style={styles.qrCode} 
              />
              <Text style={styles.qrLabel}>Scan to Join</Text>
            </View>

            <View style={styles.joinIdContainer}>
              <Text style={styles.joinIdLabel}>Unique Join ID</Text>
              <View style={styles.joinIdBox}>
                <Text style={styles.joinIdValue}>{event.joinId}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.shareActionBtn} onPress={handleShare}>
              <IconSymbol name="square.and.arrow.up" size={18} color={MidnightColors.background} />
              <Text style={styles.shareActionText}>Share Invitation</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowShareModal(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: MidnightColors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  
  // Hero
  hero: { height: 400, width: '100%' },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  floatingBack: { position: 'absolute', top: 20, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  floatingShare: { position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroContent: { position: 'absolute', bottom: 30, left: 24, right: 24 },
  heroTitle: { fontSize: 36, color: '#fff', fontFamily: Fonts.outfit.extraBold, letterSpacing: -1 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  heroDate: { fontSize: 14, color: MidnightColors.gold, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', letterSpacing: 1 },
  editCoverBtn: { position: 'absolute', top: 80, right: 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  editCoverText: { color: '#fff', fontSize: 12, fontFamily: Fonts.inter.bold },

  // Content
  content: { padding: 24 },
  description: { fontSize: 16, color: MidnightColors.slate400, fontFamily: Fonts.inter.regular, lineHeight: 24, marginBottom: 32 },
  
  // Tabs
  tabBar: { flexDirection: 'row', gap: 12, marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.05)', padding: 6, borderRadius: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  activeTab: { backgroundColor: MidnightColors.gold },
  tabText: { color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.outfit.bold },
  activeTabText: { color: MidnightColors.background },
  badge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: MidnightColors.background },
  badgeText: { color: '#fff', fontSize: 9, fontFamily: Fonts.inter.bold },

  // Section
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 22, color: '#fff', fontFamily: Fonts.outfit.bold },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  addBtnText: { color: MidnightColors.gold, fontSize: 12, fontFamily: Fonts.outfit.bold },
  
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  subCard: { width: (width - 60) / 2, height: 160, borderRadius: 20, overflow: 'hidden', backgroundColor: MidnightColors.deepSlate, borderWidth: 1, borderColor: MidnightColors.cardBorder },
  subImage: { width: '100%', height: 110 },
  subInfo: { padding: 10 },
  subTitle: { fontSize: 14, color: '#fff', fontFamily: Fonts.outfit.bold },

  // Logs
  logCard: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, borderLeftWidth: 3, borderLeftColor: MidnightColors.gold, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logName: { color: '#fff', fontSize: 16, fontFamily: Fonts.outfit.bold },
  logPhone: { color: MidnightColors.slate400, fontSize: 12, fontFamily: Fonts.inter.medium, marginTop: 2 },
  logActions: { flexDirection: 'row', gap: 10 },
  statusBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 10, fontFamily: Fonts.inter.bold, letterSpacing: 1 },
  deleteLogBtn: { padding: 8 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: MidnightColors.slate400, fontSize: 14, fontFamily: Fonts.inter.regular, fontStyle: 'italic', textAlign: 'center' },
  manageApprovedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  manageApprovedText: { color: '#64748b', fontSize: 13, fontFamily: Fonts.inter.bold },
  
  // Member Card
  memberCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderRadius: 24, 
    paddingHorizontal: 16,
    height: 84,
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 16
  },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(212, 175, 55, 0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  avatarText: { color: MidnightColors.gold, fontSize: 20, fontFamily: Fonts.outfit.bold },
  memberMain: { flex: 1, height: '100%', justifyContent: 'center', paddingBottom: 12 },
  memberName: { color: '#fff', fontSize: 17, fontFamily: Fonts.outfit.bold, lineHeight: 22 },
  memberSecondary: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberPhone: { color: MidnightColors.slate700, fontSize: 10, fontFamily: Fonts.inter.medium },
  grantedRowSmall: { flexDirection: 'row', gap: 4, height: 14, alignItems: 'center' },
  miniIcon: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  memberActions: { alignItems: 'flex-end', justifyContent: 'center', height: '100%', gap: 4 },
  memberNumber: { color: MidnightColors.gold, fontSize: 10, fontFamily: Fonts.inter.bold, opacity: 0.5 },
  memberDelete: { padding: 8 },

  grantedRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  grantedIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(212, 175, 55, 0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  
  // Premium Permission Modal
  modalBackdrop: { 
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.95)', 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 1000
  },
  premiumModalContent: { 
    width: width * 0.85, 
    alignSelf: 'center',
    borderRadius: 32, 
    overflow: 'hidden', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.5, 
    shadowRadius: 20, 
    elevation: 10 
  },
  premiumModalHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'rgba(255,255,255,0.02)' },
  premiumAvatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden' },
  avatarGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  premiumAvatarText: { color: MidnightColors.background, fontSize: 20, fontFamily: Fonts.outfit.extraBold },
  premiumModalTitle: { color: '#fff', fontSize: 18, fontFamily: Fonts.outfit.bold },
  premiumModalSub: { color: MidnightColors.gold, fontSize: 10, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', marginTop: 1, opacity: 0.8 },
  closeModalCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  permissionsScroll: { padding: 16 },
  permissionsGroupLabel: { color: MidnightColors.slate700, fontSize: 10, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
  richPermCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 20, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', gap: 12 },
  richPermCardActive: { backgroundColor: 'rgba(212, 175, 55, 0.05)', borderColor: 'rgba(212, 175, 55, 0.2)' },
  richPermIconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  richPermLabel: { color: MidnightColors.slate400, fontSize: 14, fontFamily: Fonts.outfit.bold },
  richPermDesc: { color: MidnightColors.slate700, fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 1 },
  customToggle: { width: 38, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', padding: 2, justifyContent: 'center' },
  customToggleActive: { backgroundColor: 'rgba(212, 175, 55, 0.2)' },
  customToggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: MidnightColors.slate400 },
  customToggleThumbActive: { backgroundColor: MidnightColors.gold, transform: [{ translateX: 18 }] },
  premiumDoneBtn: { margin: 16, marginTop: 0, borderRadius: 16, overflow: 'hidden', alignSelf: 'center', width: '60%' },
  premiumDoneGradient: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  premiumDoneText: { color: MidnightColors.background, fontSize: 13, fontFamily: Fonts.outfit.extraBold, textTransform: 'uppercase', letterSpacing: 1 },

  // Internal Request Cards
  requestCardItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderRadius: 24, 
    padding: 12, 
    width: '100%',
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 16
  },
  requestAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(212, 175, 55, 0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.2)' },
  avatarTextSmall: { color: MidnightColors.gold, fontSize: 18, fontFamily: Fonts.outfit.bold },
  requestName: { color: '#fff', fontSize: 16, fontFamily: Fonts.outfit.bold },
  requestPhone: { color: MidnightColors.slate700, fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 1 },
  requestActionsMini: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  miniActionBtnGreen: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  miniActionBtnRed: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },

  // Request Modal Specific
  ironCladWrapper: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  premiumRequestModal: { width: width * 0.85, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeaderCentered: { alignItems: 'center', marginBottom: 24 },
  largeAvatar: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', marginBottom: 16 },
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

  // Design
  designCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: MidnightColors.deepSlate, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: MidnightColors.cardBorder },
  designLabel: { color: MidnightColors.slate400, fontSize: 11, fontFamily: Fonts.inter.bold, textTransform: 'uppercase' },
  designValue: { color: '#fff', fontSize: 18, fontFamily: Fonts.outfit.bold, marginTop: 4 },

  // Guest Access
  guestSection: { backgroundColor: MidnightColors.deepSlate, padding: 24, borderRadius: 28, borderWidth: 1, borderColor: MidnightColors.cardBorder },
  guestTitle: { fontSize: 20, color: '#fff', fontFamily: Fonts.outfit.bold, textAlign: 'center' },
  guestSub: { fontSize: 13, color: MidnightColors.slate400, fontFamily: Fonts.inter.regular, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, color: '#fff', fontFamily: Fonts.inter.regular, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  accessBtn: { backgroundColor: MidnightColors.gold, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  accessBtnText: { fontSize: 15, color: MidnightColors.background, fontFamily: Fonts.outfit.extraBold, textTransform: 'uppercase' },

  // Gallery Btn
  viewGalleryBtn: { height: 60, borderRadius: 20, overflow: 'hidden', marginTop: 10 },
  viewGalleryGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  viewGalleryText: { fontSize: 16, color: MidnightColors.background, fontFamily: Fonts.outfit.extraBold, textTransform: 'uppercase' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { backgroundColor: '#0f172a', width: '100%', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  modalTitle: { fontSize: 24, color: '#fff', fontFamily: Fonts.outfit.bold, marginBottom: 20 },
  submitBtn: { backgroundColor: MidnightColors.gold, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: MidnightColors.background, fontSize: 16, fontFamily: Fonts.outfit.bold },
  
  templateOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  activeTemplate: { backgroundColor: MidnightColors.gold },
  templateText: { color: '#fff', fontSize: 15, fontFamily: Fonts.outfit.bold },
  activeTemplateText: { color: MidnightColors.background },
  
  errorText: { color: '#fff', fontSize: 18, fontFamily: Fonts.outfit.bold, marginBottom: 20 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: MidnightColors.gold, borderRadius: 10 },
  backBtnText: { color: MidnightColors.background, fontWeight: 'bold' },

  // Share Modal
  shareModalContent: { backgroundColor: '#0f172a', width: '90%', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', alignItems: 'center' },
  qrContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 24, marginTop: 10, alignItems: 'center' },
  qrCode: { width: 180, height: 180 },
  qrLabel: { color: MidnightColors.background, fontSize: 12, fontFamily: Fonts.inter.bold, marginTop: 10, textTransform: 'uppercase' },
  joinIdContainer: { marginTop: 24, width: '100%', alignItems: 'center' },
  joinIdLabel: { color: MidnightColors.slate400, fontSize: 12, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', marginBottom: 8 },
  joinIdBox: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  joinIdValue: { color: MidnightColors.gold, fontSize: 24, fontFamily: Fonts.outfit.extraBold, letterSpacing: 4 },
  shareActionBtn: { backgroundColor: MidnightColors.gold, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 20, marginTop: 32, width: '100%', justifyContent: 'center' },
  shareActionText: { color: MidnightColors.background, fontSize: 16, fontFamily: Fonts.outfit.extraBold, textTransform: 'uppercase' },
  closeModalBtn: { marginTop: 16, padding: 10 },
  closeModalText: { color: MidnightColors.slate400, fontSize: 14, fontFamily: Fonts.inter.medium },

  // Visitor Immersive Styles
  visitorHeaderContainer: {
    position: 'absolute',
    top: 50, // Below safe area top usually
    left: 0,
    right: 0,
    zIndex: 100,
    height: 60,
  },
  visitorHeaderContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  visitorTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  visitorTabActive: {
    backgroundColor: MidnightColors.gold,
    borderColor: MidnightColors.gold,
  },
  visitorTabText: {
    color: MidnightColors.gold,
    fontSize: 14,
    fontFamily: Fonts.outfit.bold,
  },
  visitorTabTextActive: {
    color: MidnightColors.background,
  },

  visitorContent: {
    paddingTop: 0,
  },
  mainInfoBox: {
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.02)',
    margin: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  visitorDescription: {
    fontSize: 15,
    color: MidnightColors.slate400,
    fontFamily: Fonts.inter.regular,
    lineHeight: 22,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 12,
  },
  categoryBadgeText: {
    color: MidnightColors.gold,
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
  },

  galleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginBottom: 16,
    marginTop: 10,
  },
  galleryTitle: {
    fontSize: 24,
    color: '#fff',
    fontFamily: Fonts.outfit.bold,
  },
  photoCount: {
    fontSize: 12,
    color: MidnightColors.gold,
    fontFamily: Fonts.inter.medium,
    opacity: 0.7,
  },
  photoLoading: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 40,
  },
  photoCard: {
    width: (width - 48) / 3, // 3 column grid
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  galleryImg: {
    width: '100%',
    height: '100%',
  },
  emptyGallery: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
});
