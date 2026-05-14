import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getBusinessById, updateBusiness, Business } from '@/lib/firestore';

const { width } = Dimensions.get('window');

const BUSINESS_TYPES = [
  'Venue', 'Photography', 'Videography', 'Catering', 'Food Stalls',
  'Music & DJ', 'Lighting', 'Decor', 'Event Planner', 'Security',
  'Anchors', 'Gifts', 'Travel', 'Staff', 'Invitations', 'Makeup',
  'Apparel', 'Trophies'
];

export default function ManageBusinessScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState('Profile');
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [about, setAbout] = useState('');
  const [experience, setExperience] = useState('');
  const [startedDate, setStartedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [eventsHosted, setEventsHosted] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([]);
  const [status, setStatus] = useState<'created' | 'published'>('created');
  const [news, setNews] = useState<string[]>([]);
  const [newNewsItem, setNewNewsItem] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [coverImages, setCoverImages] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [timeRange, setTimeRange] = useState('1 Month');

  const TIME_RANGES = ['1 Week', '1 Month', '3 Month', '6 Month', '1 Year', '3 Year', 'Overall'];

  useEffect(() => {
    if (id) {
      const bizId = Array.isArray(id) ? id[0] : id;
      fetchBusiness(bizId);
    }
  }, [id]);

  const fetchBusiness = async (bizId: string) => {
    setLoading(true);
    try {
      const biz = await getBusinessById(bizId);
      if (biz) {
        setBusiness(biz);
        populateFields(biz);
      }
    } catch (error) {
      console.error('Error fetching business:', error);
    } finally {
      setLoading(false);
    }
  };

  const populateFields = (biz: Business) => {
    setBusinessName(biz.name || '');
    setCategory(biz.type || '');
    setAbout(biz.description || '');
    setExperience(biz.experience?.toString() || '0');
    if (biz.startedDate) {
      // Handle Firestore Timestamp or ISO string
      const date = biz.startedDate.toDate ? biz.startedDate.toDate() : new Date(biz.startedDate);
      setStartedDate(date);
    } else if (biz.experience) {
      // Fallback: Estimate start date from experience years
      const date = new Date();
      date.setFullYear(date.getFullYear() - (biz.experience || 0));
      setStartedDate(date);
    }
    setEventsHosted(biz.eventsHosted?.toString() || '0');
    setServices(biz.services || []);
    setFaqs(biz.faqs || []);
    setStatus(biz.status || 'created');
    setNews(biz.announcements || []);
    setCoverImages(biz.coverImages || (biz.coverImage ? [biz.coverImage] : []));
  };

  const addNewsItem = () => {
    if (!newNewsItem.trim()) return;
    if (news.length >= 10) {
      Alert.alert("Limit Reached", "You can only have up to 10 active news items. Please delete an old one first.");
      return;
    }
    setNews([newNewsItem.trim(), ...news]);
    setNewNewsItem('');
  };

  const removeNewsItem = (index: number) => {
    const updated = [...news];
    updated.splice(index, 1);
    setNews(updated);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (coverImages.length < 3) {
        setCoverImages([...coverImages, result.assets[0].uri]);
      } else {
        const updated = [...coverImages];
        updated[activeImageIndex] = result.assets[0].uri;
        setCoverImages(updated);
      }
    }
  };

  const removeCoverImage = (index: number) => {
    const updated = coverImages.filter((_, i) => i !== index);
    setCoverImages(updated);
    if (activeImageIndex >= updated.length) {
      setActiveImageIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleSave = async () => {
    const bizId = Array.isArray(id) ? id[0] : id;
    if (!bizId) return;
    
    setIsUpdating(true);
    try {
      const updatedData: Partial<Business> = {
        name: businessName,
        type: category,
        description: about,
        startedDate: startedDate,
        experience: Math.floor((new Date().getTime() - startedDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
        eventsHosted: parseInt(eventsHosted) || 0,
        services: services,
        faqs: faqs,
        announcements: news,
        coverImages: coverImages,
        coverImage: coverImages[0] || '', // Fallback for single image field
      };
      
      const success = await updateBusiness(bizId, updatedData);
      
      if (success) {
        if (business) {
          setBusiness({ ...business, ...updatedData } as Business);
        }
        setIsEditing(false);
        Alert.alert("Success", "Profile updated successfully!");
      } else {
        Alert.alert("Error", "Failed to update profile.");
      }
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    if (business) {
      populateFields(business);
    }
    setIsEditing(false);
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag) return;
    if (services.length >= 10) {
      Alert.alert("Limit Reached", "You can only add up to 10 tags.");
      return;
    }
    if (services.includes(tag)) {
      Alert.alert("Duplicate", "This tag already exists.");
      return;
    }
    setServices([...services, tag]);
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    setServices(services.filter(s => s !== tag));
  };

  const addFaq = () => {
    if (faqs.length >= 5) {
      Alert.alert("Limit Reached", "You can only add up to 5 FAQs. Please delete an old one to add a new one.");
      return;
    }
    setFaqs([...faqs, { q: '', a: '' }]);
  };

  const updateFaq = (index: number, field: 'q' | 'a', value: string) => {
    const newFaqs = [...faqs];
    newFaqs[index][field] = value;
    setFaqs(newFaqs);
  };

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  const STATS = [
    { id: '1', label: 'Views', value: '1.2k', icon: 'eye.fill', color: '#3b82f6' },
    { id: '2', label: 'Inquiries', value: '34', icon: 'message.fill', color: '#d4af37' },
    { id: '3', label: 'Shortlists', value: '142', icon: 'heart.fill', color: '#ef4444' },
    { id: '4', label: 'Rating', value: business?.rating?.toString() || '0', icon: 'star.fill', color: '#22c55e' },
  ];

  const PORTFOLIO = business?.coverImage ? [business.coverImage] : [];

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#d4af37" />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: '#ffffff' }}>Business not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#d4af37' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        {isEditing ? (
          <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol name="chevron.left" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
        
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Business Manager</Text>
          {business?.shortId && <Text style={styles.headerShortId}>{business.shortId}</Text>}
        </View>
        
        {isEditing ? (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isUpdating}>
            {isUpdating ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight}>
            {activeTab === 'Profile' && (
              <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
                <IconSymbol name="pencil" size={16} color="#d4af37" />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            {activeTab === 'Portfolio' && (
              <TouchableOpacity style={styles.editBtn} onPress={pickImage}>
                <IconSymbol name="plus" size={16} color="#d4af37" />
                <Text style={styles.editBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.tabs}>
          {['Profile', 'Portfolio', 'Interactions', 'Analytics'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              {activeTab === tab && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Profile' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.tabContent}>
            {/* ── COVER CAROUSEL SECTION ── */}
            <View style={styles.inputGroup}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>Cover Carousel ({coverImages.length}/3)</Text>
                {isEditing && coverImages.length < 3 && (
                  <TouchableOpacity onPress={pickImage} style={styles.addSmallBtn}>
                    <IconSymbol name="plus.circle.fill" size={20} color="#d4af37" />
                    <Text style={styles.addSmallBtnText}>Add Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.coverPreviewContainer}>
                {coverImages.length > 0 ? (
                  <View style={{ flex: 1 }}>
                    <ScrollView 
                      horizontal 
                      pagingEnabled 
                      showsHorizontalScrollIndicator={false}
                      onScroll={(e) => {
                        const contentOffset = e.nativeEvent.contentOffset.x;
                        const viewSize = e.nativeEvent.layoutMeasurement.width;
                        const index = Math.floor(contentOffset / viewSize);
                        if (index !== activeImageIndex) setActiveImageIndex(index);
                      }}
                      scrollEventThrottle={16}
                    >
                      {coverImages.map((uri, idx) => (
                        <View key={idx} style={{ width: width - 40, height: 180 }}>
                          <ExpoImage source={{ uri }} style={styles.coverPreview} contentFit="cover" />
                          {isEditing && (
                            <View style={styles.imageActionOverlay}>
                              <TouchableOpacity 
                                style={styles.imageActionBtn} 
                                onPress={() => removeCoverImage(idx)}
                              >
                                <IconSymbol name="trash.fill" size={16} color="#ef4444" />
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.imageActionBtn, { backgroundColor: '#d4af37' }]} 
                                onPress={pickImage}
                              >
                                <IconSymbol name="pencil" size={16} color="#0f172a" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                    
                    {coverImages.length > 1 && (
                      <View style={styles.paginationDots}>
                        {coverImages.map((_, i) => (
                          <View 
                            key={i} 
                            style={[
                              styles.dot, 
                              i === activeImageIndex && styles.activeDot
                            ]} 
                          />
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.emptyCoverPlaceholder} onPress={pickImage}>
                    <IconSymbol name="photo.on.rectangle.angled" size={40} color="#334155" />
                    <Text style={styles.emptyCoverText}>No cover photos added</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.inputHint}>Owners can add up to 3 cover photos. Swipe to see how they look.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Business Name</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholderTextColor="#475569"
                />
              ) : (
                <Text style={styles.displayTextMain}>{businessName}</Text>
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Category</Text>
                {isEditing ? (
                  <>
                    <TouchableOpacity 
                      style={styles.dropdownBtn} 
                      onPress={() => setShowCategoryPicker(true)}
                    >
                      <Text style={[styles.dropdownBtnText, !category && { color: '#475569' }]}>
                        {category || 'Select Category'}
                      </Text>
                      <IconSymbol name="chevron.down" size={16} color="#d4af37" />
                    </TouchableOpacity>

                    <Modal
                      visible={showCategoryPicker}
                      transparent={true}
                      animationType="fade"
                      onRequestClose={() => setShowCategoryPicker(false)}
                    >
                      <TouchableOpacity 
                        style={styles.modalOverlay} 
                        activeOpacity={1} 
                        onPress={() => setShowCategoryPicker(false)}
                      >
                        <View style={styles.pickerModalContainer}>
                          <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Select Category</Text>
                            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                              <IconSymbol name="xmark" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                          </View>
                          <View>
                            <ScrollView 
                              style={styles.pickerList}
                              showsVerticalScrollIndicator={true}
                              contentContainerStyle={{ paddingBottom: 40 }}
                            >
                              {BUSINESS_TYPES.map((item) => (
                                <TouchableOpacity 
                                  key={item} 
                                  style={[styles.pickerItem, category === item && styles.pickerItemActive]}
                                  onPress={() => {
                                    setCategory(item);
                                    setShowCategoryPicker(false);
                                  }}
                                >
                                  <Text style={[styles.pickerItemText, category === item && styles.pickerItemTextActive]}>
                                    {item}
                                  </Text>
                                  {category === item && (
                                    <IconSymbol name="checkmark" size={16} color="#d4af37" />
                                  )}
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                            <LinearGradient
                              colors={['transparent', 'rgba(15, 23, 42, 0.9)', '#0f172a']}
                              style={styles.pickerFade}
                              pointerEvents="none"
                            />
                          </View>
                          <View style={styles.pickerFooter}>
                            <IconSymbol name="chevron.down" size={12} color="#475569" />
                            <Text style={styles.pickerFooterText}>Scroll for more</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  </>
                ) : (
                  <Text style={styles.displayText}>{category}</Text>
                )}
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 12 }]}>
                <Text style={styles.inputLabel}>Business Started</Text>
                {isEditing ? (
                  <>
                    <TouchableOpacity 
                      style={styles.datePickerBtn} 
                      onPress={() => setShowDatePicker(true)}
                    >
                      <IconSymbol name="calendar" size={16} color="#d4af37" />
                      <Text style={styles.datePickerBtnText}>
                        {startedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={startedDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(Platform.OS === 'ios');
                          if (selectedDate) {
                            setStartedDate(selectedDate);
                            // Update experience string for immediate UI feedback if needed
                            const years = Math.floor((new Date().getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
                            setExperience(years.toString());
                          }
                        }}
                        maximumDate={new Date()}
                      />
                    )}
                  </>
                ) : (
                  <View style={styles.experienceContainer}>
                    <Text style={styles.displayText}>
                      {Math.floor((new Date().getTime() - startedDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25))} Years
                    </Text>
                    <Text style={styles.startedHint}>
                      Started {startedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Events Hosted</Text>
              {isEditing ? (
                <TextInput
                  style={styles.input}
                  value={eventsHosted}
                  onChangeText={setEventsHosted}
                  keyboardType="numeric"
                  placeholder="e.g. 100"
                  placeholderTextColor="#475569"
                />
              ) : (
                <Text style={styles.displayText}>{eventsHosted}+ Events</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>About Business</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={about}
                  onChangeText={setAbout}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#475569"
                  placeholder="Tell us about your services..."
                />
              ) : (
                <Text style={styles.displayTextAbout}>{about || 'No description provided.'}</Text>
              )}
            </View>

            {/* ── SERVICES AS TAGS ── */}
            <View style={styles.inputGroup}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>Services & Tags ({services.length}/10)</Text>
              </View>
              
              {isEditing && (
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={newTag}
                    onChangeText={setNewTag}
                    placeholder="Add a service (e.g. Drone Shots)"
                    placeholderTextColor="#475569"
                    onSubmitEditing={addTag}
                  />
                  <TouchableOpacity style={styles.addTagBtn} onPress={addTag}>
                    <IconSymbol name="plus" size={20} color="#0f172a" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.tagCloud}>
                {services.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                    {isEditing && (
                      <TouchableOpacity onPress={() => removeTag(tag)} style={styles.removeTagBtn}>
                        <IconSymbol name="xmark" size={12} color="#94a3b8" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {services.length === 0 && !isEditing && (
                  <Text style={styles.emptyText}>No services listed.</Text>
                )}
              </View>
            </View>

            {/* Removed FAQ section from Profile tab */}

            {isEditing && (
              <TouchableOpacity 
                style={[styles.saveBtn, { marginTop: 20, paddingVertical: 16, width: '100%' }]} 
                onPress={handleSave} 
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <Text style={[styles.saveBtnText, { fontSize: 16 }]}>Save All Changes</Text>
                )}
              </TouchableOpacity>
            )}

            {/* ── STORAGE UTILIZATION ── */}
            <View style={[styles.inputGroup, { marginTop: 20 }]}>
              <Text style={styles.inputLabel}>Storage Utilization</Text>
              <View style={styles.storageCard}>
                <View style={styles.storageHeader}>
                  <View style={styles.storageIconBg}>
                    <IconSymbol name="cloud.fill" size={18} color="#3b82f6" />
                  </View>
                  <View style={styles.storageInfo}>
                    <Text style={styles.storageTitle}>Portfolio Storage</Text>
                    <Text style={styles.storageStats}>1.2 GB of 5.0 GB used</Text>
                  </View>
                  <TouchableOpacity style={styles.upgradeBtn}>
                    <Text style={styles.upgradeBtnText}>Upgrade</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.storageBarTrack}>
                  <LinearGradient
                    colors={['#3b82f6', '#2563eb']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.storageBarFill, { width: '24%' }]}
                  />
                </View>
                <Text style={styles.storageHint}>You are using 24% of your free tier storage.</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={styles.promotionBtn}
                onPress={async () => {
                  const bizId = Array.isArray(id) ? id[0] : id;
                  if (!bizId) return;
                  setIsUpdating(true);
                  const newStatus = status === 'published' ? 'created' : 'published';
                  const success = await updateBusiness(bizId, { status: newStatus });
                  if (success) {
                    setStatus(newStatus);
                    Alert.alert("Success", `Business ${newStatus === 'published' ? 'published' : 'hidden'} successfully!`);
                  }
                  setIsUpdating(false);
                }}
                disabled={isUpdating}
              >
                <LinearGradient
                  colors={status === 'published' ? ['#ef4444', '#b91c1c'] : ['#22c55e', '#15803d']}
                  style={styles.promotionGradient}
                >
                  <IconSymbol name={status === 'published' ? 'eye.slash.fill' : 'eye.fill'} size={16} color="#ffffff" />
                  <Text style={[styles.promotionBtnText, { color: '#ffffff' }]}>
                    {isUpdating ? 'Updating...' : status === 'published' ? 'Unpublish Listing' : 'Publish to Marketplace'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* ── PORTFOLIO & ANALYTICS ── */}
        {activeTab === 'Portfolio' && (
          <View style={styles.tabContent}>
            <View style={styles.portfolioGrid}>
              {isEditing && (
                <TouchableOpacity style={styles.addPhotoCard}>
                  <IconSymbol name="plus" size={32} color="#d4af37" />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </TouchableOpacity>
              )}
              {PORTFOLIO.map((img, idx) => (
                <View key={idx} style={styles.photoCard}>
                  <ExpoImage source={{ uri: img }} style={styles.photo} contentFit="cover" />
                  {isEditing && (
                    <TouchableOpacity style={styles.deletePhotoBtn}>
                      <IconSymbol name="xmark.circle.fill" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'Interactions' && (
          <View style={styles.tabContent}>
            {/* ── NEWS EDITOR ── */}
            <View style={[styles.inputGroup, { marginTop: 10 }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>News & Updates ({news.length}/10)</Text>
                {!isEditing && (
                  <TouchableOpacity 
                    style={styles.manageBtn}
                    onPress={() => setIsEditing(true)}
                  >
                    <IconSymbol name="megaphone.fill" size={14} color="#d4af37" />
                    <Text style={styles.manageBtnText}>Manage</Text>
                  </TouchableOpacity>
                )}
                {isEditing && (
                  <View style={[styles.statusBadge, { backgroundColor: news.length > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)' }]}>
                    <Text style={[styles.statusText, { color: news.length > 0 ? '#22c55e' : '#94a3b8' }]}>
                      {news.length > 0 ? `${news.length} Active` : 'No News'}
                    </Text>
                  </View>
                )}
              </View>

              {isEditing && (
                <View style={styles.addNewsContainer}>
                  <TextInput
                    style={[styles.input, styles.newsInputSmall, news.length >= 10 && styles.disabledInput]}
                    value={newNewsItem}
                    onChangeText={setNewNewsItem}
                    placeholder={news.length >= 10 ? "Delete an old news to add new" : "Add latest news or offer..."}
                    placeholderTextColor="#475569"
                    editable={news.length < 10}
                    multiline
                  />
                  <TouchableOpacity 
                    style={[styles.addBtnSmall, (news.length >= 10 || !newNewsItem.trim()) && { opacity: 0.5 }]} 
                    onPress={addNewsItem}
                    disabled={news.length >= 10 || !newNewsItem.trim()}
                  >
                    <IconSymbol name="plus.circle.fill" size={24} color="#d4af37" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.newsList}>
                {news.map((item, index) => (
                  <View key={index} style={styles.newsItemRow}>
                    <View style={styles.newsItemContent}>
                      <View style={styles.newsDot} />
                      <Text style={styles.newsItemText}>{item}</Text>
                    </View>
                    {isEditing && (
                      <TouchableOpacity onPress={() => removeNewsItem(index)}>
                        <IconSymbol name="xmark.circle.fill" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {news.length === 0 && !isEditing && (
                  <Text style={styles.emptyText}>No active news or updates.</Text>
                )}
              </View>
              <Text style={styles.inputHint}>Owners can manage up to 10 active news items. Delete old ones to make space.</Text>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.inputLabel}>Manage FAQ ({faqs.length}/5)</Text>
              {!isEditing && (
                <TouchableOpacity 
                  style={styles.manageBtn}
                  onPress={() => setIsEditing(true)}
                >
                  <IconSymbol name="questionmark.circle.fill" size={14} color="#d4af37" />
                  <Text style={styles.manageBtnText}>Manage</Text>
                </TouchableOpacity>
              )}
              {isEditing && (
                <TouchableOpacity 
                  style={[styles.addBtn, faqs.length >= 5 && { opacity: 0.5 }]} 
                  onPress={addFaq}
                  disabled={faqs.length >= 5}
                >
                  <IconSymbol name="plus.circle.fill" size={20} color="#d4af37" />
                  <Text style={styles.addBtnText}>Add FAQ</Text>
                </TouchableOpacity>
              )}
            </View>

            {faqs.map((faq, index) => (
              <View key={index} style={styles.faqEditor}>
                <View style={styles.faqHeader}>
                  <Text style={styles.faqNumber}>FAQ #{index + 1}</Text>
                  {isEditing && (
                    <TouchableOpacity onPress={() => removeFaq(index)}>
                      <IconSymbol name="trash.fill" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={[styles.input, { marginBottom: 8 }, !isEditing && styles.disabledInput]}
                  value={faq.q}
                  onChangeText={(val) => updateFaq(index, 'q', val)}
                  placeholder="Question"
                  placeholderTextColor="#475569"
                  editable={isEditing}
                />
                <TextInput
                  style={[styles.input, styles.textArea, { height: 80 }, !isEditing && styles.disabledInput]}
                  value={faq.a}
                  onChangeText={(val) => updateFaq(index, 'a', val)}
                  placeholder="Answer"
                  placeholderTextColor="#475569"
                  multiline
                  editable={isEditing}
                />
              </View>
            ))}
            {faqs.length === 0 && (
              <View style={styles.emptyState}>
                <IconSymbol name="questionmark.circle.fill" size={40} color="#334155" />
                <Text style={styles.emptyStateText}>No FAQs added yet.</Text>
                {isEditing && (
                  <TouchableOpacity style={styles.addBtn} onPress={addFaq}>
                    <Text style={styles.addBtnText}>Create first FAQ</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {activeTab === 'Analytics' && (
          <View style={styles.tabContent}>
            {/* ── TIME RANGE SELECTOR ── */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.timeRangeScroll}
              style={styles.timeRangeWrapper}
            >
              {TIME_RANGES.map((range) => (
                <TouchableOpacity
                  key={range}
                  onPress={() => setTimeRange(range)}
                  style={[styles.rangeChip, timeRange === range && styles.activeRangeChip]}
                >
                  <Text style={[styles.rangeText, timeRange === range && styles.activeRangeText]}>{range}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── UNIFIED OVERVIEW CARD ── */}
            <View style={styles.statsGrid}>
              <View style={styles.unifiedStatCard}>
                <View style={styles.statRow}>
                  {STATS.slice(0, 2).map((stat) => (
                    <View key={stat.id} style={styles.quadrant}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                          <IconSymbol name={stat.icon as any} size={16} color={stat.color} />
                        </View>
                        <Text style={styles.statValue}>{stat.value}</Text>
                      </View>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.statDividerH} />
                <View style={styles.statRow}>
                  {STATS.slice(2, 4).map((stat) => (
                    <View key={stat.id} style={styles.quadrant}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                          <IconSymbol name={stat.icon as any} size={16} color={stat.color} />
                        </View>
                        <Text style={styles.statValue}>{stat.value}</Text>
                      </View>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* ── MARKET STANDING (RANKING) ── */}
            <View style={styles.analyticsSection}>
              <View style={styles.rankingCard}>
                <LinearGradient
                  colors={['#d4af37', '#996515']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.rankingGradient}
                >
                  <View style={styles.rankingHeader}>
                    <View style={styles.rankingIconBg}>
                      <IconSymbol name="crown.fill" size={20} color="#ffffff" />
                    </View>
                    <Text style={styles.rankingTitle}>Market Standing</Text>
                  </View>
                  
                  <View style={styles.rankingContent}>
                    <Text style={styles.rankingValue}>Top 15%</Text>
                    <Text style={styles.rankingSubText}>
                      of {category || 'Professionals'} in Mumbai
                    </Text>
                  </View>

                  <View style={styles.gaugeContainer}>
                    <View style={styles.gaugeTrack}>
                      <View style={[styles.gaugeFill, { width: '85%' }]} />
                      <View style={[styles.gaugeMarker, { left: '85%' }]} />
                    </View>
                    <View style={styles.gaugeLabels}>
                      <Text style={styles.gaugeLabel}>Elite</Text>
                      <Text style={styles.gaugeLabel}>You</Text>
                      <Text style={styles.gaugeLabel}>Average</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </View>

            {/* ── PERFORMANCE OVERVIEW ── */}
            <View style={styles.analyticsSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Performance Overview</Text>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeBadgeText}>{timeRange}</Text>
                </View>
              </View>

              <View style={styles.performanceCard}>
                <LinearGradient
                  colors={['#1e293b', '#0f172a']}
                  style={styles.performanceGradient}
                >
                  <View style={styles.perfRow}>
                    <View>
                      <Text style={styles.perfLabel}>Overall Conversion</Text>
                      <Text style={styles.perfValue}>4.2%</Text>
                    </View>
                    <View style={styles.growthBadge}>
                      <IconSymbol name="arrow.up.right" size={12} color="#22c55e" />
                      <Text style={styles.growthText}>+12%</Text>
                    </View>
                  </View>
                  
                  <View style={styles.funnelContainer}>
                    <View style={styles.funnelStep}>
                      <View style={[styles.funnelBar, { width: '100%', backgroundColor: '#3b82f6' }]} />
                      <View style={styles.funnelInfo}>
                        <Text style={styles.funnelLabel}>Impressions</Text>
                        <Text style={styles.funnelCount}>1,240</Text>
                      </View>
                    </View>
                    <View style={styles.funnelStep}>
                      <View style={[styles.funnelBar, { width: '65%', backgroundColor: '#8b5cf6' }]} />
                      <View style={styles.funnelInfo}>
                        <Text style={styles.funnelLabel}>Profile Views</Text>
                        <Text style={styles.funnelCount}>806</Text>
                      </View>
                    </View>
                    <View style={styles.funnelStep}>
                      <View style={[styles.funnelBar, { width: '15%', backgroundColor: '#d4af37' }]} />
                      <View style={styles.funnelInfo}>
                        <Text style={styles.funnelLabel}>Inquiries</Text>
                        <Text style={styles.funnelCount}>34</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </View>

            {/* ── CONTACT METHODS ── */}
            <View style={styles.analyticsSection}>
              <Text style={styles.sectionTitle}>Inquiry Channels</Text>
              <View style={styles.channelsCard}>
                {[
                  { label: 'WhatsApp', value: 18, color: '#22c55e', icon: 'message.fill' },
                  { label: 'Phone Calls', value: 12, color: '#3b82f6', icon: 'phone.fill' },
                  { label: 'In-App Chat', value: 4, color: '#d4af37', icon: 'bubble.left.fill' },
                ].map((item, idx) => (
                  <View key={idx} style={styles.channelRow}>
                    <View style={styles.channelHeader}>
                      <View style={styles.channelIconName}>
                        <IconSymbol name={item.icon as any} size={14} color={item.color} />
                        <Text style={styles.channelLabel}>{item.label}</Text>
                      </View>
                      <Text style={styles.channelValue}>{item.value}</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View 
                        style={[
                          styles.progressBarFill, 
                          { width: `${(item.value / 34) * 100}%`, backgroundColor: item.color }
                        ]} 
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* ── SHORTLIST INSIGHTS ── */}
            <View style={styles.analyticsSection}>
              <Text style={styles.sectionTitle}>High Intent Audience</Text>
              <View style={styles.shortlistCard}>
                <View style={styles.shortlistIconContainer}>
                  <IconSymbol name="heart.circle.fill" size={40} color="#ef4444" />
                </View>
                <View style={styles.shortlistInfo}>
                  <Text style={styles.shortlistCountText}>142 Users</Text>
                  <Text style={styles.shortlistLabel}>have shortlisted your business</Text>
                  <View style={styles.intentBadge}>
                    <Text style={styles.intentBadgeText}>High Intent</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.shortlistTip}>
                Tip: Users who shortlist you are 3x more likely to book. Update your News to stay in their notifications!
              </Text>
            </View>

            {/* ── AUDIENCE REACH (LOCATION) ── */}
            <View style={styles.analyticsSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Audience Reach</Text>
                <IconSymbol name="mappin.and.ellipse" size={16} color="#d4af37" />
              </View>
              
              <View style={styles.locationCard}>
                <View style={styles.locationHeader}>
                  <Text style={styles.locationSubTitle}>Top Locations</Text>
                  <Text style={styles.locationTotal}>5 Cities tracked</Text>
                </View>

                {[
                  { city: 'Mumbai', percent: 45, color: '#3b82f6' },
                  { city: 'Delhi', percent: 28, color: '#8b5cf6' },
                  { city: 'Bangalore', percent: 15, color: '#22c55e' },
                  { city: 'Pune', percent: 8, color: '#f59e0b' },
                  { city: 'Others', percent: 4, color: '#64748b' },
                ].map((item, idx) => (
                  <View key={idx} style={styles.locationRow}>
                    <View style={styles.locationInfo}>
                      <Text style={styles.cityName}>{item.city}</Text>
                      <Text style={styles.cityPercent}>{item.percent}%</Text>
                    </View>
                    <View style={styles.locationBarTrack}>
                      <View 
                        style={[
                          styles.locationBarFill, 
                          { width: `${item.percent}%`, backgroundColor: item.color }
                        ]} 
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* ── WEEKLY ACTIVITY CHART ── */}
            <View style={styles.analyticsSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Weekly Activity</Text>
                <Text style={styles.peakDayLabel}>Peak: Sunday</Text>
              </View>
              
              <View style={styles.chartCard}>
                <View style={styles.barChartContainer}>
                  {[
                    { day: 'M', value: 45 },
                    { day: 'T', value: 52 },
                    { day: 'W', value: 48 },
                    { day: 'T', value: 70 },
                    { day: 'F', value: 85 },
                    { day: 'S', value: 92 },
                    { day: 'S', value: 100, peak: true },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.barColumn}>
                      <View style={styles.barTrack}>
                        <LinearGradient
                          colors={item.peak ? ['#d4af37', '#b8860b'] : ['#334155', '#1e293b']}
                          style={[styles.barFill, { height: `${item.value}%` }]}
                        />
                      </View>
                      <Text style={[styles.dayLabel, item.peak && styles.peakDayText]}>{item.day}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#334155' }]} />
                    <Text style={styles.legendText}>Normal Activity</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#d4af37' }]} />
                    <Text style={styles.legendText}>Peak Day</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── RECENT INQUIRIES ── */}
            <View style={[styles.analyticsSection, { marginBottom: 40 }]}>
              <Text style={styles.sectionTitle}>Recent Inquiries</Text>
              <View style={styles.emptyState}>
                <IconSymbol name="message.fill" size={40} color="#334155" />
                <Text style={styles.emptyStateText}>No new inquiries today.</Text>
                <Text style={styles.emptyStateSubtext}>New inquiries will appear here as they arrive.</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  headerShortId: {
    fontSize: 10,
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
    marginTop: -2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  editBtnText: {
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 80,
  },
  saveBtnText: {
    color: '#0f172a',
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 40,
  },
  statsGrid: {
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: 10,
  },
  unifiedStatCard: {
    backgroundColor: '#0f172a',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quadrant: {
    flex: 1,
    paddingVertical: 8,
  },
  statDividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 16,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Outfit_600SemiBold',
    marginLeft: 2,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Outfit_600SemiBold',
  },
  activeTabText: {
    color: '#d4af37',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: '#d4af37',
    borderRadius: 1,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  disabledInput: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.02)',
    color: '#94a3b8',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  addTagBtn: {
    backgroundColor: '#d4af37',
    width: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tagText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  removeTagBtn: {
    marginLeft: 6,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addBtnText: {
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  faqEditor: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 16,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  faqNumber: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Outfit_800ExtraBold',
  },
  actionRow: {
    marginTop: 20,
  },
  promotionBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  promotionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  promotionBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  addPhotoCard: {
    width: (width - 52) / 2,
    height: 150,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 52, 0.3)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(212, 175, 52, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoText: {
    color: '#d4af37',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  photoCard: {
    width: (width - 52) / 2,
    height: 150,
    borderRadius: 20,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  newsCard: {
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  newsDate: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  newsTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  newsBody: {
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  analyticsSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    color: '#64748b',
    fontFamily: 'Inter_500Medium',
  },
  newsInput: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    marginTop: 6,
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
  },
  newsPreviewCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: 24,
  },
  newsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsStatus: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },
  newsPreviewText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    marginVertical: 16,
  },
  newsEmptyText: {
    fontSize: 14,
    color: '#475569',
    fontStyle: 'italic',
    marginVertical: 16,
  },
  updateNewsBtn: {
    backgroundColor: '#d4af37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  updateNewsBtnText: {
    color: '#0f172a',
    fontSize: 14,
    fontFamily: 'Outfit_800ExtraBold',
  },
  newsInputSmall: {
    flex: 1,
    minHeight: 50,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  addNewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  addBtnSmall: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsList: {
    gap: 8,
    marginBottom: 12,
  },
  newsItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  newsItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  newsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d4af37',
    marginTop: 6,
  },
  newsItemText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    textAlign: 'center',
  },
  timeBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  timeBadgeText: {
    color: '#d4af37',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  performanceCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  performanceGradient: {
    padding: 20,
  },
  perfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  perfLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Outfit_600SemiBold',
  },
  perfValue: {
    fontSize: 32,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    marginTop: 4,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  growthText: {
    color: '#22c55e',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  funnelContainer: {
    gap: 16,
  },
  funnelStep: {
    gap: 8,
  },
  funnelBar: {
    height: 8,
    borderRadius: 4,
    opacity: 0.8,
  },
  funnelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  funnelLabel: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_500Medium',
  },
  funnelCount: {
    fontSize: 12,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  channelsCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 20,
  },
  channelRow: {
    gap: 8,
  },
  channelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelIconName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Outfit_600SemiBold',
  },
  channelValue: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Outfit_700Bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  peakCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  peakInfo: {
    flex: 1,
  },
  peakTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  peakDesc: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  peakDayLabel: {
    fontSize: 12,
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chartCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginTop: 12,
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    paddingBottom: 8,
  },
  barColumn: {
    alignItems: 'center',
    width: '12%',
  },
  barTrack: {
    flex: 1,
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  dayLabel: {
    marginTop: 12,
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Outfit_700Bold',
  },
  peakDayText: {
    color: '#d4af37',
  },
  chartLegend: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
  },
  timeRangeWrapper: {
    marginBottom: 20,
    marginTop: 10,
  },
  timeRangeScroll: {
    paddingRight: 20,
    gap: 8,
  },
  rangeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeRangeChip: {
    borderColor: '#d4af37',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  rangeText: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Outfit_600SemiBold',
  },
  activeRangeText: {
    color: '#d4af37',
  },
  locationCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginTop: 12,
    gap: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationSubTitle: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Outfit_600SemiBold',
  },
  locationTotal: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_500Medium',
  },
  locationRow: {
    gap: 8,
  },
  locationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cityName: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Outfit_600SemiBold',
  },
  cityPercent: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Outfit_700Bold',
  },
  locationBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  locationBarFill: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.8,
  },
  shortlistCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
    marginTop: 12,
  },
  shortlistIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortlistInfo: {
    flex: 1,
  },
  shortlistCountText: {
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  shortlistLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  intentBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  intentBadgeText: {
    color: '#22c55e',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
  },
  shortlistTip: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  rankingCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 10,
    elevation: 8,
    shadowColor: '#d4af37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  rankingGradient: {
    padding: 20,
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  rankingIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankingTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rankingContent: {
    marginBottom: 20,
  },
  rankingValue: {
    fontSize: 36,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  rankingSubText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  gaugeContainer: {
    gap: 8,
  },
  gaugeTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    position: 'relative',
    overflow: 'visible',
  },
  gaugeFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 3,
    opacity: 0.4,
  },
  gaugeMarker: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#d4af37',
    marginLeft: -7,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gaugeLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
  },
  displayTextMain: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    paddingVertical: 2,
    letterSpacing: -0.3,
  },
  displayText: {
    fontSize: 15,
    color: '#f1f5f9',
    fontFamily: 'Outfit_600SemiBold',
    paddingVertical: 2,
  },
  displayTextAbout: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  storageCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    marginTop: 8,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  storageIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageInfo: {
    flex: 1,
  },
  storageTitle: {
    fontSize: 15,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  storageStats: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  upgradeBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  upgradeBtnText: {
    color: '#3b82f6',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  storageBarTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  storageBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  storageHint: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
  },
  coverPreviewContainer: {
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  coverPreview: {
    width: '100%',
    height: '100%',
  },
  paginationDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  activeDot: {
    backgroundColor: '#d4af37',
    width: 14,
  },
  emptyCoverPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyCoverText: {
    color: '#475569',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    marginTop: 12,
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addSmallBtnText: {
    color: '#d4af37',
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  imageActionOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  imageActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputHint: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  datePickerBtn: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 4,
  },
  datePickerBtnText: {
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  experienceContainer: {
    marginTop: 4,
  },
  startedHint: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  dropdownBtn: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 4,
  },
  dropdownBtnText: {
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContainer: {
    backgroundColor: '#0f172a',
    width: '85%',
    maxHeight: '70%',
    minHeight: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pickerTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  pickerItemActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
  },
  pickerItemTextActive: {
    color: '#d4af37',
    fontFamily: 'Inter_600SemiBold',
  },
  pickerFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  pickerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  pickerFooterText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'Inter_500Medium',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  manageBtnText: {
    color: '#d4af37',
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
});
