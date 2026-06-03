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
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getEventById, getEventPhotos, deletePhoto, addPhoto, Event as FirestoreEvent, Photo } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';
import { uploadEventImage } from '@/lib/storage';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_MARGIN = 2;
const IMAGE_SIZE = (width - (COLUMN_COUNT + 1) * IMAGE_MARGIN) / COLUMN_COUNT;

export default function EditPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [subEvent, setSubEvent] = useState<FirestoreEvent | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventData, photosData] = await Promise.all([
        getEventById(id!),
        getEventPhotos(id!)
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
      Alert.alert('Success', `Successfully uploaded ${successCount} photo(s).`);
      fetchData();
    } else {
      Alert.alert('Upload Failed', 'There was an error uploading your photos.');
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
            <IconSymbol name="chevron.left" size={28} color="#0f172a" />
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
            <Image source={{ uri: item.url }} style={styles.image} />
            <TouchableOpacity 
              style={styles.deleteBtn} 
              onPress={() => handleDeletePhoto(item.id)}
            >
              <IconSymbol name="xmark" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
        ListHeaderComponent={
          <TouchableOpacity style={styles.uploadCard} onPress={handlePickImage}>
            <IconSymbol name="plus" size={32} color="#94a3b8" />
            <Text style={styles.uploadText}>Add Photos</Text>
          </TouchableOpacity>
        }
      />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
    color: '#0f172a',
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
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  }
});
