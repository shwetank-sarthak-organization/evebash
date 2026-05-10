import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

const albums = [
  {
    name: "Samarth & Jyoti Wedding",
    slug: "samarth-jyoti-wedding",
    category: "Wedding",
    year: "2024",
    coverImg: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767722218/0D2A5838_2_cgepes.jpg"
  },
];

export default function SampleGalleriesScreen() {
  const router = useRouter();

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{ 
        headerShown: true, 
        title: 'Sample Galleries',
        headerTitleStyle: { 
          fontWeight: 'bold',
          fontSize: 18,
          color: '#0f172a',
        },
        headerStyle: { backgroundColor: '#f8fafc' },
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.nativeBackButton}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <IconSymbol name="chevron.left" size={28} color="#0f172a" />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Sample Galleries</Text>
          <Text style={styles.subtitle}>
            Browse through our portfolio of beautiful stories.
          </Text>
        </View>

        <View style={styles.gridContainer}>
          {albums.map((album) => (
            <TouchableOpacity 
              key={album.slug} 
              style={styles.albumCard}
              activeOpacity={0.8}
            >
              <View style={styles.imageContainer}>
                <Image 
                  source={{ uri: album.coverImg }} 
                  style={styles.coverImage} 
                />
                <View style={styles.overlay} />
              </View>
              
              <View style={styles.infoContainer}>
                <View style={styles.metaRow}>
                  <Text style={styles.category}>{album.category}</Text>
                  <Text style={styles.year}>{album.year}</Text>
                </View>
                <Text style={styles.albumName}>{album.name}</Text>
                
                <View style={styles.viewRow}>
                  <Text style={styles.viewText}>View Album</Text>
                  <IconSymbol name="chevron.right" size={16} color="#0284c7" />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 40,
  },
  nativeBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: 0,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
  gridContainer: {
    paddingHorizontal: 16,
    gap: 20,
  },
  albumCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  infoContainer: {
    padding: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  category: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  year: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
  },
  albumName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
});
