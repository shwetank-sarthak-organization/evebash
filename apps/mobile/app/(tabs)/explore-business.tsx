import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ImageBackground,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

const FEATURED_VENDORS = [
  {
    id: 'v1',
    name: 'Eternal Frames',
    category: 'Photography',
    eventTypes: ['Weddings', 'Cultural', 'Birthdays'],
    rating: 4.9,
    location: 'Dehradun',
    lat: 30.3165, lng: 78.0322,
    image: 'file:///Users/sarthak/.gemini/antigravity/brain/8108cfea-61b2-481c-b392-200c0212a690/wedding_photography_hero_1778430432364.png',
    verified: true,
  },
  {
    id: 'v2',
    name: 'Grand Royal Plaza',
    category: 'Venues',
    eventTypes: ['Corporate', 'Weddings', 'Cultural'],
    rating: 4.8,
    location: 'Dehradun',
    lat: 30.3160, lng: 78.0300,
    image: 'file:///Users/sarthak/.gemini/antigravity/brain/8108cfea-61b2-481c-b392-200c0212a690/luxury_wedding_venue_1778430453775.png',
    verified: true,
  },
];

const CATEGORIES = [
  { id: '1', name: 'All', icon: 'square.grid.2x2.fill' },
  { id: '2', name: 'Weddings', icon: 'heart.fill' },
  { id: '3', name: 'Sports', icon: 'trophy.fill' },
  { id: '4', name: 'Birthdays', icon: 'gift.fill' },
  { id: '5', name: 'Cultural', icon: 'sparkles' },
  { id: '6', name: 'Corporate', icon: 'briefcase.fill' },
  { id: '7', name: 'Private', icon: 'lock.fill' },
];

const ALL_VENDORS = [
  {
    id: 'v3',
    name: 'Glow by Maria',
    category: 'Makeup',
    eventTypes: ['Weddings', 'Cultural'],
    rating: 4.7,
    location: 'Chennai',
    lat: 13.0827, lng: 80.2707,
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: 'v4',
    name: 'Taste of Elegance',
    category: 'Catering',
    eventTypes: ['Corporate', 'Sports', 'Birthdays'],
    rating: 4.6,
    location: 'Delhi',
    lat: 28.6139, lng: 77.2090,
    image: 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: 'v5',
    name: 'Bloom Decor',
    category: 'Decoration',
    eventTypes: ['Birthdays', 'Private', 'Weddings'],
    rating: 4.5,
    location: 'Dehradun',
    lat: 30.3180, lng: 78.0350,
    image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: 'v6',
    name: 'Harmony Beats',
    category: 'Music',
    eventTypes: ['Sports', 'Corporate', 'Cultural'],
    rating: 4.8,
    location: 'Chennai',
    lat: 13.0850, lng: 80.2750,
    image: 'https://images.unsplash.com/photo-1514525253361-bee8d48842a1?auto=format&fit=crop&q=80&w=800',
  },
];

