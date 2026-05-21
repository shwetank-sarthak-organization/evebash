import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Share, Keyboard, useWindowDimensions, useColorScheme, BackHandler, PanResponder } from 'react-native';
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
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [tempCoverOffset, setTempCoverOffset] = useState(0);
  const [tempCoverScale, setTempCoverScale] = useState(1.0);
  const offsetRef = React.useRef(0);
  const scaleRef = React.useRef(1.0);

  useEffect(() => {
    offsetRef.current = tempCoverOffset;
  }, [tempCoverOffset]);

  useEffect(() => {
    scaleRef.current = tempCoverScale;
  }, [tempCoverScale]);
  const { width } = useWindowDimensions();
  const { id, shared, guestView, tab, share, mode } = useLocalSearchParams<{ id: string; shared?: string; guestView?: string; tab?: string; share?: string; mode?: 'admin' | 'visitor' }>();
  const router = useRouter();
  const { user } = useAuth();

  const [scrollY, setScrollY] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { height: windowHeight } = useWindowDimensions();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

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


  // Decide which view to show
  // We show Admin view ONLY if mode=admin AND user is owner.
  // Otherwise, we default to the premium Visitor view.
  const [isAdminViewActive, setIsAdminViewActive] = useState(mode === 'admin');
  const showAdminView = isAdminViewActive && isOwner;

  // Theme colors are intentionally FIXED to the light palette for the visitor event view —
  // the selected template must look the same regardless of the device OS dark/light setting.
  // Only the admin back-office (which locks to the 'hero'/Midnight theme) follows the OS scheme.
  const isThemeDark = showAdminView && isDark;

  const selectedTemplate = React.useMemo(() => {
    // If we are in Admin/Management View, we ALWAYS lock the palette to the default 'hero' (Midnight theme)
    // to keep the back-office controls consistent and standard for the app shell.
    const activeTemplateId = showAdminView ? 'hero' : (event?.templateId || 'hero');
    const base = MOBILE_TEMPLATE_THEMES.find((theme) => theme.id === activeTemplateId) || MOBILE_TEMPLATE_THEMES[0];
    const isClassic = base.id === 'classic';
    const isHero = base.id === 'hero';
    const isEthereal = base.id === 'ethereal';
    const isAcademicEditorial = base.id === 'academic_editorial';
    const isGarden = base.id === 'garden';
    return {
      ...base,
      background: isThemeDark ? base.background.dark : base.background.light,
      panel: isThemeDark ? base.panel.dark : base.panel.light,
      text: isThemeDark ? base.text.dark : base.text.light,
      muted: isThemeDark ? base.muted.dark : base.muted.light,
      accentBg: isThemeDark ? base.accentBg.dark : base.accentBg.light,
      tileBg: isThemeDark ? base.tileBg.dark : base.tileBg.light,
      overlay: isThemeDark ? base.overlay.dark : base.overlay.light,
      serifFont: isGarden ? Fonts.cormorant.semiBold : ((isClassic || isHero || isEthereal || isAcademicEditorial) ? Fonts.playfair.regular : Fonts.serif),
      serifItalic: isGarden ? Fonts.cormorant.semiBold : ((isClassic || isHero || isEthereal || isAcademicEditorial) ? Fonts.playfair.italic : Fonts.serif),
      serifBold: isGarden ? Fonts.cormorant.bold : ((isClassic || isHero || isEthereal || isAcademicEditorial) ? Fonts.playfair.bold : Fonts.serif),
    };
  }, [event?.templateId, isThemeDark, showAdminView]);

  const heroHeight = showAdminView
    ? 400
    : event?.templateId === 'royal' || event?.templateId === 'classic' || event?.templateId === 'hero'
      ? windowHeight
      : event?.templateId === 'ethereal'
        ? windowHeight * 0.8
        : event?.templateId === 'academic_editorial'
          ? windowHeight * 0.75
          : event?.templateId === 'garden'
            ? windowHeight * 0.42
            : event?.templateId === 'golden_years'
              ? 540 + insets.top
              : event?.templateId === 'rose'
                ? 560 + insets.top
                : event?.templateId === 'vintage'
                  ? 500 + insets.top
                  : event?.templateId === 'minimal_love'
                    ? 455 + insets.top
                    : event?.templateId === 'cyber_tech' || event?.templateId === 'retro_arcade'
                      ? SCREEN_WIDTH * 1.33 + 180 + insets.top
                      : event?.templateId === 'pop' || event?.templateId === 'neon_carnival'
                        ? 465 + insets.top
                        : 400;
  const isScrapbookTemplate = !showAdminView && event?.templateId === 'scrapbook';
  const isNeonTemplate = !showAdminView && event?.templateId === 'neon';
  const isPastelTemplate = !showAdminView && event?.templateId === 'pastel';
  const isPopTemplate = !showAdminView && event?.templateId === 'pop';
  const isGoldenYearsTemplate = !showAdminView && event?.templateId === 'golden_years';
  const isVintageTemplate = !showAdminView && event?.templateId === 'vintage';
  const isRoseTemplate = !showAdminView && event?.templateId === 'rose';
  const isMinimalLoveTemplate = !showAdminView && event?.templateId === 'minimal_love';
  const isAnniversaryTemplate = isGoldenYearsTemplate || isVintageTemplate || isRoseTemplate || isMinimalLoveTemplate;
  const isEtherealTemplate = !showAdminView && event?.templateId === 'ethereal';
  const isCyberTechTemplate = !showAdminView && event?.templateId === 'cyber_tech';
  const isRetroArcadeTemplate = !showAdminView && event?.templateId === 'retro_arcade';
  const isAcademicEditorialTemplate = !showAdminView && event?.templateId === 'academic_editorial';
  const isNeonCarnivalTemplate = !showAdminView && event?.templateId === 'neon_carnival';
  const isGardenTemplate = !showAdminView && event?.templateId === 'garden';

  const [tempCoverOffsetX, setTempCoverOffsetX] = useState(0);
  const offsetXRef = React.useRef(0);

  useEffect(() => {
    offsetXRef.current = tempCoverOffsetX;
  }, [tempCoverOffsetX]);

  const panResponder = React.useMemo(() => {
    let startOffsetY = 0;
    let startOffsetX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startOffsetY = offsetRef.current;
        startOffsetX = offsetXRef.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Vertical offset has a base limit of 50, and scales with scaleFactor
        const limitY = 50 + (heroHeight * scaleRef.current - heroHeight) / 2;
        // Horizontal offset limit is strictly determined by extra width of scaling factor
        const limitX = (SCREEN_WIDTH * scaleRef.current - SCREEN_WIDTH) / 2;

        const nextOffsetY = Math.min(Math.max(startOffsetY + gestureState.dy, -limitY), limitY);
        const nextOffsetX = Math.min(Math.max(startOffsetX + gestureState.dx, -limitX), limitX);

        setTempCoverOffset(nextOffsetY);
        setTempCoverOffsetX(nextOffsetX);
      },
      onPanResponderRelease: () => {}
    });
  }, [heroHeight]);

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

  const activeCoverMode = activeSubEvent ? activeSubEvent.coverMode : event?.coverMode;
  const activeCoverOffset = activeSubEvent ? activeSubEvent.coverOffset : event?.coverOffset;
  const activeCoverOffsetX = activeSubEvent ? activeSubEvent.coverOffsetX : event?.coverOffsetX;
  const activeCoverScale = activeSubEvent ? activeSubEvent.coverScale : event?.coverScale;

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

  const handleEventBack = useCallback(() => {
    if (selectedAdminGallery !== undefined) {
      setSelectedAdminGallery(undefined);
      if (event) {
        loadPhotos(event.id, event.legacyId);
      }
      return;
    }

    if (activeSubEvent) {
      setActiveSubEvent(null);
      if (event) {
        loadPhotos(event.id, event.legacyId);
      }
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/dashboard');
    }
  }, [activeSubEvent, event, router, selectedAdminGallery]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEventBack();
      return true;
    });

    return () => subscription.remove();
  }, [handleEventBack]);

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

  const handleSharePhoto = async () => {
    const photo = photos[currentPhotoIndex];
    if (!photo?.url) return;

    try {
      await Share.share({
        message: `A birthday memory from "${event?.title || 'our event'}"\n${photo.url}`,
        url: photo.url,
      });
    } catch (error) {
      console.error('Photo sharing failed', error);
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

    if (!result.canceled) {
      const target = activeSubEvent || event;
      if (!target) return;
      setUpdating(true);
      try {
        const file = { uri: result.assets[0].uri, name: 'cover.jpg', type: 'image/jpeg' } as any;
        const upload = await uploadEventImage(file, event.id, user?.uid || 'anon');
        
        const updatedFields = {
          coverImage: upload.url,
          coverOffset: 0,
          coverOffsetX: 0,
          coverScale: 1.0
        };

        if (activeSubEvent) {
          const newSub = { ...activeSubEvent, ...updatedFields };
          setActiveSubEvent(newSub);
          setSubEvents(prev => prev.map(sub => sub.id === activeSubEvent.id ? newSub : sub));
        } else if (event) {
          setEvent({ ...event, ...updatedFields });
        }

        await updateEvent(target.id, updatedFields);
        showToast("Cover image updated successfully!");
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
      const defaultTemplate = MOBILE_TEMPLATE_THEMES.find((theme) => theme.category === category);
      const updates = {
        category,
        ...(defaultTemplate ? { templateId: defaultTemplate.id } : {}),
      };

      setEvent({ ...event, ...updates });
      await updateEvent(event.id, updates);
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
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/dashboard');
              }
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
    const isClassic = event?.templateId === 'classic';
    const isHero = event?.templateId === 'hero';
    const isEthereal = event?.templateId === 'ethereal';
    const isScrapbook = event?.templateId === 'scrapbook';
    const isNeon = event?.templateId === 'neon';
    const isPastel = event?.templateId === 'pastel';
    const isPop = event?.templateId === 'pop';
    const isGoldenYears = event?.templateId === 'golden_years';
    const isVintageNoir = event?.templateId === 'vintage';
    const isRoseGarden = event?.templateId === 'rose';
    const isMinimalLove = event?.templateId === 'minimal_love';
    const isCyberTech = event?.templateId === 'cyber_tech';
    const isRetroArcade = event?.templateId === 'retro_arcade';
    const isAcademicEditorial = event?.templateId === 'academic_editorial';
    const isNeonCarnival = event?.templateId === 'neon_carnival';
    const isGarden = event?.templateId === 'garden';
    const isThemeHeader = isRoyal || isClassic || isHero || isEthereal || isGarden;
    const birthdayTextColor = isScrapbook ? selectedTemplate.text : (isNeon ? '#f8f7ff' : (isPastel ? '#6c5d59' : (isPop ? '#231f20' : (isGoldenYears ? '#5b432c' : (isVintageNoir ? '#F2E7D2' : (isRoseGarden ? '#562733' : (isMinimalLove ? '#4a2f1d' : (isCyberTech ? '#00f0ff' : (isRetroArcade ? '#231f20' : (isNeonCarnival ? '#d946ef' : MidnightColors.gold))))))))));
    const birthdayActiveText = isScrapbook ? styles.scrapbookVisitorTabTextActive : (isNeon ? styles.neonVisitorTabTextActive : (isPastel ? styles.pastelVisitorTabTextActive : (isPop ? styles.popVisitorTabTextActive : (isGoldenYears ? styles.goldenVisitorTabTextActive : (isVintageNoir ? styles.vintageVisitorTabTextActive : (isRoseGarden ? styles.roseVisitorTabTextActive : (isMinimalLove ? styles.minimalVisitorTabTextActive : (isCyberTech ? styles.cyberVisitorTabTextActive : (isRetroArcade ? styles.retroArcadeVisitorTabTextActive : (isNeonCarnival ? styles.neonCarnivalVisitorTabTextActive : styles.visitorTabTextActive))))))))));
    const birthdayActiveTab = isScrapbook ? styles.scrapbookVisitorTabActive : (isNeon ? styles.neonVisitorTabActive : (isPastel ? styles.pastelVisitorTabActive : (isPop ? styles.popVisitorTabActive : (isGoldenYears ? styles.goldenVisitorTabActive : (isVintageNoir ? styles.vintageVisitorTabActive : (isRoseGarden ? styles.roseVisitorTabActive : (isMinimalLove ? styles.minimalVisitorTabActive : (isCyberTech ? styles.cyberVisitorTabActive : (isRetroArcade ? styles.retroArcadeVisitorTabActive : (isNeonCarnival ? styles.neonCarnivalVisitorTabActive : styles.visitorTabActive))))))))));
    const birthdayTabStyles = [
      isScrapbook && styles.scrapbookVisitorTab,
      isNeon && styles.neonVisitorTab,
      isPastel && styles.pastelVisitorTab,
      isPop && styles.popVisitorTab,
      isGoldenYears && styles.goldenVisitorTab,
      isVintageNoir && styles.vintageVisitorTab,
      isRoseGarden && styles.roseVisitorTab,
      isMinimalLove && styles.minimalVisitorTab,
      isCyberTech && styles.cyberVisitorTab,
      isRetroArcade && styles.retroArcadeVisitorTab,
      isNeonCarnival && styles.neonCarnivalVisitorTab,
    ];
    const themeHeaderTab = (active: boolean) => ({
      backgroundColor: isHero ? (active ? 'rgba(204, 164, 59, 0.08)' : 'transparent') 
        : isGarden ? (active ? '#2E6F40' : 'transparent') : 'transparent',
      borderWidth: isHero ? 0.8 : isGarden ? (active ? 0 : 0) : 0,
      borderColor: 'transparent',
      borderRadius: isHero ? 4 : isGarden ? 999 : 0,
      paddingHorizontal: isGarden ? 18 : 16,
      paddingVertical: isHero ? 8 : isGarden ? 8 : 6,
      flexDirection: isHero ? 'row' as const : 'column' as const,
      gap: 2,
      marginHorizontal: isHero ? 4 : isGarden ? 4 : 0,
      alignSelf: 'center' as const,
    });
    const themeTextColor = (active: boolean) => active
      ? (isGarden ? '#FFFFFF' : (isHero ? '#cca43b' : (isRoyal ? '#fff' : (isEthereal ? selectedTemplate.accent : '#cca43b'))))
      : (isGarden ? '#64748b' : (isHero ? '#94a3b8' : selectedTemplate.muted));
    return (
      <View style={[
        styles.visitorHeaderContainer,
        isRoyal && { height: 70, marginTop: 12, marginBottom: 0 },
        isClassic && { height: 60, marginTop: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', backgroundColor: '#FAF9F6' },
        isHero && { height: 64, marginTop: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', backgroundColor: '#000000' },
        isEthereal && { height: 60, marginTop: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: selectedTemplate.accent + '26', backgroundColor: selectedTemplate.background },
        isAcademicEditorial && { height: 52, marginTop: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: selectedTemplate.text + '1a', backgroundColor: selectedTemplate.background },
        isGarden && {
          height: 54,
          marginTop: -27,  // negative half-height → straddles cover photo bottom edge
          marginBottom: 8,
          // Use left+right margin via paddingHorizontal on parent instead to avoid
          // the width:'100%' + marginHorizontal overflow bug in React Native
          marginHorizontal: 0,
          paddingHorizontal: 16,
          alignSelf: 'stretch',
          borderRadius: 999,
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#2E6F40',
          shadowColor: '#16a34a',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 6,
          zIndex: 10,
        },
        isScrapbook && styles.scrapbookVisitorHeaderContainer,
        isNeon && styles.neonVisitorHeaderContainer,
        isPastel && styles.pastelVisitorHeaderContainer,
        isPop && styles.popVisitorHeaderContainer,
        isGoldenYears && styles.goldenVisitorHeaderContainer,
        isVintageNoir && styles.vintageVisitorHeaderContainer,
        isRoseGarden && styles.roseVisitorHeaderContainer,
        isMinimalLove && styles.minimalVisitorHeaderContainer,
        isCyberTech && styles.cyberVisitorHeaderContainer,
        isRetroArcade && styles.retroArcadeVisitorHeaderContainer,
        isNeonCarnival && styles.neonCarnivalVisitorHeaderContainer,
      ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.visitorHeaderContent, 
            isScrapbook && styles.scrapbookVisitorHeaderContent, 
            isNeon && styles.neonVisitorHeaderContent, 
            isPastel && styles.pastelVisitorHeaderContent, 
            isPop && styles.popVisitorHeaderContent, 
            isGoldenYears && styles.goldenVisitorHeaderContent,
            isVintageNoir && styles.vintageVisitorHeaderContent,
            isRoseGarden && styles.roseVisitorHeaderContent,
            isMinimalLove && styles.minimalVisitorHeaderContent,
            isCyberTech && styles.cyberVisitorHeaderContent, 
            isRetroArcade && styles.retroArcadeVisitorHeaderContent,
            isNeonCarnival && styles.neonCarnivalVisitorHeaderContent,
            isAcademicEditorial && { paddingHorizontal: 12 },
            isGarden && {
              flexGrow: 1,
              flexDirection: 'row',
              justifyContent: 'space-evenly',
              alignItems: 'center',
              paddingHorizontal: 4,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.visitorTab,
              isThemeHeader ? themeHeaderTab(!activeSubEvent) : [...birthdayTabStyles, !activeSubEvent && birthdayActiveTab],
              isAcademicEditorial && {
                backgroundColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0,
                paddingHorizontal: 14,
                paddingVertical: 6,
                alignSelf: 'center',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
              }
            ]}
            onPress={() => handleSubEventChange(null)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {!isThemeHeader && !isAcademicEditorial && (
                <IconSymbol
                  name="house.fill"
                  size={14}
                  color={!activeSubEvent ? (isCyberTech ? '#00f0ff' : (isScrapbook ? '#263331' : (isNeon ? '#66e8ff' : (isPastel ? '#c9768b' : (isPop ? '#ffffff' : (isGoldenYears ? '#5b432c' : (isVintageNoir ? '#211A12' : (isRoseGarden ? '#562733' : (isRetroArcade ? '#ffffff' : (isNeonCarnival ? '#faf5ff' : MidnightColors.background)))))))))) : (isCyberTech ? 'rgba(0, 240, 255, 0.5)' : (isScrapbook ? selectedTemplate.accent : (isNeon ? '#b9b1d9' : (isPastel ? '#9a8583' : (isPop ? '#231f20' : (isGoldenYears ? '#b8892d' : (isVintageNoir ? '#B89145' : (isRoseGarden ? '#b76578' : (isRetroArcade ? '#231f20' : (isNeonCarnival ? '#d8b4fe' : MidnightColors.gold))))))))))}
                />
              )}
              <Text style={[
                styles.visitorTabText,
                { color: isThemeHeader ? themeTextColor(!activeSubEvent) : birthdayTextColor },
                isScrapbook && styles.scrapbookVisitorTabText,
                  isNeon && styles.neonVisitorTabText,
                  isPastel && styles.pastelVisitorTabText,
                isPop && styles.popVisitorTabText,
                isGoldenYears && styles.goldenVisitorTabText,
                isVintageNoir && styles.vintageVisitorTabText,
                isRoseGarden && styles.roseVisitorTabText,
                isMinimalLove && styles.minimalVisitorTabText,
                isCyberTech && styles.cyberVisitorTabText,
              isNeonCarnival && styles.neonCarnivalVisitorTabText,
                isRetroArcade && styles.retroArcadeVisitorTabText,
                selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifBold, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
                isAcademicEditorial && {
                  fontFamily: selectedTemplate.serifBold,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  color: !activeSubEvent ? selectedTemplate.accent : selectedTemplate.muted,
                },
                !activeSubEvent && !isThemeHeader && !isAcademicEditorial && birthdayActiveText
              ]}>
                {(isCyberTech || isNeonCarnival) ? (!activeSubEvent ? '[ HOME ]' : '  HOME  ') : (isRetroArcade ? 'HOME' : (isAcademicEditorial ? '01 / HOME' : 'Home'))}
              </Text>
            </View>

            {isRoyal && !activeSubEvent && (
              <View style={{ alignItems: 'center', marginTop: 3 }}>
                <View style={{ width: 28, height: 1.5, backgroundColor: selectedTemplate.accent }} />
                <Text style={{ fontSize: 6, color: selectedTemplate.accent, marginTop: 1 }}>♦</Text>
              </View>
            )}
            {isClassic && !activeSubEvent && (
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <View style={{ width: 32, height: 1.2, backgroundColor: '#cca43b' }} />
              </View>
            )}
            {isEthereal && !activeSubEvent && (
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: selectedTemplate.accent, fontFamily: selectedTemplate.serifItalic }}>❦</Text>
              </View>
            )}
            {isAcademicEditorial && !activeSubEvent && (
              <View style={{ width: '100%', height: 2, backgroundColor: selectedTemplate.accent, marginTop: 4 }} />
            )}
          </TouchableOpacity>

          {subEvents.map((sub, idx) => {
            const isActive = activeSubEvent?.id === sub.id;
            const indexStr = String(idx + 2).padStart(2, '0');
            return (
              <TouchableOpacity
                key={sub.id}
                style={[
                  styles.visitorTab,
                  isThemeHeader ? themeHeaderTab(isActive) : [...birthdayTabStyles, isActive && birthdayActiveTab],
                  isAcademicEditorial && {
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    borderRadius: 0,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    alignSelf: 'center',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 0,
                  }
                ]}
                onPress={() => handleSubEventChange(sub)}
              >
                <Text style={[
                  styles.visitorTabText,
                  { color: isThemeHeader ? themeTextColor(isActive) : birthdayTextColor },
                  isScrapbook && styles.scrapbookVisitorTabText,
                  isNeon && styles.neonVisitorTabText,
                  isPastel && styles.pastelVisitorTabText,
                  isPop && styles.popVisitorTabText,
                  isGoldenYears && styles.goldenVisitorTabText,
                  isVintageNoir && styles.vintageVisitorTabText,
                  isRoseGarden && styles.roseVisitorTabText,
                  isMinimalLove && styles.minimalVisitorTabText,
                  isCyberTech && styles.cyberVisitorTabText,
              isNeonCarnival && styles.neonCarnivalVisitorTabText,
                  isRetroArcade && styles.retroArcadeVisitorTabText,
                  selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifBold, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
                  isAcademicEditorial && {
                    fontFamily: selectedTemplate.serifBold,
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    color: isActive ? selectedTemplate.accent : selectedTemplate.muted,
                  },
                  isActive && !isThemeHeader && !isAcademicEditorial && birthdayActiveText
                ]}>
                  {(isCyberTech || isNeonCarnival) ? (isActive ? `[ ${sub.title.toUpperCase()} ]` : `  ${sub.title.toUpperCase()}  `) : (isRetroArcade ? sub.title.toUpperCase() : (isAcademicEditorial ? `${indexStr} / ${sub.title.toUpperCase()}` : sub.title))}
                </Text>

                {isRoyal && isActive && (
                  <View style={{ alignItems: 'center', marginTop: 3 }}>
                    <View style={{ width: 28, height: 1.5, backgroundColor: selectedTemplate.accent }} />
                    <Text style={{ fontSize: 6, color: selectedTemplate.accent, marginTop: 1 }}>♦</Text>
                  </View>
                )}
                {isClassic && isActive && (
                  <View style={{ alignItems: 'center', marginTop: 4 }}>
                    <View style={{ width: 32, height: 1.2, backgroundColor: '#cca43b' }} />
                  </View>
                )}
                {isEthereal && isActive && (
                  <View style={{ alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontSize: 10, color: selectedTemplate.accent, fontFamily: selectedTemplate.serifItalic }}>❦</Text>
                  </View>
                )}
                {isAcademicEditorial && isActive && (
                  <View style={{ width: '100%', height: 2, backgroundColor: selectedTemplate.accent, marginTop: 4 }} />
                )}
              </TouchableOpacity>
            );
          })}

          {/* Event Partners Tab */}
          <TouchableOpacity
            style={[
              styles.visitorTab,
              isThemeHeader ? themeHeaderTab(activeSubEvent?.id === 'event-partners') : [...birthdayTabStyles, activeSubEvent?.id === 'event-partners' && birthdayActiveTab],
              isAcademicEditorial && {
                backgroundColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0,
                paddingHorizontal: 14,
                paddingVertical: 6,
                alignSelf: 'center',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
              }
            ]}
            onPress={() => setActiveSubEvent({ id: 'event-partners', title: 'Event Partners' } as any)}
          >
            <Text style={[
              styles.visitorTabText,
              { color: isThemeHeader ? themeTextColor(activeSubEvent?.id === 'event-partners') : birthdayTextColor },
              isScrapbook && styles.scrapbookVisitorTabText,
              isNeon && styles.neonVisitorTabText,
              isPastel && styles.pastelVisitorTabText,
              isPop && styles.popVisitorTabText,
              isGoldenYears && styles.goldenVisitorTabText,
              isVintageNoir && styles.vintageVisitorTabText,
              isRoseGarden && styles.roseVisitorTabText,
              isMinimalLove && styles.minimalVisitorTabText,
              isCyberTech && styles.cyberVisitorTabText,
              isNeonCarnival && styles.neonCarnivalVisitorTabText,
              isRetroArcade && styles.retroArcadeVisitorTabText,
              selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifBold, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 13 },
              isAcademicEditorial && {
                fontFamily: selectedTemplate.serifBold,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: activeSubEvent?.id === 'event-partners' ? selectedTemplate.accent : selectedTemplate.muted,
              },
              activeSubEvent?.id === 'event-partners' && !isThemeHeader && !isAcademicEditorial && birthdayActiveText
            ]}>
              {(isCyberTech || isNeonCarnival) ? (activeSubEvent?.id === 'event-partners' ? '[ PARTNERS ]' : '  PARTNERS  ') : (isRetroArcade ? 'PARTNERS 🤝' : (isAcademicEditorial ? `${String(subEvents.length + 2).padStart(2, '0')} / PARTNERS` : (
                <>Event Partners <Text style={{ fontSize: 10 }}>🤝</Text></>
              )))}
            </Text>

            {isRoyal && activeSubEvent?.id === 'event-partners' && (
              <View style={{ alignItems: 'center', marginTop: 3 }}>
                <View style={{ width: 28, height: 1.5, backgroundColor: selectedTemplate.accent }} />
                <Text style={{ fontSize: 6, color: selectedTemplate.accent, marginTop: 1 }}>♦</Text>
              </View>
            )}
            {isClassic && activeSubEvent?.id === 'event-partners' && (
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <View style={{ width: 32, height: 1.2, backgroundColor: '#cca43b' }} />
              </View>
            )}
            {isEthereal && activeSubEvent?.id === 'event-partners' && (
              <View style={{ alignItems: 'center', marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: selectedTemplate.accent, fontFamily: selectedTemplate.serifItalic }}>❦</Text>
              </View>
            )}
            {isAcademicEditorial && activeSubEvent?.id === 'event-partners' && (
              <View style={{ width: '100%', height: 2, backgroundColor: selectedTemplate.accent, marginTop: 4 }} />
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  // ── THEME ORNAMENTAL DIVIDER ──
  const renderThemeDivider = () => {
    if (selectedTemplate.id === 'royal') {
      return (
        <View style={styles.royalDividerContainer}>
          <View style={[styles.royalDividerLine, { backgroundColor: selectedTemplate.accent }]} />
          <Text style={[styles.royalDividerDiamond, { color: selectedTemplate.accent }]}>♦</Text>
          <View style={[styles.royalDividerLine, { backgroundColor: selectedTemplate.accent }]} />
        </View>
      );
    }
    if (selectedTemplate.id === 'classic') {
      return (
        <View style={styles.classicDividerContainer}>
          <View style={[styles.classicDividerLine, { backgroundColor: 'rgba(212, 175, 55, 0.25)' }]} />
          <Text style={[styles.classicDividerDot, { color: '#cca43b' }]}>✦</Text>
          <View style={[styles.classicDividerLine, { backgroundColor: 'rgba(212, 175, 55, 0.25)' }]} />
        </View>
      );
    }
    if (selectedTemplate.id === 'hero') {
      return (
        <View style={styles.heroDividerContainer}>
          <View style={[styles.heroDividerLine, { backgroundColor: 'rgba(204, 164, 59, 0.25)' }]} />
          <Text style={[styles.heroDividerStar, { color: '#cca43b' }]}>✦</Text>
          <View style={[styles.heroDividerLine, { backgroundColor: 'rgba(204, 164, 59, 0.25)' }]} />
        </View>
      );
    }
    if (selectedTemplate.id === 'ethereal') {
      return (
        <View style={styles.etherealDividerContainer}>
          <View style={[styles.etherealDividerLine, { backgroundColor: selectedTemplate.accent + '4d' }]} />
          <Text style={[styles.etherealDividerAsterisk, { color: selectedTemplate.accent, fontFamily: selectedTemplate.serifFont }]}>❦</Text>
          <View style={[styles.etherealDividerLine, { backgroundColor: selectedTemplate.accent + '4d' }]} />
        </View>
      );
    }
    if (selectedTemplate.id === 'academic_editorial') {
      return (
        <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
          <View style={{ height: 1, backgroundColor: selectedTemplate.text, opacity: 0.12 }} />
        </View>
      );
    }
    if (selectedTemplate.id === 'garden') {
      return (
        <View style={styles.gardenDividerContainer}>
          <View style={[styles.gardenDividerLine, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]} />
          <IconSymbol name="leaf.fill" size={14} color="#16a34a" />
          <View style={[styles.gardenDividerLine, { backgroundColor: 'rgba(22, 163, 74, 0.15)' }]} />
        </View>
      );
    }
    return null;
  };

  const getVendorInitials = (name: string): string[] => {
    if (!name) return ['W', 'E', 'D'];
    const words = name.split(/\s+/).filter(w => {
      const lower = w.toLowerCase();
      return lower !== 'by' && lower !== 'of' && lower !== 'and' && lower !== '&';
    });
    if (words.length === 0) return ['W', 'E', 'D'];
    const letters = words.slice(0, 4).map(w => w.charAt(0).toUpperCase());
    return letters;
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: selectedTemplate.background }]}>
      <Stack.Screen
        options={{
          headerShown: showAdminView ? false : !(event?.templateId === 'classic' || event?.templateId === 'hero' || event?.templateId === 'pop' || event?.templateId === 'ethereal' || event?.templateId === 'cyber_tech' || event?.templateId === 'retro_arcade' || event?.templateId === 'academic_editorial' || event?.templateId === 'neon_carnival' || event?.templateId === 'garden'),
          headerTransparent: true,
          headerTitle: '',
          headerLeft: () => {
            if (showAdminView) return null; // Custom back button is rendered inline inside the cover container to scroll with content

            const isPop = !showAdminView && event?.templateId === 'pop';
            const isVintage = event?.templateId === 'vintage';
            const isMinimal = event?.templateId === 'minimal_love';
            return (!showAdminView && (event?.templateId === 'classic' || event?.templateId === 'hero' || event?.templateId === 'ethereal' || event?.templateId === 'cyber_tech' || event?.templateId === 'retro_arcade' || event?.templateId === 'academic_editorial' || event?.templateId === 'neon_carnival' || event?.templateId === 'garden')) ? null : (
              <TouchableOpacity
                onPress={handleEventBack}
                style={[
                  styles.floatingBack,
                  { marginLeft: 16 },
                  (!showAdminView && (event?.templateId === 'royal' || event?.templateId === 'classic')) && {
                    marginLeft: 24,
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    borderColor: selectedTemplate.accent,
                    backgroundColor: 'rgba(0,0,0,0.15)',
                  },
                  isPop && styles.popFloatingBack,
                  isVintage && styles.vintageFloatingButton,
                  isMinimal && styles.minimalFloatingButton,
                ]}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <IconSymbol name="chevron.left" size={isPop ? 22 : 28} color={(isPop || isMinimal) ? '#fffaf2' : selectedTemplate.accent} />
              </TouchableOpacity>
            );
          },
          headerRight: () => {
            if (showAdminView) return null;
            const isPop = event?.templateId === 'pop';
            const isVintage = event?.templateId === 'vintage';
            const isMinimal = event?.templateId === 'minimal_love';
            return (!showAdminView && (event?.templateId === 'classic' || event?.templateId === 'hero' || event?.templateId === 'ethereal' || event?.templateId === 'cyber_tech' || event?.templateId === 'retro_arcade' || event?.templateId === 'academic_editorial' || event?.templateId === 'neon_carnival' || event?.templateId === 'garden')) ? null : (
              <TouchableOpacity
                style={[
                  styles.floatingBack,
                  { marginTop: Platform.OS === 'ios' ? 44 : 10, marginRight: 16 },
                  (!showAdminView && (event?.templateId === 'royal' || event?.templateId === 'classic')) && {
                    marginRight: 24,
                    marginTop: 36,
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    borderColor: selectedTemplate.accent,
                    backgroundColor: 'rgba(0,0,0,0.15)',
                  },
                  isPop && styles.popFloatingShare,
                  isVintage && styles.vintageFloatingButton,
                  isMinimal && styles.minimalFloatingButton,
                ]}
                onPress={() => setShowShareModal(true)}
                hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
              >
                <IconSymbol name="square.and.arrow.up" size={isPop ? 18 : 20} color={(isPop || isMinimal) ? '#fffaf2' : selectedTemplate.accent} />
              </TouchableOpacity>
            );
          }
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
        <View 
          style={[styles.hero, { height: heroHeight, backgroundColor: selectedTemplate.background, overflow: 'hidden' }]}
          {...(isRepositioning ? panResponder.panHandlers : {})}
        >
          {!showAdminView && event?.templateId === 'pop' ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#ffe84a' }]}>
              {/* Giant background comic decorative shapes */}
              <View style={styles.popBackgroundShapeBlue} />
              <View style={styles.popBackgroundShapePink} />
            </View>
          ) : !showAdminView && event?.templateId === 'classic' ? (
            <View style={styles.classicHeroImageContainer}>
              <Image 
                source={{ uri: activeSubEvent?.coverImage || event?.coverImage || event?.coverUrl }} 
                style={[
                  styles.classicHeroImage,
                  (activeCoverMode === 'fit') ? {
                    resizeMode: 'contain',
                  } : {
                    height: '120%',
                    top: '-10%',
                    resizeMode: 'cover',
                    transform: [
                      { translateY: activeCoverOffset || 0 },
                      { translateX: activeCoverOffsetX || 0 },
                      { scale: activeCoverScale || 1.0 }
                    ]
                  }
                ]} 
              />
            </View>
          ) : !showAdminView && event?.templateId === 'ethereal' ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: selectedTemplate.background }]}>
              {/* Full-bleed Photo */}
              <View style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                <Image 
                  source={{ uri: activeSubEvent?.coverImage || event?.coverImage || event?.coverUrl }} 
                  style={{ width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.88 }}
                />
                {/* Dark gradient overlay at bottom of image for readability */}
                <LinearGradient
                  colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.4)']}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 }}
                />
              </View>
            </View>
          ) : !showAdminView && event?.templateId === 'academic_editorial' ? (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: selectedTemplate.background, paddingTop: insets.top }]}>
              <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'column' }}>

                {/* Top Bar: Back | Kicker label | Share */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                  marginTop: 12,
                  marginBottom: 12,
                }}>
                  <TouchableOpacity
                    onPress={handleEventBack}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <IconSymbol name="chevron.left" size={20} color={selectedTemplate.text} />
                  </TouchableOpacity>

                  <Text style={{
                    fontFamily: selectedTemplate.serifFont,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 2.5,
                    color: selectedTemplate.muted,
                  }}>
                    {`· ${activeSubEvent ? 'EXCERPT' : 'CAMPUS JOURNAL'} ·`}
                  </Text>

                  <TouchableOpacity
                    onPress={() => setShowShareModal(true)}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <IconSymbol name="square.and.arrow.up" size={18} color={selectedTemplate.text} />
                  </TouchableOpacity>
                </View>

                {/* Cover Image — fills remaining space */}
                <View style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: selectedTemplate.text + '60',
                  padding: 6,
                  backgroundColor: selectedTemplate.panel,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 6,
                  elevation: 2,
                }}>
                  <Image
                    source={{ uri: activeSubEvent?.coverImage || event?.coverImage || event?.coverUrl }}
                    style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                  />
                </View>

                {/* Title + Date — below the image, solid background for guaranteed visibility */}
                <View style={{
                  marginTop: 10,
                  backgroundColor: isDark ? '#13161F' : '#FFFFFF',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: 2,
                  borderTopColor: isDark ? '#CC1010' : '#800020',
                }}>
                  {/* Event Title */}
                  <Text style={{
                    fontFamily: selectedTemplate.serifBold,
                    fontSize: 24,
                    fontWeight: '800',
                    color: isDark ? '#FFFFFF' : '#000000',
                    textAlign: 'center',
                    letterSpacing: 0.4,
                    lineHeight: 32,
                  }} numberOfLines={2}>
                    {(activeSubEvent?.title || event.title || '').toUpperCase()}
                  </Text>

                  {/* Thin accent divider */}
                  <View style={{
                    height: 1,
                    backgroundColor: isDark ? '#CC1010' : '#800020',
                    opacity: 0.4,
                    marginVertical: 8,
                    marginHorizontal: 24,
                  }} />

                  {/* Date */}
                  <Text style={{
                    fontFamily: selectedTemplate.serifBold,
                    fontSize: 15,
                    color: isDark ? '#CC1010' : '#800020',
                    textAlign: 'center',
                    letterSpacing: 1.2,
                    marginBottom: 2,
                  }}>
                    {activeSubEvent?.date || event.date || '—'}
                  </Text>

                  {/* Category label */}
                  <Text style={{
                    fontFamily: selectedTemplate.serifFont,
                    fontSize: 11,
                    color: isDark ? '#9CA3AF' : '#4B5563',
                    textAlign: 'center',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}>
                    {`Vol. I · ${event.category || 'CAMPUS'}`}
                  </Text>
                </View>

              </View>
            </View>
          ) : (
            <Image 
              source={{ uri: activeSubEvent?.coverImage || event?.coverImage || event?.coverUrl }} 
              style={[
                styles.heroImage,
                (!showAdminView && event?.templateId === 'pop') ? styles.popPolaroidImage : {},
                isGoldenYearsTemplate && styles.goldenHeroImage,
                isVintageTemplate && styles.vintageHeroImage,
                (activeCoverMode === 'fit') ? {
                  height: heroHeight,
                  resizeMode: 'contain',
                } : {
                  height: heroHeight + 100,
                  top: -50,
                  resizeMode: 'cover',
                  transform: [
                    { translateY: isRepositioning ? tempCoverOffset : (activeCoverOffset || 0) },
                    { translateX: isRepositioning ? tempCoverOffsetX : (activeCoverOffsetX || 0) },
                    { scale: isRepositioning ? tempCoverScale : (activeCoverScale || 1.0) }
                  ],
                }
              ]}
              blurRadius={isGoldenYearsTemplate ? 0.8 : (isVintageTemplate ? 1.1 : 0)}
            />
          )}
          {selectedTemplate.id !== 'classic' && selectedTemplate.id !== 'pop' && selectedTemplate.id !== 'ethereal' && selectedTemplate.id !== 'academic_editorial' && selectedTemplate.id !== 'garden' && (
            <LinearGradient
              colors={selectedTemplate.overlay as string[]}
              style={styles.heroGradient}
            />
          )}

          {showAdminView && (
            <TouchableOpacity
              onPress={handleEventBack}
              style={[
                styles.floatingBack,
                {
                  position: 'absolute',
                  top: insets.top > 0 ? insets.top + 8 : 16,
                  left: 16,
                  zIndex: 10,
                }
              ]}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <IconSymbol name="chevron.left" size={24} color={selectedTemplate.accent} />
            </TouchableOpacity>
          )}

          {showAdminView && !isRepositioning && (
            <View style={[styles.coverControlRow, { top: insets.top > 0 ? insets.top + 8 : 16 }]}>
              {/* Fit / Toggle */}
              <TouchableOpacity
                style={styles.coverControlSubBtn}
                onPress={async () => {
                  const target = activeSubEvent || event;
                  if (!target) return;
                  const newMode = (target.coverMode || 'fill') === 'fill' ? 'fit' : 'fill';
                  setUpdating(true);
                  try {
                    const updatedFields = {
                      coverMode: newMode,
                      coverOffset: 0,
                      coverOffsetX: 0,
                      coverScale: 1.0
                    };
                    
                    if (activeSubEvent) {
                      const newSub = { ...activeSubEvent, ...updatedFields };
                      setActiveSubEvent(newSub);
                      setSubEvents(prev => prev.map(sub => sub.id === activeSubEvent.id ? newSub : sub));
                    } else if (event) {
                      setEvent({ ...event, ...updatedFields });
                    }
                    
                    showToast(newMode === 'fit' ? 'Cover set to Fit' : 'Cover set to Fill');
                    await updateEvent(target.id, updatedFields);
                  } catch (err) {
                    console.log('Error updating cover mode:', err);
                  } finally {
                    setUpdating(false);
                  }
                }}
                disabled={updating}
              >
                <IconSymbol
                  name={(activeCoverMode || 'fill') === 'fill' ? 'arrow.down.right.and.arrow.up.left' : 'arrow.up.left.and.arrow.down.right.asymmetrical'}
                  size={14}
                  color="#fff"
                />
                <Text style={styles.coverControlText}>
                  {(activeCoverMode || 'fill') === 'fill' ? 'Fit' : 'Fill'}
                </Text>
              </TouchableOpacity>

              {/* Reposition Button (Only in Fill mode) */}
              {(activeCoverMode || 'fill') === 'fill' && (
                <TouchableOpacity
                  style={styles.coverControlSubBtn}
                  onPress={() => {
                    const target = activeSubEvent || event;
                    setTempCoverOffset(target?.coverOffset || 0);
                    setTempCoverOffsetX(target?.coverOffsetX || 0);
                    setTempCoverScale(target?.coverScale || 1.0);
                    setIsRepositioning(true);
                  }}
                  disabled={updating}
                >
                  <IconSymbol name="arrow.up.and.down" size={14} color="#fff" />
                  <Text style={styles.coverControlText}>Position</Text>
                </TouchableOpacity>
              )}

              {/* Change Cover */}
              <TouchableOpacity
                style={styles.coverControlSubBtn}
                onPress={handleChangeCover}
                disabled={updating}
              >
                <IconSymbol name="camera.fill" size={14} color="#fff" />
                <Text style={styles.coverControlText}>{updating ? '...' : 'Cover'}</Text>
              </TouchableOpacity>
            </View>
          )}


          {(!showAdminView && event?.templateId === 'academic_editorial') ? null : (!showAdminView && event?.templateId === 'royal') ? (
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
          ) : (!showAdminView && event?.templateId === 'classic') ? (
            <View style={styles.classicHeroOverlay}>
              {/* 1. Elegant Thin Matte Frame */}
              <View style={[styles.classicFrame, { borderColor: 'rgba(212, 175, 55, 0.15)' }]} />

              {/* 2. Center Content with Spaced-out Fine-Art Typography */}
              <View style={styles.classicCenterContent}>
                <Text style={[styles.classicTitle, { color: selectedTemplate.text, fontFamily: selectedTemplate.serifFont }]}>
                  {activeSubEvent?.title || event.title}
                </Text>

                <View style={styles.classicDividerOrnament}>
                  <View style={[styles.classicDividerOrnamentLine, { backgroundColor: '#cca43b' }]} />
                  <Text style={styles.classicDividerOrnamentDot}>✦</Text>
                  <View style={[styles.classicDividerOrnamentLine, { backgroundColor: '#cca43b' }]} />
                </View>

                <Text style={[styles.classicDateText, { color: '#cca43b', fontFamily: selectedTemplate.serifItalic }]}>
                  {`— ${activeSubEvent?.date || event.date || ''} —`.toUpperCase()}
                </Text>

                <View style={styles.classicActionRow}>
                  {/* Left: Symmetrical Gold Square Back Button */}
                  <TouchableOpacity
                    style={[styles.classicSideButton, { borderColor: '#cca43b' }]}
                    onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
                  >
                    <IconSymbol name="chevron.left" size={16} color="#cca43b" />
                  </TouchableOpacity>

                  {/* Center: Main Gold Square Enter Gallery Button */}
                  <TouchableOpacity
                    style={[styles.classicButton, { borderColor: '#cca43b', marginTop: 0 }]}
                    onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  >
                    <Text style={[styles.classicButtonText, { color: '#cca43b' }]}>ENTER GALLERY</Text>
                  </TouchableOpacity>

                  {/* Right: Symmetrical Gold Square Share Button */}
                  <TouchableOpacity
                    style={[styles.classicSideButton, { borderColor: '#cca43b' }]}
                    onPress={() => setShowShareModal(true)}
                  >
                    <IconSymbol name="square.and.arrow.up" size={16} color="#cca43b" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. Classic Fine Art Brand Signature */}
              <View style={styles.classicBottomContent}>
                <View style={styles.brandLogoContainer}>
                  <Text style={[styles.classicBrandSubText, { color: '#94a3b8' }]}>EXHIBITION DELIVERED BY</Text>
                  <Text style={[styles.classicBrandLogoScript, { color: selectedTemplate.text, fontFamily: selectedTemplate.serifItalic }]}>Wed Album</Text>
                </View>

                <TouchableOpacity
                  onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  style={styles.classicChevron}
                >
                  <IconSymbol name="chevron.down" size={20} color="#cca43b" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'ethereal') ? (
            <View style={styles.etherealOverlayContainer}>
              {/* Back button at top left */}
              <TouchableOpacity
                style={styles.etherealBackBtnRound}
                onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
              >
                <IconSymbol name="chevron.left" size={20} color="#ffffff" />
              </TouchableOpacity>

              {/* Share button at top right */}
              <TouchableOpacity
                style={styles.etherealShareBtnRound}
                onPress={() => setShowShareModal(true)}
              >
                <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
              </TouchableOpacity>

              {/* Floating Details Card */}
              <View style={[styles.etherealDetailsCard, { backgroundColor: selectedTemplate.panel, borderColor: selectedTemplate.accent + '26' }]}>
                {/* Couple Names */}
                <Text style={[styles.etherealCoupleNames, { fontFamily: selectedTemplate.serifBold, color: selectedTemplate.text }]}>
                  {(activeSubEvent?.title || event.title).toUpperCase()}
                </Text>

                {/* Elegant Separator Ornament */}
                <Text style={{ color: selectedTemplate.accent, fontSize: 16, marginVertical: 4 }}>❦</Text>

                {/* Event Date */}
                {(activeSubEvent?.date || event.date) && (
                  <Text style={{ color: selectedTemplate.text, opacity: 0.75, fontFamily: selectedTemplate.serifItalic, fontSize: 14, fontStyle: 'italic', letterSpacing: 1, marginBottom: 16 }}>
                    {activeSubEvent?.date || event.date}
                  </Text>
                )}

                {/* "ENTER GALLERY" Button integrated inside card */}
                <TouchableOpacity
                  style={[styles.etherealEnterBtn, { backgroundColor: selectedTemplate.accent }]}
                  onPress={() => scrollViewRef.current?.scrollTo({ y: heroHeight, animated: true })}
                >
                  <Text style={styles.etherealEnterBtnText}>ENTER GALLERY</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'hero') ? (
            <View style={styles.heroHeroOverlay}>
              {/* 1. Immersive dark linear gradient overlay for ultimate depth */}
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.25)', 'rgba(0, 0, 0, 0.92)']}
                style={StyleSheet.absoluteFillObject}
              />

              {/* 2. Glassmorphic Hero Inset Card - floating above bottom third */}
              <View style={styles.heroGlassCard}>
                {/* Thin golden-bordered micro-badge */}
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>THE CELEBRATION OF</Text>
                </View>

                {/* Event Title - Poetic fluid Playfair Display Serif Italic */}
                <Text style={[styles.heroTitleMain, { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }]}>
                  {activeSubEvent?.title || event.title}
                </Text>

                {/* Micro-thin gold sparkle separator */}
                <View style={styles.heroDividerContainer}>
                  <View style={styles.heroDividerLine} />
                  <Text style={styles.heroDividerStar}>✦</Text>
                  <View style={styles.heroDividerLine} />
                </View>

                {/* Wide tracked starlight-gold date */}
                <Text style={styles.heroDateMain}>
                  {`— ${activeSubEvent?.date || event.date || 'SAVE THE DATE'} —`.toUpperCase()}
                </Text>

                {/* Symmetrical parallel buttons block */}
                <View style={styles.heroActionRow}>
                  {/* Left: Gold bordered Square back/chevron icon button */}
                  <TouchableOpacity
                    style={[styles.heroSideButton, { borderColor: '#cca43b' }]}
                    onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
                  >
                    <IconSymbol name="chevron.left" size={16} color="#cca43b" />
                  </TouchableOpacity>

                  {/* Center: Glowing Enter Gallery pill button */}
                  <TouchableOpacity
                    style={styles.heroEnterButton}
                    onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  >
                    <Text style={styles.heroEnterButtonText}>ENTER GALLERY</Text>
                  </TouchableOpacity>

                  {/* Right: Gold bordered Square share icon button */}
                  <TouchableOpacity
                    style={[styles.heroSideButton, { borderColor: '#cca43b' }]}
                    onPress={() => setShowShareModal(true)}
                  >
                    <IconSymbol name="square.and.arrow.up" size={16} color="#cca43b" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. Infinite Dark Star Sign-off */}
              <View style={styles.heroBottomContent}>
                <View style={styles.brandLogoContainer}>
                  <Text style={styles.heroBrandText}>CINEMATIC EDITIONS — WED ALBUM</Text>
                </View>
                <TouchableOpacity
                  onPress={() => scrollViewRef.current?.scrollTo({ y: windowHeight, animated: true })}
                  style={styles.heroChevron}
                >
                  <IconSymbol name="chevron.down" size={20} color="#cca43b" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'pop') ? (
            <View style={[styles.popHeroCanvas, { height: 465 + insets.top }]}>
              {/* 1. Large Event Title Starburst Banner */}
              <View style={[styles.popTitleContainerOuter, { top: insets.top + 16 }]}>
                <View style={styles.popTitleContainerShadow} />
                <View style={styles.popTitleContainer}>
                  <Text style={styles.popTitleText}>
                    {activeSubEvent?.title || event.title}
                  </Text>
                </View>
              </View>

              {/* 2. Tilted White Polaroid Frame */}
              <View style={[styles.popPolaroidFrame, { marginTop: insets.top + 78 }]}>
                <View style={styles.popPolaroidInner}>
                  <Image 
                    source={{ uri: activeSubEvent?.coverImage || event.coverImage }} 
                    style={styles.popPolaroidImage} 
                    resizeMode="contain"
                  />
                  <View style={styles.popPolaroidOverlay} />
                </View>

                {/* Integrated Tactile Navigation Console */}
                <View style={styles.popPolaroidCaptionRow}>
                  <TouchableOpacity onPress={handleEventBack} style={styles.popCaptionBackBtn}>
                    <IconSymbol name="chevron.left" size={16} color="#ffffff" />
                  </TouchableOpacity>

                  <Text style={styles.popPolaroidCaption}>
                    {`${activeSubEvent?.date || event.date || 'PARTY TIME'}`.toUpperCase()}
                  </Text>

                  <TouchableOpacity onPress={() => setShowShareModal(true)} style={styles.popCaptionShareBtn}>
                    <IconSymbol name="square.and.arrow.up" size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                {/* Corner Starburst stickers */}
                <View style={[styles.popSticker, styles.popStickerLeft]}>
                  <Text style={styles.popStickerText}>BOOM! 🎉</Text>
                </View>
                <View style={[styles.popSticker, styles.popStickerRight]}>
                  <Text style={styles.popStickerText}>YEAH! 💥</Text>
                </View>
                {/* Birthday Cap Emoji Sticker */}
                <View style={styles.popStickerCapContainer}>
                  <Text style={styles.popStickerCapEmoji}>🥳</Text>
                </View>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'cyber_tech') ? (
            <View style={[styles.cyberHeroOverlay, { paddingTop: insets.top }]}>
              {/* Scanline Background & Ambient glow backdrops */}
              <View style={styles.cyberGridLines} />
              <View style={styles.cyberGlowDot1} />
              <View style={styles.cyberGlowDot2} />

              {/* Top status bar with centered Event Name and navigation icons */}
              <View style={styles.cyberTopBar}>
                {/* Left: Back Button */}
                <TouchableOpacity
                  style={styles.cyberHeaderButton}
                  onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
                >
                  <IconSymbol name="chevron.left" size={16} color="#00f0ff" />
                </TouchableOpacity>

                {/* Center: Centered Event Name */}
                <View style={styles.cyberTitleContainer}>
                  <Text style={styles.cyberPathText} numberOfLines={1} ellipsizeMode="tail">
                    {(activeSubEvent?.title || event.title).toUpperCase()}
                  </Text>
                </View>

                {/* Right: Share Button */}
                <TouchableOpacity
                  style={styles.cyberHeaderButton}
                  onPress={() => setShowShareModal(true)}
                >
                  <IconSymbol name="square.and.arrow.up" size={16} color="#00f0ff" />
                </TouchableOpacity>
              </View>

              {/* Poster frame in middle */}
              <View style={styles.cyberMiddleFrame}>
                <View style={styles.cyberPosterWrapper}>
                  {/* Decorative neon corners */}
                  <View style={[styles.cyberCorner, styles.cyberCornerTL]} />
                  <View style={[styles.cyberCorner, styles.cyberCornerTR]} />
                  <View style={[styles.cyberCorner, styles.cyberCornerBL]} />
                  <View style={[styles.cyberCorner, styles.cyberCornerBR]} />
                  
                  <Image 
                    source={{ uri: activeSubEvent?.coverImage || event?.coverImage || event?.coverUrl }} 
                    style={styles.cyberPosterImg}
                    resizeMode="cover"
                  />
                  {/* Scanning scanline bar */}
                  <View style={styles.cyberScanBar} />
                </View>
                <Text style={styles.cyberScanStatus}>[DECRYPTING MEMORIES... 100% SUCCESS]</Text>
              </View>

              {/* Bottom terminal console */}
              <View style={styles.cyberBottomConsole}>
                {/* Cyberpunk date display */}
                <View style={styles.cyberDateContainer}>
                  <Text style={styles.cyberDateText}>
                    {`JOIN US ON: ${activeSubEvent?.date || event.date || 'PENDING'}`.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'retro_arcade') ? (
            <View style={[styles.retroHeroOverlay, { paddingTop: insets.top }]}>
              {/* Arcade Top Bar Header */}
              <View style={styles.retroTopBar}>
                {/* Left: Back Button styled as a round arcade button */}
                <TouchableOpacity
                  style={styles.retroHeaderButtonBack}
                  onPress={handleEventBack}
                >
                  <IconSymbol name="chevron.left" size={18} color="#ffffff" />
                </TouchableOpacity>

                {/* Center: Uppercase Title */}
                <View style={styles.retroTitleContainer}>
                  <Text style={styles.retroPathText} numberOfLines={1} ellipsizeMode="tail">
                    {(activeSubEvent?.title || event.title).toUpperCase()}
                  </Text>
                </View>

                {/* Right: Share Button styled as a round arcade button */}
                <TouchableOpacity
                  style={styles.retroHeaderButtonShare}
                  onPress={() => setShowShareModal(true)}
                >
                  <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Poster frame in middle */}
              <View style={styles.retroMiddleFrame}>
                <View style={styles.retroPosterWrapper}>
                  <Image 
                    source={{ uri: activeSubEvent?.coverImage || event?.coverImage || event?.coverUrl }} 
                    style={styles.retroPosterImg}
                    resizeMode="cover"
                  />
                </View>
              </View>

              {/* High-Score / Ticket Date Console */}
              <View style={styles.retroBottomConsole}>
                <View style={styles.retroDateContainer}>
                  <Text style={styles.retroDateText}>
                    {`JOIN US ON: ${activeSubEvent?.date || event.date || 'PENDING'}`.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'neon_carnival') ? (
            <View style={[styles.neonCarnivalHeroOverlay, { paddingTop: insets.top }]}>
              {/* Cover Image spanning full background, blending top & bottom */}
              <View style={styles.neonCarnivalCoverWrapper}>
                <Image 
                  source={{ uri: activeSubEvent?.coverImage || event?.coverImage || event?.coverUrl }} 
                  style={styles.neonCarnivalCoverImg}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(12, 7, 20, 0.75)', 'rgba(12, 7, 20, 0.15)', '#0c0714']}
                  style={styles.neonCarnivalGradient}
                />
              </View>

              {/* Top status bar with Event Name and navigation icons */}
              <View style={styles.neonCarnivalTopBar}>
                <TouchableOpacity
                  style={styles.neonCarnivalHeaderButton}
                  onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
                >
                  <IconSymbol name="chevron.left" size={16} color="#faf5ff" />
                </TouchableOpacity>

                {/* Right: Share Button */}
                <TouchableOpacity
                  style={styles.neonCarnivalHeaderButton}
                  onPress={() => setShowShareModal(true)}
                >
                  <IconSymbol name="square.and.arrow.up" size={16} color="#faf5ff" />
                </TouchableOpacity>
              </View>

              <View style={styles.neonCarnivalContent}>
                {/* Title and Date */}
                <Text style={styles.neonCarnivalDateText}>
                  {activeSubEvent?.date || event.date || 'DATE TBD'}
                </Text>
                
                <View style={styles.neonCarnivalTitleWrapper}>
                  <Text style={styles.neonCarnivalTitle} numberOfLines={2} adjustsFontSizeToFit>
                    {(activeSubEvent?.title || event.title).toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ) : (!showAdminView && event?.templateId === 'academic_editorial') ? (
            null
          ) : (!showAdminView && isGardenTemplate) ? (
            <View style={[StyleSheet.absoluteFillObject, { paddingTop: insets.top + 2 }]}>
              {/* Single top bar row: [← back  share↑]  ···  [title / date] */}
              <View style={styles.gardenTopBar}>
                {/* Left: back + share */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={styles.gardenHeaderButton}
                    onPress={handleEventBack}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <IconSymbol name="chevron.left" size={20} color="#ffffff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.gardenHeaderButton}
                    onPress={() => setShowShareModal(true)}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                {/* Right: title + date stacked */}
                <View style={{ alignItems: 'flex-end', flex: 1, paddingLeft: 12 }}>
                  <Text
                    style={[styles.gardenTitle, { fontFamily: selectedTemplate.serifBold, color: '#ffffff', textAlign: 'right', fontSize: 20, lineHeight: 26 }]}
                    numberOfLines={2}
                  >
                    {activeSubEvent?.title || event.title}
                  </Text>
                  {(activeSubEvent?.date || event.date) && (
                    <Text style={[styles.gardenDate, { fontFamily: selectedTemplate.serifItalic, color: 'rgba(255,255,255,0.85)', textAlign: 'right' }]}>
                      {activeSubEvent?.date || event.date}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ) : (!showAdminView && isGoldenYearsTemplate) ? (
            <View style={styles.goldenCeremonyHero}>
              <LinearGradient
                colors={['rgba(63, 47, 34, 0.18)', 'rgba(255, 250, 240, 0.18)', 'rgba(63, 47, 34, 0.38)']}
                locations={[0, 0.48, 1]}
                style={styles.goldenCeremonyVignette}
              />
              <LinearGradient
                colors={['rgba(255, 250, 240, 0.56)', 'rgba(255, 250, 240, 0.16)', 'rgba(255, 250, 240, 0)']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.88, y: 0.78 }}
                style={styles.goldenCeremonyCreamWash}
              />
              <View style={styles.goldenCeremonyTexture}>
                <View style={[styles.goldenGrainLine, styles.goldenGrainLineOne]} />
                <View style={[styles.goldenGrainLine, styles.goldenGrainLineTwo]} />
                <View style={[styles.goldenGrainDot, styles.goldenGrainDotOne]} />
                <View style={[styles.goldenGrainDot, styles.goldenGrainDotTwo]} />
                <View style={[styles.goldenGrainDot, styles.goldenGrainDotThree]} />
              </View>
              <View style={styles.goldenCeremonyHalo} />
              <View style={styles.goldenCeremonyFrame}>
                <View style={[styles.goldenCeremonyCorner, styles.goldenCeremonyCornerTopLeft]} />
                <View style={[styles.goldenCeremonyCorner, styles.goldenCeremonyCornerTopRight]} />
                <View style={[styles.goldenCeremonyCorner, styles.goldenCeremonyCornerBottomLeft]} />
                <View style={[styles.goldenCeremonyCorner, styles.goldenCeremonyCornerBottomRight]} />
              </View>
              <Animated.View
                entering={FadeInUp.delay(90).duration(760).springify().damping(18)}
                style={styles.goldenCeremonyPhotoMotion}
              >
                <View style={styles.goldenCeremonyPhotoCard}>
                  <Image
                    source={{ uri: activeSubEvent?.coverImage || event.coverImage }}
                    style={styles.goldenCeremonyPhoto}
                    resizeMode="cover"
                  />
                  <View style={styles.goldenCeremonyPhotoVeil} />
                </View>
              </Animated.View>
              <View style={styles.goldenCeremonyYearRail}>
                <Text style={styles.goldenCeremonyYearRailText}>FOREVER</Text>
              </View>
              <Animated.View
                entering={FadeInUp.delay(160).duration(820).springify().damping(20)}
                style={styles.goldenCeremonyContent}
              >
                <Text style={styles.goldenCeremonyKicker}>Anniversary Legacy</Text>
                <View style={styles.goldenCeremonySeal}>
                  <Text style={styles.goldenCeremonySealText}>∞</Text>
                </View>
                <Text style={styles.goldenCeremonyTitle}>{activeSubEvent?.title || event.title}</Text>
                <View style={styles.goldenCeremonyRule}>
                  <View style={styles.goldenCeremonyRuleLine} />
                  <View style={styles.goldenCeremonyRuleDot} />
                  <View style={styles.goldenCeremonyRuleLine} />
                </View>
                <Text style={styles.goldenCeremonyDate}>{activeSubEvent?.date || event.date}</Text>
                <TouchableOpacity style={styles.goldenCeremonyShare} onPress={handleShare}>
                  <IconSymbol name="square.and.arrow.up" size={14} color="#3f2f22" />
                  <Text style={styles.goldenCeremonyShareText}>Share Event</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : (!showAdminView && isVintageTemplate) ? (
            <View style={styles.vintageEditorialHero}>
              <LinearGradient
                colors={['rgba(15, 14, 11, 0.86)', 'rgba(28, 24, 18, 0.62)', 'rgba(15, 14, 11, 0.96)']}
                locations={[0, 0.5, 1]}
                style={styles.vintageEditorialVignette}
              />
              <View style={styles.vintageEditorialTexture}>
                <View style={[styles.vintageGrainLine, styles.vintageGrainLineOne]} />
                <View style={[styles.vintageGrainLine, styles.vintageGrainLineTwo]} />
                <View style={[styles.vintageGrainDot, styles.vintageGrainDotOne]} />
                <View style={[styles.vintageGrainDot, styles.vintageGrainDotTwo]} />
                <View style={[styles.vintageGrainDot, styles.vintageGrainDotThree]} />
              </View>
              <View style={styles.vintageEditorialMasthead}>
                <Text style={styles.vintageEditorialMastheadText}>THE ANNIVERSARY JOURNAL</Text>
              </View>
              <View style={styles.vintageEditorialTopBar}>
                <Text style={styles.vintageEditorialEdition}>Vol. {new Date().getFullYear()}</Text>
                <Text style={styles.vintageEditorialEdition}>Anniversary Archive</Text>
              </View>
              <Animated.View
                entering={FadeInUp.delay(100).duration(780).springify().damping(19)}
                style={styles.vintageEditorialFeatureRow}
              >
                <View style={styles.vintageEditorialImagePlate}>
                  <View style={styles.vintageEditorialTape} />
                  <View style={styles.vintageEditorialClip} />
                  <Image
                    source={{ uri: activeSubEvent?.coverImage || event.coverImage }}
                    style={styles.vintageEditorialImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['rgba(67, 46, 23, 0.16)', 'rgba(17, 14, 9, 0.28)']}
                    style={styles.vintageEditorialImageFade}
                  />
                </View>
                <View style={styles.vintageEditorialNumberBlock}>
                  <Text style={styles.vintageEditorialNumber}>25</Text>
                  <Text style={styles.vintageEditorialNumberLabel}>moments</Text>
                </View>
              </Animated.View>
              <Animated.View
                entering={FadeInUp.delay(170).duration(820).springify().damping(20)}
                style={styles.vintageEditorialBand}
              >
                <Text style={styles.vintageEditorialTitle}>{activeSubEvent?.title || event.title}</Text>
              </Animated.View>
              <View style={styles.vintageEditorialFooter}>
                <Text style={styles.vintageEditorialDate}>{activeSubEvent?.date || event.date}</Text>
                <TouchableOpacity style={styles.vintageEditorialShare} onPress={handleShare}>
                  <Text style={styles.vintageEditorialShareText}>Share</Text>
                  <IconSymbol name="square.and.arrow.up" size={13} color="#B89145" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && isRoseTemplate) ? (
            <View style={styles.roseBloomHero}>
              <LinearGradient
                colors={['rgba(255, 249, 245, 0.74)', 'rgba(248, 218, 224, 0.38)', 'rgba(255, 249, 245, 0.94)']}
                locations={[0, 0.46, 1]}
                style={styles.roseBloomWash}
              />
              <View style={[styles.roseBloomOrb, styles.roseBloomOrbLarge]} />
              <View style={[styles.roseBloomOrb, styles.roseBloomOrbSmall]} />
              <View style={styles.roseBloomGrain}>
                <View style={[styles.roseBloomGrainDot, styles.roseBloomGrainDotOne]} />
                <View style={[styles.roseBloomGrainDot, styles.roseBloomGrainDotTwo]} />
                <View style={[styles.roseBloomGrainDot, styles.roseBloomGrainDotThree]} />
              </View>
              <View style={styles.roseBloomVine}>
                <View style={[styles.roseBloomPetal, styles.roseBloomPetalA]} />
                <View style={[styles.roseBloomPetal, styles.roseBloomPetalB]} />
                <View style={[styles.roseBloomPetal, styles.roseBloomPetalC]} />
              </View>
              <View style={styles.roseBloomHeader}>
                <Text style={styles.roseBloomHeaderTitle}>Rose Garden Anniversary</Text>
                <Text style={styles.roseBloomHeaderSubtitle}>Our Story, Our Forever</Text>
                <View style={styles.roseBloomHeaderDivider}>
                  <View style={styles.roseBloomHeaderLine} />
                  <View style={styles.roseBloomHeaderFlower}>
                    <View style={[styles.roseBloomHeaderPetal, styles.roseBloomHeaderPetalTop]} />
                    <View style={[styles.roseBloomHeaderPetal, styles.roseBloomHeaderPetalRight]} />
                    <View style={[styles.roseBloomHeaderPetal, styles.roseBloomHeaderPetalBottom]} />
                    <View style={[styles.roseBloomHeaderPetal, styles.roseBloomHeaderPetalLeft]} />
                  </View>
                  <View style={styles.roseBloomHeaderLine} />
                </View>
              </View>
              <View style={styles.roseBloomPhotoStamp}>
                <View style={styles.roseBloomPhotoTape} />
                <View style={styles.roseBloomPhotoCorner} />
                <Image
                  source={{ uri: activeSubEvent?.coverImage || event.coverImage }}
                  style={styles.roseBloomPhoto}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.roseBloomMomentCard}>
                <Text style={styles.roseBloomMomentNumber}>{photos.length || 25}</Text>
                <Text style={styles.roseBloomMomentLabel}>Moments</Text>
                <View style={styles.roseBloomMomentDivider} />
              </View>
              <View style={styles.roseBloomCard}>
                <View style={styles.roseBloomKickerRow}>
                  <View style={styles.roseBloomKickerDot} />
                  <Text style={styles.roseBloomKicker}>Rose Garden Anniversary</Text>
                  <View style={styles.roseBloomKickerLine} />
                </View>
                <Text style={styles.roseBloomTitle}>{activeSubEvent?.title || event.title}</Text>
                <View style={styles.roseBloomStem}>
                  <View style={styles.roseBloomLeaf} />
                  <View style={styles.roseBloomStemLine} />
                  <View style={[styles.roseBloomLeaf, styles.roseBloomLeafAlt]} />
                </View>
                <Text style={styles.roseBloomDate}>{activeSubEvent?.date || event.date}</Text>
                <TouchableOpacity style={styles.roseBloomShare} onPress={handleShare}>
                  <IconSymbol name="square.and.arrow.up" size={14} color="#5c2632" />
                  <Text style={styles.roseBloomShareText}>Share Event</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (!showAdminView && isMinimalLoveTemplate) ? (
            <View style={styles.minimalEditorialHero}>
              <LinearGradient
                colors={['rgba(247, 239, 228, 0.16)', 'rgba(247, 239, 228, 0.78)', '#f7efe4']}
                locations={[0, 0.58, 1]}
                style={styles.minimalEditorialWash}
              />
              <View style={[styles.minimalEditorialBotanical, styles.minimalEditorialBotanicalLeft]}>
                <View style={styles.minimalEditorialStem} />
                <View style={[styles.minimalEditorialLeaf, styles.minimalEditorialLeafOne]} />
                <View style={[styles.minimalEditorialLeaf, styles.minimalEditorialLeafTwo]} />
              </View>
              <View style={[styles.minimalEditorialBotanical, styles.minimalEditorialBotanicalRight]}>
                <View style={styles.minimalEditorialStem} />
                <View style={[styles.minimalEditorialLeaf, styles.minimalEditorialLeafOne]} />
                <View style={[styles.minimalEditorialLeaf, styles.minimalEditorialLeafTwo]} />
              </View>
              <View style={styles.minimalEditorialPhotoPanel}>
                <View style={styles.minimalEditorialTape} />
                <Image
                  source={{ uri: activeSubEvent?.coverImage || event.coverImage }}
                  style={styles.minimalEditorialPhoto}
                  resizeMode="cover"
                />
                <View style={styles.minimalEditorialPhotoFade} />
              </View>
              <View style={styles.minimalEditorialGridLineVertical} />
              <View style={styles.minimalEditorialGridLineHorizontal} />
              <View style={styles.minimalEditorialContent}>
                <Text style={styles.minimalEditorialKicker}>Anniversary Journal</Text>
                <Text style={styles.minimalEditorialTitle}>{activeSubEvent?.title || event.title}</Text>
                <View style={styles.minimalEditorialDivider}>
                  <View style={styles.minimalEditorialDividerLine} />
                  <View style={styles.minimalEditorialDividerOrnament} />
                  <View style={styles.minimalEditorialDividerLine} />
                </View>
                <View style={styles.minimalEditorialMetaRow}>
                  <Text style={styles.minimalEditorialDate}>{activeSubEvent?.date || event.date}</Text>
                  <TouchableOpacity style={styles.minimalEditorialShare} onPress={handleShare}>
                    <IconSymbol name="square.and.arrow.up" size={14} color="#fffaf2" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.minimalEditorialIndex}>
                <Text style={styles.minimalEditorialIndexText}>{photos.length || 1}</Text>
                <Text style={styles.minimalEditorialIndexLabel}>Moments</Text>
              </View>
            </View>
          ) : (
            <View style={[
              styles.heroContent,
              isScrapbookTemplate && styles.scrapbookHeroContent,
              isNeonTemplate && styles.neonHeroContent,
              isPastelTemplate && styles.pastelHeroContent,
              isPopTemplate && styles.popHeroContent,
              isGoldenYearsTemplate && styles.goldenHeroContent,
              isVintageTemplate && styles.vintageHeroContent,
              isRoseTemplate && styles.roseHeroContent,
              isMinimalLoveTemplate && styles.minimalHeroContent,
            ]}>
              {isScrapbookTemplate && (
                <>
                  <View style={[styles.scrapbookTape, styles.scrapbookTapeLeft]} />
                  <View style={[styles.scrapbookTape, styles.scrapbookTapeRight]} />
                  <View style={styles.scrapbookSticker}>
                    <Text style={styles.scrapbookStickerText}>Birthday memories</Text>
                  </View>
                  <View style={styles.scrapbookHeroRule}>
                    <View style={styles.scrapbookHeroRuleLine} />
                    <View style={[styles.scrapbookHeroDot, { backgroundColor: selectedTemplate.accent }]} />
                    <View style={styles.scrapbookHeroRuleLine} />
                  </View>
                </>
              )}
              {isNeonTemplate && (
                <>
                  <View style={[styles.neonLightStreak, styles.neonLightStreakTop]} />
                  <View style={[styles.neonLightStreak, styles.neonLightStreakBottom]} />
                  <View style={styles.neonHeroChip}>
                    <View style={styles.neonHeroChipDot} />
                    <Text style={styles.neonHeroChipText}>Neon party</Text>
                  </View>
                  <View style={styles.neonHeroDivider}>
                    <View style={styles.neonHeroDividerLine} />
                    <View style={styles.neonHeroDividerCore} />
                    <View style={styles.neonHeroDividerLine} />
                  </View>
                </>
              )}
              {isPastelTemplate && (
                <>
                  <View style={[styles.pastelFloatOrb, styles.pastelFloatOrbPink]} />
                  <View style={[styles.pastelFloatOrb, styles.pastelFloatOrbBlue]} />
                  <View style={styles.pastelHeroChip}>
                    <View style={styles.pastelHeroSparkle} />
                    <Text style={styles.pastelHeroChipText}>Sweet birthday journal</Text>
                  </View>
                  <View style={styles.pastelHeroDivider}>
                    <View style={styles.pastelHeroDividerDot} />
                    <View style={styles.pastelHeroDividerLine} />
                    <View style={[styles.pastelHeroDividerDot, styles.pastelHeroDividerDotAlt]} />
                  </View>
                </>
              )}
              {isPopTemplate && (
                <>
                  <View style={[styles.popBurstShape, styles.popBurstShapePink]} />
                  <View style={[styles.popBurstShape, styles.popBurstShapeBlue]} />
                  <View style={styles.popHeroSticker}>
                    <Text style={styles.popHeroStickerText}>WOW!</Text>
                  </View>
                  <Text style={styles.popHeroChipText}>★ GALLERY HIGHLIGHTS ★</Text>
                  <View style={styles.popHeroDivider}>
                    <View style={styles.popHeroDividerBlock} />
                    <View style={styles.popHeroDividerLine} />
                    <View style={[styles.popHeroDividerBlock, styles.popHeroDividerBlockAlt]} />
                  </View>
                </>
              )}
              {isGoldenYearsTemplate && (
                <>
                  <View style={[styles.anniversaryRibbon, styles.goldenRibbon]} />
                  <Text style={styles.goldenHeroLabel}>Golden Years</Text>
                  <View style={styles.goldenHeroRule}>
                    <View style={styles.goldenHeroRuleLine} />
                    <View style={styles.goldenHeroMedallion} />
                    <View style={styles.goldenHeroRuleLine} />
                  </View>
                </>
              )}
              {isVintageTemplate && (
                <>
                  <Text style={styles.vintageHeroIssue}>Anniversary archive</Text>
                  <View style={styles.vintageHeroRule} />
                </>
              )}
              {isRoseTemplate && (
                <>
                  <View style={[styles.rosePetal, styles.rosePetalOne]} />
                  <View style={[styles.rosePetal, styles.rosePetalTwo]} />
                  <Text style={styles.roseHeroLabel}>Rose Garden</Text>
                  <View style={styles.roseHeroVine} />
                </>
              )}
              {isMinimalLoveTemplate && (
                <>
                  <Text style={styles.minimalHeroLabel}>A quiet love story</Text>
                  <View style={styles.minimalHeroRule} />
                </>
              )}
              <View style={styles.titleRowMain}>
                <Text style={[
                  styles.heroTitle,
                  { color: selectedTemplate.text, flex: 1 },
                  isScrapbookTemplate && styles.scrapbookHeroTitle,
                  isNeonTemplate && styles.neonHeroTitle,
                  isPastelTemplate && styles.pastelHeroTitle,
                  isPopTemplate && styles.popHeroTitle,
                  isGoldenYearsTemplate && styles.goldenHeroTitle,
                  isVintageTemplate && styles.vintageHeroTitle,
                  isRoseTemplate && styles.roseHeroTitle,
                  isMinimalLoveTemplate && styles.minimalHeroTitle,
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
              <View style={[
                styles.heroMeta,
                isNeonTemplate && styles.neonHeroMeta,
                isPastelTemplate && styles.pastelHeroMeta,
                isPopTemplate && styles.popHeroMeta,
                isGoldenYearsTemplate && styles.goldenHeroMeta,
                isVintageTemplate && styles.vintageHeroMeta,
                isRoseTemplate && styles.roseHeroMeta,
                isMinimalLoveTemplate && styles.minimalHeroMeta,
              ]}>
                <IconSymbol name="calendar" size={12} color={selectedTemplate.accent} />
                <Text style={[
                  styles.heroDate,
                  { color: selectedTemplate.accent },
                  isNeonTemplate && styles.neonHeroDate,
                  isPastelTemplate && styles.pastelHeroDate,
                  isPopTemplate && styles.popHeroDate,
                  isAnniversaryTemplate && styles.anniversaryHeroDate,
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
                style={[
                  styles.heroMeta,
                  { marginTop: 12 },
                  isNeonTemplate && styles.neonShareButton,
                  isPastelTemplate && styles.pastelShareButton,
                  isPopTemplate && styles.popShareButton,
                  isAnniversaryTemplate && styles.anniversaryShareButton,
                ]}
                onPress={handleShare}
              >
                <IconSymbol name="square.and.arrow.up" size={12} color={selectedTemplate.accent} />
                <Text style={[
                  styles.heroDate,
                  { color: selectedTemplate.accent },
                  isNeonTemplate && styles.neonHeroDate,
                  isPastelTemplate && styles.pastelHeroDate,
                  isPopTemplate && styles.popHeroDate,
                  isAnniversaryTemplate && styles.anniversaryHeroDate,
                ]}>Share Event</Text>
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
                    <IconSymbol name="chevron.right" size={16} color={MidnightColors.gold} />
                  </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.designCard, { marginTop: 12 }]}
                      onPress={() => setShowTemplateModal(true)}
                    >
                      <View style={styles.designInfo}>
                        <Text style={styles.designLabel}>Change Template</Text>
                        <Text style={styles.designValue}>{event.templateId ? MOBILE_TEMPLATE_THEMES.find(t => t.id === event.templateId)?.label : 'Hero (Default)'}</Text>
                      </View>
                      <IconSymbol name="chevron.right" size={16} color={MidnightColors.gold} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.designCard, { marginTop: 12, backgroundColor: 'rgba(212, 175, 55, 0.08)', borderColor: 'rgba(212, 175, 55, 0.3)', borderWidth: 1 }]}
                      onPress={() => setIsAdminViewActive(false)}
                    >
                      <View style={styles.designInfo}>
                        <Text style={[styles.designLabel, { color: '#cca43b' }]}>Preview Guest Theme</Text>
                        <Text style={[styles.designValue, { color: '#cbd5e1', fontSize: 12, fontFamily: Fonts.inter.regular, marginTop: 2 }]}>
                          See how guests view your {event.templateId ? MOBILE_TEMPLATE_THEMES.find(t => t.id === event.templateId)?.label : 'Hero'} theme
                        </Text>
                      </View>
                      <IconSymbol name="eye.fill" size={16} color="#cca43b" />
                    </TouchableOpacity>
                </View>
              )}

              {activeTab === 'partners' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Event Partners</Text>

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
                {event.showWelcomeCard !== false && activeSubEvent?.id !== 'event-partners' && (
                  <View style={[
                    styles.mainInfoBox,
                    {
                      backgroundColor: selectedTemplate.panel,
                      borderColor: event.templateId === 'classic' ? 'rgba(0,0,0,0.05)' : selectedTemplate.accentBg,
                      borderRadius: selectedTemplate.radius,
                    },
                    isScrapbookTemplate && styles.scrapbookInfoBox,
                    isNeonTemplate && styles.neonInfoBox,
                    isPastelTemplate && styles.pastelInfoBox,
                    isPopTemplate && styles.popInfoBox,
                    isGoldenYearsTemplate && styles.goldenInfoBox,
                    isVintageTemplate && styles.vintageInfoBox,
                    isRoseTemplate && styles.roseInfoBox,
                    isMinimalLoveTemplate && styles.minimalInfoBox,
                    isCyberTechTemplate && styles.cyberInfoBox,
                    isRetroArcadeTemplate && styles.retroArcadeInfoBox,
                    isNeonCarnivalTemplate && styles.neonCarnivalInfoBox,
                    isGardenTemplate && styles.gardenInfoBox,
                    event.templateId === 'classic' && {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.04,
                      shadowRadius: 2,
                      elevation: 1,
                      borderWidth: 1,
                    },
                    event.templateId === 'royal' && {
                      borderWidth: 1,
                      borderColor: 'rgba(204, 164, 59, 0.35)',
                      borderRadius: 12,
                      padding: 10,
                      borderLeftWidth: 1, // override dynamic left border stripe
                    },
                    event.templateId === 'hero' && {
                      borderWidth: 0.8,
                      borderColor: '#cca43b',
                      borderRadius: 4,
                      padding: 12,
                      borderLeftWidth: 0.8, // override dynamic left border stripe
                    },
                    event.templateId === 'ethereal' && {
                      borderWidth: 1,
                      borderColor: selectedTemplate.accent + '4d',
                      borderRadius: 2,
                      padding: 8,
                      borderLeftWidth: 1, // override dynamic left border stripe
                    },
                    event.templateId === 'academic_editorial' && {
                      borderWidth: 1,
                      borderColor: selectedTemplate.text,
                      borderRadius: 0,
                      padding: 6,
                      borderLeftWidth: 1, // override dynamic left border stripe
                    }
                  ]}>
                    <View style={[
                      isScrapbookTemplate && styles.scrapbookInfoInner,
                      isNeonTemplate && styles.neonInfoInner,
                      isPastelTemplate && styles.pastelInfoInner,
                      isPopTemplate && styles.popInfoInner,
                      isGoldenYearsTemplate && styles.goldenInfoInner,
                      isVintageTemplate && styles.vintageInfoInner,
                      isRoseTemplate && styles.roseInfoInner,
                      isMinimalLoveTemplate && styles.minimalInfoInner,
                      isCyberTechTemplate && styles.cyberInfoInner,
                      isRetroArcadeTemplate && styles.retroArcadeInfoInner,
                      isNeonCarnivalTemplate && styles.neonCarnivalInfoInner,
                      isGardenTemplate && styles.gardenInfoInner,
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
                      event.templateId === 'hero' && {
                        borderWidth: 0.8,
                        borderColor: 'rgba(204, 164, 59, 0.25)',
                        borderRadius: 2,
                        paddingVertical: 24,
                        paddingHorizontal: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      },
                      event.templateId === 'ethereal' && {
                        borderWidth: 0.5,
                        borderColor: selectedTemplate.accent + '33',
                        borderRadius: 1,
                        paddingVertical: 24,
                        paddingHorizontal: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      },
                      event.templateId === 'academic_editorial' && {
                        borderWidth: 0.5,
                        borderColor: selectedTemplate.text + '26',
                        borderRadius: 0,
                        paddingVertical: 20,
                        paddingHorizontal: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        backgroundColor: selectedTemplate.background,
                      },
                      { position: 'relative' }
                    ]}>
                      {isScrapbookTemplate && (
                        <View style={styles.scrapbookInfoRule}>
                          <View style={[styles.scrapbookInfoRuleLine, { backgroundColor: selectedTemplate.accent }]} />
                          <View style={styles.scrapbookInfoRuleShort} />
                        </View>
                      )}

                      {event.templateId === 'royal' && (
                        <Text style={{ color: selectedTemplate.accent, fontSize: 10, marginBottom: 12 }}>✦  ♦  ✦</Text>
                      )}
                      {event.templateId === 'hero' && (
                        <Text style={{ color: selectedTemplate.accent, fontSize: 11, marginBottom: 14, letterSpacing: 2 }}>✦   ♦   ✦</Text>
                      )}
                      {event.templateId === 'ethereal' && (
                        <Text style={{ color: selectedTemplate.accent, fontSize: 14, marginBottom: 12, fontFamily: selectedTemplate.serifFont }}>❦</Text>
                      )}
                      {event.templateId === 'academic_editorial' && (
                        <Text style={{ color: selectedTemplate.accent, fontSize: 14, marginBottom: 12, fontFamily: selectedTemplate.serifFont }}>§</Text>
                      )}

                      {isCyberTechTemplate && (
                        <View style={styles.cyberInfoHeader}>
                          <Text style={styles.cyberInfoKicker}>[BROADCAST INCOMING]</Text>
                        </View>
                      )}

                      {isNeonTemplate && (
                        <View style={styles.neonInfoHeader}>
                          <View style={styles.neonInfoPulse} />
                          <Text style={styles.neonInfoKicker}>Party highlights</Text>
                          <View style={styles.neonInfoLine} />
                        </View>
                      )}

                      {isPastelTemplate && (
                        <View style={styles.pastelInfoHeader}>
                          <View style={styles.pastelInfoPetal} />
                          <Text style={styles.pastelInfoKicker}>Sweet Memories</Text>
                          <View style={styles.pastelInfoLine} />
                        </View>
                      )}

                      {isPopTemplate && (
                        <>
                          <View style={styles.popInfoHeader}>
                            <Text style={styles.popInfoBang}>!</Text>
                            <Text style={styles.popInfoKicker}>{"Host's Broadcast"}</Text>
                            <View style={styles.popInfoStripe} />
                          </View>
                          {/* Speech Bubble Tail */}
                          <View style={styles.popBubbleTailOuter}>
                            <View style={styles.popBubbleTail} />
                          </View>
                        </>
                      )}

                      {isRetroArcadeTemplate && (
                        <View style={styles.retroArcadeInfoHeader}>
                          <View style={styles.retroArcadeInfoBadge}>
                            <Text style={styles.retroArcadeInfoBadgeText}>! BROADCAST</Text>
                          </View>
                          <View style={styles.retroArcadeInfoStripe} />
                        </View>
                      )}

                      {isNeonCarnivalTemplate && (
                        <View style={styles.neonCarnivalInfoHeader}>
                          <View style={styles.neonCarnivalInfoPulse} />
                          <Text style={styles.neonCarnivalInfoKicker}>CARNIVAL BROADCAST</Text>
                          <View style={styles.neonCarnivalInfoLine} />
                        </View>
                      )}

                      {isGardenTemplate && (
                        <View style={styles.gardenInfoHeader}>
                          <IconSymbol name="leaf.fill" size={14} color="#16a34a" />
                          <Text style={[styles.gardenInfoKicker, { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic', color: '#16a34a' }]}>
                            Garden Letter
                          </Text>
                          <View style={[styles.gardenInfoLine, { backgroundColor: 'rgba(22, 163, 74, 0.2)' }]} />
                        </View>
                      )}

                      {isAnniversaryTemplate && (
                        <View style={[
                          styles.anniversaryInfoHeader,
                          isVintageTemplate && styles.vintageInfoHeader,
                          isMinimalLoveTemplate && styles.minimalInfoHeader,
                        ]}>
                          <View style={[
                            styles.anniversaryInfoMark,
                            isGoldenYearsTemplate && styles.goldenInfoMark,
                            isVintageTemplate && styles.vintageInfoMark,
                            isRoseTemplate && styles.roseInfoMark,
                            isMinimalLoveTemplate && styles.minimalInfoMark,
                          ]} />
                          <Text style={[
                            styles.anniversaryInfoKicker,
                            isGoldenYearsTemplate && styles.goldenInfoKicker,
                            isVintageTemplate && styles.vintageInfoKicker,
                            isRoseTemplate && styles.roseInfoKicker,
                            isMinimalLoveTemplate && styles.minimalInfoKicker,
                          ]}>
                            {isGoldenYearsTemplate ? 'Legacy notes' : isVintageTemplate ? 'Archive note' : isRoseTemplate ? 'Garden letter' : 'Love note'}
                          </Text>
                          <View style={[
                            styles.anniversaryInfoLine,
                            isGoldenYearsTemplate && styles.goldenInfoLine,
                            isVintageTemplate && styles.vintageInfoLine,
                            isRoseTemplate && styles.roseInfoLine,
                            isMinimalLoveTemplate && styles.minimalInfoLine,
                          ]} />
                        </View>
                      )}

                      <Text style={[
                        styles.visitorDescription,
                        { color: event.templateId === 'royal' ? selectedTemplate.accent : selectedTemplate.text },
                        isNeonTemplate && styles.neonVisitorDescription,
                        isPastelTemplate && styles.pastelVisitorDescription,
                        isPopTemplate && styles.popVisitorDescription,
                        isGoldenYearsTemplate && styles.goldenVisitorDescription,
                        isVintageTemplate && styles.vintageVisitorDescription,
                        isRoseTemplate && styles.roseVisitorDescription,
                        isMinimalLoveTemplate && styles.minimalVisitorDescription,
                        isCyberTechTemplate && styles.cyberVisitorDescription,
                        isRetroArcadeTemplate && styles.retroArcadeVisitorDescription,
                        isNeonCarnivalTemplate && styles.neonCarnivalVisitorDescription,
                        isGardenTemplate && styles.gardenVisitorDescription,
                        selectedTemplate.useSerif && {
                          fontFamily: selectedTemplate.serifItalic,
                          fontStyle: 'italic',
                          fontSize: 16,
                          lineHeight: 26,
                          textAlign: 'center',
                        }
                      ]}>{activeSubEvent ? activeSubEvent.description : event.description}{(isCyberTechTemplate || isRetroArcadeTemplate || isNeonCarnivalTemplate) ? '' : ' 🤍'}</Text>

                      {isScrapbookTemplate && (
                        <View style={[styles.scrapbookInfoRule, styles.scrapbookInfoRuleBottom]}>
                          <View style={styles.scrapbookInfoRuleShort} />
                          <View style={[styles.scrapbookInfoRuleLine, { backgroundColor: selectedTemplate.accent }]} />
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {renderThemeDivider()}

                {activeSubEvent?.id === 'event-partners' ? (
                  <View style={{ paddingTop: (isPopTemplate || isRetroArcadeTemplate) ? 10 : 40, paddingBottom: 24, paddingHorizontal: 20 }}>
                    <View style={{ alignItems: 'center', marginBottom: 32 }}>
                      <Text style={[
                        { fontSize: 28, color: selectedTemplate.text, marginBottom: 8 },
                        isPopTemplate && { fontFamily: FunkyFonts.marker, fontSize: 32, color: '#0080ff', textTransform: 'uppercase', letterSpacing: -0.5 },
                        isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, fontSize: 32, color: '#ff3562', textTransform: 'uppercase', letterSpacing: 0.5 },
                        isCyberTechTemplate && styles.cyberPartnersTitle,
                        isNeonCarnivalTemplate && styles.neonCarnivalPartnersTitle,
                        selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }
                      ]}>The Dream Team</Text>
                      <Text style={[
                        { fontSize: 14, color: selectedTemplate.muted, textAlign: 'center', lineHeight: 22, maxWidth: '80%' },
                        isPopTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', fontSize: 13, textTransform: 'uppercase', letterSpacing: -0.2 },
                        isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.2 },
                        isCyberTechTemplate && styles.cyberPartnersSubtitle,
                        isNeonCarnivalTemplate && styles.neonCarnivalPartnersSubtitle
                      ]}>
                        {`The incredible businesses and vendors who brought this beautiful ${event?.category?.toLowerCase() === 'birthday' ? 'birthday' : event?.category?.toLowerCase() === 'wedding' ? 'wedding' : `${event?.category?.toLowerCase() || 'event'} event`} to life.`}
                      </Text>
                    </View>

                    {linkedVendors.length === 0 ? (
                      <View style={[
                        { alignItems: 'center', paddingVertical: 40, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
                        isPopTemplate && {
                          backgroundColor: '#fffdf3',
                          borderWidth: 3,
                          borderColor: '#231f20',
                          borderRadius: 18,
                          shadowColor: '#ef2b3a',
                          shadowOffset: { width: 5, height: 5 },
                          shadowOpacity: 1,
                          shadowRadius: 0,
                          elevation: 4,
                        },
                        isRetroArcadeTemplate && {
                          backgroundColor: '#ffffff',
                          borderWidth: 3,
                          borderColor: '#231f20',
                          borderRadius: 18,
                          shadowColor: '#231f20',
                          shadowOffset: { width: 5, height: 5 },
                          shadowOpacity: 1,
                          shadowRadius: 0,
                          elevation: 4,
                        },
                        isCyberTechTemplate && styles.cyberPartnerCard,
                        isNeonCarnivalTemplate && styles.neonCarnivalPartnerCard,
                        isGardenTemplate && [styles.gardenPartnerCard, { backgroundColor: isDark ? '#1B3224' : '#FDFBF7', borderColor: isDark ? 'rgba(74, 222, 128, 0.15)' : 'rgba(46, 111, 64, 0.08)' }]
                      ]}>
                         <IconSymbol name="building.2" size={32} color={isPopTemplate ? '#0080ff' : (isCyberTechTemplate ? '#00f0ff' : (isRetroArcadeTemplate ? '#ff3562' : (isNeonCarnivalTemplate ? '#d946ef' : selectedTemplate.accent)))} />
                         <Text style={[
                           { color: selectedTemplate.muted, marginTop: 16, fontSize: 15, fontWeight: '500' },
                           isPopTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', textTransform: 'uppercase', fontSize: 13 },
                           isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', textTransform: 'uppercase', fontSize: 13 },
                           isCyberTechTemplate && styles.cyberEmptyText,
                           isNeonCarnivalTemplate && styles.neonCarnivalEmptyText
                         ]}>Vendor list coming soon...</Text>
                      </View>
                    ) : (
                      <View style={{ gap: (isPopTemplate || isRetroArcadeTemplate) ? 20 : 16 }}>
                        {linkedVendors.map((biz) => (
                          <TouchableOpacity
                            key={biz.id}
                            style={[
                              { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
                              isPopTemplate && {
                                backgroundColor: '#fffdf3',
                                borderWidth: 3,
                                borderColor: '#231f20',
                                borderRadius: 18,
                                shadowColor: '#ef2b3a',
                                shadowOffset: { width: 5, height: 5 },
                                shadowOpacity: 1,
                                shadowRadius: 0,
                                elevation: 4,
                                padding: 14,
                                marginBottom: 6,
                              },
                              isRetroArcadeTemplate && {
                                backgroundColor: '#ffffff',
                                borderWidth: 3,
                                borderColor: '#231f20',
                                borderRadius: 18,
                                shadowColor: '#231f20',
                                shadowOffset: { width: 5, height: 5 },
                                shadowOpacity: 1,
                                shadowRadius: 0,
                                elevation: 4,
                                padding: 14,
                                marginBottom: 6,
                              },
                              isCyberTechTemplate && styles.cyberPartnerCard,
                              isNeonCarnivalTemplate && styles.neonCarnivalPartnerCard,
                              isGardenTemplate && [styles.gardenPartnerCard, { backgroundColor: '#FDFBF7', borderColor: 'rgba(46, 111, 64, 0.08)' }]
                            ]}
                            onPress={() => router.push(`/business/${biz.id}`)}
                          >
                            <Image 
                              source={{ uri: biz.coverImage || 'https://via.placeholder.com/150' }} 
                              style={[
                                { width: 64, height: 64, borderRadius: 32, marginRight: 16, borderWidth: 1, borderColor: selectedTemplate.accent },
                                isPopTemplate && { borderWidth: 2.5, borderColor: '#231f20', borderRadius: 32 },
                                isRetroArcadeTemplate && { borderWidth: 2.5, borderColor: '#231f20', borderRadius: 14 },
                                isCyberTechTemplate && { borderWidth: 1, borderColor: '#00f0ff', borderRadius: 8 },
                                isNeonCarnivalTemplate && { borderWidth: 1.5, borderColor: '#d946ef', borderRadius: 16 },
                                isGardenTemplate && [styles.gardenPartnerImage, { borderColor: '#2E6F40' }]
                              ]} 
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={[
                                { color: selectedTemplate.text, fontSize: 18, fontWeight: '600', marginBottom: 4 },
                                isPopTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', fontSize: 18, fontWeight: undefined, textTransform: 'uppercase' },
                                isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, color: '#231f20', fontSize: 18, fontWeight: undefined, textTransform: 'uppercase' },
                                isCyberTechTemplate && styles.cyberPartnerName,
                                isNeonCarnivalTemplate && styles.neonCarnivalPartnerName
                              ]}>{biz.name}</Text>
                              <Text style={[
                                { color: selectedTemplate.accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
                                isPopTemplate && { fontFamily: FunkyFonts.marker, color: '#ff4fb8', fontSize: 12, fontWeight: undefined, letterSpacing: 0.5 },
                                isRetroArcadeTemplate && { fontFamily: FunkyFonts.marker, color: '#ff3562', fontSize: 12, fontWeight: undefined, letterSpacing: 0.5 },
                                isCyberTechTemplate && styles.cyberPartnerType,
                                isNeonCarnivalTemplate && styles.neonCarnivalPartnerType
                              ]}>{biz.type}</Text>
                            </View>
                            <IconSymbol name="chevron.right" size={20} color={isPopTemplate ? '#231f20' : (isCyberTechTemplate ? '#00f0ff' : (isRetroArcadeTemplate ? '#231f20' : selectedTemplate.muted))} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <>
                <View style={[
                  styles.galleryHeader,
                  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16 },
                  isScrapbookTemplate && styles.scrapbookGalleryHeader,
                  isNeonTemplate && styles.neonGalleryHeader,
                  isPastelTemplate && styles.pastelGalleryHeader,
                  isPopTemplate && styles.popGalleryHeader,
                  isGoldenYearsTemplate && styles.goldenGalleryHeader,
                  isVintageTemplate && styles.vintageGalleryHeader,
                  isRoseTemplate && styles.roseGalleryHeader,
                  isMinimalLoveTemplate && styles.minimalGalleryHeader,
                  isRetroArcadeTemplate && styles.retroArcadeGalleryHeader,
                  isNeonCarnivalTemplate && styles.neonCarnivalGalleryHeader,
                  isGardenTemplate && styles.gardenGalleryHeader
                ]}>
                  <View>
                    {isGardenTemplate && (
                      <View style={styles.gardenGalleryKicker}>
                        <IconSymbol name="leaf.fill" size={12} color="#16a34a" />
                        <Text style={[styles.gardenGalleryKickerText, { color: '#16a34a', fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }]}>
                          organic feed
                        </Text>
                        <View style={[styles.gardenGalleryKickerLine, { backgroundColor: 'rgba(22, 163, 74, 0.2)' }]} />
                      </View>
                    )}
                    {isCyberTechTemplate && (
                      <View style={styles.cyberGalleryKicker}>
                        <Text style={styles.cyberGalleryKickerText}>[ ARCHIVE SECTION ]</Text>
                      </View>
                    )}
                    {isNeonCarnivalTemplate && (
                      <View style={styles.neonCarnivalGalleryKicker}>
                        <View style={styles.neonCarnivalGalleryPulse} />
                        <Text style={styles.neonCarnivalGalleryKickerText}>Carnival Feed</Text>
                        <View style={styles.neonCarnivalGalleryKickerLine} />
                      </View>
                    )}
                    {isRetroArcadeTemplate && (
                      <View style={styles.retroArcadeGalleryKicker}>
                        <Text style={styles.retroArcadeGalleryKickerBadge}>ARCADE</Text>
                        <Text style={styles.retroArcadeGalleryKickerText}>Memory slot</Text>
                        <View style={styles.retroArcadeGalleryKickerBolt} />
                      </View>
                    )}
                    {isScrapbookTemplate && (
                      <View style={styles.scrapbookGalleryKicker}>
                        <View style={[styles.scrapbookGalleryKickerLine, { backgroundColor: selectedTemplate.accent }]} />
                        <Text style={[styles.scrapbookGalleryKickerText, { color: selectedTemplate.muted }]}>Memory strip</Text>
                      </View>
                    )}
                    {isNeonTemplate && (
                      <View style={styles.neonGalleryKicker}>
                        <View style={styles.neonGallerySpark} />
                        <Text style={styles.neonGalleryKickerText}>Glow reel</Text>
                        <View style={styles.neonGalleryKickerLine} />
                      </View>
                    )}
                    {isPastelTemplate && (
                      <View style={styles.pastelGalleryKicker}>
                        <View style={styles.pastelGalleryKickerDot} />
                        <Text style={styles.pastelGalleryKickerText}>Dream notes</Text>
                        <View style={styles.pastelGalleryKickerLine} />
                      </View>
                    )}
                    {isPopTemplate && (
                      <View style={styles.popGalleryKicker}>
                        <Text style={styles.popGalleryKickerBadge}>POP</Text>
                        <Text style={styles.popGalleryKickerText}>Poster reel</Text>
                        <View style={styles.popGalleryKickerBolt} />
                      </View>
                    )}
                    {isAnniversaryTemplate && (
                      <View style={[
                        styles.anniversaryGalleryKicker,
                        isVintageTemplate && styles.vintageGalleryKicker,
                        isMinimalLoveTemplate && styles.minimalGalleryKicker,
                      ]}>
                        <View style={[
                          styles.anniversaryGalleryDot,
                          isGoldenYearsTemplate && styles.goldenGalleryDot,
                          isVintageTemplate && styles.vintageGalleryDot,
                          isRoseTemplate && styles.roseGalleryDot,
                          isMinimalLoveTemplate && styles.minimalGalleryDot,
                        ]} />
                        <Text style={[
                          styles.anniversaryGalleryKickerText,
                          isGoldenYearsTemplate && styles.goldenGalleryKickerText,
                          isVintageTemplate && styles.vintageGalleryKickerText,
                          isRoseTemplate && styles.roseGalleryKickerText,
                          isMinimalLoveTemplate && styles.minimalGalleryKickerText,
                        ]}>
                          {isGoldenYearsTemplate ? 'Golden reel' : isVintageTemplate ? 'Noir frames' : isRoseTemplate ? 'Bloom reel' : 'Quiet frames'}
                        </Text>
                        <View style={[
                          styles.anniversaryGalleryLine,
                          isGoldenYearsTemplate && styles.goldenGalleryLine,
                          isVintageTemplate && styles.vintageGalleryLine,
                          isRoseTemplate && styles.roseGalleryLine,
                          isMinimalLoveTemplate && styles.minimalGalleryLine,
                        ]} />
                      </View>
                    )}
                    <Text style={[
                      styles.galleryTitle,
                      { color: selectedTemplate.text },
                      isScrapbookTemplate && styles.scrapbookGalleryTitle,
                      isNeonTemplate && styles.neonGalleryTitle,
                      isPastelTemplate && styles.pastelGalleryTitle,
                      isPopTemplate && styles.popGalleryTitle,
                      isGoldenYearsTemplate && styles.goldenGalleryTitle,
                      isVintageTemplate && styles.vintageGalleryTitle,
                      isRoseTemplate && styles.roseGalleryTitle,
                      isMinimalLoveTemplate && styles.minimalGalleryTitle,
                      isCyberTechTemplate && styles.cyberGalleryTitle,
                      isRetroArcadeTemplate && styles.retroArcadeGalleryTitle,
                      isNeonCarnivalTemplate && styles.neonCarnivalGalleryTitle,
                      isGardenTemplate && styles.gardenGalleryTitle,
                      selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifBold, fontWeight: 'bold' }
                    ]}>
                      {isGardenTemplate ? (
                        <>
                          <Text style={{ color: '#14532d', fontFamily: selectedTemplate.serifBold }}>
                            {activeSubEvent ? activeSubEvent.title : 'Highlights'}
                          </Text>
                          <Text style={{ color: '#16a34a', fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }}>
                            {` (${photos.length})`}
                          </Text>
                        </>
                      ) : isRetroArcadeTemplate ? (
                        <>
                          <Text style={{ color: '#ff3562' }}>
                            {(activeSubEvent ? activeSubEvent.title : 'Highlights').toUpperCase()}
                          </Text>
                          <Text style={{ color: '#231f20' }}>
                            {` (${photos.length})`}
                          </Text>
                        </>
                      ) : isPopTemplate ? (
                        <>
                          <Text style={{ color: '#0080ff' }}>
                            {activeSubEvent ? activeSubEvent.title : 'Highlights'}
                          </Text>
                          <Text style={{ color: '#ff4fb8' }}>
                            {` (${photos.length})`}
                          </Text>
                        </>
                      ) : (
                        activeSubEvent ? activeSubEvent.title : 'Highlights'
                      )}
                    </Text>
                    {!isPopTemplate && !isRetroArcadeTemplate && !isGardenTemplate && (
                      <Text style={[
                        styles.photoCount,
                        { color: selectedTemplate.accent },
                        isCyberTechTemplate && styles.cyberPhotoCount,
                        isNeonCarnivalTemplate && styles.neonCarnivalPhotoCount,
                        selectedTemplate.useSerif && { fontFamily: selectedTemplate.serifItalic, fontStyle: 'italic' }
                      ]}>
                        {isCyberTechTemplate ? `// ARCHIVED_FILES: ${photos.length}` : (isNeonCarnivalTemplate ? `STAGE CAPTURES: ${photos.length}` : `${photos.length} ${photos.length === 1 ? 'Photo' : 'Photos'}`)}
                      </Text>
                    )}
                  </View>


                </View>

                {loadingPhotos ? (
                  <View style={styles.photoLoading}>
                    <ActivityIndicator color={isCyberTechTemplate ? '#00f0ff' : selectedTemplate.accent} />
                  </View>
                ) : (
                  <View style={styles.photoGrid}>
                    {photos.length === 0 ? (
                      <View style={styles.emptyGallery}>
                        <IconSymbol name="photo.on.rectangle" size={40} color={isCyberTechTemplate ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.05)'} />
                        <Text style={[styles.emptyText, isCyberTechTemplate && styles.cyberEmptyText]}>
                          {isCyberTechTemplate ? '// NO_DATA_AVAILABLE' : 'No photos yet.'}
                        </Text>
                      </View>
                    ) : (
                      (() => {
                        const leftCol: any[] = [];
                        const rightCol: any[] = [];
                        let leftHeight = 0;
                        let rightHeight = 0;

                        photos.forEach((photo, idx) => {
                          const ratio = photo.width && photo.height
                            ? photo.height / photo.width
                            : (idx % 3 === 0 ? 1.25 : (idx % 3 === 1 ? 0.95 : 1.45));

                          // Height-aware sorting: always place the photo in the shorter column!
                          if (leftHeight <= rightHeight) {
                            leftCol.push({ photo, idx });
                            leftHeight += ratio;
                          } else {
                            rightCol.push({ photo, idx });
                            rightHeight += ratio;
                          }
                        });

                        const renderPhotoItem = ({ photo, idx }: { photo: any; idx: number }) => {
                          const ratio = photo.width && photo.height
                            ? photo.height / photo.width
                            : (idx % 3 === 0 ? 1.25 : (idx % 3 === 1 ? 0.95 : 1.45));

                          return (
                            <Animated.View
                              key={photo.id}
                              entering={FadeInUp.delay(idx * 80).duration(600).springify().damping(14)}
                              style={[
                                styles.photoCard,
                                !isGardenTemplate && {
                                  aspectRatio: 1 / ratio,
                                }
                              ]}
                            >
                              <TouchableOpacity
                                style={isGardenTemplate ? { width: '100%' } : { flex: 1 }}
                                activeOpacity={0.9}
                                onPress={() => openViewer(idx)}
                              >
                                <View style={[
                                  styles.photoTile,
                                  {
                                    backgroundColor: selectedTemplate.tileBg,
                                    borderRadius: selectedTemplate.radius,
                                    borderWidth: event.templateId === 'polaroid' || event.templateId === 'museum' || event.templateId === 'brutalist' || event.templateId === 'royal' || event.templateId === 'classic' || event.templateId === 'ethereal' || event.templateId === 'academic_editorial' ? 1 : 0,
                                    borderColor: event.templateId === 'royal' ? selectedTemplate.accent : (event.templateId === 'classic' ? 'rgba(0,0,0,0.05)' : (event.templateId === 'ethereal' ? 'rgba(45, 42, 41, 0.12)' : (event.templateId === 'academic_editorial' ? selectedTemplate.text + '26' : selectedTemplate.accentBg))),
                                    padding: event.templateId === 'polaroid' ? 4 : (event.templateId === 'royal' ? 3 : (event.templateId === 'classic' ? 8 : (event.templateId === 'ethereal' ? 10 : (event.templateId === 'academic_editorial' ? 6 : 0)))),
                                  },
                                  isScrapbookTemplate && [
                                    styles.scrapbookPhotoTile,
                                    {
                                      borderColor: selectedTemplate.accentBg,
                                      shadowColor: selectedTemplate.accent,
                                    },
                                    idx % 2 === 1 && styles.scrapbookPhotoTileAlt,
                                  ],
                                  isNeonTemplate && [
                                    styles.neonPhotoTile,
                                    {
                                      borderColor: idx % 3 === 0 ? selectedTemplate.accent : selectedTemplate.accentBg,
                                      shadowColor: idx % 3 === 0 ? selectedTemplate.accent : '#66e8ff',
                                    },
                                    idx % 3 === 0 && styles.neonPhotoTileFeatured,
                                  ],
                                  isPastelTemplate && [
                                    styles.pastelPhotoTile,
                                    {
                                      borderColor: idx % 3 === 0 ? 'rgba(201, 118, 139, 0.26)' : selectedTemplate.accentBg,
                                      shadowColor: idx % 2 === 0 ? '#d8b4dc' : '#f4b8a8',
                                    },
                                    idx % 2 === 1 && styles.pastelPhotoTileAlt,
                                  ],
                                  isGoldenYearsTemplate && [
                                    styles.goldenPhotoTile,
                                    { shadowColor: selectedTemplate.accent },
                                    idx % 2 === 1 && styles.goldenPhotoTileAlt,
                                  ],
                                  isVintageTemplate && [
                                    styles.vintagePhotoTile,
                                    idx % 2 === 1 && styles.vintagePhotoTileAlt,
                                  ],
                                  isRoseTemplate && [
                                    styles.rosePhotoTile,
                                    { shadowColor: '#c75f72' },
                                    idx % 2 === 1 && styles.rosePhotoTileAlt,
                                  ],
                                  isMinimalLoveTemplate && [
                                    styles.minimalPhotoTile,
                                    idx % 2 === 1 && styles.minimalPhotoTileAlt,
                                  ],
                                  isPopTemplate && [
                                    styles.popPhotoTile,
                                    {
                                      borderColor: idx % 3 === 0 ? '#0080ff' : '#231f20',
                                      shadowColor: idx % 2 === 0 ? '#ef2b3a' : '#0080ff',
                                    },
                                    idx % 2 === 1 && styles.popPhotoTileAlt,
                                  ],
                                  isRetroArcadeTemplate && [
                                    styles.retroArcadePhotoTile,
                                    {
                                      borderColor: idx % 3 === 0 ? '#ff3562' : '#231f20',
                                      shadowColor: idx % 2 === 0 ? '#ff3562' : '#231f20',
                                    },
                                    idx % 2 === 1 && styles.retroArcadePhotoTileAlt,
                                  ],
                                  isGardenTemplate && [
                                    styles.gardenPhotoTile,
                                    {
                                      backgroundColor: isDark ? '#1B3224' : '#FDFBF7',
                                    }
                                  ],
                                  event.templateId === 'royal' && {
                                    shadowColor: selectedTemplate.accent,
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.15,
                                    shadowRadius: 4,
                                    elevation: 2,
                                  },
                                  event.templateId === 'classic' && {
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.06,
                                    shadowRadius: 3,
                                    elevation: 1,
                                    backgroundColor: '#ffffff',
                                  },
                                  event.templateId === 'ethereal' && {
                                    paddingBottom: 24,
                                    shadowColor: '#2d2a29',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.08,
                                    shadowRadius: 5,
                                    elevation: 2,
                                    backgroundColor: isDark ? '#262423' : '#ffffff',
                                  },
                                  event.templateId === 'academic_editorial' && {
                                    paddingBottom: 22,
                                    shadowColor: '#000000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.04,
                                    shadowRadius: 4,
                                    elevation: 1,
                                    backgroundColor: selectedTemplate.tileBg,
                                  }
                                ]}>
                                  {isScrapbookTemplate && (
                                    <>
                                      <View style={[styles.scrapbookCorner, styles.scrapbookCornerTopLeft, { borderColor: selectedTemplate.accent }]} />
                                      <View style={[styles.scrapbookCorner, styles.scrapbookCornerBottomRight, { borderColor: selectedTemplate.accent }]} />
                                    </>
                                  )}
                                  {isNeonTemplate && (
                                    <>
                                      <LinearGradient
                                        colors={['rgba(255,61,242,0.75)', 'rgba(102,232,255,0.08)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[styles.neonPhotoGlowLine, styles.neonPhotoGlowLineTop]}
                                      />
                                      <LinearGradient
                                        colors={['rgba(102,232,255,0.7)', 'rgba(126,87,255,0.08)']}
                                        start={{ x: 1, y: 0 }}
                                        end={{ x: 0, y: 0 }}
                                        style={[styles.neonPhotoGlowLine, styles.neonPhotoGlowLineBottom]}
                                      />
                                    </>
                                  )}
                                  {isPastelTemplate && (
                                    <>
                                      <View style={[styles.pastelPhotoTape, styles.pastelPhotoTapeLeft]} />
                                      <View style={[styles.pastelPhotoTape, styles.pastelPhotoTapeRight]} />
                                      <View style={[styles.pastelPhotoDot, styles.pastelPhotoDotTop]} />
                                      <View style={[styles.pastelPhotoDot, styles.pastelPhotoDotBottom]} />
                                    </>
                                  )}
                                  {isGoldenYearsTemplate && (
                                    <>
                                      <View style={[styles.anniversaryPhotoAccent, styles.goldenPhotoAccentTop]} />
                                      <View style={[styles.anniversaryPhotoAccent, styles.goldenPhotoAccentBottom]} />
                                    </>
                                  )}
                                  {isVintageTemplate && (
                                    <>
                                      <View style={[styles.vintagePhotoFrameLine, styles.vintagePhotoFrameLineTop]} />
                                      <View style={[styles.vintagePhotoFrameLine, styles.vintagePhotoFrameLineBottom]} />
                                    </>
                                  )}
                                  {isRoseTemplate && (
                                    <>
                                      <View style={[styles.rosePhotoPetal, styles.rosePhotoPetalTop]} />
                                      <View style={[styles.rosePhotoPetal, styles.rosePhotoPetalBottom]} />
                                    </>
                                  )}
                                  {isMinimalLoveTemplate && (
                                    <View style={styles.minimalPhotoIndex}>
                                      <Text style={styles.minimalPhotoIndexText}>{String(idx + 1).padStart(2, '0')}</Text>
                                    </View>
                                  )}
                                  <Image
                                    source={{ uri: photo.url }}
                                    style={[
                                      styles.galleryImg,
                                      isScrapbookTemplate && styles.scrapbookGalleryImg,
                                      isNeonTemplate && styles.neonGalleryImg,
                                      isPastelTemplate && styles.pastelGalleryImg,
                                      isPopTemplate && styles.popGalleryImg,
                                      isGoldenYearsTemplate && styles.goldenGalleryImg,
                                      isVintageTemplate && styles.vintageGalleryImg,
                                      isRoseTemplate && styles.roseGalleryImg,
                                      isMinimalLoveTemplate && styles.minimalGalleryImg,
                                      isRetroArcadeTemplate && styles.retroArcadeGalleryImg,
                                      isGardenTemplate ? {
                                        width: '100%',
                                        aspectRatio: 1 / ratio,
                                        height: undefined,
                                        borderTopLeftRadius: 22,
                                        borderTopRightRadius: 22,
                                        borderBottomLeftRadius: 0,
                                        borderBottomRightRadius: 0,
                                      } : {},
                                    ]}
                                    resizeMode="cover"
                                  />
                                  {event.templateId === 'academic_editorial' && (
                                    <View style={{
                                      paddingTop: 6,
                                      paddingBottom: 2,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderTopWidth: 0.5,
                                      borderTopColor: selectedTemplate.text + '1a',
                                      marginTop: 4,
                                    }}>
                                      <Text style={{
                                        fontFamily: 'Courier',
                                        fontSize: 8,
                                        color: selectedTemplate.muted,
                                        letterSpacing: 0.5,
                                      }}>
                                        {`[IMG_${String(idx + 1).padStart(3, '0')} // CAMPUS]`}
                                      </Text>
                                    </View>
                                  )}
                                  {isGardenTemplate && (
                                    <View style={[
                                      styles.gardenPhotoLabelContainer,
                                      {
                                        backgroundColor: '#FDFBF7',
                                        borderTopColor: 'rgba(46, 111, 64, 0.08)',
                                      }
                                    ]}>
                                      <Text style={[styles.gardenPhotoLabelText, { fontFamily: selectedTemplate.serifBold, color: '#1A3322' }]} numberOfLines={1}>
                                        {photo.title || (idx % 3 === 0 ? 'Foliage Whisper' : (idx % 3 === 1 ? 'Garden Sun' : 'Botanical Frame'))}
                                      </Text>
                                      <Text style={[styles.gardenPhotoRatioText, { color: '#2E6F40' }]}>
                                        {ratio > 1.2 ? 'PORTRAIT' : ratio < 0.8 ? 'LANDSCAPE' : 'SQUARE'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </TouchableOpacity>
                            </Animated.View>
                          );
                        };

                        return (
                          <View style={styles.masonryContainer}>
                            <View style={styles.masonryColumn}>
                              {leftCol.map(renderPhotoItem)}
                            </View>
                            <View style={styles.masonryColumn}>
                              {rightCol.map(renderPhotoItem)}
                            </View>
                          </View>
                        );
                      })()
                    )}
                  </View>
                )}
                </>
                )}

                {renderThemeDivider()}

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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, width: '100%' }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ fontSize: 22, color: '#fff', fontFamily: Fonts.outfit.bold }}>Event Type</Text>
                <Text style={{ color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.inter.regular, marginTop: 4 }}>
                  Choose a category for your gallery
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowCategoryModal(false)}
                style={{ marginTop: 2 }}
              >
                <IconSymbol name="xmark.circle.fill" size={24} color={MidnightColors.slate400} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {[
                { name: 'Wedding', icon: 'heart.fill', color: '#ff4b72' },
                { name: 'Birthday', icon: 'gift.fill', color: '#3b82f6' },
                { name: 'Anniversary', icon: 'sparkles', color: '#eab308' },
                { name: 'Corporate', icon: 'briefcase.fill', color: '#10b981' },
                { name: 'Sports', icon: 'figure.run', color: '#06b6d4' },
                { name: 'College', icon: 'graduationcap.fill', color: '#6366f1' },
                { name: 'Other', icon: 'ellipsis.circle.fill', color: '#64748b' }
              ].map((cat) => {
                const isActive = event?.category === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.categoryOption,
                      isActive && styles.activeCategoryOption
                    ]}
                    onPress={() => {
                      handleUpdateCategory(cat.name);
                      setShowCategoryModal(false);
                    }}
                  >
                    <View style={styles.categoryLeft}>
                      <View style={[styles.categoryIconWrapper, { backgroundColor: `${cat.color}15` }]}>
                        <IconSymbol name={cat.icon as any} size={16} color={cat.color} />
                      </View>
                      <Text style={[styles.categoryText, isActive && styles.activeCategoryText]}>
                        {cat.name}
                      </Text>
                    </View>
                    {isActive && (
                      <View style={styles.categoryCheckBadge}>
                        <IconSymbol name="checkmark" size={10} color={MidnightColors.background} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
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
            {(isScrapbookTemplate || isNeonTemplate || isPopTemplate) && (
              <TouchableOpacity style={styles.viewerAction} onPress={handleSharePhoto}>
                <IconSymbol name="square.and.arrow.up" size={28} color={isNeonTemplate ? '#66e8ff' : (isPopTemplate ? '#ffe84a' : '#ffffff')} />
                <Text style={[styles.viewerActionCount, isNeonTemplate && styles.neonViewerActionCount, isPopTemplate && styles.popViewerActionCount]}>Share</Text>
              </TouchableOpacity>
            )}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, width: '100%' }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ fontSize: 22, color: '#fff', fontFamily: Fonts.outfit.bold }}>Choose Style</Text>
                <Text style={{ color: MidnightColors.slate400, fontSize: 13, fontFamily: Fonts.inter.regular, marginTop: 4 }}>
                  Select a design template for this {event?.category || 'Wedding'} event.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeModalCircle, { marginTop: 2 }]}
                onPress={() => setShowTemplateModal(false)}
              >
                <IconSymbol name="xmark" size={20} color={MidnightColors.gold} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {MOBILE_TEMPLATE_THEMES.filter(t => t.category === (event?.category === 'Sports' ? 'Other' : (event?.category || 'Wedding'))).map((template) => {
                const isActive = (event?.templateId || 'hero') === template.id;
                return (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templateRowCard,
                      isActive && styles.activeTemplateRowCard,
                      { borderColor: isActive ? template.accent : 'rgba(255,255,255,0.06)' }
                    ]}
                    onPress={() => handleUpdateTemplate(template.id)}
                  >
                    <View style={styles.templateRowLeft}>
                      <View style={[styles.palettePreview, { backgroundColor: isDark ? template.background.dark : template.background.light }]}>
                        <View style={[styles.paletteAccentDot, { backgroundColor: template.accent }]} />
                      </View>
                      
                      <View style={styles.templateRowText}>
                        <Text style={[styles.templateRowName, isActive && { color: template.accent }]}>
                          {template.label}
                        </Text>
                        <Text style={styles.templateRowDesc} numberOfLines={1}>
                          {template.desc}
                        </Text>
                      </View>
                    </View>

                    {isActive && (
                      <View style={[styles.templateCheckCircle, { backgroundColor: template.accent }]}>
                        <IconSymbol name="checkmark" size={10} color="#000" />
                      </View>
                    )}
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
                        Alert.alert("Vendor Linked!", `Successfully linked ${biz.name}. They will now appear on the Event Partners page.`);
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
      {/* ── REPOSITION TOOLBAR OVERLAY ── */}
      {showAdminView && isRepositioning && (
        <View style={[styles.repositionToolbar, { top: insets.top > 0 ? insets.top + 8 : 16 }]}>
          <Text style={styles.repositionInstruction}>Drag image</Text>

          {/* Zoom controls */}
          <View style={styles.zoomControlRow}>
            <TouchableOpacity 
              style={styles.zoomBtn} 
              onPress={() => setTempCoverScale(prev => Math.max(1.0, prev - 0.1))}
            >
              <IconSymbol name="minus" size={12} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.zoomText}>{Math.round(tempCoverScale * 100)}%</Text>
            <TouchableOpacity 
              style={styles.zoomBtn} 
              onPress={() => setTempCoverScale(prev => Math.min(2.5, prev + 0.1))}
            >
              <IconSymbol name="plus" size={12} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.repositionActions}>
            <TouchableOpacity
              style={[styles.repositionBtn, styles.repositionCancelBtn]}
              onPress={() => {
                setIsRepositioning(false);
                showToast('Positioning cancelled');
              }}
            >
              <Text style={styles.repositionBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.repositionBtn, styles.repositionSaveBtn]}
              onPress={async () => {
                const target = activeSubEvent || event;
                if (!target) return;
                setIsRepositioning(false);
                setUpdating(true);
                try {
                  const updatedFields = {
                    coverOffset: tempCoverOffset,
                    coverOffsetX: tempCoverOffsetX,
                    coverScale: tempCoverScale
                  };

                  if (activeSubEvent) {
                    const newSub = { ...activeSubEvent, ...updatedFields };
                    setActiveSubEvent(newSub);
                    setSubEvents(prev => prev.map(sub => sub.id === activeSubEvent.id ? newSub : sub));
                  } else if (event) {
                    setEvent({ ...event, ...updatedFields });
                  }

                  showToast('Cover position saved');
                  await updateEvent(target.id, updatedFields);
                } catch (err) {
                  console.log('Error saving cover position:', err);
                } finally {
                  setUpdating(false);
                }
              }}
            >
              <Text style={[styles.repositionBtnText, { color: '#000' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── TOAST MESSAGE FEEDBACK OVERLAY ── */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toastContent}>
            <IconSymbol name="checkmark.circle.fill" size={16} color={MidnightColors.gold} />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const FunkyFonts = {
  marker: Fonts.permanentMarker?.regular ?? Fonts.outfit.extraBold,
  comic: Fonts.bubblegum?.regular ?? Fonts.outfit.extraBold,
  display: Fonts.monofett?.regular ?? Fonts.outfit.extraBold,
  retro: Platform.select({
    ios: 'American Typewriter',
    android: 'monospace',
    default: 'monospace',
  }),
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: MidnightColors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },

  // Hero
  hero: { height: 400, width: '100%' },
  heroImage: { ...StyleSheet.absoluteFillObject },
  goldenHeroImage: {
    transform: [{ scale: 1.02 }],
  },
  vintageHeroImage: {
    opacity: 0.42,
  },
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
  popFloatingBack: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0080ff',
    borderWidth: 3,
    borderColor: '#231f20',
    shadowColor: '#231f20',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popFloatingShare: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ff4fb8',
    borderWidth: 3,
    borderColor: '#231f20',
    shadowColor: '#231f20',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popCustomNavbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 25,
  },
  vintageFloatingButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(21, 19, 15, 0.92)',
    borderColor: 'rgba(184, 145, 69, 0.72)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
  minimalFloatingButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4a2f1d',
    borderColor: 'rgba(255, 250, 242, 0.36)',
    borderWidth: 1,
    shadowColor: '#6d4b34',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  floatingShare: { position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroContent: { position: 'absolute', bottom: 14, left: 24, right: 24 },
  heroTitle: { fontSize: 36, color: '#fff', fontFamily: Fonts.outfit.extraBold, letterSpacing: -1 },
  scrapbookHeroContent: {
    left: 18,
    right: 18,
    bottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 253, 249, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(217, 130, 107, 0.22)',
  },
  scrapbookHeroRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  scrapbookHeroRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(38, 51, 49, 0.18)',
  },
  scrapbookHeroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  scrapbookHeroTitle: {
    fontSize: 34,
    letterSpacing: 0,
    lineHeight: 38,
  },
  neonHeroContent: {
    left: 18,
    right: 18,
    bottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 28,
    backgroundColor: 'rgba(9, 8, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 61, 242, 0.42)',
    shadowColor: '#ff3df2',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.26,
    shadowRadius: 28,
    elevation: 8,
    overflow: 'hidden',
  },
  neonLightStreak: {
    position: 'absolute',
    height: 2,
    borderRadius: 999,
    opacity: 0.85,
  },
  neonLightStreakTop: {
    top: 16,
    right: -12,
    width: 132,
    backgroundColor: '#66e8ff',
    transform: [{ rotate: '-12deg' }],
  },
  neonLightStreakBottom: {
    left: -18,
    bottom: 18,
    width: 110,
    backgroundColor: '#ff3df2',
    transform: [{ rotate: '-10deg' }],
  },
  neonHeroChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(102, 232, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(102, 232, 255, 0.34)',
    marginBottom: 12,
  },
  neonHeroChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#66e8ff',
  },
  neonHeroChipText: {
    color: '#e9fbff',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  neonHeroDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  neonHeroDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(102, 232, 255, 0.24)',
  },
  neonHeroDividerCore: {
    width: 42,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#ff3df2',
  },
  neonHeroTitle: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  neonHeroMeta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  neonHeroDate: {
    color: '#66e8ff',
    letterSpacing: 1.2,
  },
  neonShareButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 61, 242, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 61, 242, 0.36)',
  },
  pastelHeroContent: {
    left: 18,
    right: 18,
    bottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 253, 251, 0.76)',
    borderWidth: 1,
    borderColor: 'rgba(213, 180, 220, 0.34)',
    shadowColor: '#d8b4dc',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 6,
    overflow: 'hidden',
  },
  pastelFloatOrb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.42,
  },
  pastelFloatOrbPink: {
    width: 92,
    height: 92,
    right: -28,
    top: -22,
    backgroundColor: '#f8c8d8',
  },
  pastelFloatOrbBlue: {
    width: 70,
    height: 70,
    left: -22,
    bottom: -20,
    backgroundColor: '#cdeaf6',
  },
  pastelHeroChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 241, 232, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(201, 118, 139, 0.18)',
    marginBottom: 12,
  },
  pastelHeroSparkle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d8b4dc',
  },
  pastelHeroChipText: {
    color: '#8b6f70',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  pastelHeroDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pastelHeroDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(154, 133, 131, 0.22)',
  },
  pastelHeroDividerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f4b8a8',
  },
  pastelHeroDividerDotAlt: {
    backgroundColor: '#bddfd9',
  },
  pastelHeroTitle: {
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: 0,
  },
  pastelHeroMeta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(201, 118, 139, 0.16)',
  },
  pastelHeroDate: {
    color: '#c9768b',
    letterSpacing: 0.9,
  },
  pastelShareButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(216, 180, 220, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(201, 118, 139, 0.2)',
  },
  anniversaryRibbon: {
    position: 'absolute',
    height: 3,
    left: 20,
    right: 20,
    top: 18,
    borderRadius: 999,
  },
  goldenRibbon: {
    backgroundColor: 'rgba(201, 154, 46, 0.72)',
  },
  goldenHeroContent: {
    left: 18,
    right: 18,
    bottom: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 250, 240, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(201, 154, 46, 0.34)',
    shadowColor: '#c99a2e',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 5,
  },
  goldenHeroLabel: {
    color: '#8a6421',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 12,
  },
  goldenHeroRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  goldenHeroRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(201, 154, 46, 0.38)',
  },
  goldenHeroMedallion: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#c99a2e',
    backgroundColor: '#fff7e6',
  },
  goldenHeroTitle: {
    fontSize: 39,
    lineHeight: 42,
    fontFamily: Fonts.cormorant.bold,
    color: '#3f2f22',
    letterSpacing: 0,
  },
  goldenHeroMeta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 154, 46, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201, 154, 46, 0.26)',
  },
  vintageHeroContent: {
    left: 20,
    right: 20,
    bottom: 28,
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderRadius: 2,
    backgroundColor: 'rgba(245, 239, 228, 0.9)',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 4,
  },
  vintageHeroIssue: {
    color: '#5e5348',
    fontSize: 11,
    fontFamily: Fonts.inter.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    marginBottom: 12,
  },
  vintageHeroRule: {
    height: 1,
    backgroundColor: 'rgba(23, 23, 23, 0.16)',
    marginBottom: 14,
  },
  vintageHeroTitle: {
    fontSize: 40,
    lineHeight: 42,
    fontFamily: Fonts.cormorant.bold,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  vintageHeroMeta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 0,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(23, 23, 23, 0.46)',
    backgroundColor: 'rgba(23, 23, 23, 0.045)',
  },
  roseHeroContent: {
    left: 18,
    right: 18,
    bottom: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 252, 247, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.18)',
    shadowColor: '#b76578',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    elevation: 4,
    overflow: 'hidden',
  },
  rosePetal: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(199, 95, 114, 0.16)',
  },
  rosePetalOne: {
    width: 92,
    height: 92,
    right: -28,
    top: -28,
  },
  rosePetalTwo: {
    width: 64,
    height: 64,
    left: -20,
    bottom: -18,
    backgroundColor: 'rgba(237, 178, 187, 0.2)',
  },
  roseHeroLabel: {
    color: '#9a6c74',
    fontSize: 10,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  roseHeroVine: {
    width: 88,
    height: 1,
    borderRadius: 999,
    backgroundColor: '#b76578',
    marginBottom: 12,
  },
  roseHeroTitle: {
    fontSize: 38,
    lineHeight: 42,
    fontFamily: Fonts.cormorant.bold,
    color: '#562733',
    letterSpacing: 0,
  },
  roseHeroMeta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(183, 101, 120, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.2)',
  },
  minimalHeroContent: {
    left: 20,
    right: 20,
    bottom: 26,
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 250, 242, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(109, 75, 52, 0.1)',
  },
  minimalHeroLabel: {
    color: '#8a7461',
    fontSize: 10,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  minimalHeroRule: {
    width: 48,
    height: 1,
    backgroundColor: '#6d4b34',
    marginBottom: 12,
  },
  minimalHeroTitle: {
    color: '#3b2618',
    fontSize: 38,
    lineHeight: 40,
    fontFamily: Fonts.cormorant.bold,
    letterSpacing: 0,
  },
  minimalHeroMeta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 6,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  anniversaryHeroDate: {
    letterSpacing: 1,
  },
  anniversaryShareButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  goldenCeremonyHero: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  goldenCeremonyVignette: {
    ...StyleSheet.absoluteFillObject,
  },
  goldenCeremonyCreamWash: {
    ...StyleSheet.absoluteFillObject,
  },
  goldenCeremonyTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
  },
  goldenGrainLine: {
    position: 'absolute',
    height: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 250, 240, 0.2)',
  },
  goldenGrainLineOne: {
    left: 30,
    right: 54,
    top: 182,
  },
  goldenGrainLineTwo: {
    left: 76,
    right: 26,
    bottom: 218,
    backgroundColor: 'rgba(201, 154, 46, 0.1)',
  },
  goldenGrainDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 250, 240, 0.26)',
  },
  goldenGrainDotOne: {
    left: 52,
    top: 140,
  },
  goldenGrainDotTwo: {
    right: 82,
    top: 272,
  },
  goldenGrainDotThree: {
    left: 112,
    bottom: 168,
    backgroundColor: 'rgba(201, 154, 46, 0.16)',
  },
  goldenCeremonyHalo: {
    position: 'absolute',
    top: 70,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(201, 154, 46, 0.14)',
    transform: [{ scaleX: 1.42 }],
  },
  goldenCeremonyFrame: {
    position: 'absolute',
    top: 94,
    left: 22,
    right: 22,
    bottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 247, 230, 0.32)',
    borderRadius: 36,
  },
  goldenCeremonyCorner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: 'rgba(201, 154, 46, 0.38)',
  },
  goldenCeremonyCornerTopLeft: {
    top: 12,
    left: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopLeftRadius: 16,
  },
  goldenCeremonyCornerTopRight: {
    top: 12,
    right: 12,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderTopRightRadius: 16,
  },
  goldenCeremonyCornerBottomLeft: {
    bottom: 12,
    left: 12,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderBottomLeftRadius: 16,
  },
  goldenCeremonyCornerBottomRight: {
    bottom: 12,
    right: 12,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomRightRadius: 16,
  },
  goldenCeremonyPhotoMotion: {
    position: 'absolute',
    top: 122,
    right: 30,
    width: 138,
    height: 178,
  },
  goldenCeremonyPhotoCard: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255, 250, 240, 0.82)',
    transform: [{ rotate: '2deg' }],
    shadowColor: '#3f2f22',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 5,
  },
  goldenCeremonyPhoto: {
    width: '100%',
    height: '100%',
  },
  goldenCeremonyPhotoVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(201, 154, 46, 0.1)',
  },
  goldenCeremonyYearRail: {
    position: 'absolute',
    left: 26,
    top: 136,
    paddingVertical: 12,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 250, 240, 0.58)',
    borderWidth: 0,
  },
  goldenCeremonyYearRailText: {
    color: '#8a6421',
    fontSize: 9,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 2.3,
    writingDirection: 'ltr',
    transform: [{ rotate: '-90deg' }],
  },
  goldenCeremonyContent: {
    width: '92%',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 26,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: 'rgba(255, 250, 240, 0.86)',
    borderWidth: 0,
    shadowColor: '#c99a2e',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.18,
    shadowRadius: 38,
    elevation: 6,
  },
  goldenCeremonyKicker: {
    color: '#9a6f22',
    fontSize: 10.5,
    fontFamily: Fonts.nunitoSans.semiBold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 13,
  },
  goldenCeremonySeal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c99a2e',
    borderWidth: 2,
    borderColor: 'rgba(255, 247, 230, 0.86)',
    marginBottom: 18,
  },
  goldenCeremonySealText: {
    color: '#fff7e6',
    fontSize: 24,
    fontFamily: Fonts.cormorant.bold,
  },
  goldenCeremonyTitle: {
    color: '#3f2f22',
    fontSize: 40,
    lineHeight: 45,
    fontFamily: Fonts.cormorant.semiBold,
    textAlign: 'center',
    letterSpacing: 0,
    marginHorizontal: 4,
  },
  goldenCeremonyRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    width: '82%',
    marginTop: 18,
    marginBottom: 13,
  },
  goldenCeremonyRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(201, 154, 46, 0.32)',
  },
  goldenCeremonyRuleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(201, 154, 46, 0.78)',
  },
  goldenCeremonyDate: {
    color: '#81633f',
    fontSize: 12,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.55,
  },
  goldenCeremonyShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 154, 46, 0.18)',
    borderWidth: 0,
  },
  goldenCeremonyShareText: {
    color: '#3f2f22',
    fontSize: 11,
    fontFamily: Fonts.nunitoSans.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  vintageEditorialHero: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 76,
    paddingBottom: 30,
    paddingHorizontal: 22,
    overflow: 'hidden',
    backgroundColor: '#0F0E0B',
  },
  vintageEditorialVignette: {
    ...StyleSheet.absoluteFillObject,
  },
  vintageEditorialTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.34,
  },
  vintageGrainLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(184, 145, 69, 0.18)',
  },
  vintageGrainLineOne: {
    left: 24,
    right: 40,
    top: 132,
  },
  vintageGrainLineTwo: {
    left: 58,
    right: 22,
    bottom: 88,
    backgroundColor: 'rgba(239, 227, 199, 0.08)',
  },
  vintageGrainDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(184, 145, 69, 0.22)',
  },
  vintageGrainDotOne: {
    left: 46,
    top: 188,
  },
  vintageGrainDotTwo: {
    right: 54,
    top: 256,
  },
  vintageGrainDotThree: {
    left: 132,
    bottom: 132,
    backgroundColor: 'rgba(239, 227, 199, 0.13)',
  },
  vintageEditorialMasthead: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(184, 145, 69, 0.46)',
    backgroundColor: 'rgba(15, 14, 11, 0.78)',
  },
  vintageEditorialMastheadText: {
    color: '#F2E7D2',
    fontSize: 12,
    fontFamily: Fonts.cormorant.bold,
    textTransform: 'uppercase',
    letterSpacing: 2.6,
  },
  vintageEditorialTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(184, 145, 69, 0.34)',
    paddingVertical: 10,
  },
  vintageEditorialFeatureRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 13,
  },
  vintageEditorialImagePlate: {
    flex: 1,
    height: 148,
    padding: 8,
    backgroundColor: '#D6C29A',
    borderWidth: 1,
    borderColor: 'rgba(184, 145, 69, 0.62)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.34,
    shadowRadius: 28,
    elevation: 4,
  },
  vintageEditorialTape: {
    position: 'absolute',
    top: -8,
    left: 28,
    width: 54,
    height: 17,
    backgroundColor: 'rgba(232, 216, 184, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(184, 145, 69, 0.24)',
    transform: [{ rotate: '-3deg' }],
    zIndex: 4,
  },
  vintageEditorialClip: {
    position: 'absolute',
    top: 12,
    right: 18,
    width: 13,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(33, 26, 18, 0.45)',
    backgroundColor: 'rgba(239, 227, 199, 0.26)',
    zIndex: 4,
  },
  vintageEditorialImage: {
    width: '100%',
    height: '100%',
    opacity: 0.86,
  },
  vintageEditorialImageFade: {
    ...StyleSheet.absoluteFillObject,
    margin: 8,
  },
  vintageEditorialNumberBlock: {
    width: 84,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A241B',
    borderWidth: 1,
    borderColor: 'rgba(184, 145, 69, 0.52)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 3,
  },
  vintageEditorialNumber: {
    color: '#B89145',
    fontSize: 50,
    lineHeight: 52,
    fontFamily: Fonts.cormorant.bold,
  },
  vintageEditorialNumberLabel: {
    color: '#F2E7D2',
    fontSize: 9,
    fontFamily: Fonts.inter.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.9,
  },
  vintageEditorialEdition: {
    color: '#C7A96B',
    fontSize: 10,
    fontFamily: Fonts.inter.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.7,
  },
  vintageEditorialBand: {
    alignSelf: 'stretch',
    backgroundColor: '#E8D8B8',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(184, 145, 69, 0.6)',
    borderLeftWidth: 3,
    borderLeftColor: '#B89145',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 4,
  },
  vintageEditorialTitle: {
    color: '#211A12',
    fontSize: 43,
    lineHeight: 43,
    fontFamily: Fonts.cormorant.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  vintageEditorialFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vintageEditorialDate: {
    color: '#C7A96B',
    fontSize: 12,
    fontFamily: Fonts.inter.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  vintageEditorialShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#15130F',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(184, 145, 69, 0.62)',
  },
  vintageEditorialShareText: {
    color: '#B89145',
    fontSize: 11,
    fontFamily: Fonts.inter.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.25,
  },
  roseBloomHero: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingBottom: 30,
    overflow: 'hidden',
    backgroundColor: '#fff9f5',
  },
  roseBloomWash: {
    ...StyleSheet.absoluteFillObject,
  },
  roseBloomGrain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.42,
  },
  roseBloomGrainDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(154, 108, 116, 0.16)',
  },
  roseBloomGrainDotOne: {
    top: 112,
    left: 62,
  },
  roseBloomGrainDotTwo: {
    top: 238,
    right: 46,
    backgroundColor: 'rgba(143, 159, 123, 0.16)',
  },
  roseBloomGrainDotThree: {
    bottom: 118,
    left: 118,
  },
  roseBloomHeader: {
    position: 'absolute',
    top: 78,
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 3,
  },
  roseBloomHeaderTitle: {
    color: '#562733',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: Fonts.cormorant.bold,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
  },
  roseBloomHeaderSubtitle: {
    color: '#8b5962',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Fonts.nunitoSans.semiBold,
    letterSpacing: 0.5,
    marginTop: 3,
  },
  roseBloomHeaderDivider: {
    marginTop: 10,
    width: '58%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roseBloomHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(183, 101, 120, 0.28)',
  },
  roseBloomHeaderFlower: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roseBloomHeaderPetal: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: 'rgba(183, 101, 120, 0.34)',
  },
  roseBloomHeaderPetalTop: {
    top: 1,
  },
  roseBloomHeaderPetalRight: {
    right: 1,
    backgroundColor: 'rgba(143, 159, 123, 0.24)',
  },
  roseBloomHeaderPetalBottom: {
    bottom: 1,
  },
  roseBloomHeaderPetalLeft: {
    left: 1,
    backgroundColor: 'rgba(143, 159, 123, 0.24)',
  },
  roseBloomOrb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(248, 218, 224, 0.48)',
  },
  roseBloomOrbLarge: {
    width: 300,
    height: 300,
    right: -105,
    top: 58,
  },
  roseBloomOrbSmall: {
    width: 118,
    height: 118,
    left: -34,
    bottom: 92,
    backgroundColor: 'rgba(183, 101, 120, 0.16)',
  },
  roseBloomVine: {
    position: 'absolute',
    top: 112,
    left: 22,
    width: 86,
    height: 230,
    borderLeftWidth: 1,
    borderColor: 'rgba(143, 159, 123, 0.34)',
    borderTopLeftRadius: 80,
  },
  roseBloomPetal: {
    position: 'absolute',
    width: 42,
    height: 26,
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: 'rgba(255, 252, 247, 0.72)',
  },
  roseBloomPetalA: {
    top: 20,
    left: 16,
    transform: [{ rotate: '-18deg' }],
  },
  roseBloomPetalB: {
    top: 96,
    left: -8,
    backgroundColor: 'rgba(215, 155, 166, 0.38)',
    transform: [{ rotate: '18deg' }],
  },
  roseBloomPetalC: {
    top: 160,
    left: 20,
    transform: [{ rotate: '-8deg' }],
  },
  roseBloomPhotoStamp: {
    position: 'absolute',
    top: 150,
    right: 24,
    width: 142,
    height: 172,
    padding: 7,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 252, 247, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.14)',
    transform: [{ rotate: '4deg' }],
    shadowColor: '#b76578',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 7,
  },
  roseBloomPhotoTape: {
    position: 'absolute',
    top: -8,
    left: 28,
    width: 56,
    height: 18,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 235, 225, 0.66)',
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.12)',
    transform: [{ rotate: '-5deg' }],
    zIndex: 5,
  },
  roseBloomPhotoCorner: {
    position: 'absolute',
    right: 13,
    bottom: 13,
    width: 28,
    height: 28,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(143, 159, 123, 0.38)',
    borderBottomRightRadius: 10,
    zIndex: 5,
  },
  roseBloomPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
    opacity: 0.92,
  },
  roseBloomMomentCard: {
    position: 'absolute',
    top: 212,
    left: 26,
    width: 94,
    minHeight: 102,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 252, 247, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.2)',
    shadowColor: '#b76578',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.13,
    shadowRadius: 22,
    elevation: 5,
    alignItems: 'center',
  },
  roseBloomMomentNumber: {
    color: '#562733',
    fontSize: 42,
    lineHeight: 43,
    fontFamily: Fonts.cormorant.bold,
  },
  roseBloomMomentLabel: {
    color: '#9a6c74',
    fontSize: 9.5,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  roseBloomMomentDivider: {
    width: 34,
    height: 1,
    backgroundColor: 'rgba(143, 159, 123, 0.42)',
    marginTop: 9,
  },
  roseBloomCard: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    borderTopLeftRadius: 46,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 42,
    backgroundColor: 'rgba(255, 252, 247, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.2)',
    shadowColor: '#b76578',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 30,
    elevation: 7,
  },
  roseBloomKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },
  roseBloomKickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8f9f7b',
  },
  roseBloomKickerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(183, 101, 120, 0.22)',
  },
  roseBloomKicker: {
    color: '#9a6c74',
    fontSize: 10.5,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  roseBloomTitle: {
    color: '#562733',
    fontSize: 42,
    lineHeight: 44,
    fontFamily: Fonts.cormorant.bold,
    letterSpacing: 0,
  },
  roseBloomStem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  roseBloomStemLine: {
    width: 86,
    height: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(183, 101, 120, 0.56)',
  },
  roseBloomLeaf: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#8f9f7b',
  },
  roseBloomLeafAlt: {
    backgroundColor: '#d79ba6',
  },
  roseBloomDate: {
    color: '#8b5962',
    fontSize: 12,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.35,
  },
  roseBloomShare: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 19,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(183, 101, 120, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.24)',
  },
  roseBloomShareText: {
    color: '#562733',
    fontSize: 11,
    fontFamily: Fonts.nunitoSans.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  minimalEditorialHero: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 28,
    overflow: 'hidden',
    backgroundColor: '#f7efe4',
  },
  minimalEditorialWash: {
    ...StyleSheet.absoluteFillObject,
  },
  minimalEditorialBotanical: {
    position: 'absolute',
    width: 92,
    height: 118,
    opacity: 0.28,
  },
  minimalEditorialBotanicalLeft: {
    left: -20,
    bottom: 72,
    transform: [{ rotate: '-18deg' }],
  },
  minimalEditorialBotanicalRight: {
    right: -18,
    top: 126,
    transform: [{ rotate: '164deg' }],
  },
  minimalEditorialStem: {
    position: 'absolute',
    left: 44,
    top: 8,
    width: 1,
    height: 104,
    backgroundColor: 'rgba(109, 75, 52, 0.34)',
  },
  minimalEditorialLeaf: {
    position: 'absolute',
    width: 30,
    height: 15,
    borderTopLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: 'rgba(178, 151, 119, 0.42)',
  },
  minimalEditorialLeafOne: {
    top: 30,
    left: 45,
    transform: [{ rotate: '22deg' }],
  },
  minimalEditorialLeafTwo: {
    top: 66,
    left: 15,
    transform: [{ rotate: '-28deg' }],
  },
  minimalEditorialPhotoPanel: {
    position: 'absolute',
    top: 92,
    right: 22,
    width: 166,
    height: 198,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#fffaf2',
    padding: 9,
    paddingBottom: 22,
    shadowColor: '#6d4b34',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 5,
    transform: [{ rotate: '2deg' }],
  },
  minimalEditorialTape: {
    position: 'absolute',
    top: -5,
    left: 48,
    width: 68,
    height: 20,
    borderRadius: 5,
    backgroundColor: 'rgba(214, 190, 156, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(109, 75, 52, 0.08)',
    zIndex: 3,
    transform: [{ rotate: '-5deg' }],
  },
  minimalEditorialPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  minimalEditorialPhotoFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(109, 75, 52, 0.04)',
  },
  minimalEditorialGridLineVertical: {
    position: 'absolute',
    top: 82,
    bottom: 42,
    left: 56,
    width: 1,
    backgroundColor: 'rgba(109, 75, 52, 0.08)',
  },
  minimalEditorialGridLineHorizontal: {
    position: 'absolute',
    top: 304,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(109, 75, 52, 0.08)',
  },
  minimalEditorialContent: {
    width: '86%',
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 250, 242, 0.91)',
    borderWidth: 1,
    borderColor: 'rgba(109, 75, 52, 0.1)',
    shadowColor: '#6d4b34',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 4,
  },
  minimalEditorialKicker: {
    color: '#8a7461',
    fontSize: 10.5,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 2.1,
    marginBottom: 12,
  },
  minimalEditorialTitle: {
    color: '#3b2618',
    fontSize: 43,
    lineHeight: 45,
    fontFamily: Fonts.cormorant.bold,
    letterSpacing: 0,
  },
  minimalEditorialDivider: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  minimalEditorialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(109, 75, 52, 0.18)',
  },
  minimalEditorialDividerOrnament: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#6d4b34',
  },
  minimalEditorialMetaRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  minimalEditorialDate: {
    color: '#6d4b34',
    fontSize: 12,
    fontFamily: Fonts.nunitoSans.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  minimalEditorialShare: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a2f1d',
    shadowColor: '#6d4b34',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 3,
  },
  minimalEditorialIndex: {
    position: 'absolute',
    top: 96,
    left: 24,
    width: 70,
    height: 82,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 250, 242, 0.26)',
    backgroundColor: '#4a2f1d',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6d4b34',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 3,
  },
  minimalEditorialIndexText: {
    color: '#fffaf2',
    fontSize: 27,
    lineHeight: 29,
    fontFamily: Fonts.cormorant.bold,
  },
  minimalEditorialIndexLabel: {
    marginTop: 1,
    color: '#d6be9c',
    fontSize: 8.5,
    fontFamily: Fonts.nunitoSans.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  popHeroContent: {
    left: 18,
    right: 18,
    bottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 24,
    backgroundColor: '#fffdf3',
    borderWidth: 3,
    borderColor: '#231f20',
    shadowColor: '#0080ff',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    overflow: 'hidden',
  },
  popBurstShape: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#231f20',
    opacity: 0.92,
  },
  popBurstShapePink: {
    right: -28,
    top: -24,
    backgroundColor: '#ff4fb8',
    transform: [{ rotate: '18deg' }],
  },
  popBurstShapeBlue: {
    left: -34,
    bottom: -30,
    backgroundColor: '#0080ff',
    transform: [{ rotate: '-16deg' }],
  },
  popHeroSticker: {
    position: 'absolute',
    right: 18,
    top: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ffe84a',
    borderWidth: 3,
    borderColor: '#231f20',
    transform: [{ rotate: '8deg' }],
    zIndex: 2,
  },
  popHeroStickerText: {
    color: '#231f20',
    fontSize: 13,
    fontFamily: FunkyFonts.marker,
    letterSpacing: 0,
  },
  popHeroChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#ff4fb8',
    borderWidth: 3,
    borderColor: '#231f20',
    marginBottom: 12,
  },
  popHeroChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffe84a',
    borderWidth: 1,
    borderColor: '#231f20',
  },
  popHeroChipText: {
    color: '#231f20',
    fontSize: 20,
    fontFamily: FunkyFonts.marker,
    textTransform: 'uppercase',
    letterSpacing: -0.2,
    marginBottom: 10,
    marginTop: 6,
    alignSelf: 'center',
  },
  popHeroDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  popHeroDividerLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#231f20',
  },
  popHeroDividerBlock: {
    width: 22,
    height: 12,
    backgroundColor: '#0080ff',
    borderWidth: 2,
    borderColor: '#231f20',
    transform: [{ rotate: '-8deg' }],
  },
  popHeroDividerBlockAlt: {
    backgroundColor: '#ef2b3a',
    transform: [{ rotate: '8deg' }],
  },
  popHeroTitle: {
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: 0,
    textTransform: 'uppercase',
    fontFamily: FunkyFonts.marker,
  },
  popHeroMeta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#ffe84a',
    borderWidth: 3,
    borderColor: '#231f20',
  },
  popHeroDate: {
    color: '#231f20',
    letterSpacing: 0.5,
    fontFamily: FunkyFonts.marker,
    fontSize: 14,
  },
  popShareButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: '#0080ff',
    borderWidth: 3,
    borderColor: '#231f20',
  },
  // CYBER TECH TEMPLATE STYLES

  neonCarnivalHeroOverlay: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#0c0714',
    zIndex: 2,
    justifyContent: 'space-between',
  },
  neonCarnivalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 10,
  },
  neonCarnivalHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(24, 15, 38, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.2)',
  },
  neonCarnivalContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 20,
    zIndex: 10,
  },
  neonCarnivalDateText: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 14,
    color: '#d8b4fe',
    letterSpacing: 3,
    marginBottom: 8,
  },
  neonCarnivalTitleWrapper: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  neonCarnivalTitle: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 48,
    color: '#faf5ff',
    textAlign: 'center',
    textShadowColor: 'rgba(217, 70, 239, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  neonCarnivalCoverWrapper: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  neonCarnivalCoverImg: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  neonCarnivalGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    bottom: 0,
  },
  neonCarnivalInfoBox: {
    backgroundColor: 'rgba(20, 12, 33, 0.72)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(217, 70, 239, 0.25)',
    padding: 12,
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  neonCarnivalInfoInner: {
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.15)',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: 'rgba(12, 7, 20, 0.5)',
  },
  neonCarnivalInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'center',
  },
  neonCarnivalInfoPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d946ef',
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  neonCarnivalInfoKicker: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 12,
    color: '#d946ef',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  neonCarnivalInfoLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(217, 70, 239, 0.2)',
    marginLeft: 8,
  },
  neonCarnivalVisitorDescription: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: '#d8b4fe',
    textAlign: 'center',
  },
  neonCarnivalPartnersTitle: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 26,
    color: '#faf5ff',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(217, 70, 239, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  neonCarnivalPartnersSubtitle: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 13,
    color: '#d8b4fe',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  neonCarnivalPartnerCard: {
    backgroundColor: 'rgba(20, 12, 33, 0.8)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(217, 70, 239, 0.15)',
    padding: 16,
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  neonCarnivalEmptyText: {
    fontFamily: 'TiltNeon_400Regular',
    color: '#d8b4fe',
    fontSize: 14,
    letterSpacing: 1,
  },
  neonCarnivalPartnerName: {
    fontFamily: 'TiltNeon_400Regular',
    color: '#faf5ff',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  neonCarnivalPartnerType: {
    fontFamily: 'TiltNeon_400Regular',
    color: '#d946ef',
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  neonCarnivalGalleryKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  neonCarnivalGalleryPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d946ef',
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  neonCarnivalGalleryKickerText: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 11,
    color: '#d946ef',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  neonCarnivalGalleryKickerLine: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(217, 70, 239, 0.3)',
  },
  neonCarnivalGalleryTitle: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 24,
    color: '#faf5ff',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(217, 70, 239, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  neonCarnivalPhotoCount: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 12,
    color: '#d8b4fe',
    letterSpacing: 1,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  neonCarnivalPhotoTile: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 0,
    backgroundColor: 'rgba(20, 12, 33, 0.8)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  neonCarnivalPhotoTileFeatured: {
    borderWidth: 2,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 6,
  },
  neonCarnivalGalleryImg: {
    borderRadius: 14,
  },
  neonCarnivalViewerActionCount: {
    fontFamily: 'TiltNeon_400Regular',
    color: '#d8b4fe',
  },
  neonCarnivalText: {
    fontFamily: 'TiltNeon_400Regular',
  },
  cyberHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#05070c',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  cyberGridLines: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.03)',
  },
  cyberGlowDot1: {
    position: 'absolute',
    top: '15%',
    left: '-10%',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#00f0ff',
    opacity: 0.06,
  },
  cyberGlowDot2: {
    position: 'absolute',
    bottom: '20%',
    right: '-10%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#d946ef',
    opacity: 0.05,
  },
  cyberTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.15)',
  },
  cyberPathText: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 22,
    color: '#00f0ff',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  cyberHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cyberTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  cyberMiddleFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  cyberPosterWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    backgroundColor: '#090d16',
    padding: 6,
  },
  cyberPosterImg: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  cyberCorner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#00f0ff',
    zIndex: 5,
  },
  cyberCornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cyberCornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cyberCornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cyberCornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  cyberScanBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '35%',
    height: 2,
    backgroundColor: '#00f0ff',
    opacity: 0.6,
  },
  cyberScanStatus: {
    marginTop: 12,
    color: '#627fa7',
    fontFamily: Fonts.vt323.regular,
    fontSize: 14,
    letterSpacing: 1.2,
  },
  cyberBottomConsole: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
    gap: 12,
  },
  cyberTerminalCard: {
    width: '100%',
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.15)',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  cyberTerminalPrompt: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 16,
    color: '#e2eafc',
  },
  cyberDateContainer: {
    width: '100%',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    borderRadius: 8,
    backgroundColor: 'rgba(0, 240, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cyberDateText: {
    color: '#00f0ff',
    fontSize: 18,
    fontFamily: Fonts.vt323.regular,
    letterSpacing: 2,
  },
  // RETRO ARCADE TEMPLATE STYLES
  retroHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffde4a',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  retroTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderColor: '#231f20',
  },
  retroHeaderButtonBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ff3562',
    borderWidth: 3,
    borderColor: '#231f20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retroHeaderButtonShare: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0080ff',
    borderWidth: 3,
    borderColor: '#231f20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retroTitleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  retroPathText: {
    fontFamily: FunkyFonts.marker,
    fontSize: 20,
    color: '#231f20',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  retroMiddleFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  retroPosterWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
    borderWidth: 3,
    borderColor: '#231f20',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 6,
    shadowColor: '#ff3562',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  retroPosterImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  retroBottomConsole: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
    gap: 12,
  },
  retroDateContainer: {
    width: '100%',
    paddingVertical: 12,
    borderWidth: 3,
    borderColor: '#231f20',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#231f20',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  retroDateText: {
    color: '#ff3562',
    fontSize: 16,
    fontFamily: FunkyFonts.marker,
    letterSpacing: 0.5,
  },
  retroArcadeInfoBox: {
    borderWidth: 3,
    borderColor: '#231f20',
    borderRadius: 18,
    padding: 4,
    shadowColor: '#ff3562',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
    backgroundColor: '#ffde4a',
  },
  retroArcadeInfoInner: {
    borderWidth: 3,
    borderColor: '#231f20',
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  retroArcadeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  retroArcadeInfoBadge: {
    backgroundColor: '#ff3562',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 3,
    borderColor: '#231f20',
    borderRadius: 10,
    transform: [{ rotate: '-2deg' }],
  },
  retroArcadeInfoBadgeText: {
    color: '#ffffff',
    fontFamily: FunkyFonts.marker,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  retroArcadeInfoStripe: {
    flex: 1,
    height: 6,
    backgroundColor: '#231f20',
    marginLeft: 10,
    borderRadius: 3,
  },
  retroArcadeVisitorDescription: {
    fontFamily: FunkyFonts.marker,
    fontSize: 15,
    lineHeight: 24,
    color: '#231f20',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  retroArcadeGalleryHeader: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  retroArcadeGalleryKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  retroArcadeGalleryKickerBadge: {
    backgroundColor: '#0080ff',
    color: '#ffffff',
    fontFamily: FunkyFonts.marker,
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#231f20',
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  retroArcadeGalleryKickerText: {
    fontFamily: FunkyFonts.marker,
    fontSize: 12,
    color: '#231f20',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  retroArcadeGalleryKickerBolt: {
    width: 14,
    height: 14,
    backgroundColor: '#ff3562',
    marginLeft: 6,
    borderRadius: 7,
  },
  retroArcadeGalleryTitle: {
    fontFamily: FunkyFonts.marker,
    fontSize: 28,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  retroArcadePhotoTile: {
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#231f20',
    borderRadius: 18,
    padding: 4,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    overflow: 'hidden',
  },
  retroArcadePhotoTileAlt: {
    transform: [{ rotate: '1.5deg' }],
  },
  retroArcadeGalleryImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  popHeroCanvas: {
    width: '100%',
    height: 465,
    backgroundColor: '#ffe84a',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    paddingTop: 16,
  },
  popTitleContainerOuter: {
    position: 'absolute',
    top: 20,
    zIndex: 10,
    transform: [{ rotate: '-1.5deg' }],
  },
  popTitleContainerShadow: {
    position: 'absolute',
    top: 4, left: 4, right: -4, bottom: -4,
    backgroundColor: '#ef2b3a',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#231f20',
  },
  popTitleContainer: {
    backgroundColor: '#fffdf3',
    borderWidth: 3,
    borderColor: '#231f20',
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 18,
  },
  popTitleText: {
    fontFamily: FunkyFonts.marker,
    fontSize: 24,
    color: '#0080ff',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  popPolaroidFrame: {
    marginTop: 82,
    width: 340,
    height: 310,
    backgroundColor: '#ffffff',
    borderWidth: 4,
    borderColor: '#231f20',
    padding: 12,
    paddingBottom: 24,
    borderRadius: 16,
    transform: [{ rotate: '2.5deg' }],
    shadowColor: '#231f20',
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    position: 'relative',
  },
  popPolaroidInner: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#231f20',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  popPolaroidImage: {
    width: '100%',
    height: '100%',
  },
  popPolaroidOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#ffe84a',
    opacity: 0.05,
  },
  popPolaroidCaption: {
    fontFamily: FunkyFonts.marker,
    fontSize: 13,
    color: '#231f20',
    textAlign: 'center',
    textTransform: 'uppercase',
    flex: 1,
  },
  popPolaroidCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  popCaptionBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0080ff',
    borderWidth: 2.5,
    borderColor: '#231f20',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#231f20',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  popCaptionShareBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ff4fb8',
    borderWidth: 2.5,
    borderColor: '#231f20',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#231f20',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  popSticker: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#231f20',
    zIndex: 20,
  },
  popStickerLeft: {
    top: -12,
    left: -20,
    backgroundColor: '#0080ff',
    transform: [{ rotate: '-12deg' }],
  },
  popStickerRight: {
    top: 110,
    right: -24,
    backgroundColor: '#ff4fb8',
    transform: [{ rotate: '8deg' }],
  },
  popStickerText: {
    fontFamily: FunkyFonts.marker,
    fontSize: 12,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  popBubbleTailOuter: {
    position: 'absolute',
    bottom: -13,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 24,
    overflow: 'hidden',
    zIndex: 4,
  },
  popBubbleTail: {
    width: 14,
    height: 14,
    backgroundColor: '#fffdf3',
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#231f20',
    transform: [{ rotate: '45deg' }],
    marginTop: -8,
    marginLeft: 5,
  },
  popBackgroundShapeBlue: {
    position: 'absolute',
    top: 60,
    left: -40,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#231f20',
    backgroundColor: '#0080ff',
    opacity: 0.12,
    transform: [{ rotate: '-12deg' }],
  },
  popBackgroundShapePink: {
    position: 'absolute',
    bottom: 50,
    right: -45,
    width: 120,
    height: 120,
    borderWidth: 3,
    borderColor: '#231f20',
    backgroundColor: '#ff4fb8',
    opacity: 0.12,
    transform: [{ rotate: '45deg' }],
  },
  popStickerCapContainer: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ffe84a',
    borderWidth: 3,
    borderColor: '#231f20',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '15deg' }],
    zIndex: 25,
    shadowColor: '#231f20',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  popStickerCapEmoji: {
    fontSize: 26,
  },
  scrapbookTape: {
    position: 'absolute',
    width: 70,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(246, 213, 143, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(217, 130, 107, 0.18)',
    zIndex: 3,
  },
  scrapbookTapeLeft: {
    top: -10,
    left: 22,
    transform: [{ rotate: '-8deg' }],
  },
  scrapbookTapeRight: {
    top: -8,
    right: 26,
    transform: [{ rotate: '7deg' }],
  },
  scrapbookSticker: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 130, 107, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(217, 130, 107, 0.18)',
    marginBottom: 10,
  },
  scrapbookStickerText: {
    color: '#72493f',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
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
  designCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: 'rgba(30, 41, 59, 0.45)', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  designInfo: { flex: 1, paddingRight: 12 },
  designLabel: { color: MidnightColors.slate400, fontSize: 9.5, fontFamily: Fonts.inter.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  designValue: { color: '#fff', fontSize: 14, fontFamily: Fonts.outfit.semiBold, marginTop: 2 },

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
  templateRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  activeTemplateRowCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  templateRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  palettePreview: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  paletteAccentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  templateRowText: {
    flex: 1,
    marginRight: 8,
  },
  templateRowName: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.outfit.bold,
  },
  templateRowDesc: {
    color: MidnightColors.slate400,
    fontSize: 11,
    fontFamily: Fonts.inter.regular,
    marginTop: 1,
  },
  templateCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
  scrapbookVisitorHeaderContainer: {
    height: 72,
    marginTop: 12,
  },
  scrapbookVisitorHeaderContent: {
    paddingHorizontal: 18,
    gap: 12,
  },
  neonVisitorHeaderContainer: {
    height: 72,
    marginTop: 10,
  },
  neonVisitorHeaderContent: {
    paddingHorizontal: 18,
    gap: 12,
  },
  pastelVisitorHeaderContainer: {
    height: 72,
    marginTop: 10,
  },
  pastelVisitorHeaderContent: {
    paddingHorizontal: 18,
    gap: 12,
  },
  popVisitorHeaderContainer: {
    height: 74,
    marginTop: 10,
  },
  popVisitorHeaderContent: {
    paddingHorizontal: 18,
    gap: 12,
  },
  cyberVisitorHeaderContainer: {
    height: 72,
    marginTop: 10,
    backgroundColor: '#05070c',
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.1)',
  },
  cyberVisitorHeaderContent: {
    paddingHorizontal: 18,
    gap: 12,
  },
  retroArcadeVisitorHeaderContainer: {
    height: 74,
    marginTop: 10,
    backgroundColor: '#ffde4a',
    borderBottomWidth: 3,
    borderColor: '#231f20',
  },

  neonCarnivalVisitorHeaderContainer: {
    height: 72,
    marginTop: 10,
    backgroundColor: '#0c0714',
    borderBottomWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.2)',
  },
  neonCarnivalVisitorHeaderContent: {
    paddingHorizontal: 18,
    gap: 12,
  },
  neonCarnivalVisitorTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(12, 7, 20, 0.9)',
    borderWidth: 2,
    borderColor: 'rgba(217, 70, 239, 0.15)',
  },
  neonCarnivalVisitorTabActive: {
    backgroundColor: 'rgba(217, 70, 239, 0.08)',
    borderColor: '#d946ef',
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  neonCarnivalVisitorTabText: {
    fontFamily: 'TiltNeon_400Regular',
    fontSize: 13,
    color: 'rgba(216, 180, 254, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  neonCarnivalVisitorTabTextActive: {
    color: '#d946ef',
    textShadowColor: 'rgba(217, 70, 239, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  retroArcadeVisitorHeaderContent: {
    paddingHorizontal: 18,
    gap: 12,
  },
  goldenVisitorHeaderContainer: {
    height: 68,
    marginTop: 12,
    marginBottom: 4,
  },
  goldenVisitorHeaderContent: {
    paddingHorizontal: 20,
    gap: 14,
  },
  vintageVisitorHeaderContainer: {
    height: 70,
    marginTop: 14,
    marginBottom: 8,
  },
  vintageVisitorHeaderContent: {
    paddingHorizontal: 20,
    gap: 14,
  },
  roseVisitorHeaderContainer: {
    height: 70,
    marginTop: 12,
    marginBottom: 8,
  },
  roseVisitorHeaderContent: {
    paddingHorizontal: 20,
    gap: 13,
  },
  minimalVisitorHeaderContainer: {
    height: 68,
    marginTop: 12,
    marginBottom: 8,
  },
  minimalVisitorHeaderContent: {
    paddingHorizontal: 20,
    gap: 13,
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
  scrapbookVisitorTab: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 253, 249, 0.72)',
    borderColor: 'rgba(38, 51, 49, 0.1)',
    shadowColor: '#d9826b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  visitorTabActive: {
    backgroundColor: MidnightColors.gold,
    borderColor: MidnightColors.gold,
  },
  scrapbookVisitorTabActive: {
    backgroundColor: '#f6d58f',
    borderColor: 'rgba(217, 130, 107, 0.28)',
    transform: [{ translateY: -2 }, { rotate: '-0.4deg' }],
  },
  neonVisitorTab: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 14, 34, 0.72)',
    borderColor: 'rgba(102, 232, 255, 0.18)',
  },
  neonVisitorTabActive: {
    backgroundColor: 'rgba(255, 61, 242, 0.18)',
    borderColor: 'rgba(255, 61, 242, 0.72)',
    shadowColor: '#ff3df2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
    transform: [{ translateY: -2 }],
  },
  pastelVisitorTab: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 253, 251, 0.78)',
    borderColor: 'rgba(213, 180, 220, 0.22)',
    shadowColor: '#d8b4dc',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 2,
  },
  pastelVisitorTabActive: {
    backgroundColor: '#f8d9de',
    borderColor: 'rgba(201, 118, 139, 0.24)',
    transform: [{ translateY: -2 }],
  },
  popVisitorTab: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: '#fffdf3',
    borderColor: '#231f20',
    borderWidth: 2,
    shadowColor: '#231f20',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  popVisitorTabActive: {
    backgroundColor: '#0080ff',
    borderColor: '#231f20',
    transform: [{ translateY: -2 }, { rotate: '-1deg' }],
  },
  cyberVisitorTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cyberVisitorTabActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
  },
  retroArcadeVisitorTab: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderColor: '#231f20',
    borderWidth: 2,
    shadowColor: '#231f20',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  retroArcadeVisitorTabActive: {
    backgroundColor: '#ff3562',
    borderColor: '#231f20',
    transform: [{ translateY: -2 }, { rotate: '-1.5deg' }],
  },
  goldenVisitorTab: {
    paddingHorizontal: 21,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 250, 240, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(201, 154, 46, 0.12)',
    shadowColor: '#c99a2e',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 1,
  },
  goldenVisitorTabActive: {
    backgroundColor: 'rgba(201, 154, 46, 0.18)',
    borderColor: 'rgba(201, 154, 46, 0.24)',
    transform: [{ translateY: -1 }],
  },
  vintageVisitorTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#15130F',
    borderWidth: 1,
    borderColor: 'rgba(184, 145, 69, 0.44)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 3,
  },
  vintageVisitorTabActive: {
    backgroundColor: '#B89145',
    borderColor: '#B89145',
    transform: [{ translateY: -1 }],
  },
  roseVisitorTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 252, 247, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.18)',
    shadowColor: '#b76578',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  roseVisitorTabActive: {
    backgroundColor: 'rgba(183, 101, 120, 0.18)',
    borderColor: 'rgba(183, 101, 120, 0.34)',
    transform: [{ translateY: -1 }],
  },
  minimalVisitorTab: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 250, 242, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(109, 75, 52, 0.12)',
    shadowColor: '#6d4b34',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  minimalVisitorTabActive: {
    backgroundColor: '#4a2f1d',
    borderColor: '#4a2f1d',
    transform: [{ translateY: -1 }],
  },
  visitorTabText: {
    color: MidnightColors.gold,
    fontSize: 14,
    fontFamily: Fonts.outfit.bold,
  },
  scrapbookVisitorTabText: {
    fontSize: 13,
    fontFamily: Fonts.outfit.bold,
    letterSpacing: 0.2,
  },
  neonVisitorTabText: {
    fontSize: 12,
    fontFamily: Fonts.outfit.extraBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pastelVisitorTabText: {
    fontSize: 13,
    fontFamily: Fonts.outfit.bold,
    letterSpacing: 0.15,
  },
  popVisitorTabText: {
    fontSize: 13,
    fontFamily: FunkyFonts.marker,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  goldenVisitorTabText: {
    fontSize: 12.5,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.85,
  },
  visitorTabTextActive: {
    color: MidnightColors.background,
  },
  goldenVisitorTabTextActive: {
    color: '#3f2f22',
    fontFamily: Fonts.nunitoSans.bold,
  },
  vintageVisitorTabText: {
    fontSize: 12.5,
    fontFamily: Fonts.inter.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.25,
    color: '#F2E7D2',
  },
  vintageVisitorTabTextActive: {
    color: '#211A12',
    fontFamily: Fonts.inter.bold,
  },
  roseVisitorTabText: {
    fontSize: 12.5,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.85,
    color: '#562733',
  },
  roseVisitorTabTextActive: {
    color: '#562733',
    fontFamily: Fonts.nunitoSans.bold,
  },
  minimalVisitorTabText: {
    fontSize: 12.5,
    fontFamily: Fonts.nunitoSans.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: '#4a2f1d',
  },
  minimalVisitorTabTextActive: {
    color: '#fffaf2',
    fontFamily: Fonts.nunitoSans.bold,
  },
  scrapbookVisitorTabTextActive: {
    color: '#263331',
  },
  neonVisitorTabTextActive: {
    color: '#66e8ff',
  },
  pastelVisitorTabTextActive: {
    color: '#7b555b',
  },
  popVisitorTabTextActive: {
    color: '#ffffff',
  },
  cyberVisitorTabText: {
    fontSize: 16,
    fontFamily: Fonts.vt323.regular,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(0, 240, 255, 0.5)',
  },
  cyberVisitorTabTextActive: {
    color: '#00f0ff',
    fontFamily: Fonts.vt323.regular,
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 240, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  retroArcadeVisitorTabText: {
    fontSize: 13,
    fontFamily: FunkyFonts.marker,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#231f20',
  },
  retroArcadeVisitorTabTextActive: {
    color: '#ffffff',
  },
  cyberInfoBox: {
    backgroundColor: '#05070c',
    borderColor: 'rgba(0, 240, 255, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  cyberInfoInner: {
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.08)',
    borderRadius: 6,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cyberInfoHeader: {
    marginBottom: 12,
    alignItems: 'center',
  },
  cyberInfoKicker: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 16,
    color: '#00f0ff',
    letterSpacing: 1.5,
  },
  cyberVisitorDescription: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    color: '#e2eafc',
    textTransform: 'uppercase',
  },
  cyberPartnersTitle: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 28,
    color: '#00f0ff',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  cyberPartnersSubtitle: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 16,
    color: 'rgba(0, 240, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '85%',
  },
  cyberEmptyText: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 18,
    color: 'rgba(0, 240, 255, 0.5)',
    textTransform: 'uppercase',
    marginTop: 12,
  },
  cyberPartnerCard: {
    backgroundColor: 'rgba(0, 240, 255, 0.02)',
    borderColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 4,
  },
  cyberPartnerName: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 20,
    color: '#e2eafc',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cyberPartnerType: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 14,
    color: '#00f0ff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cyberGalleryKicker: {
    marginBottom: 4,
  },
  cyberGalleryKickerText: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 14,
    color: 'rgba(0, 240, 255, 0.5)',
    letterSpacing: 1.5,
  },
  cyberGalleryTitle: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 26,
    color: '#e2eafc',
    textTransform: 'uppercase',
  },
  cyberPhotoCount: {
    fontFamily: Fonts.vt323.regular,
    fontSize: 16,
    color: '#00f0ff',
    marginTop: 2,
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
  scrapbookInfoBox: {
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 26,
    padding: 12,
    borderRadius: 26,
    borderWidth: 1,
    shadowColor: '#d9826b',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 3,
  },
  scrapbookInfoInner: {
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(38, 51, 49, 0.08)',
    backgroundColor: 'rgba(255, 253, 249, 0.58)',
  },
  neonInfoBox: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 24,
    padding: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(102, 232, 255, 0.26)',
    shadowColor: '#7e57ff',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 6,
  },
  neonInfoInner: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 26,
    backgroundColor: 'rgba(12, 11, 27, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  neonInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },
  neonInfoPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3df2',
  },
  neonInfoKicker: {
    color: '#66e8ff',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  neonInfoLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(102, 232, 255, 0.24)',
  },
  pastelInfoBox: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 24,
    padding: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(213, 180, 220, 0.24)',
    backgroundColor: 'rgba(255, 253, 251, 0.62)',
    shadowColor: '#f4b8a8',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 3,
  },
  pastelInfoInner: {
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(201, 118, 139, 0.12)',
  },
  pastelInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },
  pastelInfoPetal: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#f4b8a8',
  },
  pastelInfoKicker: {
    color: '#9a8583',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  pastelInfoLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(201, 118, 139, 0.18)',
  },
  goldenInfoBox: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 30,
    padding: 8,
    borderRadius: 26,
    borderWidth: 0,
    backgroundColor: 'rgba(255, 250, 240, 0.26)',
    shadowColor: '#c99a2e',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 2,
  },
  goldenInfoInner: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 22,
    borderWidth: 0,
    backgroundColor: 'rgba(255, 250, 240, 0.68)',
  },
  vintageInfoBox: {
    marginHorizontal: 18,
    marginTop: 20,
    marginBottom: 32,
    padding: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(184, 145, 69, 0.42)',
    backgroundColor: '#15130F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 4,
  },
  vintageInfoInner: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 17,
    backgroundColor: '#1C1812',
  },
  roseInfoBox: {
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 30,
    padding: 8,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.14)',
    backgroundColor: 'rgba(255, 249, 245, 0.42)',
    shadowColor: '#b76578',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 3,
  },
  roseInfoInner: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(183, 101, 120, 0.13)',
    backgroundColor: 'rgba(255, 252, 247, 0.82)',
  },
  minimalInfoBox: {
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 28,
    padding: 0,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(109, 75, 52, 0.1)',
    backgroundColor: '#fffaf2',
    shadowColor: '#6d4b34',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 3,
  },
  minimalInfoInner: {
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 250, 242, 0.92)',
  },
  anniversaryInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 12,
  },
  vintageInfoHeader: {
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: 'rgba(184, 145, 69, 0.34)',
  },
  minimalInfoHeader: {
    marginBottom: 14,
  },
  anniversaryInfoMark: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  goldenInfoMark: {
    backgroundColor: '#c99a2e',
  },
  vintageInfoMark: {
    width: 22,
    height: 1,
    borderRadius: 0,
    backgroundColor: '#B89145',
  },
  roseInfoMark: {
    backgroundColor: '#8f9f7b',
  },
  minimalInfoMark: {
    width: 24,
    height: 1,
    borderRadius: 0,
    backgroundColor: '#6d4b34',
  },
  anniversaryInfoKicker: {
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.25,
  },
  goldenInfoKicker: {
    color: '#9a6f22',
    fontSize: 10.5,
    fontFamily: Fonts.nunitoSans.semiBold,
    letterSpacing: 1.8,
  },
  vintageInfoKicker: {
    color: '#C7A96B',
    fontFamily: Fonts.inter.semiBold,
    letterSpacing: 2,
  },
  roseInfoKicker: {
    color: '#9a6c74',
    fontFamily: Fonts.nunitoSans.semiBold,
    letterSpacing: 1.7,
  },
  minimalInfoKicker: {
    color: '#8a7461',
    fontFamily: Fonts.nunitoSans.semiBold,
    letterSpacing: 1.8,
  },
  anniversaryInfoLine: {
    flex: 1,
    height: 1,
  },
  goldenInfoLine: {
    backgroundColor: 'rgba(201, 154, 46, 0.28)',
  },
  vintageInfoLine: {
    backgroundColor: 'rgba(184, 145, 69, 0.28)',
  },
  roseInfoLine: {
    backgroundColor: 'rgba(183, 101, 120, 0.22)',
  },
  minimalInfoLine: {
    backgroundColor: 'rgba(109, 75, 52, 0.14)',
  },
  popInfoBox: {
    marginHorizontal: 10,
    marginTop: 16,
    marginBottom: 26,
    padding: 0,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#231f20',
    backgroundColor: '#fffdf3',
    shadowColor: '#ef2b3a',
    shadowOffset: { width: 7, height: 7 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  popInfoInner: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 20,
    backgroundColor: '#fffdf3',
    borderWidth: 0,
  },
  popInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  popInfoBang: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 28,
    backgroundColor: '#0080ff',
    borderWidth: 2.5,
    borderColor: '#231f20',
    color: '#ffffff',
    fontFamily: FunkyFonts.marker,
    fontSize: 18,
  },
  popInfoKicker: {
    color: '#231f20',
    fontSize: 13,
    fontFamily: FunkyFonts.marker,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  popInfoStripe: {
    flex: 1,
    height: 4,
    backgroundColor: '#ff4fb8',
    borderWidth: 1,
    borderColor: '#231f20',
  },
  scrapbookInfoRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  scrapbookInfoRuleBottom: {
    marginTop: 16,
    marginBottom: 0,
  },
  scrapbookInfoRuleLine: {
    flex: 1,
    height: 1,
    opacity: 0.65,
  },
  scrapbookInfoRuleShort: {
    width: 42,
    height: 1,
    backgroundColor: 'rgba(38, 51, 49, 0.16)',
  },
  visitorDescription: {
    fontSize: 15,
    color: MidnightColors.slate400,
    fontFamily: Fonts.inter.regular,
    lineHeight: 22,
  },
  neonVisitorDescription: {
    color: '#e7e3ff',
    lineHeight: 23,
  },
  pastelVisitorDescription: {
    color: '#5d5350',
    lineHeight: 24,
  },
  popVisitorDescription: {
    color: '#231f20',
    fontFamily: FunkyFonts.marker,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  goldenVisitorDescription: {
    color: '#4d3928',
    fontFamily: Fonts.nunitoSans.regular,
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: 0.05,
  },
  vintageVisitorDescription: {
    color: '#EFE3C7',
    fontFamily: Fonts.inter.regular,
    lineHeight: 25,
    letterSpacing: 0.05,
  },
  roseVisitorDescription: {
    color: '#562733',
    fontFamily: Fonts.nunitoSans.regular,
    fontSize: 15,
    lineHeight: 25,
  },
  minimalVisitorDescription: {
    color: '#5b3e29',
    fontFamily: Fonts.nunitoSans.regular,
    fontSize: 15,
    lineHeight: 25,
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
  scrapbookGalleryHeader: {
    marginTop: 18,
    marginBottom: 22,
    paddingHorizontal: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(38, 51, 49, 0.1)',
  },
  neonGalleryHeader: {
    marginTop: 18,
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(102, 232, 255, 0.16)',
  },
  pastelGalleryHeader: {
    marginTop: 18,
    marginBottom: 22,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201, 118, 139, 0.12)',
  },
  goldenGalleryHeader: {
    marginTop: 24,
    marginBottom: 28,
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 0,
  },
  vintageGalleryHeader: {
    marginTop: 28,
    marginBottom: 28,
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(184, 145, 69, 0.24)',
  },
  roseGalleryHeader: {
    marginTop: 24,
    marginBottom: 28,
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(183, 101, 120, 0.16)',
  },
  minimalGalleryHeader: {
    marginTop: 24,
    marginBottom: 28,
    paddingHorizontal: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(109, 75, 52, 0.12)',
  },
  popGalleryHeader: {
    marginTop: 24,
    marginBottom: 16,
    marginHorizontal: 16,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  scrapbookGalleryKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  scrapbookGalleryKickerLine: {
    width: 34,
    height: 2,
    borderRadius: 1,
  },
  scrapbookGalleryKickerText: {
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  neonGalleryKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  neonGallerySpark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3df2',
  },
  neonGalleryKickerText: {
    color: '#66e8ff',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  neonGalleryKickerLine: {
    width: 44,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 61, 242, 0.72)',
  },
  pastelGalleryKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  pastelGalleryKickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d8b4dc',
  },
  pastelGalleryKickerText: {
    color: '#9a8583',
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.35,
  },
  pastelGalleryKickerLine: {
    width: 42,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(244, 184, 168, 0.72)',
  },
  popGalleryKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  popGalleryKickerBadge: {
    color: '#ffffff',
    backgroundColor: '#ef2b3a',
    borderWidth: 2,
    borderColor: '#231f20',
    borderRadius: 9,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 10,
    fontFamily: Fonts.outfit.extraBold,
    letterSpacing: 0,
  },
  popGalleryKickerText: {
    color: '#231f20',
    fontSize: 10,
    fontFamily: FunkyFonts.marker,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  popGalleryKickerBolt: {
    width: 36,
    height: 4,
    backgroundColor: '#ffe84a',
    borderWidth: 1,
    borderColor: '#231f20',
    transform: [{ rotate: '-4deg' }],
  },
  anniversaryGalleryKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  vintageGalleryKicker: {
    gap: 11,
  },
  minimalGalleryKicker: {
    gap: 10,
  },
  anniversaryGalleryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  goldenGalleryDot: {
    backgroundColor: 'rgba(201, 154, 46, 0.78)',
  },
  vintageGalleryDot: {
    borderRadius: 0,
    width: 22,
    height: 1,
    backgroundColor: '#B89145',
  },
  roseGalleryDot: {
    backgroundColor: '#8f9f7b',
  },
  minimalGalleryDot: {
    width: 24,
    height: 1,
    borderRadius: 0,
    backgroundColor: '#6d4b34',
  },
  anniversaryGalleryKickerText: {
    fontSize: 10,
    fontFamily: Fonts.inter.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.35,
  },
  goldenGalleryKickerText: {
    color: '#9a6f22',
    fontSize: 10.5,
    fontFamily: Fonts.nunitoSans.semiBold,
    letterSpacing: 1.85,
  },
  vintageGalleryKickerText: {
    color: '#C7A96B',
    fontFamily: Fonts.inter.semiBold,
    letterSpacing: 2,
  },
  roseGalleryKickerText: {
    color: '#9a6c74',
    fontFamily: Fonts.nunitoSans.semiBold,
    letterSpacing: 1.65,
  },
  minimalGalleryKickerText: {
    color: '#8a7461',
    fontFamily: Fonts.nunitoSans.semiBold,
    letterSpacing: 1.8,
  },
  anniversaryGalleryLine: {
    width: 42,
    height: 2,
    borderRadius: 999,
  },
  goldenGalleryLine: {
    backgroundColor: 'rgba(201, 154, 46, 0.36)',
  },
  vintageGalleryLine: {
    height: 1,
    backgroundColor: 'rgba(184, 145, 69, 0.34)',
  },
  roseGalleryLine: {
    backgroundColor: 'rgba(183, 101, 120, 0.42)',
  },
  minimalGalleryLine: {
    height: 1,
    backgroundColor: 'rgba(109, 75, 52, 0.18)',
  },
  galleryTitle: {
    fontSize: 24,
    color: '#fff',
    fontFamily: Fonts.outfit.bold,
  },
  scrapbookGalleryTitle: {
    fontSize: 28,
    letterSpacing: 0,
  },
  neonGalleryTitle: {
    fontSize: 28,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  pastelGalleryTitle: {
    fontSize: 29,
    letterSpacing: 0,
  },
  popGalleryTitle: {
    color: '#231f20',
    fontSize: 32,
    fontFamily: FunkyFonts.marker,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  goldenGalleryTitle: {
    fontSize: 34,
    lineHeight: 39,
    fontFamily: Fonts.cormorant.semiBold,
    letterSpacing: 0,
  },
  vintageGalleryTitle: {
    color: '#F2E7D2',
    fontSize: 34,
    lineHeight: 38,
    fontFamily: Fonts.cormorant.bold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  roseGalleryTitle: {
    color: '#562733',
    fontSize: 32,
    lineHeight: 37,
    fontFamily: Fonts.cormorant.bold,
    letterSpacing: 0,
  },
  minimalGalleryTitle: {
    color: '#3b2618',
    fontSize: 34,
    lineHeight: 38,
    fontFamily: Fonts.cormorant.bold,
    letterSpacing: 0,
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
    paddingHorizontal: 12,
  },
  masonryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  masonryColumn: {
    flex: 1,
    flexDirection: 'column',
    gap: 12,
  },
  photoCard: {
    width: '100%',
  },
  photoTile: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  scrapbookPhotoTile: {
    padding: 9,
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 2,
    transform: [{ rotate: '-0.35deg' }],
  },
  scrapbookPhotoTileAlt: {
    transform: [{ rotate: '0.35deg' }],
  },
  neonPhotoTile: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 3,
    backgroundColor: 'rgba(14, 12, 31, 0.9)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 5,
  },
  neonPhotoTileFeatured: {
    borderWidth: 1.5,
    shadowOpacity: 0.34,
    transform: [{ scale: 0.995 }],
  },
  neonPhotoGlowLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 999,
    zIndex: 2,
  },
  neonPhotoGlowLineTop: {
    top: 12,
  },
  neonPhotoGlowLineBottom: {
    bottom: 12,
  },
  pastelPhotoTile: {
    padding: 9,
    borderWidth: 1,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#fffdfb',
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 3,
    transform: [{ rotate: '-0.2deg' }],
  },
  pastelPhotoTileAlt: {
    transform: [{ rotate: '0.25deg' }],
  },
  pastelPhotoTape: {
    position: 'absolute',
    width: 58,
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(216, 180, 220, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(201, 118, 139, 0.12)',
    zIndex: 2,
  },
  pastelPhotoTapeLeft: {
    top: 12,
    left: 18,
    transform: [{ rotate: '-7deg' }],
  },
  pastelPhotoTapeRight: {
    right: 18,
    bottom: 12,
    transform: [{ rotate: '6deg' }],
    backgroundColor: 'rgba(189, 223, 217, 0.52)',
  },
  pastelPhotoDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    zIndex: 2,
  },
  pastelPhotoDotTop: {
    top: 42,
    right: 24,
    backgroundColor: '#f4b8a8',
  },
  pastelPhotoDotBottom: {
    left: 24,
    bottom: 42,
    backgroundColor: '#d8b4dc',
  },
  goldenPhotoTile: {
    padding: 8,
    borderWidth: 0,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 250, 240, 0.88)',
    shadowColor: '#8a6421',
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 2,
  },
  goldenPhotoTileAlt: {
    transform: [{ rotate: '0.18deg' }],
  },
  anniversaryPhotoAccent: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 2,
    borderRadius: 999,
    zIndex: 2,
  },
  goldenPhotoAccentTop: {
    top: 13,
    backgroundColor: 'rgba(201, 154, 46, 0.28)',
  },
  goldenPhotoAccentBottom: {
    bottom: 13,
    backgroundColor: 'rgba(201, 154, 46, 0.16)',
  },
  vintagePhotoTile: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#D6C29A',
    borderColor: 'rgba(184, 145, 69, 0.44)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.26,
    shadowRadius: 24,
    elevation: 4,
  },
  vintagePhotoTileAlt: {
    transform: [{ rotate: '-0.16deg' }],
  },
  vintagePhotoFrameLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: 'rgba(33, 26, 18, 0.22)',
    zIndex: 2,
  },
  vintagePhotoFrameLineTop: {
    top: 14,
  },
  vintagePhotoFrameLineBottom: {
    bottom: 14,
  },
  rosePhotoTile: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#fffdfa',
    borderColor: 'rgba(183, 101, 120, 0.14)',
    shadowColor: '#b76578',
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 3,
  },
  rosePhotoTileAlt: {
    transform: [{ rotate: '0.2deg' }],
  },
  rosePhotoPetal: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 18,
    backgroundColor: 'rgba(183, 101, 120, 0.14)',
    zIndex: 2,
  },
  rosePhotoPetalTop: {
    top: 14,
    right: 16,
  },
  rosePhotoPetalBottom: {
    left: 16,
    bottom: 14,
    backgroundColor: 'rgba(143, 159, 123, 0.16)',
  },
  minimalPhotoTile: {
    padding: 8,
    paddingBottom: 20,
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fffaf2',
    borderColor: 'rgba(109, 75, 52, 0.1)',
    shadowColor: '#6d4b34',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 3,
  },
  minimalPhotoTileAlt: {
    opacity: 0.98,
    transform: [{ rotate: '-0.35deg' }],
  },
  minimalPhotoIndex: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(74, 47, 29, 0.88)',
  },
  minimalPhotoIndexText: {
    color: '#fffaf2',
    fontSize: 10,
    fontFamily: Fonts.nunitoSans.bold,
  },
  popPhotoTile: {
    padding: 8,
    borderWidth: 3,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fffdf3',
    shadowOffset: { width: 7, height: 7 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
    transform: [{ rotate: '-0.45deg' }],
  },
  popPhotoTileAlt: {
    transform: [{ rotate: '0.45deg' }],
  },
  popPhotoCorner: {
    position: 'absolute',
    width: 36,
    height: 36,
    zIndex: 3,
    borderWidth: 3,
    borderColor: '#231f20',
    backgroundColor: '#ffe84a',
  },
  popPhotoCornerTopLeft: {
    top: 12,
    left: 12,
    borderBottomRightRadius: 18,
  },
  popPhotoCornerBottomRight: {
    right: 12,
    bottom: 12,
    borderTopLeftRadius: 18,
    backgroundColor: '#ff4fb8',
  },
  popPhotoHalftone: {
    position: 'absolute',
    zIndex: 2,
    width: 54,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#231f20',
    backgroundColor: '#0080ff',
    opacity: 0.88,
  },
  popPhotoHalftoneTop: {
    top: 18,
    right: 22,
    transform: [{ rotate: '8deg' }],
  },
  popPhotoHalftoneBottom: {
    left: 22,
    bottom: 18,
    backgroundColor: '#ef2b3a',
    transform: [{ rotate: '-8deg' }],
  },
  scrapbookCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    opacity: 0.75,
    zIndex: 2,
  },
  scrapbookCornerTopLeft: {
    top: 14,
    left: 14,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  scrapbookCornerBottomRight: {
    right: 14,
    bottom: 14,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  galleryImg: {
    width: '100%',
    height: '100%',
  },
  scrapbookGalleryImg: {
    borderRadius: 14,
  },
  neonGalleryImg: {
    borderRadius: 20,
  },
  pastelGalleryImg: {
    borderRadius: 18,
  },
  popGalleryImg: {
    borderRadius: 14,
  },
  goldenGalleryImg: {
    borderRadius: 16,
  },
  vintageGalleryImg: {
    borderRadius: 10,
    opacity: 0.88,
  },
  roseGalleryImg: {
    borderRadius: 19,
    opacity: 0.94,
  },
  minimalGalleryImg: {
    borderRadius: 16,
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
  neonViewerActionCount: {
    color: '#66e8ff',
  },
  popViewerActionCount: {
    color: '#ffe84a',
    fontFamily: FunkyFonts.marker,
    fontSize: 14,
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

  etherealDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 24,
    alignSelf: 'center',
    width: '60%',
  },
  etherealDividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.25,
  },
  etherealDividerAsterisk: {
    fontSize: 14,
    opacity: 0.8,
  },

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

  // Premium Classic White Fine Art Styles
  classicDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 24,
    alignSelf: 'center',
    width: '60%',
  },
  classicDividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.2,
  },
  classicDividerDot: {
    fontSize: 8,
    opacity: 0.8,
  },
  classicHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 40,
  },
  classicFrame: {
    position: 'absolute',
    top: 60,
    bottom: 30,
    left: 20,
    right: 20,
    borderWidth: 1,
    borderRadius: 0, // Clean, zero-radius classic framing
    pointerEvents: 'none',
  },
  classicHeroImageContainer: {
    position: 'absolute',
    top: 80,
    left: 28,
    right: 28,
    height: SCREEN_WIDTH * 1.15, // Grand portrait exhibition height!
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1.5, // Thicker, luxurious outer frame
    borderColor: '#cca43b', // Elegantly gilded warm gold frame holding the white-matted photo!
    backgroundColor: '#ffffff', // Crisp white internal gallery matte frame
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    padding: 10, // Gives a beautiful physical matting effect around the photograph
  },
  classicHeroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  classicCenterContent: {
    position: 'absolute',
    top: 80 + SCREEN_WIDTH * 1.15 + 20, // Mathematically scales perfectly below the enlarged portrait mat card
    left: 30,
    right: 30,
    alignItems: 'center',
  },
  classicTitle: {
    fontSize: 32,
    fontFamily: Fonts.serif,
    textAlign: 'center',
    marginHorizontal: 36,
    lineHeight: 42,
    letterSpacing: 1.5,
    textTransform: 'capitalize',
  },
  classicDividerOrnament: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    width: 60,
  },
  classicDividerOrnamentLine: {
    flex: 1,
    height: 1,
    opacity: 0.4,
  },
  classicDividerOrnamentDot: {
    fontSize: 6,
    opacity: 0.7,
  },
  classicDateText: {
    fontSize: 12,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    marginTop: 10,
    letterSpacing: 2,
  },
  classicButton: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 0, // Perfectly square classic high-fashion button
    paddingHorizontal: 24,
    paddingVertical: 10,
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  classicButtonText: {
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 2,
  },
  classicBottomContent: {
    position: 'absolute',
    bottom: 25,
    left: 30,
    right: 30,
    alignItems: 'center',
    gap: 8,
  },
  classicBrandLogoScript: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 2,
  },
  classicBrandSubText: {
    fontSize: 8,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 2,
  },
  classicChevron: {
    opacity: 0.85,
    marginTop: 8,
  },
  classicActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  classicSideButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 0, // Clean, high-fashion square buttons
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  heroHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 40,
  },
  heroGlassCard: {
    position: 'absolute',
    bottom: 110,
    left: SCREEN_WIDTH * 0.08,
    right: SCREEN_WIDTH * 0.08,
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 2, // Ultra-modern sharp editorial edges
    backgroundColor: 'rgba(10, 10, 12, 0.7)', // Luminous dark obsidian glass
    borderWidth: 0.8, // Micro-thin gold border
    borderColor: 'rgba(204, 164, 59, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
  },
  heroBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 0.8,
    borderColor: 'rgba(204, 164, 59, 0.35)',
    borderRadius: 2,
    marginBottom: 16,
  },
  heroBadgeText: {
    fontFamily: Fonts.inter.bold,
    fontSize: 9,
    color: '#cca43b',
    letterSpacing: 3, // Premium wide letterspacing
  },
  heroTitleMain: {
    fontSize: 28,
    textAlign: 'center',
    color: '#ffffff',
    letterSpacing: 1.5,
    lineHeight: 38,
  },
  heroDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 14,
    width: 140,
  },
  heroDividerLine: {
    flex: 1,
    height: 0.8,
    backgroundColor: 'rgba(204, 164, 59, 0.25)',
  },
  heroDividerStar: {
    fontSize: 10,
    color: '#cca43b',
  },
  heroDateMain: {
    fontSize: 11,
    fontFamily: Fonts.inter.semiBold,
    color: '#94a3b8',
    letterSpacing: 3,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 26,
    width: '100%',
  },
  heroSideButton: {
    width: 44,
    height: 44,
    borderWidth: 0.8,
    borderColor: '#cca43b',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  heroEnterButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#cca43b',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#cca43b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  heroEnterButtonText: {
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 2,
    color: '#000000',
  },
  heroBottomContent: {
    position: 'absolute',
    bottom: 25,
    left: 30,
    right: 30,
    alignItems: 'center',
    gap: 6,
  },
  heroBrandText: {
    fontSize: 8,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 2,
    color: 'rgba(255, 255, 255, 0.35)',
  },
  heroChevron: {
    opacity: 0.85,
    marginTop: 4,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeCategoryOption: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontFamily: Fonts.inter.medium,
  },
  activeCategoryText: {
    color: MidnightColors.gold,
    fontFamily: Fonts.inter.bold,
  },
  categoryCheckBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: MidnightColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverControlRow: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 15,
  },
  coverControlSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  coverControlText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
  },
  repositionToolbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 30,
  },
  repositionInstruction: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.inter.medium,
  },
  repositionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repositionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  repositionCancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  repositionSaveBtn: {
    backgroundColor: MidnightColors.gold,
  },
  repositionBtnText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(9, 8, 24, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: Fonts.inter.bold,
  },
  zoomControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  zoomBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: Fonts.inter.bold,
    minWidth: 32,
    textAlign: 'center',
  },

  etherealHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  etherealOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  etherealBackBtnRound: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  etherealShareBtnRound: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  etherealDetailsCard: {
    position: 'absolute',
    bottom: 30,
    width: '90%',
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  etherealEnterBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  etherealEnterBtnText: {
    color: '#ffffff',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: 'bold',
    fontFamily: Fonts.inter.bold,
  },
  etherealBrandSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  etherealBrandScriptText: {
    fontSize: 18,
    fontStyle: 'italic',
    color: '#2d2a29',
    textAlign: 'center',
    marginBottom: 4,
  },
  etherealMonogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  etherealMonogramCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2d2a29',
    justifyContent: 'center',
    alignItems: 'center',
  },
  etherealMonogramLetter: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#2d2a29',
  },
  etherealSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  etherealSocialIconBtn: {
    padding: 4,
  },
  etherealCoupleNames: {
    fontSize: 22,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 14,
  },
  etherealCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  etherealCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  etherealCountText: {
    fontSize: 14,
    color: '#555555',
    fontWeight: '500',
  },
  // Garden Path Hero Overlay Styles
  gardenTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    width: '100%',
  },
  gardenHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2E6F40',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  gardenCenterContent: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    marginBottom: 16,
    marginHorizontal: 20,
    // Floating translucent invite card — set bg color dynamically in JSX
    borderRadius: 24,
    borderWidth: 1,
    // borderColor set dynamically in JSX
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  gardenLeafContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(240, 253, 244, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gardenTitle: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  gardenDate: {
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 6,
    fontWeight: '500',
  },
  // Garden Divider
  gardenDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  gardenDividerLine: {
    width: 48,
    height: 1,
    borderRadius: 999,
  },
  // Garden Picture Grid Card Tile & Labels
  gardenPhotoTile: {
    padding: 0,
    borderWidth: 0,
    borderRadius: 22,
    // overflow must be 'visible' (not 'hidden') so iOS renders the
    // drop shadow correctly without clipping it to the card bounds.
    overflow: 'visible',
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 4,
  },
  gardenGalleryImg: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  gardenPhotoLabelContainer: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 0.5,
  },
  gardenPhotoLabelText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  gardenPhotoRatioText: {
    fontSize: 7,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 1.5,
    textTransform: 'uppercase',
  },
  gardenPartnerCard: {
    borderWidth: 1,
    borderRadius: 22,
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gardenPartnerImage: {
    borderRadius: 32,
    borderWidth: 1.5,
  },
  // Garden Welcome Card styles
  gardenInfoBox: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
    shadowColor: '#14532d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginTop: 2,
    marginBottom: 20,
    marginHorizontal: 16,
  },
  gardenInfoInner: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gardenInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  gardenInfoKicker: {
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  gardenInfoLine: {
    width: 32,
    height: 1,
    marginLeft: 8,
  },
  gardenVisitorDescription: {
    fontSize: 15,
    lineHeight: 25,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  // Garden Gallery Header styles
  gardenGalleryHeader: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  gardenGalleryKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  gardenGalleryKickerText: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'lowercase',
  },
  gardenGalleryKickerLine: {
    width: 24,
    height: 1,
    borderRadius: 999,
    marginLeft: 6,
  },
  gardenGalleryTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
