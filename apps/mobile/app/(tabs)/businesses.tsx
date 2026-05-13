import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '@/context/AuthContext';
import { createBusiness, getUserBusinesses, Business } from '@/lib/firestore';

const { width } = Dimensions.get('window');

const BUSINESS_TYPES = ['Photography', 'Catering', 'Venues', 'Decoration', 'Music', 'Makeup', 'Event Planning'];
const EVENT_TAGS = ['Wedding', 'Birthdays', 'Sports', 'Corporate', 'Cultural', 'Private'];

const BENEFITS = [
  { id: '1', title: 'Reach Event Organizers', desc: 'Connect with professionals planning sports tournaments, corporate meets, and celebrations.', icon: 'person.2.fill' },
  { id: '2', title: 'Smart Analytics', desc: 'Track your profile views, inquiries, and growth in real-time.', icon: 'chart.bar.fill' },
  { id: '3', title: 'Premium Portfolio', desc: 'Showcase your work to a diverse audience with high-resolution galleries.', icon: 'photo.on.rectangle.fill' },
];

export default function BusinessLandingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [showListingForm, setShowListingForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingBusinesses, setFetchingBusinesses] = useState(true);
  const [userBusinesses, setUserBusinesses] = useState<Business[]>([]);

  // Form State
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.displayName || '');
  const [ownerEmail, setOwnerEmail] = useState(user?.email || '');
  const [ownerPhone, setOwnerPhone] = useState(user?.phoneNumber || '');
  const [businessType, setBusinessType] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // New profile fields
  const [description, setDescription] = useState('');
  const [experience, setExperience] = useState('');
  const [eventsHosted, setEventsHosted] = useState('');

  useEffect(() => {
    fetchUserBusinesses();
  }, [user]);

  const fetchUserBusinesses = async () => {
    if (!user) return;
    setFetchingBusinesses(true);
    try {
      const biz = await getUserBusinesses(user.uid);
      setUserBusinesses(biz);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setFetchingBusinesses(false);
    }
  };

  const handleGetLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to pinpoint your business.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not fetch your location.');
    } finally {
      setIsLocating(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async () => {
    if (!name || !ownerName || !ownerEmail || !ownerPhone || !businessType || !location) {
      Alert.alert('Missing Info', 'Please fill in all basic fields and pinpoint your location.');
      return;
    }

    if (!user) {
      Alert.alert('Auth Required', 'Please login to create a business.');
      return;
    }

    setLoading(true);
    try {
      const businessData: Omit<Business, 'id' | 'createdAt'> = {
        name,
        ownerName,
        ownerEmail,
        ownerPhone,
        type: businessType,
        tags: selectedTags,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        description,
        experience: parseInt(experience) || 0,
        eventsHosted: parseInt(eventsHosted) || 0,
        rating: 0,
        coverImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800', // Default image
        createdBy: user.uid,
        status: 'created',
      };

      const result = await createBusiness(businessData);
      if (result) {
        Alert.alert('Success', 'Your business has been created! You can now manage it from the Partner Hub.');
        setShowListingForm(false);
        // Reset form
        setName('');
        setBusinessType('');
        setSelectedTags([]);
        setLocation(null);
        setDescription('');
        setExperience('');
        setEventsHosted('');
        // Refresh list
        fetchUserBusinesses();
      } else {
        Alert.alert('Error', 'Failed to create business. Please try again.');
      }
    } catch (error) {
      console.error('Error creating business:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* ── YOUR BUSINESSES SECTION ── */}
        {fetchingBusinesses ? (
          <View style={[styles.section, { alignItems: 'center' }]}>
            <ActivityIndicator color="#d4af37" />
          </View>
        ) : userBusinesses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Businesses</Text>
            {userBusinesses.map((biz) => (
              <TouchableOpacity 
                key={biz.id} 
                style={styles.bizManageCard}
                onPress={() => router.push({ pathname: '/manage-business', params: { id: biz.id } })}
              >
                <ExpoImage source={{ uri: biz.coverImage }} style={styles.bizManageImage} contentFit="cover" />
                <View style={styles.bizManageInfo}>
                  <Text style={styles.bizManageName}>{biz.name}</Text>
                  <Text style={styles.bizManageType}>{biz.type}</Text>
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: biz.status === 'published' ? '#22c55e' : '#f59e0b' }]} />
                    <Text style={styles.statusText}>{biz.status.toUpperCase()}</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={20} color="#475569" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── HERO SECTION ── */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#0f172a', '#020617']}
            style={styles.heroGradient}
          >
            <View style={styles.heroBadge}>
              <IconSymbol name="briefcase.fill" size={14} color="#d4af37" />
              <Text style={styles.heroBadgeText}>PARTNER HUB</Text>
            </View>
            <Text style={styles.heroTitle}>Grow Your Business</Text>
            <Text style={styles.heroSubtitle}>
              Connect with event organizers, showcase your premium portfolio, and track your growth with elite analytics.
            </Text>
            
            <View style={styles.heroActions}>
              <TouchableOpacity 
                style={styles.primaryBtn} 
                onPress={() => setShowListingForm(true)}
              >
                <LinearGradient
                  colors={['#d4af37', '#b8860b']}
                  style={styles.btnGradient}
                >
                  <Text style={styles.primaryBtnText}>List New Business</Text>
                  <IconSymbol name="plus" size={18} color="#0f172a" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ── BENEFITS SECTION ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why Partner With Us?</Text>
          <View style={styles.benefitsGrid}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.id} style={styles.benefitCard}>
                <View style={styles.benefitIcon}>
                  <IconSymbol name={benefit.icon as any} size={24} color="#d4af37" />
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDesc}>{benefit.desc}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── CREATE BUSINESS MODAL ── */}
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
              <Text style={styles.formTitle}>Business Details</Text>
              <TouchableOpacity onPress={() => setShowListingForm(false)}>
                <IconSymbol name="xmark" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Business Name *</Text>
                <TextInput 
                  style={styles.formInput} 
                  placeholder="e.g. Royal Photography" 
                  placeholderTextColor="#475569"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Email *</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="email@example.com" 
                    placeholderTextColor="#475569"
                    value={ownerEmail}
                    onChangeText={setOwnerEmail}
                    keyboardType="email-address"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.inputLabel}>Phone *</Text>
                  <TextInput 
                    style={styles.formInput} 
                    placeholder="+91..." 
                    placeholderTextColor="#475569"
                    value={ownerPhone}
                    onChangeText={setOwnerPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Business Type *</Text>
                <View style={styles.typeGrid}>
                  {BUSINESS_TYPES.map(type => (
                    <TouchableOpacity 
                      key={type} 
                      style={[styles.typeChip, businessType === type && styles.typeChipActive]}
                      onPress={() => setBusinessType(type)}
                    >
                      <Text style={[styles.typeChipText, businessType === type && styles.typeChipTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Experience & Reach</Text>
                <View style={styles.row}>
                  <TextInput 
                    style={[styles.formInput, { flex: 1, marginRight: 6 }]} 
                    placeholder="Years Exp." 
                    placeholderTextColor="#475569"
                    value={experience}
                    onChangeText={setExperience}
                    keyboardType="numeric"
                  />
                  <TextInput 
                    style={[styles.formInput, { flex: 1, marginLeft: 6 }]} 
                    placeholder="Events Done" 
                    placeholderTextColor="#475569"
                    value={eventsHosted}
                    onChangeText={setEventsHosted}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>About Business</Text>
                <TextInput 
                  style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]} 
                  placeholder="Short description of your services..." 
                  placeholderTextColor="#475569"
                  multiline
                  value={description}
                  onChangeText={setDescription}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pinpoint Location *</Text>
                <TouchableOpacity 
                  style={[styles.locationBtn, location && styles.locationBtnActive]} 
                  onPress={handleGetLocation}
                  disabled={isLocating}
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color="#d4af37" />
                  ) : (
                    <>
                      <IconSymbol name="location.fill" size={18} color={location ? "#0f172a" : "#d4af37"} />
                      <Text style={[styles.locationBtnText, location && styles.locationBtnTextActive]}>
                        {location ? 'Location Captured' : 'Use Current GPS'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.submitFormBtn, loading && styles.submitBtnDisabled]} 
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.submitFormText}>Create Business</Text>
                )}
              </TouchableOpacity>
              
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
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
  heroSection: {
    marginBottom: 40,
  },
  heroGradient: {
    padding: 32,
    paddingTop: 48,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  heroBadgeText: {
    color: '#d4af37',
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 36,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: 42,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    marginBottom: 32,
  },
  heroActions: {
    gap: 16,
  },
  primaryBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  primaryBtnText: {
    color: '#0f172a',
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
  },
  section: {
    paddingHorizontal: 24,
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 22,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 20,
  },
  benefitsGrid: {
    gap: 16,
  },
  benefitCard: {
    backgroundColor: '#0f172a',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    marginBottom: 8,
  },
  benefitDesc: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  bizManageCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  bizManageImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  bizManageInfo: {
    flex: 1,
    marginLeft: 16,
  },
  bizManageName: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  bizManageType: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.9)',
    justifyContent: 'flex-end',
  },
  formContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
    padding: 24,
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
    gap: 20,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
  },
  formInput: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  typeChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: '#d4af37',
  },
  typeChipText: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  typeChipTextActive: {
    color: '#d4af37',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderStyle: 'dashed',
    paddingVertical: 16,
    borderRadius: 16,
  },
  locationBtnActive: {
    backgroundColor: '#d4af37',
    borderStyle: 'solid',
    borderColor: '#d4af37',
  },
  locationBtnText: {
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
  },
  locationBtnTextActive: {
    color: '#0f172a',
  },
  submitFormBtn: {
    backgroundColor: '#d4af37',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitFormText: {
    color: '#0f172a',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
  },
});