// Helper to calculate distance in KM
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function ExploreBusinessScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [showListingForm, setShowListingForm] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortBy, setSortBy] = useState('Rating'); // Rating, Distance, Price
  const [selectedLocation, setSelectedLocation] = useState('All Cities');
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const [maxDistance, setMaxDistance] = useState(100); // in KM
  const [isDetecting, setIsDetecting] = useState(false);

  const detectLocation = async () => {
    setIsDetecting(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions to use this feature.');
        setIsDetecting(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserCoords({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      setSelectedLocation('Near Me');
    } catch (error) {
      Alert.alert('Error', 'Could not fetch location.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Filter vendors based on event type and search
  const filteredVendors = ALL_VENDORS.filter((v) => {
    const matchesCategory = selectedCategory === 'All' || v.eventTypes.includes(selectedCategory);
    const matchesLocation = selectedLocation === 'All Cities' || 
                           (selectedLocation === 'Near Me' && userCoords ? true : v.location === selectedLocation);
    
    // Distance filtering
    let isWithinDistance = true;
    if (selectedLocation === 'Near Me' && userCoords) {
      const dist = getDistance(userCoords.lat, userCoords.lng, v.lat, v.lng);
      isWithinDistance = dist <= maxDistance;
    }

    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) || 
                         v.category.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesLocation && matchesSearch && isWithinDistance;
  });

  const featuredFiltered = FEATURED_VENDORS.filter((v) => {
    const matchesCategory = selectedCategory === 'All' || v.eventTypes.includes(selectedCategory);
    const matchesLocation = selectedLocation === 'All Cities' || 
                           (selectedLocation === 'Near Me' && userCoords ? true : v.location === selectedLocation);
    
    let isWithinDistance = true;
    if (selectedLocation === 'Near Me' && userCoords) {
      const dist = getDistance(userCoords.lat, userCoords.lng, v.lat, v.lng);
      isWithinDistance = dist <= maxDistance;
    }

    return matchesCategory && matchesLocation && isWithinDistance;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Marketplace</Text>
            <Text style={styles.headerSubtitle}>Elite Deals. Every Event.</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <IconSymbol name="bell.fill" size={20} color="#d4af37" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── SEARCH BAR ── */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <IconSymbol name="magnifyingglass" size={18} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search photographers, venues..."
              placeholderTextColor="#64748b"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity 
            style={styles.filterBtn}
            onPress={() => setShowFilterModal(true)}
          >
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M10 5H3"/><Path d="M12 19H3"/><Path d="M14 3v4"/><Path d="M16 17v4"/><Path d="M21 12h-9"/><Path d="M21 19h-5"/><Path d="M21 5h-7"/><Path d="M8 10v4"/><Path d="M8 12H3"/>
            </Svg>
          </TouchableOpacity>
        </View>

        {/* ── CATEGORIES ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContainer}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, selectedCategory === cat.name && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.name)}
            >
              <IconSymbol
                name={cat.icon as any}
                size={16}
                color={selectedCategory === cat.name ? '#0f172a' : '#94a3b8'}
              />
              <Text style={[styles.categoryText, selectedCategory === cat.name && styles.categoryTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── PROMOTE BUSINESS HERO ── */}
        <TouchableOpacity 
          activeOpacity={0.9} 
          style={styles.heroCard}
          onPress={() => router.push('/(tabs)/businesses')}
        >
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.95)', 'rgba(184, 134, 11, 1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>FOR OWNERS</Text>
              </View>
              <Text style={styles.heroTitle}>Promote Your Business</Text>
              <Text style={styles.heroSubtitle}>
                Reach thousands of event organizers and grow your brand today.
              </Text>
              <View style={styles.heroBtn}>
                <Text style={styles.heroBtnText}>Get Started</Text>
                <IconSymbol name="chevron.right" size={12} color="#ffffff" />
              </View>
            </View>
            <View style={styles.heroIconContainer}>
              <IconSymbol name="briefcase.fill" size={80} color="rgba(255,255,255,0.2)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── FEATURED VENDORS ── */}
        {featuredFiltered.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Vendors</Text>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredContainer}
            >
              {featuredFiltered.map((vendor) => (
                <TouchableOpacity 
                  key={vendor.id} 
                  style={styles.featuredCard} 
                  activeOpacity={0.9}
                  onPress={() => setSelectedVendor(vendor)}
                >
                  <ExpoImage source={{ uri: vendor.image }} style={styles.featuredImage} contentFit="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(2, 6, 23, 0.9)']}
                    style={styles.cardGradient}
                  />
                  <View style={styles.featuredBadge}>
                    <IconSymbol name="star.fill" size={10} color="#d4af37" />
                    <Text style={styles.featuredBadgeText}>{vendor.rating}</Text>
                  </View>
                  <View style={styles.featuredInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.featuredName}>{vendor.name}</Text>
                      {vendor.verified && (
                        <IconSymbol name="checkmark.seal.fill" size={14} color="#3b82f6" />
                      )}
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.featuredCategory}>{vendor.category}</Text>
                      <View style={styles.locationRow}>
                        <IconSymbol name="mappin.circle.fill" size={10} color="#94a3b8" />
                        <Text style={styles.locationText}>{vendor.location}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── EXPLORE ALL ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'All' ? 'Explore All' : `Best ${selectedCategory}`}
          </Text>
          {filteredVendors.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="magnifyingglass" size={40} color="#334155" />
              <Text style={styles.emptyText}>No vendors found in this category</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {filteredVendors.map((vendor) => (
                <TouchableOpacity 
                  key={vendor.id} 
                  style={styles.gridCard} 
                  activeOpacity={0.9}
                  onPress={() => setSelectedVendor(vendor)}
                >
                  <ExpoImage source={{ uri: vendor.image }} style={styles.gridImage} contentFit="cover" />
                  <View style={styles.gridInfo}>
                    <Text style={styles.gridName} numberOfLines={1}>
                      {vendor.name}
                    </Text>
                    <View style={styles.gridMeta}>
                      <Text style={styles.gridCategory}>{vendor.category}</Text>
                      <View style={styles.locationRow}>
                        <IconSymbol name="mappin.fill" size={10} color="#64748b" />
                        <Text style={styles.locationText}>{vendor.location}</Text>
                      </View>
                    </View>
                    <View style={styles.gridRatingRow}>
                      <IconSymbol name="star.fill" size={10} color="#d4af37" />
                      <Text style={styles.gridRating}>{vendor.rating}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── VENDOR DETAIL MODAL ── */}
      {selectedVendor && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={!!selectedVendor}
          onRequestClose={() => setSelectedVendor(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeBtn} 
                onPress={() => setSelectedVendor(null)}
              >
                <IconSymbol name="xmark.circle.fill" size={32} color="#ffffff" />
              </TouchableOpacity>
              
              <ExpoImage 
                source={{ uri: selectedVendor.image }} 
                style={styles.modalHeroImage} 
                contentFit="cover" 
              />
              
              <View style={styles.modalBody}>
                <View style={styles.modalHeaderRow}>
                  <View>
                    <Text style={styles.modalVendorName}>{selectedVendor.name}</Text>
                    <Text style={styles.modalVendorCat}>{selectedVendor.category}</Text>
                  </View>
                  <View style={styles.modalRating}>
                    <IconSymbol name="star.fill" size={16} color="#d4af37" />
                    <Text style={styles.modalRatingText}>{selectedVendor.rating}</Text>
                  </View>
                </View>

                <Text style={styles.modalDesc}>
                  Experience the magic of {selectedVendor.name}. We specialize in providing top-notch {selectedVendor.category.toLowerCase()} services tailored to make your event unforgettable.
                </Text>

                <View style={styles.featureGrid}>
                  <View style={styles.featureItem}>
                    <IconSymbol name="clock.fill" size={14} color="#d4af37" />
                    <Text style={styles.featureText}>Available 24/7</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <IconSymbol name="mappin.circle.fill" size={14} color="#d4af37" />
                    <Text style={styles.featureText}>Premium Locations</Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.primaryAction}>
                    <IconSymbol name="phone.fill" size={18} color="#0f172a" />
                    <Text style={styles.primaryActionText}>Call Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryAction}>
                    <IconSymbol name="bubble.left.and.bubble.right.fill" size={18} color="#d4af37" />
                    <Text style={styles.secondaryActionText}>Inquiry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── LIST YOUR BUSINESS MODAL ── */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showListingForm}
        onRequestClose={() => setShowListingForm(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.formContainer}
          >
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>List Your Business</Text>
              <TouchableOpacity onPress={() => setShowListingForm(false)}>
                <IconSymbol name="xmark" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formBody}>
              <Text style={styles.inputLabel}>Business Name</Text>
              <TextInput style={styles.formInput} placeholder="e.g. Royal Photography" placeholderTextColor="#475569" />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.categoryPicker}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat.id} style={styles.pickerChip}>
                    <Text style={styles.pickerChipText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.formInput} placeholder="+91 98765 43210" placeholderTextColor="#475569" keyboardType="phone-pad" />

              <Text style={styles.inputLabel}>About Your Business</Text>
              <TextInput 
                style={[styles.formInput, { height: 100, textAlignVertical: 'top' }]} 
                placeholder="Tell us about your services..." 
                placeholderTextColor="#475569"
                multiline
              />

              <TouchableOpacity style={styles.submitFormBtn} onPress={() => {
                setShowListingForm(false);
                Alert.alert("Success", "Your business listing has been submitted for review!");
              }}>
                <Text style={styles.submitFormText}>Submit Listing</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* ── FILTER MODAL ── */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showFilterModal}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowFilterModal(false)}
        >
          <View style={[styles.formContainer, { height: '85%' }]}>
            <View style={styles.grabHandle} />
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Sort & Filter</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <IconSymbol name="xmark" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.formBody}
            >
              <View style={styles.locationHeaderRow}>
                <Text style={styles.inputLabel}>Select City</Text>
                <TouchableOpacity 
                  style={styles.detectBtn} 
                  onPress={detectLocation}
                  disabled={isDetecting}
                >
                  <IconSymbol name="location.fill" size={12} color="#d4af37" />
                  <Text style={styles.detectBtnText}>{isDetecting ? 'Detecting...' : 'Near Me'}</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.categoryPicker}>
                {['All Cities', 'Near Me', 'Dehradun', 'Delhi', 'Chennai'].map((city) => (
                  <TouchableOpacity 
                    key={city} 
                    style={[styles.pickerChip, selectedLocation === city && styles.categoryChipActive]}
                    onPress={() => setSelectedLocation(city)}
                  >
                    <Text style={[styles.pickerChipText, selectedLocation === city && styles.categoryTextActive]}>
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedLocation === 'Near Me' && (
                <>
                  <Text style={styles.inputLabel}>Distance Radius (km)</Text>
                  <View style={styles.categoryPicker}>
                    {[5, 10, 20, 50, 100].map((radius) => (
                      <TouchableOpacity 
                        key={radius} 
                        style={[styles.pickerChip, maxDistance === radius && styles.categoryChipActive]}
                        onPress={() => setMaxDistance(radius)}
                      >
                        <Text style={[styles.pickerChipText, maxDistance === radius && styles.categoryTextActive]}>
                          {radius}km
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.inputLabel}>Sort By</Text>
              <View style={styles.categoryPicker}>
                {['Rating', 'Price: Low to High', 'Price: High to Low', 'Distance'].map((option) => (
                  <TouchableOpacity 
                    key={option} 
                    style={[styles.pickerChip, sortBy === option && styles.categoryChipActive]}
                    onPress={() => setSortBy(option)}
                  >
                    <Text style={[styles.pickerChipText, sortBy === option && styles.categoryTextActive]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.submitFormBtn} 
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.submitFormText}>Apply Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
  },
  headerTitle: {
    fontSize: 28,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    marginTop: -2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#d4af37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 8,
  },
  categoryChipActive: {
    backgroundColor: '#d4af37',
    borderColor: '#d4af37',
  },
  categoryText: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  categoryTextActive: {
    color: '#0f172a',
  },
  heroCard: {
    marginHorizontal: 24,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 32,
    elevation: 8,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  heroGradient: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroContent: {
    flex: 1,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  heroBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    lineHeight: 20,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  heroBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  heroIconContainer: {
    marginLeft: 12,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    paddingHorizontal: 24,
  },
  viewAllText: {
    color: '#d4af37',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  featuredContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  featuredCard: {
    width: width * 0.7,
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  featuredBadgeText: {
    color: '#d4af37',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  featuredInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featuredName: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  featuredCategory: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  gridCard: {
    width: (width - 48) / 2,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    marginHorizontal: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  gridImage: {
    width: '100%',
    height: 120,
  },
  gridInfo: {
    padding: 12,
  },
  gridName: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  gridMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  gridRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  gridCategory: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gridRating: {
    color: '#d4af37',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '90%',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  modalHeroImage: {
    width: '100%',
    height: 300,
  },
  modalBody: {
    padding: 24,
    flex: 1,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalVendorName: {
    fontSize: 28,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  modalVendorCat: {
    fontSize: 16,
    color: '#d4af37',
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 4,
  },
  modalRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  modalRatingText: {
    color: '#d4af37',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  modalDesc: {
    fontSize: 15,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    marginBottom: 24,
  },
  featureGrid: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    color: '#f8fafc',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4af37',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  primaryActionText: {
    color: '#0f172a',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    gap: 10,
  },
  secondaryActionText: {
    color: '#d4af37',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  // ── Form Styles ──
  formContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
  },
  grabHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  formBody: {
    paddingTop: 10,
    gap: 20,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    gap: 6,
  },
  detectBtnText: {
    color: '#d4af37',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  inputLabel: {
    fontSize: 14,
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  pickerChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  pickerChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  submitFormBtn: {
    backgroundColor: '#d4af37',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitFormText: {
    color: '#0f172a',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    gap: 16,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
