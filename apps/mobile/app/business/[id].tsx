import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import * as Location from 'expo-location';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getBusinessById, Business } from '@/lib/firestore';

const { width } = Dimensions.get('window');



export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showContactOptions, setShowContactOptions] = useState(false);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [activeTab, setActiveTab] = useState('About');
  const [locality, setLocality] = useState<string | null>(null);
  
  // Enquiry form state
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryDate, setEnquiryDate] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchBusiness() {
      if (typeof id === 'string') {
        const data = await getBusinessById(id);
        setBusiness(data);
        
        // Try to get locality from coordinates if address is missing
        if (data && data.location && (data.location.latitude || data.location.longitude)) {
          try {
            const reverse = await Location.reverseGeocodeAsync({
              latitude: data.location.latitude,
              longitude: data.location.longitude
            });
            if (reverse[0]) {
              const place = reverse[0];
              const name = place.district || place.city || place.subregion || place.region;
              if (name) setLocality(name);
            }
          } catch (error) {
            console.log('Reverse geocoding failed', error);
          }
        }
      }
      setLoading(false);
    }
    fetchBusiness();
  }, [id]);

  const handleCall = () => {
    if (business?.ownerPhone) {
      Linking.openURL(`tel:${business.ownerPhone}`);
      setShowContactOptions(false);
    }
  };

  const handleWhatsApp = () => {
    if (business?.ownerPhone) {
      const phone = business.ownerPhone.replace(/\D/g, '');
      const message = encodeURIComponent(`Hi ${business.name}, I found your business on WedAlbum and I'm interested in your services.`);
      Linking.openURL(`whatsapp://send?phone=${phone}&text=${message}`).catch(() => {
        Linking.openURL(`https://wa.me/${phone}?text=${message}`);
      });
      setShowContactOptions(false);
    }
  };

  const handleEnquirySubmit = () => {
    if (!enquiryName || !enquiryDate) {
      Alert.alert('Missing Info', 'Please provide your name and event date.');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setShowEnquiryForm(false);
      Alert.alert('Inquiry Sent', 'Your inquiry has been sent to the business. They will contact you shortly!');
    }, 1500);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${business?.name} on WedAlbum Marketplace!`,
        url: 'https://wedalbum.com',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#d4af37" />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>Business not found</Text>
        <TouchableOpacity style={styles.backBtnLink} onPress={() => router.back()}>
          <Text style={styles.backBtnLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const galleryImages = business.coverImages && business.coverImages.length > 0 
    ? business.coverImages 
    : [business.coverImage || 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop'];

  const highlights = [
    { id: '1', title: `${business.experience || 0}+ Years`, subtitle: 'Experience', icon: 'clock.fill', color: '#6366f1' },
    { id: '2', title: `${business.eventsHosted || 0}+`, subtitle: 'Events', icon: 'star.fill', color: '#f59e0b' },
    { id: '3', title: 'Quick', subtitle: 'Response', icon: 'bolt.fill', color: '#10b981' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── HERO GALLERY ── */}
        <View style={styles.heroContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setActiveImageIndex(Math.round(x / width));
            }}
            scrollEventThrottle={16}
          >
            {galleryImages.map((img, index) => (
              <ExpoImage
                key={index}
                source={{ uri: img }}
                style={styles.heroImage}
                contentFit="cover"
              />
            ))}
          </ScrollView>
          
          <LinearGradient
            colors={['rgba(2, 6, 23, 0.4)', 'transparent', 'rgba(2, 6, 23, 0.8)']}
            style={styles.heroGradient}
          />

          <View style={styles.pagination}>
            {galleryImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  activeImageIndex === index && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── INFO SECTION ── */}
        <View style={styles.contentSection}>
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <View style={styles.nameRow}>
                <View style={styles.verifiedBadgeIcon}>
                  <IconSymbol name="checkmark.seal.fill" size={14} color="#ffffff" />
                </View>
                <Text style={styles.businessName}>{business.name}</Text>
              </View>
              
              <View style={styles.locationRow}>
                <IconSymbol name="mappin.and.ellipse" size={14} color="#94a3b8" />
                <Text style={styles.locationText}>
                  {business.location.address || locality || 'New Delhi'}
                </Text>
                <View style={styles.dot} />
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{business.type}</Text>
                </View>
              </View>
            </View>
            <View style={styles.ratingBadge}>
              <IconSymbol name="star.fill" size={16} color="#d4af37" />
              <Text style={styles.ratingText}>{business.rating}</Text>
            </View>
          </View>
          

          {/* ── TAB NAVIGATION ── */}
          <View style={styles.tabContainer}>
            {['About', 'Portfolio', 'News', 'Reviews'].map((tab) => (
              <TouchableOpacity 
                key={tab} 
                style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'About' && (
            <View style={{ animationDuration: '300ms' }}>
              {/* ── HIGHLIGHTS ── */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.highlightsContainer}
              >
                {highlights.map((item) => (
                  <View key={item.id} style={styles.highlightItem}>
                    <View style={[styles.highlightIcon, { backgroundColor: `${item.color}15` }]}>
                      <IconSymbol name={item.icon as any} size={18} color={item.color} />
                    </View>
                    <Text style={styles.highlightTitle}>{item.title}</Text>
                    <Text style={styles.highlightSubtitle}>{item.subtitle}</Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.descriptionText}>
                  {business.description || 
                    `Experience the exceptional services of ${business.name}. With a focus on quality and client satisfaction, we bring your vision to life with professional expertise in ${business.type.toLowerCase()}.`}
                </Text>
              </View>

              {business.services && business.services.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Services Offered</Text>
                  <View style={styles.servicesGrid}>
                    {business.services.map((s, i) => (
                      <View key={i} style={styles.serviceTag}>
                        <IconSymbol name="checkmark.circle.fill" size={14} color="#d4af37" />
                        <Text style={styles.serviceTagText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {business.faqs && business.faqs.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>FAQs</Text>
                  {business.faqs.map((faq, i) => (
                    <View key={i} style={styles.faqItem}>
                      <Text style={styles.faqQuestion}>{faq.q}</Text>
                      <Text style={styles.faqAnswer}>{faq.a}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}


          {activeTab === 'Portfolio' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Gallery</Text>
                <Text style={styles.viewAllText}>{galleryImages.length} Photos</Text>
              </View>
              <View style={styles.portfolioGrid}>
                {galleryImages.map((img, index) => (
                  <ExpoImage
                    key={index}
                    source={{ uri: img }}
                    style={[styles.portfolioItem, index === 0 && styles.portfolioItemLarge]}
                    contentFit="cover"
                  />
                ))}
              </View>
            </View>
          )}

          {activeTab === 'News' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>News & Updates</Text>
              {business.announcements && business.announcements.length > 0 ? (
                business.announcements.map((item, index) => (
                  <View key={index} style={styles.announcementCard}>
                    <View style={styles.announcementHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <IconSymbol name="megaphone.fill" size={18} color="#d4af37" />
                        <Text style={styles.announcementDate}>{index === 0 ? 'Latest' : 'Update'}</Text>
                      </View>
                    </View>
                    <Text style={styles.announcementBody}>{item}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <IconSymbol name="megaphone" size={40} color="#334155" />
                  <Text style={styles.emptyStateText}>No recent news from this business.</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'Reviews' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>What Clients Say</Text>
                <TouchableOpacity>
                  <Text style={styles.viewAllText}>Write a review</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <ExpoImage 
                    source={{ uri: 'https://i.pravatar.cc/100?img=32' }} 
                    style={styles.reviewerAvatar} 
                  />
                  <View style={styles.reviewerInfo}>
                    <Text style={styles.reviewerName}>Ananya Sharma</Text>
                    <Text style={styles.reviewDate}>2 weeks ago</Text>
                  </View>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <IconSymbol key={s} name="star.fill" size={10} color="#d4af37" />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewContent}>
                  Absolutely amazing experience! The team was professional and captured every moment beautifully. Highly recommend for any wedding event.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── STICKY TOP ACTIONS ── */}
      <SafeAreaView style={styles.headerActions} edges={['top']}>
        <TouchableOpacity style={styles.glassBtn} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={20} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.rightActions}>
          <TouchableOpacity style={styles.glassBtn} onPress={handleShare}>
            <IconSymbol name="square.and.arrow.up" size={18} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.glassBtn, isFavorited && styles.glassBtnActive]} 
            onPress={() => setIsFavorited(!isFavorited)}
          >
            <IconSymbol 
              name={isFavorited ? "heart.fill" : "heart"} 
              size={18} 
              color={isFavorited ? "#ef4444" : "#ffffff"} 
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── BOTTOM CTA ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={styles.secondaryCTA}
          onPress={() => {
            setShowEnquiryForm(true);
            setEnquiryMessage(`Hi ${business.name}, I'm interested in your services. Please share your availability.`);
          }}
        >
          <IconSymbol name="bubble.left.and.bubble.right.fill" size={18} color="#d4af37" />
          <Text style={styles.secondaryCTAText}>Enquire</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryCTA} onPress={() => setShowContactOptions(true)}>
          <Text style={styles.primaryCTAText}>Contact Now</Text>
          <IconSymbol name="arrow.right" size={16} color="#020617" />
        </TouchableOpacity>
      </View>

      {/* ── CONTACT OPTIONS MODAL ── */}
      <Modal
        visible={showContactOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowContactOptions(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowContactOptions(false)}
        >
          <View style={styles.optionsContainer}>
            <View style={styles.grabHandle} />
            <View style={styles.optionsHeader}>
              <View>
                <Text style={styles.optionsTitle}>Contact Business</Text>
                <Text style={styles.optionsSub}>Select your preferred mode</Text>
              </View>
              <TouchableOpacity onPress={() => setShowContactOptions(false)} style={styles.closeBtn}>
                <IconSymbol name="xmark" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsList}>
              <TouchableOpacity style={styles.optionItem} onPress={handleCall}>
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <IconSymbol name="phone.fill" size={20} color="#3b82f6" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>Call Directly</Text>
                  <Text style={styles.optionSubText}>{business.ownerPhone}</Text>
                </View>
                <IconSymbol name="chevron.right" size={14} color="#334155" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionItem} onPress={handleWhatsApp}>
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                  <IconSymbol name="bolt.fill" size={20} color="#22c55e" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>WhatsApp Message</Text>
                  <Text style={styles.optionSubText}>Instant response usually</Text>
                </View>
                <IconSymbol name="chevron.right" size={14} color="#334155" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionItem} 
                onPress={() => {
                  setShowContactOptions(false);
                  setShowEnquiryForm(true);
                }}
              >
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                  <IconSymbol name="paperplane.fill" size={20} color="#d4af37" />
                </View>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>Enquire through App</Text>
                  <Text style={styles.optionSubText}>Share event details</Text>
                </View>
                <IconSymbol name="chevron.right" size={14} color="#334155" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── ENQUIRY FORM MODAL ── */}
      <Modal
        visible={showEnquiryForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEnquiryForm(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.formModalOverlay}
        >
          <View style={styles.enquiryFormContainer}>
            <View style={styles.formHeader}>
              <View>
                <Text style={styles.formTitle}>Enquiry Form</Text>
                <Text style={styles.formSub}>Inquiry for {business.name}</Text>
              </View>
              <TouchableOpacity style={styles.closeFormBtn} onPress={() => setShowEnquiryForm(false)}>
                <IconSymbol name="xmark" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Your Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter your full name"
                  placeholderTextColor="#475569"
                  value={enquiryName}
                  onChangeText={setEnquiryName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Event Date</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 24th Dec 2026"
                  placeholderTextColor="#475569"
                  value={enquiryDate}
                  onChangeText={setEnquiryDate}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Your Message</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="Tell the vendor what you're looking for..."
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={4}
                  value={enquiryMessage}
                  onChangeText={setEnquiryMessage}
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitEnquiryBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleEnquirySubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#020617" />
                ) : (
                  <>
                    <Text style={styles.submitEnquiryBtnText}>Send Inquiry</Text>
                    <IconSymbol name="paperplane.fill" size={16} color="#020617" />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroContainer: {
    width: width,
    height: width * 1.1,
    backgroundColor: '#0f172a',
  },
  heroImage: {
    width: width,
    height: width * 1.1,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  pagination: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: '#d4af37',
  },
  headerActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 0 : 40,
  },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 12,
  },
  contentSection: {
    paddingHorizontal: 24,
    marginTop: -30,
    backgroundColor: '#020617',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  titleContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  businessName: {
    fontSize: 28,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: 34,
  },
  verifiedBadgeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#020617',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
  },
  categoryBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  categoryText: {
    fontSize: 11,
    color: '#d4af37',
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#334155',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  ratingText: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  announcementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 20,
    backgroundColor: '#d4af37',
    gap: 10,
  },
  announcementText: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontFamily: 'Outfit_700Bold',
  },
  backBtnLinkText: {
    color: '#020617',
    fontFamily: 'Outfit_700Bold',
  },
  announcementCard: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  announcementDate: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
  },
  announcementBody: {
    fontSize: 15,
    color: '#e2e8f0',
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  highlightsContainer: {
    gap: 16,
    paddingBottom: 24,
  },
  highlightItem: {
    width: 85,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  highlightTitle: {
    fontSize: 11,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  highlightSubtitle: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 6,
    marginBottom: 32,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: '#d4af37',
  },
  tabText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Outfit_600SemiBold',
  },
  tabTextActive: {
    color: '#020617',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.1)',
  },
  serviceTagText: {
    fontSize: 13,
    color: '#e2e8f0',
    fontFamily: 'Inter_500Medium',
  },
  faqItem: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  faqQuestion: {
    fontSize: 15,
    color: '#ffffff',
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  packageCardLarge: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  packageCardPopular: {
    borderColor: '#d4af37',
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 24,
    backgroundColor: '#d4af37',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularBadgeText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#020617',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  packageName: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  packagePrice: {
    fontSize: 22,
    color: '#d4af37',
    fontFamily: 'Outfit_800ExtraBold',
  },
  packageFeatures: {
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
  },
  packageSelectBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packageSelectBtnPopular: {
    backgroundColor: '#d4af37',
  },
  packageSelectBtnText: {
    fontSize: 15,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  packageSelectBtnTextPopular: {
    color: '#020617',
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  portfolioItem: {
    width: (width - 58) / 2,
    height: 140,
    borderRadius: 16,
  },
  portfolioItemLarge: {
    width: '100%',
    height: 200,
  },
  viewAllText: {
    fontSize: 14,
    color: '#d4af37',
    fontFamily: 'Outfit_600SemiBold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 15,
    color: '#ffffff',
    fontFamily: 'Outfit_600SemiBold',
  },
  reviewDate: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 3,
  },
  reviewContent: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  secondaryCTA: {
    width: 120,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  secondaryCTAText: {
    color: '#d4af37',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  primaryCTA: {
    flex: 1,
    height: 56,
    backgroundColor: '#d4af37',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  primaryCTAText: {
    color: '#020617',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  grabHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  optionsTitle: {
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  optionsSub: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsList: {
    gap: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  optionIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  optionSubText: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    justifyContent: 'flex-end',
  },
  enquiryFormContainer: {
    backgroundColor: '#020617',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    height: '85%',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 26,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  formSub: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  closeFormBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formScroll: {
    paddingBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 8,
    marginLeft: 4,
  },
  formInput: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    fontSize: 15,
  },
  formTextArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  submitEnquiryBtn: {
    backgroundColor: '#d4af37',
    height: 60,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitEnquiryBtnText: {
    color: '#020617',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    marginBottom: 16,
  },
  backBtnLink: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#d4af37',
    borderRadius: 14,
  },
  backBtnLinkText: {
    color: '#020617',
    fontFamily: 'Outfit_700Bold',
  },
});
