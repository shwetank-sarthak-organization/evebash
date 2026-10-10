import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard, Alert, useWindowDimensions, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getEventById, getEventPhotos, toggleLike, addComment, onPhotoInteractions, deletePhotoComment, openGallery, getPublicGalleryMedia, requestGalleryAccess, GalleryAccess, OpenedGallery, Event as DatabaseEvent, Photo } from '@/lib/database';
import { GalleryAccessGate, GalleryGateState } from '@/components/event/GalleryAccessGate';
import { appAlert } from '@/lib/feedback';
import { useAuth } from '@/context/AuthContext';
import { getGridThumbnail, getImageUrl } from '@/lib/imageUrl';
import { subscribeToUploadQueue, clearFinishedUploads } from '@/lib/uploadQueue';




const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = (SCREEN_WIDTH - 24) / COLUMN_COUNT;
// Logged-out public view pages through previews (get_public_gallery_media)
const PUBLIC_PAGE_SIZE = 60;

export default function SubEventPhotosScreen() {
  const { width } = useWindowDimensions();
  const { id, shared } = useLocalSearchParams<{ id: string; shared?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isShared = shared === 'true';
  
  const [subEvent, setSubEvent] = useState<DatabaseEvent | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  // What this viewer may do with the link (open_gallery)
  const [galleryAccess, setGalleryAccess] = useState<GalleryAccess | null>(null);
  const [galleryOpenFailed, setGalleryOpenFailed] = useState(false);
  const [gateTitle, setGateTitle] = useState('');
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [publicPage, setPublicPage] = useState(0);
  const [hasMorePublic, setHasMorePublic] = useState(false);
  const loadingMorePublicRef = useRef(false);
  const isPublicView = galleryAccess === 'public_view';
  const completedIdsRef = useRef<string[]>([]);
  const isPrivilegedViewer = !!user && !!subEvent && (
    user.role === 'admin' ||
    user.uid === subEvent.createdBy ||
    (user.roleType === 'primary' && user.delegatedBy === subEvent.createdBy) ||
    !!user.assignedEvents?.some((eventId) =>
      eventId === subEvent.id ||
      eventId === subEvent.legacyId ||
      eventId === subEvent.parentId
    )
  );
  


  // Viewer State
  const [viewerVisible, setViewerVisible] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);

  const openViewer = (index: number) => {
    setInitialIndex(index);
    setViewerVisible(true);
  };

  const navigateViewer = (dir: 'prev' | 'next') => {
    if (dir === 'prev') {
      setInitialIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
    } else {
      setInitialIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
    }
  };

  const loadGallery = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setGalleryOpenFailed(false);
    let redirecting = false;
    try {
      // What this viewer may do with the link. Logged-in viewers of a public gallery join it here.
      let opened: OpenedGallery;
      try {
        opened = await openGallery(id);
      } catch (err) {
        console.error('[SubEventPhotosScreen] Could not open gallery link:', err);
        setGalleryAccess(null);
        setSubEvent(null);
        setGalleryOpenFailed(true);
        return;
      }

      // Join codes and legacy ids continue on the gallery's own route
      if (opened.eventId && opened.eventId !== decodeURIComponent(id)) {
        redirecting = true;
        router.replace({ pathname: '/events/sub/[id]', params: { id: opened.eventId, ...(shared ? { shared } : {}) } } as any);
        return;
      }

      setGalleryAccess(opened.access);
      setGateTitle(opened.title || '');

      if (opened.access === 'public_view' && opened.event) {
        // Logged out, public gallery: previews and video streams only (never originals)
        const media = await getPublicGalleryMedia(opened.event.id, PUBLIC_PAGE_SIZE, 0);
        setSubEvent(opened.event);
        setPhotos(media);
        setPublicPage(0);
        setHasMorePublic(media.length === PUBLIC_PAGE_SIZE);
        return;
      }
      // Not found, or a private gallery the viewer can't see yet: nothing of it is loaded
      if (opened.access !== 'manage' && opened.access !== 'member') {
        setSubEvent(null);
        setPhotos([]);
        return;
      }

      const eventData = await getEventById(id);
      const photosData = eventData ? await getEventPhotos(id, eventData.legacyId) : [];
      setSubEvent(eventData);
      setPhotos(photosData);
    } catch (err) {
      console.error("Error fetching photos:", err);
    } finally {
      if (!redirecting) setLoading(false);
    }
  }, [id, router, shared]);

  // The link check depends on who is logged in, so it runs again after login or logout
  useEffect(() => {
    void loadGallery();
  }, [loadGallery, user?.uid]);

  const loadMorePublicPhotos = async () => {
    if (!isPublicView || !hasMorePublic || !subEvent || loadingMorePublicRef.current) return;
    loadingMorePublicRef.current = true;
    try {
      const nextPage = publicPage + 1;
      const media = await getPublicGalleryMedia(subEvent.id, PUBLIC_PAGE_SIZE, nextPage * PUBLIC_PAGE_SIZE);
      setPhotos(prev => [...prev, ...media]);
      setPublicPage(nextPage);
      setHasMorePublic(media.length === PUBLIC_PAGE_SIZE);
    } catch (err) {
      console.error('[SubEventPhotosScreen] Load more failed:', err);
    } finally {
      loadingMorePublicRef.current = false;
    }
  };

  const handleRequestAccess = async () => {
    if (requestingAccess || !id) return;
    setRequestingAccess(true);
    try {
      const status = await requestGalleryAccess(id);
      if (status === 'pending') {
        setGalleryAccess('pending');
      } else {
        await loadGallery();
      }
    } catch (err) {
      console.error('[GalleryAccess] Request failed:', err);
      appAlert('Request failed', "We couldn't send your request. Please try again.");
    } finally {
      setRequestingAccess(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToUploadQueue((items) => {
      const legacyId = subEvent?.legacyId;
      const filtered = items.filter(item => item.eventId === id || (legacyId && item.eventId === legacyId));
      const activeItems = filtered.filter(
        item => item.status === 'uploading' || item.status === 'pending' || item.status === 'uploaded_pending_metadata' || item.status === 'processing'
      );
      const completedItems = filtered.filter(item => item.status === 'completed');

      // Option B: Reload progressively as each item becomes visible: photos once saved to DB ('processing'),
      // videos only once Modal has transcoded them ('completed') — the grid hides unprocessed videos.
      const readyItems = filtered.filter(item => item.mediaType === 'video'
        ? item.status === 'completed'
        : item.status === 'processing' || item.status === 'completed');
      const newlyReady = readyItems.filter(item => !completedIdsRef.current.includes(item.id));
      if (newlyReady.length > 0) {
        completedIdsRef.current = [...completedIdsRef.current, ...newlyReady.map(item => item.id)];
        const loadFresh = async () => {
          try {
            const eventData = await getEventById(id);
            const photosData = eventData ? await getEventPhotos(id, eventData.legacyId) : [];
            setPhotos(photosData);
          } catch (e) {
            console.error("[SubEventPhotosScreen] Error refreshing photos:", e);
          }
        };
        loadFresh();
      }
    });

    return unsubscribe;
  }, [id, subEvent?.legacyId]);


  const goBackToParentEvent = useCallback(() => {
    const parentId = subEvent?.parentId;

    if (parentId) {
      const params: Record<string, string> = {};
      if (isPrivilegedViewer) params.mode = 'admin';
      if (isShared) params.shared = 'true';

      router.replace({
        pathname: `/events/${parentId}`,
        params,
      } as any);
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/dashboard');
    }
  }, [isPrivilegedViewer, isShared, router, subEvent?.parentId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!subEvent?.parentId) return false;
      goBackToParentEvent();
      return true;
    });

    return () => subscription.remove();
  }, [goBackToParentEvent, subEvent?.parentId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#906D4B" />
      </SafeAreaView>
    );
  }

  const galleryGate: GalleryGateState | null = galleryOpenFailed
    ? 'error'
    : galleryAccess === 'login_required' || galleryAccess === 'none' || galleryAccess === 'pending' || galleryAccess === 'rejected'
      ? galleryAccess
      : null;
  if (galleryGate) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <GalleryAccessGate
          state={galleryGate}
          title={gateTitle}
          requesting={requestingAccess}
          onLogin={() => router.push({ pathname: '/login', params: { returnTo: `/events/sub/${id}` } })}
          onRequestAccess={handleRequestAccess}
          onRetry={loadGallery}
          onBack={goBackToParentEvent}
        />
      </>
    );
  }

  if (!subEvent) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Gallery not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={goBackToParentEvent}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          headerTransparent: true,
          headerTitle: '',
          headerTintColor: '#ffffff',
          headerLeft: () => (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" 
              onPress={goBackToParentEvent}
              style={styles.nativeBackButton}
              hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
            >
              <IconSymbol name="chevron.left" size={28} color="#ffffff" />
            </TouchableOpacity>
          )
        }} 
      />
      <View style={styles.container}>

        {photos.length > 0 ? (
          <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            numColumns={COLUMN_COUNT}
            onEndReached={isPublicView ? loadMorePublicPhotos : undefined}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContainer}
            renderItem={({ item, index }) => (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open photo ${index + 1}`} activeOpacity={0.8} onPress={() => openViewer(index)}>
                <Image 
                  source={{ uri: getGridThumbnail(item.url, item.thumbnailUrl) }} 
                  style={styles.gridImage} 
                />
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <IconSymbol name="photo" size={64} color="#594C3D" />
            <Text style={styles.emptyText}>No photos uploaded yet.</Text>
            <Text style={styles.emptySubText}>Use the web dashboard to upload photos to this gallery.</Text>
          </View>
        )}
      </View>

      <Modal
        visible={viewerVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setViewerVisible(false)}
      >
        <PhotoViewer 
          photos={photos} 
          initialIndex={initialIndex} 
          onClose={() => setViewerVisible(false)} 
          user={user} 
        />
      </Modal>
    </>
  );
}

// --- PHOTO VIEWER COMPONENT ---
function PhotoViewer({ photos, initialIndex, onClose, user }: any) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const { width, height: screenHeight } = useWindowDimensions();

  const goToNext = () => {
    setCurrentIndex((prev: number) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const goToPrev = () => {
    setCurrentIndex((prev: number) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  return (
    <View style={styles.viewerContainer}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" style={styles.viewerClose} onPress={onClose}>
        <IconSymbol name="xmark" size={28} color="#fff" />
      </TouchableOpacity>
      
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous photo" style={styles.navBtnLeft} onPress={goToPrev}>
        <IconSymbol name="chevron.left" size={32} color="#fff" />
      </TouchableOpacity>
      
      {photos[currentIndex] && (
        <Image 
          source={{ uri: getImageUrl(photos[currentIndex].url, { width: 900 }, photos[currentIndex].thumbnailUrl) }} 
          style={styles.fullImage} 
          resizeMode="contain" 
        />
      )}
      
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next photo" style={styles.navBtnRight} onPress={goToNext}>
        <IconSymbol name="chevron.right" size={32} color="#fff" />
      </TouchableOpacity>
      
      <View style={styles.viewerFooter}>
        <Text style={styles.viewerText}>{currentIndex + 1} / {photos.length}</Text>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B211F',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1B211F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#cbd5e1',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#2B2F2E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2B2F2E',
  },
  nativeBackButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#CDB89E',
    marginTop: 2,
  },
  gridContainer: {
    paddingBottom: 40,
  },
  gridImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    margin: 4,
    backgroundColor: '#2B2F2E',
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#FFF7EB',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubText: {
    color: '#CDB89E',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -50,
    zIndex: 100,
  },
  navArrowLeft: {
    left: 0,
  },
  navArrowRight: {
    right: 0,
  },
  interactionsOverlay: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 80,
    paddingVertical: 20,
    backgroundColor: '#000000',
  },
  actionButton: {
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 6,
  },
  commentsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Dimensions.get('window').height * 0.5,
    backgroundColor: '#2B2F2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: -24,
    paddingTop: 32,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  commentsTitle: {
    color: '#1B211F',
    fontSize: 24,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  commentsSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  closeCommentsBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  commentsList: {
    flex: 1,
  },
  commentThread: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF7EB',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentAvatarText: {
    color: '#1B211F',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentContent: {
    flex: 1,
  },
  commentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentName: {
    color: '#1B211F',
    fontSize: 13,
    fontWeight: 'bold',
  },
  commentTime: {
    color: '#CDB89E',
    fontSize: 11,
  },
  commentBubble: {
    backgroundColor: '#f1f5f9',
    padding: 14,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  commentText: {
    color: '#594C3D',
    fontSize: 14,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  replyBtnText: {
    color: '#CA9C68',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  replyItem: {
    flexDirection: 'row',
    marginLeft: 48,
    marginTop: 8,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  replyAvatarText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  replyName: {
    color: '#475569',
    fontSize: 12,
    fontWeight: 'bold',
  },
  replyBubble: {
    backgroundColor: '#FFF7EB',
    padding: 10,
    borderRadius: 12,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  replyText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  emptyCommentsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: '#ffffff',
  },
  emptyComments: {
    color: '#1B211F',
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 16,
  },
  emptyCommentsSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  commentInputContainer: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  replyingToBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  replyingToText: {
    color: '#64748b',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#FFF7EB',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: '#1B211F',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commentSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1B211F',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: 'bold',
  },
});
