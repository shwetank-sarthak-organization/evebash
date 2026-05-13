import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';

export default function ShortlistScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        headerShown: true, 
        headerTransparent: true,
        headerTitle: '',
        headerTintColor: '#ffffff',
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/dashboard');
              }
            }}
            style={styles.backBtn}
            hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
          >
            <IconSymbol name="chevron.left" size={28} color="#ffffff" />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <IconSymbol name="heart.fill" size={40} color="#d4af37" />
          </View>
          <Text style={styles.emptyTitle}>Your shortlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Save your favorite photographers, venues, and vendors to view them here later.
          </Text>
          <TouchableOpacity 
            style={styles.exploreBtn}
            onPress={() => router.push('/(tabs)/explore-business')}
          >
            <Text style={styles.exploreBtnText}>Explore Marketplace</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.1)',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  exploreBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  exploreBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
});
