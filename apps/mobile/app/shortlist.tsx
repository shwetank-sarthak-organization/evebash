import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getTopRatedBusinesses, toggleShortlistBusiness, Business } from '@/lib/firestore';
import { Image as ExpoImage } from 'expo-image';

const { width } = Dimensions.get('window');

export default function ShortlistScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShortlist();
  }, [user?.shortlisted]);

  const fetchShortlist = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const allBusinesses = await getTopRatedBusinesses(100);
      const shortlisted = allBusinesses.filter(b => user.shortlisted?.includes(b.id));
      setVendors(shortlisted);
    } catch (error) {
      console.error("Error fetching shortlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (vendorId: string) => {
    if (!user?.uid) return;
    try {
      await toggleShortlistBusiness(user.uid, vendorId);
    } catch (e) {
      console.error(e);
    }
  };

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

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Custom Header Section */}
        <View style={styles.customHeader}>
          <Text style={styles.headerTitle}>My Shortlist</Text>
          <Text style={styles.headerSubtitle}>
            {loading ? 'Updating list...' : `${vendors.length} Saved Vendors`}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#818cf8" />
          </View>
        ) : vendors.length === 0 ? (
          <ScrollView contentContainerStyle={styles.scrollContentEmpty}>
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <IconSymbol name="heart.fill" size={40} color="#818cf8" />
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
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContentList}>
            <View style={styles.gridContainer}>
              {vendors.map((vendor) => (
                <View key={vendor.id} style={styles.gridCard}>
                  {/* Floating Remove Button */}
                  <TouchableOpacity 
                    style={styles.removeBtnFloat} 
                    onPress={() => handleRemove(vendor.id)}
                  >
                    <IconSymbol name="heart.fill" size={16} color="#ef4444" />
                  </TouchableOpacity>

                  <ExpoImage source={{ uri: vendor.coverImage }} style={styles.gridImage} contentFit="cover" />
                  
                  <View style={styles.gridInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.gridName} numberOfLines={1}>{vendor.name}</Text>
                      {vendor.rating >= 4.0 && (
                        <View style={styles.verifiedIcon}>
                          <IconSymbol name="checkmark.seal.fill" size={10} color="#ffffff" />
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.gridMeta}>
                      <View style={[styles.badgeChip, styles.indigoBadgeChip]}>
                        <Text style={styles.badgeChipText}>{vendor.type}</Text>
                      </View>
                      <View style={styles.locationRow}>
                        <IconSymbol name="mappin.fill" size={10} color="#64748b" />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {vendor.location?.address || 'Mumbai'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.footerRow}>
                      <View style={styles.ratingContainer}>
                        <IconSymbol name="star.fill" size={10} color="#d4af37" />
                        <Text style={styles.ratingText}>{vendor.rating || '5.0'}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.viewPortfolioBtn}
                        onPress={() => router.push(`/business/${vendor.id}`)}
                      >
                        <Text style={styles.viewPortfolioText}>Portfolio</Text>
                        <IconSymbol name="chevron.right" size={10} color="#818cf8" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  safeArea: { flex: 1 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
    marginTop: 8,
  },
  customHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#818cf8',
    fontFamily: 'Outfit_700Bold',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrollContentList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
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
    backgroundColor: '#818cf8',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  exploreBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: (width - 44) / 2,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.15)',
    position: 'relative',
  },
  removeBtnFloat: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
  },
  gridImage: {
    width: '100%',
    height: 120,
  },
  gridInfo: {
    padding: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridName: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    flex: 1,
  },
  verifiedIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridMeta: {
    marginTop: 6,
    gap: 6,
  },
  badgeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  indigoBadgeChip: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  badgeChipText: {
    color: '#818cf8',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingTop: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
  viewPortfolioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewPortfolioText: {
    color: '#818cf8',
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
});
