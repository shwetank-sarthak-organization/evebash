import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard, Alert, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getEventById, getEventPhotos, toggleLike, addComment, onPhotoInteractions, deletePhotoComment, logGuestLogin, onGuestStatusChange, Event as FirestoreEvent, Photo } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_MARGIN = 2;
const IMAGE_SIZE = (width - (COLUMN_COUNT + 1) * IMAGE_MARGIN) / COLUMN_COUNT;

export default function SubEventPhotosScreen() {
  const { id, shared } = useLocalSearchParams<{ id: string; shared?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isShared = shared === 'true';
  
  const [subEvent, setSubEvent] = useState<FirestoreEvent | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestStatus, setGuestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
  const [submittingGuest, setSubmittingGuest] = useState(false);
  const loggedInGuestIdentifier = user ? (user.email || user.phone || user.uid) : '';
  const parentEventId = subEvent?.parentId || subEvent?.id;
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

  useEffect(() => {
    if (!id) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const eventData = await getEventById(id);
        const photosData = eventData ? await getEventPhotos(id, eventData.legacyId) : [];
        setSubEvent(eventData);
        setPhotos(photosData);
      } catch (err) {
        console.error("Error fetching photos:", err);
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
    if (!isShared || !user || !subEvent || !id || isPrivilegedViewer || guestStatus !== 'idle' || !loggedInGuestIdentifier) return;

    let cancelled = false;
    const requestGuestAccess = async () => {
      setSubmittingGuest(true);
      const success = await logGuestLogin(
        user.name || 'Guest',
        loggedInGuestIdentifier,
        id,
        parentEventId,
        subEvent.title,
        subEvent.createdBy
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
  }, [guestStatus, id, isPrivilegedViewer, isShared, loggedInGuestIdentifier, parentEventId, subEvent, user]);

  const accessGranted = !isShared || isPrivilegedViewer || guestStatus === 'approved';

  const submitGuestRequest = async () => {
    if (!subEvent || !id || !guestName.trim() || !guestPhone.trim()) return;
    const normalizedPhone = guestPhone.replace(/\D/g, '');
    setSubmittingGuest(true);
    await logGuestLogin(
      guestName.trim(),
      normalizedPhone,
      id,
      subEvent.parentId || subEvent.id,
      subEvent.title,
      subEvent.createdBy
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

  if (!subEvent) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Gallery not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.nativeBackButton} 
            onPress={() => router.back()}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <IconSymbol name="chevron.left" size={28} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{subEvent.title}</Text>
            <Text style={styles.headerSubtitle}>{photos.length} Photos</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {!accessGranted ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="shield.fill" size={64} color="#334155" />
            <Text style={styles.emptyText}>Access approval required.</Text>
            <Text style={styles.emptySubText}>Send a request to unlock this shared gallery.</Text>
          </View>
        ) : photos.length > 0 ? (
          <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            numColumns={COLUMN_COUNT}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContainer}
            renderItem={({ item, index }) => (
              <TouchableOpacity activeOpacity={0.8} onPress={() => openViewer(index)}>
                <Image 
                  source={{ uri: item.url }} 
                  style={styles.gridImage} 
                />
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <IconSymbol name="photo" size={64} color="#334155" />
            <Text style={styles.emptyText}>No photos uploaded yet.</Text>
            <Text style={styles.emptySubText}>Use the web dashboard to upload photos to this gallery.</Text>
          </View>
        )}
      </SafeAreaView>

      <Modal visible={viewerVisible} transparent={true} animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <PhotoViewer 
          photos={photos} 
          initialIndex={initialIndex} 
          onClose={() => setViewerVisible(false)} 
          user={user} 
        />
      </Modal>
      <GuestAccessModal
        visible={!!subEvent && isShared && !accessGranted && (!user || guestStatus !== 'idle')}
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
              <Text style={styles.guestModalText}>Your request has been sent to the event admin. This gallery will unlock after approval.</Text>
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

// --- PHOTO VIEWER COMPONENT ---
function PhotoViewer({ photos, initialIndex, onClose, user }: any) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const [interactions, setInteractions] = useState<{ [key: string]: { likes: any[], comments: any[] } }>({});
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const { width, height: screenHeight } = useWindowDimensions();

  useEffect(() => {
    const photo = photos[currentIndex];
    if (!photo) return;
    
    // Subscribe to likes and comments
    const unsubscribe = onPhotoInteractions(photo.id, (data) => {
      setInteractions(prev => ({ ...prev, [photo.id]: data }));
    });
    
    return () => unsubscribe();
  }, [currentIndex, photos]);

  const currentPhoto = photos[currentIndex];
  const photoInteractions = interactions[currentPhoto?.id] || { likes: [], comments: [] };
  const hasLiked = photoInteractions.likes.some((l: any) => l.userId === user?.uid);

  const handleLike = async () => {
    if (!user) return;
    try {
      await toggleLike(currentPhoto.id, user.uid, user.name || 'User');
    } catch (e) {
      console.error(e);
    }
  };

  const handleComment = async () => {
    if (!user || !commentText.trim()) return;
    try {
      await addComment(currentPhoto.id, user.uid, user.name || 'User', commentText.trim(), replyingTo?.id);
      setCommentText('');
      setReplyingTo(null);
      Keyboard.dismiss();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert("Delete Comment", "Are you sure you want to delete this comment?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deletePhotoComment(commentId);
        } catch (e) {
          console.error(e);
        }
      }}
    ]);
  };

  const goToNext = () => {
    if (currentIndex < photos.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
    }
  };

  return (
    <SafeAreaView style={styles.viewerContainer} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.viewerHeaderNonAbsolute}>
        <TouchableOpacity 
          style={styles.viewerCloseBtn} 
          onPress={onClose}
          hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
        >
          <IconSymbol name="xmark" size={28} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.viewerCounter}>{currentIndex + 1} / {photos.length}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <FlatList
          data={photoInteractions.comments.filter(c => !c.parentId)}
          keyExtractor={c => c.id}
          style={styles.commentsList}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListHeaderComponent={
            <View>
              {/* Image Area */}
              <View style={{ height: screenHeight * 0.65 }}>
                <FlatList
                  ref={flatListRef}
                  data={photos}
                  horizontal
                  pagingEnabled={false}
                  snapToInterval={width}
                  snapToAlignment="center"
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  initialScrollIndex={initialIndex}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(index);
                  }}
                  getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <View style={{ width, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                      <Image source={{ uri: item.url }} style={styles.viewerImage} resizeMode="contain" />
                    </View>
                  )}
                />

                {currentIndex > 0 && (
                  <TouchableOpacity style={[styles.navArrow, styles.navArrowLeft]} onPress={goToPrev}>
                    <IconSymbol name="chevron.left" size={32} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                )}
                {currentIndex < photos.length - 1 && (
                  <TouchableOpacity style={[styles.navArrow, styles.navArrowRight]} onPress={goToNext}>
                    <IconSymbol name="chevron.right" size={32} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Interactions Bar */}
              <View style={styles.interactionsOverlay}>
                <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                  <IconSymbol name={hasLiked ? "heart.fill" : "heart"} size={28} color="#ef4444" />
                  <Text style={styles.actionText}>{photoInteractions.likes.length || ''}</Text>
                </TouchableOpacity>
                <View style={styles.actionButton}>
                  <IconSymbol name="bubble.right" size={28} color="#ef4444" />
                  <Text style={styles.actionText}>{photoInteractions.comments.length || ''}</Text>
                </View>
              </View>

              {/* Comments Header */}
              <View style={styles.commentsHeader}>
                <View>
                  <Text style={styles.commentsTitle}>Guestbook</Text>
                  <Text style={styles.commentsSubtitle}>{photoInteractions.comments.length} Shared Thoughts</Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => {
              const replies = photoInteractions.comments.filter(c => c.parentId === item.id);
              return (
                <View style={styles.commentThread}>
                  {/* Main Comment */}
                  <View style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarText}>{item.userName.charAt(0)}</Text>
                    </View>
                    <View style={styles.commentContent}>
                      <View style={styles.commentRow}>
                        <Text style={styles.commentName}>{item.userName}</Text>
                        <Text style={styles.commentTime}>
                          {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                        </Text>
                      </View>
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentText}>{item.text}</Text>
                        <View style={styles.commentActions}>
                          <TouchableOpacity onPress={() => setReplyingTo(item)}>
                            <Text style={styles.replyBtnText}>REPLY</Text>
                          </TouchableOpacity>
                          {item.userId === user?.uid && (
                            <TouchableOpacity onPress={() => handleDeleteComment(item.id)}>
                              <Text style={styles.deleteBtnText}>DELETE</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Replies */}
                  {replies.map(reply => (
                    <View key={reply.id} style={styles.replyItem}>
                      <View style={styles.replyAvatar}>
                        <Text style={styles.replyAvatarText}>{reply.userName.charAt(0)}</Text>
                      </View>
                      <View style={styles.commentContent}>
                        <View style={styles.commentRow}>
                          <Text style={styles.replyName}>{reply.userName}</Text>
                          <Text style={styles.commentTime}>
                            {reply.createdAt ? new Date(reply.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                          </Text>
                        </View>
                        <View style={styles.replyBubble}>
                          <Text style={styles.replyText}>{reply.text}</Text>
                          {reply.userId === user?.uid && (
                            <TouchableOpacity onPress={() => handleDeleteComment(reply.id)}>
                              <Text style={[styles.deleteBtnText, { marginTop: 4 }]}>DELETE</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyCommentsContainer}>
                <IconSymbol name="bubble.right" size={40} color="#334155" />
                <Text style={styles.emptyComments}>No whispers yet...</Text>
                <Text style={styles.emptyCommentsSub}>Write the first beautiful word.</Text>
              </View>
            }
          />
          
        <View style={styles.commentInputContainer}>
          {replyingTo && (
            <View style={styles.replyingToBanner}>
              <Text style={styles.replyingToText}>Replying to <Text style={{color: '#d4af37'}}>{replyingTo.userName}</Text></Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <IconSymbol name="xmark" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder={replyingTo ? "Write a reply..." : "Share a wish..."}
              placeholderTextColor="#64748b"
              value={commentText}
              onChangeText={setCommentText}
            />
            <TouchableOpacity style={styles.commentSendBtn} onPress={handleComment} disabled={!commentText.trim()}>
              <IconSymbol name="paperplane.fill" size={20} color={commentText.trim() ? "#0ea5e9" : "#334155"} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#cbd5e1',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#1e293b',
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
    borderBottomColor: '#1e293b',
  },
  nativeBackButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
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
    color: '#94a3b8',
    marginTop: 2,
  },
  gridContainer: {
    padding: IMAGE_MARGIN,
    paddingBottom: 40,
  },
  gridImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    margin: IMAGE_MARGIN,
    backgroundColor: '#1e293b',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewerHeaderNonAbsolute: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
    zIndex: 9999,
  },
  viewerCloseBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCounter: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
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
    backgroundColor: '#1e293b',
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
    color: '#0f172a',
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
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commentAvatarText: {
    color: '#0f172a',
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
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  commentTime: {
    color: '#94a3b8',
    fontSize: 11,
  },
  commentBubble: {
    backgroundColor: '#f1f5f9',
    padding: 14,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  commentText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  replyBtnText: {
    color: '#d4af37',
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
    backgroundColor: '#f8fafc',
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
    color: '#0f172a',
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
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: '#0f172a',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commentSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
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
