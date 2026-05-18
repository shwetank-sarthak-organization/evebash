import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Share, Keyboard, useWindowDimensions, useColorScheme } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import Svg, { Path, Rect } from 'react-native-svg';
import { getEventById, getSubEvents, logGuestLogin, onGuestStatusChange, Event as FirestoreEvent, updateEvent, createEvent, getGuestLogs, updateGuestStatus, updateGuestPermissions, deleteGuest, GuestLog, onPhotoInteractions, toggleLike, addComment, deletePhotoComment, deleteEvent, getBusinessByVendorCode, getBusinessById, Business } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import { MidnightColors, Fonts } from '../../constants/theme';
import { MOBILE_TEMPLATE_THEMES } from '../../constants/templates';
import * as ImagePicker from 'expo-image-picker';
import { uploadEventImage } from '@/lib/storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Animated, { FadeInUp } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_GRID_GAP = 3;

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id, shared, guestView, tab, share, mode } = useLocalSearchParams<{ id: string; shared?: string; guestView?: string; tab?: string; share?: string; mode?: 'admin' | 'visitor' }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [scrollY, setScrollY] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { height: windowHeight } = useWindowDimensions();

  const [event, setEvent] = useState<FirestoreEvent | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<GuestLog | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<GuestLog | null>(null);
  const [subEvents, setSubEvents] = useState<FirestoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestStatus, setGuestStatus] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState<'galleries' | 'permissions' | 'design' | 'partners'>((tab as any) || 'galleries');
  const [linkingVendor, setLinkingVendor] = useState(false);
  const [vendorCode, setVendorCode] = useState('');
  const [linkedVendors, setLinkedVendors] = useState<Business[]>([]);
  const [guestLogs, setGuestLogs] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const selectedTemplate = React.useMemo(() => {
    // If event is loading or missing, fallback to first theme
    const base = MOBILE_TEMPLATE_THEMES.find((theme) => theme.id === (event?.templateId || 'hero')) || MOBILE_TEMPLATE_THEMES[0];
    return {
      ...base,
      background: isDark ? base.background.dark : base.background.light,
      panel: isDark ? base.panel.dark : base.panel.light,
      text: isDark ? base.text.dark : base.text.light,
      muted: isDark ? base.muted.dark : base.muted.light,
      accentBg: isDark ? base.accentBg.dark : base.accentBg.light,
      tileBg: isDark ? base.tileBg.dark : base.tileBg.light,
      overlay: isDark ? base.overlay.dark : base.overlay.light,
    };
  }, [event?.templateId, isDark]);

  // Decide which view to show
  // We show Admin view ONLY if mode=admin AND user is owner.
  // Otherwise, we default to the premium Visitor view.
  const [isAdminViewActive, setIsAdminViewActive] = useState(mode === 'admin');

  const showAdminView = isAdminViewActive && isOwner;
  const heroHeight = (!showAdminView && event?.templateId === 'royal') ? windowHeight : 400;
  
  // Modals
  const [showSubEventModal, setShowSubEventModal] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(share === 'true');
  const [showApproved, setShowApproved] = useState(false);

  const [activeSubEvent, setActiveSubEvent] = useState<FirestoreEvent | null>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  
  // Gallery Welcome Text Settings State
  const [galleryDescModalVisible, setGalleryDescModalVisible] = useState(false);
  const [galleryDescText, setGalleryDescText] = useState('');

  // Admin Gallery Manager — which gallery is the host currently managing
  // null = Home gallery, FirestoreEvent = a sub-event gallery
  const [selectedAdminGallery, setSelectedAdminGallery] = useState<FirestoreEvent | null | undefined>(undefined);

  // Image Viewer State
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [likes, setLikes] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  const currentPhoto = photos[currentPhotoIndex];
  const viewerIdentity = user
    ? { id: user.uid, name: user.name || user.email?.split('@')[0] || 'User' }
    : { id: guestPhone || 'anonymous', name: guestName || 'Guest' };
  const isLiked = likes.some((like) => like.userId === viewerIdentity.id);

  const openViewer = (index: number) => {
    setCurrentPhotoIndex(index);
    setShowComments(false);
    setReplyingTo(null);
    setNewComment('');
    setViewerVisible(true);
  };

  const navigateViewer = (dir: 'prev' | 'next') => {
    if (dir === 'prev') {
      setCurrentPhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
    } else {
      setCurrentPhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
    }
  };

  useEffect(() => {
    if (!viewerVisible || !currentPhoto?.id) return;

    const unsubscribe = onPhotoInteractions(currentPhoto.id, (data) => {
      setLikes(data.likes);
      setComments(data.comments);
    });

    return () => unsubscribe();
  }, [viewerVisible, currentPhoto?.id]);

  const handleToggleLike = async () => {
    if (!currentPhoto?.id || isLiking) return;
    setIsLiking(true);
    try {
      await toggleLike(currentPhoto.id, viewerIdentity.id, viewerIdentity.name);
    } catch (err) {
      console.error('[EventDetail] Like failed:', err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleAddComment = async () => {
    if (!currentPhoto?.id || !newComment.trim() || isCommenting) return;
    setIsCommenting(true);
    try {
      await addComment(currentPhoto.id, viewerIdentity.id, viewerIdentity.name, newComment.trim(), replyingTo?.id);
      setNewComment('');
      setReplyingTo(null);
      Keyboard.dismiss();
    } catch (err) {
      console.error('[EventDetail] Comment failed:', err);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePhotoComment(commentId);
          } catch (err) {
            console.error('[EventDetail] Delete comment failed:', err);
          }
        },
      },
    ]);
  };

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

        if (!eventData.templateId) {
          await updateEvent(eventData.id, { templateId: 'hero' });
          eventData.templateId = 'hero';
        }
        
        setEvent(eventData);
        setIsOwner(user?.uid === eventData.createdBy);
        const subs = await getSubEvents(id, eventData.legacyId);
        setSubEvents(subs);
        
        // Fetch linked vendors
        if (eventData.vendors && eventData.vendors.length > 0) {
          const vendorsData = await Promise.all(
            eventData.vendors.map((vid: string) => getBusinessById(vid))
          );
          setLinkedVendors(vendorsData.filter(v => v !== null) as Business[]);
        }
        
        // Auto-load photos for main event initially
        loadPhotos(eventData.id, eventData.legacyId);

        if (user && user.uid === eventData.createdBy) {
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

  const handleOpenEditWelcomeModal = () => {
    const currentDesc = activeSubEvent ? activeSubEvent.description : event?.description;
    setGalleryDescText(currentDesc || '');
    setGalleryDescModalVisible(true);
  };

  const handleSaveGalleryDesc = async () => {
    if (!event) return;
    setUpdating(true);
    try {
      if (activeSubEvent) {
        await updateEvent(activeSubEvent.id, { description: galleryDescText.trim() });
        setActiveSubEvent({ ...activeSubEvent, description: galleryDescText.trim() });
        const loadedSubs = await getSubEvents(event.id, event.legacyId);
        setSubEvents(loadedSubs);
      } else {
        await updateEvent(event.id, { description: galleryDescText.trim() });
        setEvent({ ...event, description: galleryDescText.trim() });
      }
      setGalleryDescModalVisible(false);
      Alert.alert("Success", "Gallery message updated successfully!");
    } catch (err) {
      console.error('[SaveDesc] Error:', err);
      Alert.alert("Error", "Failed to update description.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUploadGalleryPhoto = async () => {
    if (!event) return;
    const activeId = activeSubEvent ? activeSubEvent.id : event.id;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      setUpdating(true);
      try {
        const file = { uri: result.assets[0].uri, name: 'photo.jpg', type: 'image/jpeg' } as any;
        const upload = await uploadEventImage(file, activeId, user?.uid || 'anon');
        
        const { addPhoto } = await import('@/lib/firestore');
        await addPhoto({
          eventId: activeId,
          url: upload.url,
          cloudinaryPublicId: '',
          uploadedAt: new Date(),
          userId: user?.uid || 'anon'
        });
        
        loadPhotos(activeId, activeSubEvent ? activeSubEvent.legacyId : event.legacyId);
        Alert.alert("Success", "Photo uploaded successfully!");
      } catch (err) {
        console.error('[UploadPhoto] Error:', err);
        Alert.alert("Error", "Failed to upload photo.");
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleDeleteGalleryPhoto = async (photoId: string) => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to permanently delete this photo from the gallery?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUpdating(true);
            try {
              const { deletePhoto } = await import('@/lib/firestore');
              await deletePhoto(photoId);
              
              const activeId = activeSubEvent ? activeSubEvent.id : event!.id;
              loadPhotos(activeId, activeSubEvent ? activeSubEvent.legacyId : event!.legacyId);
              Alert.alert("Success", "Photo removed from gallery.");
            } catch (err) {
              console.error('[DeletePhoto] Error:', err);
              Alert.alert("Error", "Failed to delete photo.");
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleOpenGalleryImmersive = (sub: FirestoreEvent | null) => {
    console.log('[GalleryOpen] Tapped gallery card:', sub ? sub.title : 'Home');
    try {
      handleSubEventChange(sub);
      setIsAdminViewActive(false);
      console.log('[GalleryOpen] Switched isAdminViewActive to false successfully!');
    } catch (error) {
      console.error('[GalleryOpen] Error in handleOpenGalleryImmersive:', error);
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
        description: `Welcome to the ${newSubTitle} gallery! Share your beautiful moments and thoughts here.`,
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
      setEvent({ ...event, templateId });
      await updateEvent(event.id, { templateId });
      setShowTemplateModal(false);
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
      setEvent({ ...event, category });
      await updateEvent(event.id, { category });
    } catch (err) {
      Alert.alert("Error", "Failed to update event type.");
    } finally {
      setUpdating(false);
    }
  };

  const handleRenameEvent = async () => {
    if (!event || !editTitle.trim()) return;
    setUpdating(true);
    try {
      const success = await updateEvent(event.id, { title: editTitle.trim() });
      if (success) {
        // Update local state immediately for snappiness
        setEvent({ ...event, title: editTitle.trim() });
        setShowRenameModal(false);
      } else {
        Alert.alert("Error", "Failed to rename event in database.");
      }
    } catch (err) {
      console.error("[RenameEvent] Error:", err);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setUpdating(false);
    }
  };
  const handleDateChange = async (e: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (e.type === 'set' && selectedDate && event) {
      const formattedDate = selectedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      setUpdating(true);
      try {
        const success = await updateEvent(event.id, { date: formattedDate });
        if (success) {
          setEvent({ ...event, date: formattedDate });
        } else {
          Alert.alert("Error", "Failed to update date in database.");
        }
      } catch (err) {
        console.error("[DateChange] Error:", err);
        Alert.alert("Error", "Failed to update date.");
      } finally {
        setUpdating(false);
      }
    }
  };

  const handleDeleteMainEvent = async () => {
    if (!event) return;
    Alert.alert(
      "Delete Event",
      `Are you sure you want to delete "${event.title}"? This will permanently remove all photos and sub-events.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            setUpdating(true);
            const success = await deleteEvent(event.id);
            if (success) {
              Alert.alert("Success", "Event deleted successfully.");
              router.replace('/(tabs)/gallery');
            } else {
              Alert.alert("Error", "Failed to delete event.");
            }
            setUpdating(false);
          } 
        }
      ]
    );
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
    const isRoyal = event?.templateId === 'royal';
    return (
      <View style={[styles.visitorHeaderContainer, isRoyal && { height: 70, marginTop: 12, marginBottom: 0 }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.visitorHeaderContent}
        >
          <TouchableOpacity 
            style={[
              styles.visitorTab,
              isRoyal ? { 
                backgroundColor: 'transparent', 
                borderWidth: 0, 
                borderRadius: 0, 
                paddingHorizontal: 16, 
                paddingVertical: 6,
                flexDirection: 'column',
                gap: 2
              } : !activeSubEvent && styles.visitorTabActive
            ]}
            onPress={() => handleSubEventChange(null)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {!isRoyal && (
                <IconSymbol 
                  name="house.fill" 
                  size={14} 
                  color={!activeSubEvent ? MidnightColors.background : MidnightColors.gold} 
                />
              )}
              <Text style={[
                styles.visitorTabText,
                { color: isRoyal ? selectedTemplate.muted : MidnightColors.gold },
                selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
                !activeSubEvent && (isRoyal ? { color: '#fff' } : styles.visitorTabTextActive)
              ]}>
                Home
              </Text>
            </View>

            {isRoyal && !activeSubEvent && (
              <View style={{ alignItems: 'center', marginTop: 3 }}>
                <View style={{ width: 28, height: 1.5, backgroundColor: selectedTemplate.accent }} />
                <Text style={{ fontSize: 6, color: selectedTemplate.accent, marginTop: 1 }}>♦</Text>
              </View>
            )}
          </TouchableOpacity>

          {subEvents.map((sub) => {
            const isActive = activeSubEvent?.id === sub.id;
            return (
              <TouchableOpacity 
                key={sub.id}
                style={[
                  styles.visitorTab,
                  isRoyal ? { 
                    backgroundColor: 'transparent', 
                    borderWidth: 0, 
                    borderRadius: 0, 
                    paddingHorizontal: 16, 
                    paddingVertical: 6,
                    flexDirection: 'column',
                    gap: 2
                  } : isActive && styles.visitorTabActive
                ]}
                onPress={() => handleSubEventChange(sub)}
              >
                <Text style={[
                  styles.visitorTabText,
                  { color: isRoyal ? selectedTemplate.muted : MidnightColors.gold },
                  selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
                  isActive && (isRoyal ? { color: '#fff' } : styles.visitorTabTextActive)
                ]}>
                  {sub.title}
                </Text>

                {isRoyal && isActive && (
                  <View style={{ alignItems: 'center', marginTop: 3 }}>
                    <View style={{ width: 28, height: 1.5, backgroundColor: selectedTemplate.accent }} />
                    <Text style={{ fontSize: 6, color: selectedTemplate.accent, marginTop: 1 }}>♦</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Wedding Partners Tab */}
          <TouchableOpacity 
            style={[
              styles.visitorTab,
              isRoyal ? { 
                backgroundColor: 'transparent', 
                borderWidth: 0, 
                borderRadius: 0, 
                paddingHorizontal: 16, 
                paddingVertical: 6,
                flexDirection: 'column',
                gap: 2
              } : activeSubEvent?.id === 'wedding-partners' && styles.visitorTabActive
            ]}
            onPress={() => setActiveSubEvent({ id: 'wedding-partners', title: 'Wedding Partners' } as any)}
          >
            <Text style={[
              styles.visitorTabText,
              { color: isRoyal ? selectedTemplate.muted : MidnightColors.gold },
              selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
              activeSubEvent?.id === 'wedding-partners' && (isRoyal ? { color: '#fff' } : styles.visitorTabTextActive)
            ]}>
              Wedding Partners <Text style={{ fontSize: 10 }}>🤝</Text>
            </Text>

            {isRoyal && activeSubEvent?.id === 'wedding-partners' && (
              <View style={{ alignItems: 'center', marginTop: 3 }}>
                <View style={{ width: 28, height: 1.5, backgroundColor: selectedTemplate.accent }} />
                <Text style={{ fontSize: 6, color: selectedTemplate.accent, marginTop: 1 }}>♦</Text>
              </View>
            )}
          </TouchableOpacity>


        </ScrollView>
      </View>
    );
  };

  // ── ROYAL ORNAMENTAL DIVIDER ──
  const renderRoyalDivider = () => {
    if (selectedTemplate.id !== 'royal') return null;
    return (
      <View style={styles.royalDividerContainer}>
        <View style={[styles.royalDividerLine, { backgroundColor: selectedTemplate.accent }]} />
        <Text style={[styles.royalDividerDiamond, { color: selectedTemplate.accent }]}>♦</Text>
        <View style={[styles.royalDividerLine, { backgroundColor: selectedTemplate.accent }]} />
      </View>
    );
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: selectedTemplate.background }]}>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          headerTransparent: true, 
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.replace('/(tabs)/gallery')}
              style={[
                styles.floatingBack,
                { marginTop: Platform.OS === 'ios' ? 44 : 10 },
                (!showAdminView && event?.templateId === 'royal') && {
                  marginLeft: 24,
                  marginTop: 36,
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  borderColor: selectedTemplate.accent,
                  backgroundColor: 'rgba(0,0,0,0.15)',
                }
              ]}
              hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
            >
              <IconSymbol name="chevron.left" size={28} color={selectedTemplate.accent} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity 
              style={[
                styles.floatingBack,
                { marginTop: Platform.OS === 'ios' ? 44 : 10, marginRight: 16 },
                (!showAdminView && event?.templateId === 'royal') && {
                  marginRight: 24,
                  marginTop: 36,
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  borderColor: selectedTemplate.accent,
                  backgroundColor: 'rgba(0,0,0,0.15)',
                }
              ]} 
              onPress={() => setShowShareModal(true)}
              hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
            >
              <IconSymbol name="square.and.arrow.up" size={20} color={selectedTemplate.accent} />
            </TouchableOpacity>
          )
        }} 
      />

      <ScrollView 
        ref={scrollViewRef}
        style={[styles.container, { backgroundColor: selectedTemplate.background }]} 
        bounces={false} 
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        stickyHeaderIndices={!showAdminView ? [1] : undefined}
      >
        {/* ── HERO ── */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image source={{ uri: activeSubEvent?.coverImage || event.coverImage }} style={styles.heroImage} />
          <LinearGradient
            colors={selectedTemplate.overlay as [string, string]}
            style={styles.heroGradient}
          />





          {showAdminView && (
            <TouchableOpacity style={styles.editCoverBtn} onPress={handleChangeCover} disabled={updating}>
              <IconSymbol name="camera.fill" size={16} color="#fff" />
              <Text style={styles.editCoverText}>{updating ? 'Updating...' : 'Change Cover'}</Text>
            </TouchableOpacity>
          )}
          
          {(!showAdminView && event?.templateId === 'royal') ? (
            <View style={styles.royalHeroOverlay}>
              {/* 1. Elegant Thin Inset Frame */}
              <View style={[styles.royalFrame, { borderColor: selectedTemplate.accent }]} />

              {/* 2. Centered Text & Button */}
              <View style={styles.royalCenterContent}>
                <Text style={[styles.royalTitle, { color: '#fff' }]}>
                  {(activeSubEvent?.title || event.title).toUpperCase()}
                </Text>

                <Text style={[styles.royalDateText, { color: selectedTemplate.accent }]}>
                  {(activeSubEvent?.date || event.date || '').toUpperCase()}
                </Text>

                <TouchableOpacity 
                  style={[styles.royalButton, { borderColor: selectedTemplate.accent }]}
                  onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                >
                  <Text style={[styles.royalButtonText, { color: selectedTemplate.text }]}>MY PHOTOS</Text>
                </TouchableOpacity>
              </View>

              {/* 3. Bottom Brand/Logo and Chevron */}
              <View style={styles.royalBottomContent}>
                <View style={styles.brandLogoContainer}>
                  <Text style={[styles.royalBrandLogoScript, { color: '#fff', fontSize: 13, opacity: 0.8 }]}>Delivered by</Text>
                  <Text style={[styles.royalBrandSubText, { color: selectedTemplate.accent, fontSize: 16, marginTop: 2, letterSpacing: 2 }]}>Wed Album</Text>
                  <Text style={[styles.royalBrandLogoScript, { color: '#fff', fontSize: 12, marginTop: 4, opacity: 0.8, fontStyle: 'normal' }]}>with love ❤️</Text>
                </View>

                {/* Downward Chevron */}
                <TouchableOpacity 
                  onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  style={styles.royalChevron}
                >
                  <IconSymbol name="chevron.down" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.heroContent}>
              <View style={styles.titleRowMain}>
                <Text style={[
                  styles.heroTitle, 
                  { color: selectedTemplate.text, flex: 1 },
                  selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' }
                ]}>
                  {activeSubEvent?.title || event.title}
                </Text>
                {showAdminView && !activeSubEvent && (
                  <TouchableOpacity 
                    style={styles.renameHeroBtn}
                    onPress={() => {
                      setEditTitle(event.title);
                      setShowRenameModal(true);
                    }}
                  >
                    <IconSymbol name="pencil" size={22} color={MidnightColors.gold} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.heroMeta}>
                <IconSymbol name="calendar" size={12} color={selectedTemplate.accent} />
                <Text style={[
                  styles.heroDate, 
                  { color: selectedTemplate.accent },
                  selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic', letterSpacing: 2 }
                ]}>{activeSubEvent?.date || event.date}</Text>
                {showAdminView && !activeSubEvent && (
                  <TouchableOpacity 
                    style={styles.editDateBtn}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <IconSymbol name="pencil" size={12} color={selectedTemplate.accent} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.heroMeta, { marginTop: 12 }]} 
                onPress={handleShare}
              >
                <IconSymbol name="square.and.arrow.up" size={12} color={selectedTemplate.accent} />
                <Text style={[styles.heroDate, { color: selectedTemplate.accent }]}>Share Event</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Visitor Navigation Tabs placed BELOW the Cover Photo screen */}
        {!showAdminView && renderVisitorHeader()}

        {/* ── CONTENT ── */}
        <View style={[styles.content, showAdminView && { paddingBottom: 60 + insets.bottom }]}>
          {showAdminView ? (
            <>
              {/* Owner Tabs */}
              <View style={styles.tabBar}>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'galleries' && styles.activeTab]} 
                  onPress={() => { setActiveTab('galleries'); setSelectedAdminGallery(undefined); }}
                >
                  <Text style={[styles.tabText, activeTab === 'galleries' && styles.activeTabText]}>Galleries</Text>
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
                  onPress={() => { setActiveTab('design'); setSelectedAdminGallery(undefined); }}
                >
                  <Text style={[styles.tabText, activeTab === 'design' && styles.activeTabText]}>Design</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'partners' && styles.activeTab]} 
                  onPress={() => { setActiveTab('partners'); setSelectedAdminGallery(undefined); }}
                >
                  <Text style={[styles.tabText, activeTab === 'partners' && styles.activeTabText]}>Partners</Text>
                </TouchableOpacity>
              </View>

              {activeTab === 'galleries' && (
                <View style={styles.section}>
                  {selectedAdminGallery === undefined ? (
                    // ── GALLERY CARDS LIST ──
                    <>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Galleries</Text>
                        <TouchableOpacity style={styles.addBtn} onPress={() => setShowSubEventModal(true)}>
                          <IconSymbol name="plus" size={14} color={MidnightColors.gold} />
                          <Text style={styles.addBtnText}>Add Gallery</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.subGrid}>
                        {/* Home Gallery Card */}
                        {event && (
                          <TouchableOpacity 
                            style={[styles.subCard, { borderColor: selectedTemplate.accent, borderWidth: 1, backgroundColor: 'rgba(204,164,59,0.05)' }]}
                            onPress={() => {
                              loadPhotos(event.id, event.legacyId);
                              setGalleryDescText(event.description || '');
                              setSelectedAdminGallery(null);
                            }}
                          >
                            <Image source={{ uri: event.coverImage }} style={styles.subImage} />
                            <View style={styles.subInfo}>
                              <Text style={[styles.subTitle, { color: selectedTemplate.accent, fontWeight: 'bold' }]} numberOfLines={1}>🏠 Home</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                        {subEvents.map((sub) => (
                          <TouchableOpacity 
                            key={sub.id} 
                            style={styles.subCard}
                            onPress={() => {
                              loadPhotos(sub.id, sub.legacyId);
                              setGalleryDescText(sub.description || '');
                              setSelectedAdminGallery(sub);
                            }}
                          >
                            <Image source={{ uri: sub.coverImage }} style={styles.subImage} />
                            <View style={styles.subInfo}>
                              <Text style={styles.subTitle} numberOfLines={1}>{sub.title}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Delete Event */}
                      <TouchableOpacity style={styles.deleteMainBtn} onPress={handleDeleteMainEvent}>
                        <IconSymbol name="trash.fill" size={16} color="#ef4444" />
                        <Text style={styles.deleteMainText}>Delete Event</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    // ── INLINE GALLERY MANAGER ──
                    <>
                      {/* Header with back button */}
                      <View style={[styles.sectionHeader, { marginBottom: 16 }]}>
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                          onPress={() => setSelectedAdminGallery(undefined)}
                        >
                          <IconSymbol name="chevron.left" size={18} color={MidnightColors.gold} />
                          <Text style={{ color: MidnightColors.gold, fontSize: 14, fontWeight: '600' }}>Galleries</Text>
                        </TouchableOpacity>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                            {selectedAdminGallery === null ? '🏠 Home' : selectedAdminGallery.title}
                          </Text>
                          <TouchableOpacity
                            style={{ backgroundColor: 'rgba(204,164,59,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: MidnightColors.gold, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            onPress={async () => {
                              const targetId = selectedAdminGallery === null ? event!.id : selectedAdminGallery.id;
                              const result = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                allowsEditing: true,
                                aspect: [16, 9],
                                quality: 0.8,
                              });
                              if (!result.canceled) {
                                setUpdating(true);
                                try {
                                  const file = { uri: result.assets[0].uri, name: 'cover.jpg', type: 'image/jpeg' } as any;
                                  const upload = await uploadEventImage(file, event!.id, user?.uid || 'anon');
                                  await updateEvent(targetId, { coverImage: upload.url });
                                  loadEvent(); 
                                  Alert.alert("Success", "Cover image updated!");
                                } catch (err) {
                                  Alert.alert("Error", "Failed to update cover.");
                                } finally {
                                  setUpdating(false);
                                }
                              }
                            }}
                          >
                            <IconSymbol name="camera.fill" size={12} color={MidnightColors.gold} />
                            <Text style={{ color: MidnightColors.gold, fontSize: 11, fontWeight: '600' }}>Change Cover</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Welcome Message Editor */}
                      <View style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 }}>Welcome Message</Text>
                          <Text style={{ color: (galleryDescText?.length || 0) >= 200 ? '#ef4444' : 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                            {galleryDescText?.length || 0}/200
                          </Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(204,164,59,0.25)', overflow: 'hidden' }}>
                          <TextInput
                            style={{ color: '#ffffff', fontSize: 14, lineHeight: 22, minHeight: 60, maxHeight: 100, padding: 12, textAlignVertical: 'top' }}
                            value={galleryDescText}
                            onChangeText={setGalleryDescText}
                            placeholder="Write a brief, elegant welcome note..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            multiline
                            maxLength={200}
                          />
                          <View style={{ backgroundColor: 'rgba(204,164,59,0.05)', borderTopWidth: 1, borderColor: 'rgba(204,164,59,0.1)', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                            {(() => {
                              const originalDesc = (selectedAdminGallery === null ? event!.description : selectedAdminGallery.description) || '';
                              const isChanged = galleryDescText !== originalDesc;
                              
                              if (isChanged) {
                                return (
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                    onPress={async () => {
                                      const targetId = selectedAdminGallery === null ? event!.id : selectedAdminGallery.id;
                                      const { updateEvent } = await import('@/lib/firestore');
                                      await updateEvent(targetId, { description: galleryDescText });
                                      
                                      if (selectedAdminGallery === null) {
                                        event!.description = galleryDescText;
                                      } else {
                                        selectedAdminGallery.description = galleryDescText;
                                      }
                                      
                                      Alert.alert('Saved', 'Welcome message updated.');
                                    }}
                                  >
                                    <IconSymbol name="checkmark" size={12} color={MidnightColors.gold} />
                                    <Text style={{ color: MidnightColors.gold, fontWeight: '600', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Save</Text>
                                  </TouchableOpacity>
                                );
                              } else {
                                return (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.5 }} pointerEvents="none">
                                    <IconSymbol name="pencil" size={12} color={'#cbd5e1'} />
                                    <Text style={{ color: '#cbd5e1', fontWeight: '600', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Edit</Text>
                                  </View>
                                );
                              }
                            })()}
                          </View>
                        </View>
                      </View>

                      {/* Photo Grid Header */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={styles.sectionTitle}>
                          Photos ({photos.length})
                        </Text>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(204,164,59,0.12)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: MidnightColors.gold }}
                          onPress={handleUploadGalleryPhoto}
                        >
                          <IconSymbol name="plus" size={13} color={MidnightColors.gold} />
                          <Text style={{ color: MidnightColors.gold, fontSize: 12, fontWeight: '600' }}>Add Photo</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Photo Grid */}
                      {loadingPhotos ? (
                        <ActivityIndicator color={MidnightColors.gold} style={{ marginTop: 24 }} />
                      ) : photos.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                          <IconSymbol name="photo.on.rectangle" size={36} color={MidnightColors.slate700} />
                          <Text style={{ color: MidnightColors.slate400, marginTop: 10, fontSize: 14 }}>No photos yet. Tap Add Photo!</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {photos.map((photo) => (
                            <View key={photo.id} style={{ position: 'relative' }}>
                              <Image
                                source={{ uri: photo.url }}
                                style={{ width: (SCREEN_WIDTH - 76) / 3, height: (SCREEN_WIDTH - 76) / 3, borderRadius: 10 }}
                                resizeMode="contain"
                              />
                              <TouchableOpacity
                                style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(239,68,68,0.9)', alignItems: 'center', justifyContent: 'center' }}
                                onPress={() => handleDeleteGalleryPhoto(photo.id)}
                              >
                                <IconSymbol name="trash.fill" size={10} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}
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
                                {log.canComment && <View style={styles.miniIcon}><IconSymbol name={"bubble.left.fill" as any} size={8} color={MidnightColors.gold} /></View>}
                                {log.canChat && <View style={styles.miniIcon}><IconSymbol name={"message.fill" as any} size={8} color={MidnightColors.gold} /></View>}
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
                <View style={styles.premiumModalBackdrop}>
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
                <View style={styles.premiumModalBackdrop}>
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
                      <Text style={styles.designLabel}>Event Type</Text>
                      <Text style={styles.designValue}>{event.category || 'Select Type'}</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={20} color={MidnightColors.gold} />
                  </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.designCard, { marginTop: 16 }]} 
                      onPress={() => setShowTemplateModal(true)}
                    >
                      <View style={styles.designInfo}>
                        <Text style={styles.designLabel}>Change Template</Text>
                        <Text style={styles.designValue}>{event.templateId ? MOBILE_TEMPLATE_THEMES.find(t => t.id === event.templateId)?.label : 'Hero (Default)'}</Text>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={MidnightColors.gold} />
                    </TouchableOpacity>
                </View>
              )}

              {activeTab === 'partners' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Wedding Partners</Text>
                  
                  {linkedVendors.length === 0 && (
                    <View style={{ 
                      backgroundColor: 'rgba(30, 41, 59, 0.4)', 
                      borderRadius: 20, 
                      paddingVertical: 20, 
                      paddingHorizontal: 16, 
                      alignItems: 'center', 
                      borderWidth: 1, 
                      borderColor: 'rgba(204, 164, 59, 0.2)',
                    }}>
                      <Text style={{ 
                        color: '#fff', 
                        fontSize: 14, 
                        fontFamily: Fonts.outfit.bold,
                        textTransform: 'uppercase',
                        letterSpacing: 1.5,
                        marginBottom: 8 
                      }}>Partner Management</Text>
                      
                      <Text style={{ 
                        color: '#cbd5e1', 
                        fontSize: 13, 
                        textAlign: 'center', 
                        lineHeight: 20, 
                        paddingHorizontal: 12,
                        fontFamily: Fonts.inter.regular,
                      }}>
                        Connect photographers, makeup artists, and venues to your event page using their unique Vendor Code.
                      </Text>
                      
                      <TouchableOpacity 
                        style={{ 
                          marginTop: 18, 
                          backgroundColor: MidnightColors.gold, 
                          paddingHorizontal: 28, 
                          paddingVertical: 10, 
                          borderRadius: 24,
                        }}
                        onPress={() => setLinkingVendor(true)}
                      >
                        <Text style={{ color: '#000', fontFamily: Fonts.outfit.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Link a Vendor</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {linkedVendors.length > 0 && (
                    <View style={{ marginTop: 28, paddingHorizontal: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <Text style={{ 
                          color: '#cbd5e1', 
                          fontSize: 11, 
                          fontFamily: Fonts.inter.bold, 
                          textTransform: 'uppercase', 
                          letterSpacing: 1.2 
                        }}>Linked Partners</Text>
                        
                        {!linkingVendor && (
                          <TouchableOpacity 
                            style={{ 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              gap: 6,
                              backgroundColor: 'rgba(204, 164, 59, 0.12)', 
                              borderRadius: 12, 
                              paddingHorizontal: 12, 
                              paddingVertical: 6, 
                              borderWidth: 1, 
                              borderColor: MidnightColors.gold 
                            }}
                            onPress={() => setLinkingVendor(true)}
                          >
                            <IconSymbol name="plus" size={12} color={MidnightColors.gold} />
                            <Text style={{ color: MidnightColors.gold, fontSize: 11, fontFamily: Fonts.outfit.bold, textTransform: 'uppercase', letterSpacing: 0.5 }}>Link Partner</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      
                      <View style={{ gap: 12 }}>
                        {linkedVendors.map((biz) => (
                          <View key={biz.id} style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            backgroundColor: 'rgba(30, 41, 59, 0.3)', 
                            paddingHorizontal: 16,
                            paddingVertical: 12, 
                            borderRadius: 16, 
                            borderWidth: 1, 
                            borderColor: 'rgba(255, 255, 255, 0.05)',
                          }}>
                            <Image 
                              source={{ uri: biz.coverImage || 'https://via.placeholder.com/150' }} 
                              style={{ 
                                width: 44, 
                                height: 44, 
                                borderRadius: 22, 
                                marginRight: 14, 
                                backgroundColor: 'rgba(255, 255, 255, 0.05)' 
                              }} 
                            />
                            
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 15, fontFamily: Fonts.outfit.bold }}>{biz.name}</Text>
                              <Text style={{ color: MidnightColors.slate400, fontSize: 12, fontFamily: Fonts.inter.medium, marginTop: 2 }}>{biz.type}</Text>
                            </View>
                            
                            <TouchableOpacity
                              style={{ 
                                padding: 8, 
                                backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: 'rgba(239, 68, 68, 0.15)',
                              }}
                              onPress={async () => {
                                const newVendors = event?.vendors?.filter(vid => vid !== biz.id) || [];
                                await updateEvent(event!.id, { vendors: newVendors });
                                setEvent({ ...event!, vendors: newVendors });
                                setLinkedVendors(linkedVendors.filter(v => v.id !== biz.id));
                              }}
                            >
                              <IconSymbol name="trash.fill" size={14} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </>
          ) : (
            <>
              {/* ── VISITOR IMMERSIVE CONTENT ── */}
              <View style={[styles.visitorContent, { backgroundColor: selectedTemplate.background }]}>
                {event.showWelcomeCard !== false && activeSubEvent?.id !== 'wedding-partners' && (
                  <View style={[
                    styles.mainInfoBox, 
                    { backgroundColor: selectedTemplate.panel, borderColor: selectedTemplate.accentBg },
                    event.templateId === 'royal' && { 
                      borderWidth: 1, 
                      borderColor: 'rgba(204, 164, 59, 0.35)', 
                      borderRadius: 12,
                      padding: 10,
                      borderLeftWidth: 1, // override dynamic left border stripe
                    }
                  ]}>
                    <View style={[
                      event.templateId === 'royal' && {
                        borderWidth: 1,
                        borderColor: 'rgba(204, 164, 59, 0.15)',
                        borderRadius: 8,
                        paddingVertical: 20,
                        paddingHorizontal: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      },
                      { position: 'relative' }
                    ]}>
                      {event.templateId === 'royal' && (
                        <Text style={{ color: selectedTemplate.accent, fontSize: 10, marginBottom: 12 }}>✦  ♦  ✦</Text>
                      )}

                      <Text style={[
                        styles.visitorDescription, 
                        { color: event.templateId === 'royal' ? selectedTemplate.accent : selectedTemplate.text },
                        selectedTemplate.useSerif && { 
                          fontFamily: Fonts.serif, 
                          fontStyle: 'italic', 
                          fontSize: 16, 
                          lineHeight: 26,
                          textAlign: 'center',
                        }
                      ]}>{activeSubEvent ? activeSubEvent.description : event.description} 🤍</Text>




                    </View>
                  </View>
                )}

                {renderRoyalDivider()}

                {activeSubEvent?.id === 'wedding-partners' ? (
                  <View style={{ paddingVertical: 40, paddingHorizontal: 20 }}>
                    <View style={{ alignItems: 'center', marginBottom: 32 }}>
                      <Text style={[
                        { fontSize: 28, color: selectedTemplate.text, marginBottom: 8 },
                        selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic' }
                      ]}>The Dream Team</Text>
                      <Text style={{ fontSize: 14, color: selectedTemplate.muted, textAlign: 'center', lineHeight: 22, maxWidth: '80%' }}>
                        The incredible businesses and vendors who brought this beautiful wedding to life.
                      </Text>
                    </View>
                    
                    {linkedVendors.length === 0 ? (
                      <View style={{ alignItems: 'center', paddingVertical: 40, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                         <IconSymbol name="building.2" size={32} color={selectedTemplate.accent} />
                         <Text style={{ color: selectedTemplate.muted, marginTop: 16, fontSize: 15, fontWeight: '500' }}>Vendor list coming soon...</Text>
                      </View>
                    ) : (
                      <View style={{ gap: 16 }}>
                        {linkedVendors.map((biz) => (
                          <TouchableOpacity 
                            key={biz.id} 
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                            onPress={() => router.push(`/business/${biz.id}`)}
                          >
                            <Image source={{ uri: biz.coverImage || 'https://via.placeholder.com/150' }} style={{ width: 64, height: 64, borderRadius: 32, marginRight: 16, borderWidth: 1, borderColor: selectedTemplate.accent }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: selectedTemplate.text, fontSize: 18, fontWeight: '600', marginBottom: 4 }}>{biz.name}</Text>
                              <Text style={{ color: selectedTemplate.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' }}>{biz.type}</Text>
                            </View>
                            <IconSymbol name="chevron.right" size={20} color={selectedTemplate.muted} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                <View style={[styles.galleryHeader, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16 }]}>
                  <View>
                    <Text style={[
                      styles.galleryTitle, 
                      { color: selectedTemplate.text },
                      selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' }
                    ]}>
                      {activeSubEvent ? activeSubEvent.title : 'Highlights'}
                    </Text>
                    <Text style={[
                      styles.photoCount, 
                      { color: selectedTemplate.accent },
                      selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic' }
                    ]}>
                      {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
                    </Text>
                  </View>


                </View>

                {loadingPhotos ? (
                  <View style={styles.photoLoading}>
                    <ActivityIndicator color={selectedTemplate.accent} />
                  </View>
                ) : (
                  <View style={styles.photoGrid}>
                    {photos.length === 0 ? (
                      <View style={styles.emptyGallery}>
                        <IconSymbol name="photo.on.rectangle" size={40} color="rgba(255,255,255,0.05)" />
                        <Text style={styles.emptyText}>No photos yet.</Text>
                      </View>
                    ) : (
                      photos.map((photo, i) => {
                        const ratio = photo.width && photo.height 
                          ? photo.height / photo.width 
                          : (i % 3 === 0 ? 1.25 : (i % 3 === 1 ? 0.95 : 1.45));

                        return (
                          <Animated.View
                            key={photo.id}
                            entering={FadeInUp.delay(i * 80).duration(600).springify().damping(14)}
                            style={[
                              styles.photoCard,
                              {
                                aspectRatio: 1 / ratio,
                              }
                            ]}
                          >
                            <TouchableOpacity 
                              style={{ flex: 1 }}
                              activeOpacity={0.9}
                              onPress={() => openViewer(i)}
                            >
                              <View style={[
                                styles.photoTile, 
                                {
                                  backgroundColor: selectedTemplate.tileBg,
                                  borderRadius: selectedTemplate.radius,
                                  borderWidth: event.templateId === 'polaroid' || event.templateId === 'museum' || event.templateId === 'brutalist' || event.templateId === 'royal' ? 1 : 0,
                                  borderColor: event.templateId === 'royal' ? selectedTemplate.accent : selectedTemplate.accentBg,
                                  padding: event.templateId === 'polaroid' ? 5 : (event.templateId === 'royal' ? 4 : 0),
                                },
                                event.templateId === 'royal' && {
                                  shadowColor: selectedTemplate.accent,
                                  shadowOffset: { width: 0, height: 2 },
                                  shadowOpacity: 0.15,
                                  shadowRadius: 4,
                                  elevation: 2,
                                }
                              ]}>
                                <Image source={{ uri: photo.url }} style={styles.galleryImg} resizeMode="cover" />
                              </View>
                            </TouchableOpacity>
                          </Animated.View>
                        );
                      })
                    )}
                  </View>
                )}
                </>
                )}

                {renderRoyalDivider()}

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

      {/* ── IMAGE VIEWER MODAL ── */}
      <Modal
        visible={viewerVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.viewerContainer}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)}>
            <IconSymbol name="xmark" size={28} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navBtnLeft} onPress={() => navigateViewer('prev')}>
            <IconSymbol name="chevron.left" size={32} color="#fff" />
          </TouchableOpacity>
          
          {photos[currentPhotoIndex] && (
            <Image 
              source={{ uri: photos[currentPhotoIndex].url }} 
              style={[styles.fullImage, showComments && styles.fullImageWithComments]} 
              resizeMode="contain" 
            />
          )}
          
          <TouchableOpacity style={styles.navBtnRight} onPress={() => navigateViewer('next')}>
            <IconSymbol name="chevron.right" size={32} color="#fff" />
          </TouchableOpacity>
          
          <View style={[styles.viewerActions, showComments ? styles.viewerActionsRaised : styles.viewerActionsDocked]}>
            <TouchableOpacity style={styles.viewerAction} onPress={handleToggleLike} disabled={isLiking}>
              <IconSymbol name={isLiked ? "heart.fill" : "heart"} size={30} color={isLiked ? "#f43f5e" : "#ffffff"} />
              <Text style={styles.viewerActionCount}>{likes.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.viewerAction} onPress={() => setShowComments(true)}>
              <IconSymbol name="bubble.right" size={30} color={showComments ? MidnightColors.gold : "#ffffff"} />
              <Text style={styles.viewerActionCount}>{comments.length}</Text>
            </TouchableOpacity>
          </View>

          {!showComments && (
            <View style={styles.viewerFooter}>
              <Text style={styles.viewerText}>{currentPhotoIndex + 1} / {photos.length}</Text>
            </View>
          )}

          {showComments && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.guestbookPanel}>
              <View style={styles.guestbookHeader}>
                <View>
                  <Text style={[
                    styles.guestbookTitle,
                    selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontWeight: 'bold' }
                  ]}>Guestbook</Text>
                  <Text style={[
                    styles.guestbookSubtitle,
                    selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic' }
                  ]}>{comments.length} Shared Thoughts</Text>
                </View>
                <TouchableOpacity style={styles.closeGuestbookBtn} onPress={() => setShowComments(false)}>
                  <IconSymbol name="xmark" size={18} color="#57534e" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.guestbookList} contentContainerStyle={styles.guestbookListContent}>
                {comments.length === 0 ? (
                  <View style={styles.emptyGuestbook}>
                    <View style={styles.emptyGuestbookIcon}>
                      <IconSymbol name="bubble.right" size={30} color="#78716c" />
                    </View>
                    <Text style={[
                      styles.emptyGuestbookTitle,
                      selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic', fontSize: 18 }
                    ]}>No whispers yet...</Text>
                    <Text style={[
                      styles.emptyGuestbookText,
                      selectedTemplate.useSerif && { fontFamily: Fonts.serif, fontStyle: 'italic' }
                    ]}>Write the first beautiful word.</Text>
                  </View>
                ) : (
                  comments.filter((comment) => !comment.parentId).map((comment) => {
                    const replies = comments.filter((reply) => reply.parentId === comment.id);
                    return (
                      <View key={comment.id} style={styles.commentThread}>
                        <View style={styles.commentItem}>
                          <View style={[
                            styles.commentAvatar,
                            selectedTemplate.id === 'royal' && { backgroundColor: selectedTemplate.accentBg, borderWidth: 1, borderColor: selectedTemplate.accent }
                          ]}>
                            <Text style={[
                              styles.commentAvatarText,
                              selectedTemplate.id === 'royal' && { color: selectedTemplate.accent, fontFamily: Fonts.serif, fontWeight: 'bold' }
                            ]}>{comment.userName?.charAt(0) || 'G'}</Text>
                          </View>
                          <View style={styles.commentContent}>
                            <View style={styles.commentRow}>
                              <Text style={[
                                styles.commentName,
                                selectedTemplate.id === 'royal' && { fontFamily: Fonts.serif, color: selectedTemplate.text }
                              ]} numberOfLines={1}>{comment.userName || 'Guest'}</Text>
                              <Text style={styles.commentTime}>
                                {comment.createdAt ? new Date(comment.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                              </Text>
                            </View>
                            <View style={[
                              styles.commentBubble,
                              selectedTemplate.id === 'royal' && { borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', backgroundColor: 'rgba(212,175,55,0.04)' }
                            ]}>
                              <Text style={[
                                styles.commentText,
                                selectedTemplate.id === 'royal' && { color: selectedTemplate.text, fontFamily: Fonts.serif }
                              ]}>{comment.text}</Text>
                              <View style={styles.commentActions}>
                                <TouchableOpacity onPress={() => setReplyingTo(comment)}>
                                  <Text style={styles.replyBtnText}>REPLY</Text>
                                </TouchableOpacity>
                                {comment.userId === viewerIdentity.id && (
                                  <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                                    <Text style={styles.deleteBtnText}>DELETE</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        </View>

                        {replies.map((reply) => (
                          <View key={reply.id} style={styles.replyItem}>
                            <View style={[
                              styles.replyAvatar,
                              selectedTemplate.id === 'royal' && { backgroundColor: selectedTemplate.accentBg, borderWidth: 1, borderColor: selectedTemplate.accent }
                            ]}>
                              <Text style={[
                                styles.replyAvatarText,
                                selectedTemplate.id === 'royal' && { color: selectedTemplate.accent, fontFamily: Fonts.serif, fontWeight: 'bold' }
                              ]}>{reply.userName?.charAt(0) || 'G'}</Text>
                            </View>
                            <View style={styles.commentContent}>
                              <View style={styles.commentRow}>
                                <Text style={[
                                  styles.replyName,
                                  selectedTemplate.id === 'royal' && { fontFamily: Fonts.serif, color: selectedTemplate.text }
                                ]} numberOfLines={1}>{reply.userName || 'Guest'}</Text>
                                <Text style={styles.commentTime}>
                                  {reply.createdAt ? new Date(reply.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                </Text>
                              </View>
                              <View style={[
                                styles.replyBubble,
                                selectedTemplate.id === 'royal' && { borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', backgroundColor: 'rgba(212,175,55,0.04)' }
                              ]}>
                                <Text style={[
                                  styles.replyText,
                                  selectedTemplate.id === 'royal' && { color: selectedTemplate.text, fontFamily: Fonts.serif }
                                ]}>{reply.text}</Text>
                                {reply.userId === viewerIdentity.id && (
                                  <TouchableOpacity onPress={() => handleDeleteComment(reply.id)}>
                                    <Text style={[styles.deleteBtnText, styles.replyDeleteText]}>DELETE</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.commentComposer}>
                {replyingTo && (
                  <View style={styles.replyingToBanner}>
                    <Text style={styles.replyingToText}>Replying to <Text style={styles.replyingToName}>{replyingTo.userName}</Text></Text>
                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                      <IconSymbol name="xmark" size={14} color="#78716c" />
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder={replyingTo ? "Write a reply..." : "Share a wish..."}
                    placeholderTextColor="#78716c"
                    value={newComment}
                    onChangeText={setNewComment}
                  />
                  <TouchableOpacity style={[styles.commentSendBtn, (!newComment.trim() || isCommenting) && styles.commentSendBtnDisabled]} onPress={handleAddComment} disabled={!newComment.trim() || isCommenting}>
                    <IconSymbol name="paperplane.fill" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </Modal>

      <Modal visible={showTemplateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowTemplateModal(false)} 
          />
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Choose Style</Text>
                <Text style={styles.templateModalSub}>Select a design template for this {event?.category || 'Wedding'} event.</Text>
              </View>
              <TouchableOpacity 
                style={styles.closeModalCircle} 
                onPress={() => setShowTemplateModal(false)}
              >
                <IconSymbol name="xmark" size={20} color={MidnightColors.gold} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {MOBILE_TEMPLATE_THEMES.filter(t => t.category === (event?.category || 'Wedding')).map((template, index) => {
                const isActive = (event?.templateId || 'hero') === template.id;
                return (
                  <TouchableOpacity 
                    key={template.id} 
                    style={[
                      styles.templateOptionCard,
                      { borderColor: isActive ? template.accent : 'rgba(255,255,255,0.1)' }
                    ]}
                    onPress={() => handleUpdateTemplate(template.id)}
                  >
                    <View style={[styles.templatePreview, { backgroundColor: isDark ? template.background.dark : template.background.light }]}>
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />
                      <Text style={[styles.templatePreviewLabel, { color: template.accent }]}>Template {index + 1}</Text>
                      <Text style={[styles.templatePreviewTitle, { color: isDark ? template.text.dark : template.text.light }]}>{template.label}</Text>
                    </View>
                    <View style={styles.templateMeta}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.templateText}>{template.label}</Text>
                        <Text style={styles.templateDesc}>{template.desc}</Text>
                      </View>
                      {isActive && (
                        <View style={[styles.templateCheck, { backgroundColor: template.accent }]}>
                          <IconSymbol name="checkmark" size={14} color="#000" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {MOBILE_TEMPLATE_THEMES.length === 0 && (
                <Text style={{ color: '#fff', textAlign: 'center', marginTop: 20 }}>No templates available.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── RENAME EVENT MODAL ── */}
      <Modal visible={showRenameModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowRenameModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename Event</Text>
            <TextInput 
              style={styles.input} 
              value={editTitle} 
              onChangeText={setEditTitle} 
              placeholder="Event Name" 
              placeholderTextColor={MidnightColors.slate400}
              autoFocus
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleRenameEvent} disabled={updating}>
              <Text style={styles.submitBtnText}>{updating ? 'Updating...' : 'Save Name'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── EDIT GALLERY DESCRIPTION MODAL ── */}
      <Modal visible={galleryDescModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setGalleryDescModalVisible(false)} 
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Gallery Message</Text>
                <Text style={styles.headerGreeting}>
                  For: {activeSubEvent ? activeSubEvent.title : 'Home Gallery'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setGalleryDescModalVisible(false)}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gallery Welcome Message</Text>
                <TextInput 
                  style={[styles.input, { minHeight: 120, textAlignVertical: 'top', padding: 12, backgroundColor: MidnightColors.deepSlate, borderRadius: 8, color: '#fff' }]} 
                  value={galleryDescText} 
                  onChangeText={setGalleryDescText} 
                  placeholder="Write a beautiful welcome message for this gallery..." 
                  placeholderTextColor={MidnightColors.slate700}
                  multiline
                  numberOfLines={5}
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: selectedTemplate.accent, marginTop: 12 }]} 
                onPress={handleSaveGalleryDesc}
              >
                <Text style={[styles.submitBtnText, { color: '#000', fontWeight: 'bold' }]}>Save Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── DATE PICKER ── */}
      {showDatePicker && (
        <DateTimePicker
          value={event.date ? new Date(event.date) : new Date()}
          mode="date"
          display="spinner"
          onChange={handleDateChange}
        />
      )}
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

      {/* ── LINK VENDOR MODAL ── */}
      <Modal visible={linkingVendor} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => { setLinkingVendor(false); setVendorCode(''); }} 
          />
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { borderBottomWidth: 0, paddingBottom: 8 }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ 
                  fontSize: 18, 
                  color: '#ffffff', 
                  fontFamily: Fonts.outfit.bold, 
                  textTransform: 'uppercase', 
                  letterSpacing: 1.2
                }}>Link a Partner</Text>
                <Text style={{ 
                  fontSize: 12, 
                  color: '#94a3b8', 
                  fontFamily: Fonts.inter.regular, 
                  marginTop: 4, 
                  lineHeight: 18
                }}>
                  Connect photographers, makeup artists, and venues from the Biz Hub.
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setLinkingVendor(false); setVendorCode(''); }}>
                <IconSymbol name={"xmark.circle.fill" as any} size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={{ 
                  fontSize: 11, 
                  color: '#cbd5e1', 
                  fontFamily: Fonts.inter.bold, 
                  textTransform: 'uppercase', 
                  letterSpacing: 1.2, 
                  marginBottom: 8 
                }}>Enter Vendor Code</Text>
                <TextInput
                  style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                    color: MidnightColors.gold, 
                    fontSize: 18, 
                    borderRadius: 12, 
                    paddingHorizontal: 16, 
                    paddingVertical: 14, 
                    borderWidth: 1, 
                    borderColor: 'rgba(204, 164, 59, 0.4)', 
                    marginBottom: 16,
                    textAlign: 'center',
                    fontFamily: Fonts.outfit.bold,
                    letterSpacing: 2,
                  }}
                  value={vendorCode}
                  onChangeText={(text) => setVendorCode(text.toUpperCase())}
                  placeholder="e.g. VEN-1234"
                  placeholderTextColor={'#64748b'}
                  autoCapitalize="characters"
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <TouchableOpacity 
                  style={{ 
                    flex: 1, 
                    paddingVertical: 12, 
                    borderRadius: 20, 
                    borderWidth: 1, 
                    borderColor: 'rgba(255, 255, 255, 0.15)', 
                    alignItems: 'center' 
                  }}
                  onPress={() => { setLinkingVendor(false); setVendorCode(''); }}
                >
                  <Text style={{ color: '#cbd5e1', fontFamily: Fonts.outfit.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={{ 
                    flex: 1, 
                    backgroundColor: MidnightColors.gold, 
                    paddingVertical: 12, 
                    borderRadius: 20, 
                    alignItems: 'center', 
                    opacity: vendorCode.length > 3 ? 1 : 0.4,
                    shadowColor: MidnightColors.gold,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 6,
                    elevation: 3,
                  }}
                  disabled={vendorCode.length <= 3}
                  onPress={async () => {
                    const biz = await getBusinessByVendorCode(vendorCode);
                    if (biz) {
                      if (event?.vendors?.includes(biz.id)) {
                        Alert.alert("Already Linked", "This vendor is already linked to your event.");
                      } else {
                        const newVendors = [...(event?.vendors || []), biz.id];
                        await updateEvent(event!.id, { vendors: newVendors });
                        setEvent({ ...event!, vendors: newVendors });
                        setLinkedVendors([...linkedVendors, biz]);
                        Alert.alert("Vendor Linked!", `Successfully linked ${biz.name}. They will now appear on the Wedding Partners page.`);
                        setLinkingVendor(false);
                        setVendorCode('');
                      }
                    } else {
                      Alert.alert("Invalid Code", "No business found with this code. Please try again.");
                    }
                  }}
                >
                  <Text style={{ color: '#000', fontFamily: Fonts.outfit.bold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Submit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── CUSTOM BOTTOM APP NAV BAR (Only visible in Host/Management View) ── */}
      {showAdminView && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 55 + insets.bottom,
          backgroundColor: '#020617',
          flexDirection: 'row',
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 5 : 10,
          zIndex: 1000,
        }}>
          {/* TAB 1: Host (Active Gold since we are in Event Management) */}
          <TouchableOpacity 
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.8}
          >
            <IconSymbol size={28} name="calendar" color="#d4af37" />
            <Text style={{ color: '#d4af37', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 4 }}>Host</Text>
          </TouchableOpacity>

          {/* TAB 2: Biz Hub (Matches TabLayout Svg exactly) */}
          <TouchableOpacity 
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.replace('/(tabs)/businesses')}
            activeOpacity={0.8}
          >
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="m11 17 2 2a1 1 0 1 0 3-3"/>
              <Path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/>
              <Path d="m21 3 1 11h-2"/>
              <Path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/>
              <Path d="M3 4h8"/>
            </Svg>
            <Text style={{ color: '#94a3b8', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 4 }}>Biz Hub</Text>
          </TouchableOpacity>

          {/* TAB 3: Dashboard (Matches TabLayout Svg exactly) */}
          <TouchableOpacity 
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.replace('/(tabs)/dashboard')}
            activeOpacity={0.8}
          >
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Rect width="7" height="9" x="3" y="3" rx="1" />
              <Rect width="7" height="5" x="14" y="3" rx="1" />
              <Rect width="7" height="9" x="14" y="12" rx="1" />
              <Rect width="7" height="5" x="3" y="16" rx="1" />
            </Svg>
            <Text style={{ color: '#94a3b8', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 4 }}>Dashboard</Text>
          </TouchableOpacity>

          {/* TAB 4: Social */}
          <TouchableOpacity 
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.replace('/(tabs)/social')}
            activeOpacity={0.8}
          >
            <IconSymbol size={28} name="person.2.fill" color="#94a3b8" />
            <Text style={{ color: '#94a3b8', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 4 }}>Social</Text>
          </TouchableOpacity>

          {/* TAB 5: Profile */}
          <TouchableOpacity 
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.replace('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <IconSymbol size={28} name="person.fill" color="#94a3b8" />
            <Text style={{ color: '#94a3b8', fontSize: 10, fontFamily: Fonts.inter.medium, marginTop: 4 }}>Profile</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
  floatingBack: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: 'rgba(2, 6, 23, 0.7)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginLeft: 8,
    borderWidth: 1, 
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  floatingShare: { position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroContent: { position: 'absolute', bottom: 30, left: 24, right: 24 },
  heroTitle: { fontSize: 36, color: '#fff', fontFamily: Fonts.outfit.extraBold, letterSpacing: -1 },
  titleRowMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  renameHeroBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(212, 175, 55, 0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  heroDate: { fontSize: 14, color: MidnightColors.gold, fontFamily: Fonts.inter.bold, textTransform: 'uppercase', letterSpacing: 1 },
  editDateBtn: { paddingHorizontal: 4, paddingVertical: 2 },
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
  subCard: { width: (SCREEN_WIDTH - 60) / 2, height: 160, borderRadius: 20, overflow: 'hidden', backgroundColor: MidnightColors.deepSlate, borderWidth: 1, borderColor: MidnightColors.cardBorder },
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
  premiumModalBackdrop: { 
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
    width: SCREEN_WIDTH * 0.85, 
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
  premiumRequestModal: { width: SCREEN_WIDTH * 0.85, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
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
  designInfo: { flex: 1, paddingRight: 16 },
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
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8,
    width: '100%'
  },
  modalContent: { backgroundColor: '#0f172a', width: '100%', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  modalTitle: { fontSize: 24, color: '#fff', fontFamily: Fonts.outfit.bold },
  templateModalSub: { color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.inter.medium, marginTop: -10, marginBottom: 18 },
  submitBtn: { backgroundColor: MidnightColors.gold, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: MidnightColors.background, fontSize: 16, fontFamily: Fonts.outfit.bold },
  
  templateOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  activeTemplate: { backgroundColor: MidnightColors.gold },
  templateText: { color: '#fff', fontSize: 15, fontFamily: Fonts.outfit.bold },
  activeTemplateText: { color: MidnightColors.background },
  templateOptionCard: {
    borderWidth: 2,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  activeTemplateCard: {
    transform: [{ scale: 0.99 }],
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
    width: '100%',
    height: 60,
    zIndex: 100,
    marginTop: 8,
    marginBottom: 0,
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
    marginHorizontal: 12, // Reduced to make the card wider
    marginTop: 6,
    marginBottom: 16,
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
    flexDirection: 'column',
    width: '100%',
    alignSelf: 'stretch',
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  photoCard: {
    width: '100%',
    marginBottom: 16,
  },
  photoTile: {
    flex: 1,
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
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  fullImageWithComments: {
    height: '46%',
    marginBottom: SCREEN_WIDTH * 0.86,
  },
  viewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  navBtnLeft: {
    position: 'absolute',
    left: 20,
    top: '50%',
    marginTop: -25,
    zIndex: 10,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 30,
  },
  navBtnRight: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -25,
    zIndex: 10,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 30,
  },
  viewerFooter: {
    position: 'absolute',
    bottom: 40,
    paddingHorizontal: 20,
  },
  viewerText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.inter.bold,
  },
  viewerActions: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  viewerActionsDocked: {
    bottom: 72,
  },
  viewerActionsRaised: {
    bottom: SCREEN_WIDTH * 0.9,
  },
  viewerAction: {
    alignItems: 'center',
    gap: 4,
  },
  viewerActionCount: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
  },
  guestbookPanel: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    height: SCREEN_WIDTH * 0.86,
    backgroundColor: '#fafaf9',
    borderRadius: 28,
    overflow: 'hidden',
    zIndex: 11,
  },
  guestbookHeader: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guestbookTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontFamily: Fonts.outfit.bold,
    fontStyle: 'italic',
  },
  guestbookSubtitle: {
    color: '#57534e',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 5,
  },
  closeGuestbookBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestbookList: {
    flex: 1,
  },
  guestbookListContent: {
    padding: 22,
    paddingBottom: 26,
  },
  emptyGuestbook: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    opacity: 0.55,
  },
  emptyGuestbookIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f5f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyGuestbookTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontFamily: Fonts.outfit.bold,
    fontStyle: 'italic',
  },
  emptyGuestbookText: {
    color: '#57534e',
    fontSize: 13,
    fontFamily: Fonts.inter.regular,
    marginTop: 6,
  },
  commentThread: {
    marginBottom: 22,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: Fonts.inter.bold,
  },
  commentContent: {
    flex: 1,
    minWidth: 0,
  },
  commentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentName: {
    flex: 1,
    color: '#0f172a',
    fontSize: 12,
    fontFamily: Fonts.inter.bold,
    paddingRight: 8,
  },
  commentTime: {
    color: '#78716c',
    fontSize: 10,
    fontFamily: Fonts.inter.medium,
  },
  commentBubble: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f5f5f4',
    borderRadius: 18,
    borderTopLeftRadius: 2,
    padding: 14,
  },
  commentText: {
    color: '#57534e',
    fontSize: 13,
    fontFamily: Fonts.inter.regular,
    lineHeight: 19,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 10,
  },
  replyBtnText: {
    color: MidnightColors.gold,
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 1.5,
  },
  deleteBtnText: {
    color: '#fb7185',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 1.5,
  },
  replyItem: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 50,
    marginTop: 14,
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAvatarText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
  },
  replyName: {
    flex: 1,
    color: '#1e293b',
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
    paddingRight: 8,
  },
  replyBubble: {
    backgroundColor: '#f5f5f4',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 14,
    borderTopLeftRadius: 2,
    padding: 11,
  },
  replyText: {
    color: '#44403c',
    fontSize: 12,
    fontFamily: Fonts.inter.regular,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  replyDeleteText: {
    marginTop: 6,
    fontSize: 9,
  },
  commentComposer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f5f5f4',
  },
  replyingToBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fafaf9',
    borderWidth: 1,
    borderColor: '#f5f5f4',
    marginBottom: 10,
  },
  replyingToText: {
    color: '#57534e',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  replyingToName: {
    color: MidnightColors.gold,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 22,
    backgroundColor: '#fafaf9',
    borderWidth: 1,
    borderColor: '#f5f5f4',
    paddingHorizontal: 18,
    color: '#0f172a',
    fontSize: 14,
    fontFamily: Fonts.inter.regular,
  },
  commentSendBtn: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSendBtnDisabled: {
    opacity: 0.25,
  },
  deleteMainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, marginTop: 32, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  deleteMainText: { color: '#ef4444', fontSize: 14, fontFamily: Fonts.inter.bold },

  royalDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 24,
    alignSelf: 'center',
    width: '60%',
  },
  royalDividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  royalDividerDiamond: {
    fontSize: 10,
    transform: [{ scaleY: 1.2 }],
    opacity: 0.75,
  },

  // Premium Royal Gold Splash Overlay Styles
  royalHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 40,
  },
  royalFrame: {
    position: 'absolute',
    top: 60,
    bottom: 30,
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: 8,
    pointerEvents: 'none',
  },
  royalCenterContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  royalTitle: {
    fontSize: 34,
    fontFamily: Fonts.serif,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 36,
    lineHeight: 46,
    letterSpacing: 2,
  },
  royalDateText: {
    fontSize: 13,
    fontFamily: Fonts.inter.bold,
    marginTop: 14,
    letterSpacing: 2,
  },
  royalButton: {
    marginTop: 32,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 32,
    paddingVertical: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  royalButtonText: {
    fontSize: 12,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 2,
  },
  royalBottomContent: {
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  brandLogoContainer: {
    alignItems: 'center',
  },
  royalBrandLogoScript: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontStyle: 'italic',
    color: '#fff',
    marginBottom: 4,
  },
  royalCircleLetters: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  royalCircleLetterBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  royalCircleLetterText: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  royalBrandSubText: {
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 3,
  },
  royalChevron: {
    opacity: 0.85,
  },
});
