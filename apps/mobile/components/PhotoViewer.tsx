import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Share, TextInput, Keyboard, Modal } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { onPhotoInteractions, toggleLike, addComment, deletePhotoComment, Event as FirestoreEvent } from '@/lib/firestore';
import { MidnightColors, Fonts } from '../constants/theme';
import { styles } from './eventStyles';

interface PhotoViewerProps {
  visible: boolean;
  onClose: () => void;
  photos: any[];
  initialIndex: number;
  viewerIdentity: { id: string; name: string };
  event: FirestoreEvent | null;
  selectedTemplate: any;
}

export default function PhotoViewer({
  visible,
  onClose,
  photos,
  initialIndex,
  viewerIdentity,
  event,
  selectedTemplate,
}: PhotoViewerProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialIndex);
  const [likes, setLikes] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  // Sync index when initialIndex changes
  useEffect(() => {
    setCurrentPhotoIndex(initialIndex);
  }, [initialIndex]);

  const currentPhoto = photos[currentPhotoIndex];
  const isLiked = useMemo(() => likes.some((like) => like.userId === viewerIdentity.id), [likes, viewerIdentity.id]);

  const isScrapbookTemplate = event?.templateId === 'scrapbook';
  const isNeonTemplate = event?.templateId === 'neon';
  const isPopTemplate = event?.templateId === 'pop';

  const navigateViewer = (dir: 'prev' | 'next') => {
    if (photos.length === 0) return;
    if (dir === 'prev') {
      setCurrentPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    } else {
      setCurrentPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    }
    // Reset commenting context on navigation
    setShowComments(false);
    setReplyingTo(null);
    setNewComment('');
  };

  useEffect(() => {
    if (!visible || !currentPhoto?.id) return;

    const unsubscribe = onPhotoInteractions(currentPhoto.id, (data) => {
      setLikes(data.likes || []);
      setComments(data.comments || []);
    });

    return () => unsubscribe();
  }, [visible, currentPhoto?.id]);

  const handleToggleLike = async () => {
    if (!currentPhoto?.id || isLiking) return;
    setIsLiking(true);
    try {
      await toggleLike(currentPhoto.id, viewerIdentity.id, viewerIdentity.name);
    } catch (err) {
      console.error('[PhotoViewer] Like failed:', err);
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
      console.error('[PhotoViewer] Comment failed:', err);
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
            console.error('[PhotoViewer] Delete comment failed:', err);
          }
        },
      },
    ]);
  };

  const handleSharePhoto = async () => {
    if (!currentPhoto?.url) return;
    try {
      await Share.share({
        message: `A memory from "${event?.title || 'our event'}"\n${currentPhoto.url}`,
        url: currentPhoto.url,
      });
    } catch (error) {
      console.error('[PhotoViewer] Photo sharing failed', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.viewerContainer}>
        <TouchableOpacity style={styles.viewerClose} onPress={onClose}>
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
  );
}
