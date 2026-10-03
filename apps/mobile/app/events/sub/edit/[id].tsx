import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Modal
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getEventById, getEventPhotos, deletePhoto, addPhoto, Event as DatabaseEvent, Photo } from '@/lib/database';
import { useAuth } from '@/context/AuthContext';
import { uploadEventImage } from '@/lib/storage';
import { useAppTheme } from '@/context/ThemeContext';
import { getGridThumbnail } from '@/lib/imageUrl';
import { subscribeToUploadQueue, clearFinishedUploads } from '@/lib/uploadQueue';


const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_MARGIN = 2;
const IMAGE_SIZE = (width - (COLUMN_COUNT + 1) * IMAGE_MARGIN) / COLUMN_COUNT;

export default function EditPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();

  const [subEvent, setSubEvent] = useState<DatabaseEvent | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadCompleteModal, setShowUploadCompleteModal] = useState(false);
  const [showUploadFailedModal, setShowUploadFailedModal] = useState(false);
  const completedIdsRef = React.useRef<string[]>([]);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToUploadQueue((items) => {
      const legacyId = subEvent?.legacyId;
      const filtered = items.filter(item => item.eventId === id || (legacyId && item.eventId === legacyId));
      const activeItems = filtered.filter(
        item => item.status === 'uploading' || item.status === 'pending' || item.status === 'uploaded_pending_metadata' || item.status === 'processing'
      );
      const completedItems = filtered.filter(item => item.status === 'completed');

      // Option B: Reload photos progressively as each photo is saved to DB (status: 'processing' or 'completed')
      const readyItems = filtered.filter(item => item.status === 'processing' || item.status === 'completed');
      const newlyReady = readyItems.filter(item => !completedIdsRef.current.includes(item.id));
      if (newlyReady.length > 0) {
        completedIdsRef.current = [...completedIdsRef.current, ...newlyReady.map(item => item.id)];
        fetchData();
      }
    });

    return unsubscribe;
  }, [id, subEvent?.legacyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventData, photosData] = await Promise.all([
        getEventById(id!),
        getEventPhotos(id!, subEvent?.legacyId)
      ]);
      setSubEvent(eventData);
      setPhotos(photosData.filter(photo => photo.mediaType !== 'video' && photo.resourceType !== 'video'));
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'We need access to your photos to upload them.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      handleUploadImages(result.assets);
    }
  };

  const handleUploadImages = async (assets: any[]) => {
    setUploading(true);
    let successCount = 0;

    for (const asset of assets) {
      try {
        const fileName = asset.fileName || asset.uri?.split('/').pop() || `photo-${Date.now()}.jpg`;
        const upload = await uploadEventImage({
          uri: asset.uri,
          name: fileName,
          type: asset.mimeType || 'image/jpeg',
        }, id!, user?.uid);

        if (upload.url) {
          await addPhoto({
            eventId: id!,
            url: upload.url,
            storageKey: upload.publicId,
            mediaType: 'photo',
            resourceType: 'image',
            uploadedAt: new Date(),
            userId: user?.uid || subEvent?.createdBy,
            width: upload.width || asset.width,
            height: upload.height || asset.height,
            size: upload.bytes || asset.fileSize,
            format: upload.format,
          });
          successCount++;
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    setUploading(false);
    if (successCount > 0) {
      setShowUploadCompleteModal(true);
      fetchData();
    } else {
      setShowUploadFailedModal(true);
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to delete this photo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const success = await deletePhoto(photoId);
            if (success) {
              setPhotos(prev => prev.filter(p => p.id !== photoId));
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0284c7" />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{
        title: 'Edit Photos',
        headerShown: true,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
            style={styles.nativeBackButton}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <IconSymbol name="chevron.left" size={28} color="#1B211F" />
          </TouchableOpacity>
        ),
        headerRight: () => (
          uploading ? (
            <ActivityIndicator size="small" color="#0284c7" style={{ marginRight: 16 }} />
          ) : (
            <TouchableOpacity onPress={handlePickImage} style={{ marginRight: 16 }}>
              <IconSymbol name="plus" size={24} color="#0284c7" />
            </TouchableOpacity>
          )
        )
      }} />

      <View style={styles.header}>
        <Text style={styles.eventTitle}>{subEvent?.title}</Text>
        <Text style={styles.photoCount}>{photos.length} Photos in this gallery</Text>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: getGridThumbnail(item.url, item.thumbnailUrl) }} style={styles.image} />
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeletePhoto(item.id)}
              accessibilityRole="button"
              accessibilityLabel="Delete photo"
              hitSlop={10}
            >
              <IconSymbol name="xmark" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
        ListHeaderComponent={
          <TouchableOpacity style={styles.uploadCard} onPress={handlePickImage}>
            <IconSymbol name="plus" size={32} color="#CDB89E" />
            <Text style={styles.uploadText}>Add Photos</Text>
          </TouchableOpacity>
        }
      />

      {/* ── CUSTOM THEME-STYLED UPLOAD COMPLETE MODAL ── */}
      <Modal
        visible={showUploadCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadCompleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowUploadCompleteModal(false)} />
          <View style={[
            styles.modalContent,
            {
              padding: 24,
              borderRadius: 24,
              borderWidth: 1.5,
              backgroundColor: '#1B211F',
              borderColor: 'rgba(202, 156, 104, 0.3)',
              alignItems: 'center',
              alignSelf: 'center',
              width: width * 0.85,
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 10,
            }
          ]}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(34, 197, 94, 0.35)',
            }}>
              <IconSymbol name="checkmark.circle.fill" size={34} color="#22c55e" />
            </View>

            <Text style={{
              fontSize: 22,
              fontWeight: 'bold',
              color: colors.gold || '#CCA43B',
              marginBottom: 10,
              textAlign: 'center',
              letterSpacing: -0.3,
            }}>
              Upload Complete
            </Text>

            <Text style={{
              fontSize: 14,
              color: '#cbd5e1',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 20,
              paddingHorizontal: 8,
            }}>
              All your photos and videos have been uploaded.
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: colors.gold || '#CCA43B',
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 14,
                width: '100%',
                alignItems: 'center'
              }}
              onPress={() => setShowUploadCompleteModal(false)}
            >
              <Text style={{ color: '#13191F', fontWeight: 'bold', fontSize: 15 }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── CUSTOM THEME-STYLED UPLOAD FAILED MODAL ── */}
      <Modal
        visible={showUploadFailedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUploadFailedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowUploadFailedModal(false)} />
          <View style={[
            styles.modalContent,
            {
              padding: 24,
              borderRadius: 24,
              borderWidth: 1.5,
              backgroundColor: '#1B211F',
              borderColor: 'rgba(239, 68, 68, 0.35)',
              alignItems: 'center',
              alignSelf: 'center',
              width: width * 0.85,
              maxWidth: 400,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 10,
            }
          ]}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.35)',
            }}>
              <IconSymbol name="xmark.circle.fill" size={34} color="#ef4444" />
            </View>

            <Text style={{
              fontSize: 22,
              fontWeight: 'bold',
              color: '#ef4444',
              marginBottom: 10,
              textAlign: 'center',
              letterSpacing: -0.3,
            }}>
              Upload Failed
            </Text>

            <Text style={{
              fontSize: 14,
              color: '#cbd5e1',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 20,
              paddingHorizontal: 8,
            }}>
              Upload failed
            </Text>

            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 14,
                width: '100%',
                alignItems: 'center'
              }}
              onPress={() => setShowUploadFailedModal(false)}
            >
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 15 }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFF7EB',
  },
  nativeBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF7EB',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1B211F',
  },
  photoCount: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  grid: {
    padding: IMAGE_MARGIN,
  },
  imageWrapper: {
    position: 'relative',
    margin: IMAGE_MARGIN,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    backgroundColor: '#e2e8f0',
  },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadCard: {
    width: width - (IMAGE_MARGIN * 2),
    height: 120,
    backgroundColor: '#ffffff',
    margin: IMAGE_MARGIN,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f1f5f9',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadText: {
    color: '#CDB89E',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    justifyContent: 'center',
    alignItems: 'center',
  }
});
