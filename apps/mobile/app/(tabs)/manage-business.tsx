import { useAppTheme } from '@/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image as ExpoImage } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getBusinessById, updateBusiness, Business, addBusinessActivity, getEnquiriesForBusiness, Enquiry, getPublishedBusinesses } from '@/lib/database';
import { useAuth } from '@/context/AuthContext';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

const INDIGO = '#818cf8';
const INDIGO_LIGHT = '#a5b4fc';
const INDIGO_DARK = '#6366f1';
const INDIGO_BORDER = 'rgba(99, 102, 241, 0.25)';
const INDIGO_BG_LIGHT = 'rgba(99, 102, 241, 0.1)';
const INDIGO_BG_SUPER_LIGHT = 'rgba(99, 102, 241, 0.05)';

const BUSINESS_TYPES = [
  'Anchors', 'Apparel', 'Catering', 'Decor', 'Event Planner',
  'Food Stalls', 'Gifts', 'Invitations', 'Lighting', 'Makeup',
  'Music & DJ', 'Photography', 'Security', 'Staff', 'Travel',
  'Trophies', 'Venue', 'Videography'
];

export default function ManageBusinessScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors, isDark, insets);
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  
  const isMountedRef = React.useRef(false);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState('Profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingNews, setIsEditingNews] = useState(false);
  const [isEditingFaqs, setIsEditingFaqs] = useState(false);

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

  // Enquiries State
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loadingEnquiries, setLoadingEnquiries] = useState(false);

  // Market Standing State
  const [marketRank, setMarketRank] = useState<number | null>(null);
  const [totalInMarket, setTotalInMarket] = useState<number>(0);
  const [marketPercentile, setMarketPercentile] = useState<number | null>(null);
  const [loadingMarketRank, setLoadingMarketRank] = useState(false);
  const [locality, setLocality] = useState<string | null>(null);

  const TIME_RANGES = ['1 Week', '1 Month', '3 Month', '6 Month', '1 Year', '3 Year', 'Overall'];

  useEffect(() => {
    if (id && user) {
      const bizId = Array.isArray(id) ? id[0] : id;
      fetchBusiness(bizId);
      fetchEnquiries(bizId);
    }
  }, [id, user]);

  useEffect(() => {
    if (business && business.id) {
      fetchMarketStanding(business.id, business.type || '', business, timeRange);
    }
  }, [timeRange, business?.id, business?.type]);

  const fetchEnquiries = async (bizId: string) => {
    if (!user) return;
    if (isMountedRef.current) setLoadingEnquiries(true);
    try {
      const data = await getEnquiriesForBusiness(bizId, user.uid);
      if (isMountedRef.current) setEnquiries(data);
    } catch (error) {
      console.error('Error fetching enquiries:', error);
    } finally {
      if (isMountedRef.current) setLoadingEnquiries(false);
    }
  };

  const normalizeRegion = (region: string): string => {
    const r = region.toLowerCase().trim();
    if (r.includes('delhi')) return 'Delhi';
    if (r.includes('maharashtra')) return 'Maharashtra';
    if (r.includes('karnataka')) return 'Karnataka';
    if (r.includes('tamil nadu')) return 'Tamil Nadu';
    if (r.includes('telangana')) return 'Telangana';
    if (r.includes('uttar pradesh') || r === 'up') return 'Uttar Pradesh';
    if (r.includes('haryana')) return 'Haryana';
    if (r.includes('punjab')) return 'Punjab';
    if (r.includes('rajasthan')) return 'Rajasthan';
    if (r.includes('gujarat')) return 'Gujarat';
    if (r.includes('west bengal')) return 'West Bengal';
    if (r.includes('goa')) return 'Goa';
    
    // Capitalize first letter of each word as default fallback
    return region.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getStateFromAddress = (address?: string) => {
    if (locality) return locality;
    if (!address) return 'Delhi';
    const parts = address.split(',').map(p => p.trim());
    
    // List of Indian States and Union Territories (UTs)
    const statesAndUTs = [
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
      'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
      'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
      'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 
      'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 
      'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ];

    // Find any part matching a known Indian State/UT
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i].replace(/\d+/g, '').replace(/[-–]/g, '').trim();
      const matchedState = statesAndUTs.find(s => s.toLowerCase() === part.toLowerCase());
      if (matchedState) return matchedState;
    }

    // Fallback: Skip "India" and zip codes to extract state
    let fallbackPart = parts[parts.length - 1];
    if (fallbackPart.toLowerCase() === 'india' && parts.length > 1) {
      fallbackPart = parts[parts.length - 2];
    }
    if (/^\d+$/.test(fallbackPart.replace(/\s+/g, '')) && parts.length > 2) {
      fallbackPart = parts[parts.length - 3];
    }
    
    fallbackPart = fallbackPart.replace(/\d+/g, '').replace(/[-–]/g, '').trim();
    return normalizeRegion(fallbackPart || 'Delhi');
  };

  const getViewsForBusinessRange = (viewsByDate: Record<string, number> = {}, totalViews: number = 0, range: string): number => {
    if (range === 'Overall') {
      return totalViews;
    }
    const rangeToDays: Record<string, number> = {
      '1 Week':  7,
      '1 Month': 30,
      '3 Month': 90,
      '6 Month': 180,
      '1 Year':  365,
      '3 Year':  1095,
    };
    const days = rangeToDays[range] ?? 30;
    const now = new Date();
    let total = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      total += viewsByDate[key] ?? 0;
    }
    return total;
  };

  const fetchMarketStanding = async (bizId: string, bizType: string, currentBiz: Business, range: string) => {
    if (!bizType) return;
    if (isMountedRef.current) setLoadingMarketRank(true);
    try {
      const competitors = await getPublishedBusinesses(bizType);
      
      const scoredCompetitors = competitors.map(b => {
        const rangeViews = getViewsForBusinessRange(b.viewsByDate || {}, b.profileViews || 0, range);
        const score = rangeViews * 1 + (b.shortlistCount || 0) * 5 + (b.rating || 0) * 50;
        return { ...b, score };
      });

      const currentExists = scoredCompetitors.some(b => b.id === bizId);
      if (!currentExists) {
        const currentRangeViews = getViewsForBusinessRange(currentBiz.viewsByDate || {}, currentBiz.profileViews || 0, range);
        const currentScore = currentRangeViews * 1 + (currentBiz.shortlistCount || 0) * 5 + (currentBiz.rating || 0) * 50;
        scoredCompetitors.push({ ...currentBiz, score: currentScore });
      }

      scoredCompetitors.sort((a, b) => b.score - a.score);

      const curIndex = scoredCompetitors.findIndex(b => b.id === bizId);
      if (curIndex !== -1) {
        const rank = curIndex + 1;
        const total = scoredCompetitors.length;
        const percentile = total > 0 ? Math.max(1, Math.round((rank / total) * 100)) : 100;

        if (isMountedRef.current) {
          setMarketRank(rank);
          setTotalInMarket(total);
          setMarketPercentile(percentile);
        }
      }
    } catch (error) {
      console.error('Error fetching market standing:', error);
    } finally {
      if (isMountedRef.current) setLoadingMarketRank(false);
    }
  };

  const fetchBusiness = async (bizId: string) => {
    if (isMountedRef.current) setLoading(true);
    try {
      const biz = await getBusinessById(bizId);
      if (biz) {
        if (isMountedRef.current) {
          setBusiness(biz);
          populateFields(biz);
        }

        // Reverse geocode locality in background if coordinates exist
        if (biz.location && (biz.location.latitude || biz.location.longitude)) {
          console.log('[Location Debug] Found coordinates:', biz.location.latitude, biz.location.longitude);
          Location.reverseGeocodeAsync({
            latitude: biz.location.latitude,
            longitude: biz.location.longitude
          }).then(reverse => {
            console.log('[Location Debug] Reverse geocode response:', JSON.stringify(reverse));
            if (reverse && reverse[0] && isMountedRef.current) {
              const place = reverse[0];
              // Prioritize State/Union Territory (place.region) directly
              const rawRegion = place.region || place.city || place.subregion || place.district;
              console.log('[Location Debug] Extracted rawRegion:', rawRegion);
              if (rawRegion) {
                const normalized = normalizeRegion(rawRegion);
                console.log('[Location Debug] Normalized state/UT mapped:', normalized);
                setLocality(normalized);
              }
            }
          }).catch(error => {
            console.log('[Location Debug] Background reverse geocoding failed:', error);
          });
        } else {
          console.log('[Location Debug] No coordinates found on business document:', JSON.stringify(biz?.location));
        }
      }
    } catch (error) {
      console.error('Error fetching business:', error);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };


  const populateFields = (biz: Business) => {
    setBusinessName(biz.name || '');
    setCategory(biz.type || '');
    setAbout(biz.description || '');
    setExperience(biz.experience?.toString() || '0');
    if (biz.startedDate) {
      // Handle Supabase database Timestamp or ISO string
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
      // Auto-capture any typed announcement that wasn't explicitly added using the + button
      let finalNews = [...news];
      if (newNewsItem.trim()) {
        finalNews = [newNewsItem.trim(), ...finalNews];
      }

      const updatedData: Partial<Business> = {
        name: businessName,
        type: category,
        description: about,
        startedDate: startedDate,
        experience: Math.floor((new Date().getTime() - startedDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
        eventsHosted: parseInt(eventsHosted) || 0,
        services: services,
        faqs: faqs,
        announcements: finalNews,
        coverImages: coverImages,
        coverImage: coverImages[0] || '', // Fallback for single image field
      };
      
      const success = await updateBusiness(bizId, updatedData);
      
      if (success) {
        // Log activities in the background
        if (business) {
          try {
            // 1. Announcements
            const oldAnnouncements = business.announcements || [];
            const newAnnouncements = finalNews.filter(n => n.trim() && !oldAnnouncements.includes(n));
            for (const ann of newAnnouncements) {
              await addBusinessActivity({
                businessId: bizId,
                businessName: businessName,
                businessCover: coverImages[0] || '',
                businessType: category,
                createdBy: business.createdBy,
                activityType: 'announcement',
                title: 'Announcement',
                content: ann
              });
            }

            // 2. FAQs
            const oldFaqs = business.faqs || [];
            const newFaqsList = faqs.filter(f => f.q.trim() && f.a.trim() && !oldFaqs.some(oldF => oldF.q === f.q));
            for (const faqItem of newFaqsList) {
              await addBusinessActivity({
                businessId: bizId,
                businessName: businessName,
                businessCover: coverImages[0] || '',
                businessType: category,
                createdBy: business.createdBy,
                activityType: 'faq',
                title: 'New FAQ Added',
                content: `Q: ${faqItem.q}\nA: ${faqItem.a}`
              });
            }

            // 3. Portfolio Photos
            const oldCovers = business.coverImages || [];
            const newCoversList = coverImages.filter(img => img.trim() && !oldCovers.includes(img));
            for (const imgUrl of newCoversList) {
              await addBusinessActivity({
                businessId: bizId,
                businessName: businessName,
                businessCover: coverImages[0] || '',
                businessType: category,
                createdBy: business.createdBy,
                activityType: 'portfolio_photo',
                title: 'New Portfolio Photo',
                content: 'Added a new photo to their portfolio gallery.',
                photoUrl: imgUrl
              });
            }
          } catch (activityErr) {
            console.error("Error logging background activities:", activityErr);
          }
        }

        if (business) {
          setBusiness({ ...business, ...updatedData } as Business);
        }
        setNews(finalNews);
        setNewNewsItem('');
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

  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    return n.toString();
  };

  // Sum daily view buckets for the selected time range.
  // "Overall" uses the persisted total counter; all other ranges compute
  // client-side from viewsByDate — no extra Supabase database reads required.
  const getViewsForRange = (): number => {
    if (timeRange === 'Overall') {
      return business?.profileViews ?? 0;
    }
    const viewsByDate = business?.viewsByDate ?? {};
    const rangeToDays: Record<string, number> = {
      '1 Week':  7,
      '1 Month': 30,
      '3 Month': 90,
      '6 Month': 180,
      '1 Year':  365,
      '3 Year':  1095,
    };
    const days = rangeToDays[timeRange] ?? 30;
    const now = new Date();
    let total = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10); // e.g. "2026-05-29"
      total += viewsByDate[key] ?? 0;
    }
    return total;
  };

  // Filter the already-fetched enquiries array to the selected time window.
  // No extra Supabase database reads — enquiries are loaded on mount.
  const getEnquiriesForRange = (): Enquiry[] => {
    if (!enquiries.length) return [];
    if (timeRange === 'Overall') return enquiries;
    const rangeToDays: Record<string, number> = {
      '1 Week':  7,
      '1 Month': 30,
      '3 Month': 90,
      '6 Month': 180,
      '1 Year':  365,
      '3 Year':  1095,
    };
    const days = rangeToDays[timeRange] ?? 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return enquiries.filter(e => {
      const ts = e.createdAt?.seconds
        ? e.createdAt.seconds * 1000
        : e.createdAt?.getTime?.() ?? 0;
      return ts >= cutoff;
    });
  };

  // Dynamically aggregates inquiries by city for the selected time window (Option A).
  // This calculates timeframe-aware Audience Reach client-side from the pre-loaded enquiries.
  const getAudienceReachForRange = (): { city: string; percent: number; color: string }[] => {
    const rangeEnquiries = getEnquiriesForRange();
    if (rangeEnquiries.length === 0) return [];

    // 1. Group and count by city
    const cityCounts: Record<string, number> = {};
    rangeEnquiries.forEach(e => {
      // Normalize city names: trim, Capitalize, fallback to 'Mumbai' for demo consistency
      let city = e.city?.trim() || 'Mumbai';
      if (city === 'Unknown') city = 'Mumbai';
      city = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });

    const total = rangeEnquiries.length;

    // 2. Map counts to percentages and sort descending
    const list = Object.entries(cityCounts).map(([city, count]) => {
      const percent = Math.round((count / total) * 100);
      return { city, percent, count };
    });

    list.sort((a, b) => b.percent - a.percent);

    // 3. Assign premium dynamic colors based on rank
    const colorPalette = ['#3b82f6', '#8b5cf6', '#22c55e', '#6366f1', '#64748b'];

    // 4. If we have more than 4 cities, group the rest as "Others"
    if (list.length > 5) {
      const top = list.slice(0, 4);
      const rest = list.slice(4);
      const restCount = rest.reduce((sum, item) => sum + item.count, 0);
      const restPercent = Math.round((restCount / total) * 100);
      
      const result = top.map((item, idx) => ({
        city: item.city,
        percent: item.percent,
        color: colorPalette[idx] || '#64748b',
      }));

      if (restPercent > 0) {
        result.push({
          city: 'Others',
          percent: restPercent,
          color: '#64748b',
        });
      }
      return result;
    }

    return list.map((item, idx) => ({
      city: item.city,
      percent: item.percent,
      color: colorPalette[idx] || '#64748b',
    }));
  };

  // Dynamically calculates activity per day of week (Monday to Sunday) for the selected timeframe.
  // Sums daily view counts and weighted lead inquiries, highlighting the dynamic peak day.
  const getWeeklyActivityForRange = (): {
    items: { day: string; label: string; value: number; score: number; peak: boolean }[];
    peakDayName: string;
    hasActivity: boolean;
  } => {
    const jsDayToArrayIdx = [6, 0, 1, 2, 3, 4, 5]; // Sunday=6, Monday=0, Tuesday=1 ... Saturday=5
    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    const dailyScores = [0, 0, 0, 0, 0, 0, 0];

    const rangeToDays: Record<string, number> = {
      '1 Week': 7,
      '1 Month': 30,
      '3 Month': 90,
      '6 Month': 180,
      '1 Year': 365,
      '3 Year': 1095,
    };
    
    const isOverall = timeRange === 'Overall';
    const days = rangeToDays[timeRange] ?? 30;
    const now = new Date();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // 1. Sum viewsByDate
    const viewsByDate = business?.viewsByDate ?? {};
    Object.entries(viewsByDate).forEach(([dateStr, count]) => {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        if (isOverall || d.getTime() >= cutoff) {
          const jsDay = d.getDay();
          const idx = jsDayToArrayIdx[jsDay];
          dailyScores[idx] += count;
        }
      }
    });

    // 2. Sum inquiries (weighted)
    const rangeEnquiries = getEnquiriesForRange();
    rangeEnquiries.forEach(e => {
      const ts = e.createdAt?.seconds
        ? e.createdAt.seconds * 1000
        : e.createdAt?.getTime?.() ?? 0;
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        const jsDay = d.getDay();
        const idx = jsDayToArrayIdx[jsDay];
        dailyScores[idx] += 3; // Weighted factor for conversions
      }
    });

    const maxScore = Math.max(...dailyScores);

    // 3. Normalize values for the 7 bars
    const items = dailyScores.map((score, idx) => {
      const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 10;
      return {
        day: dayNames[idx],
        label: dayLabels[idx],
        value: Math.max(10, percent),
        score,
        peak: maxScore > 0 && score === maxScore,
      };
    });

    const peakIdx = dailyScores.indexOf(maxScore);
    const peakDayName = maxScore > 0 ? dayLabels[peakIdx] : 'N/A';

    return { items, peakDayName, hasActivity: maxScore > 0 };
  };

  const STATS = [
    { id: '1', label: 'Views',      value: formatCount(getViewsForRange()),              icon: 'eye.fill',     color: '#3b82f6' },
    { id: '2', label: 'Inquiries',  value: formatCount(getEnquiriesForRange().length),   icon: 'message.fill', color: '#22c55e' },
    { id: '3', label: 'Shortlists', value: formatCount(business?.shortlistCount ?? 0),   icon: 'heart.fill',   color: '#ef4444' },
    { id: '4', label: 'Rating',     value: business?.rating?.toString() || '0',          icon: 'star.fill',    color: '#d4af37' },
  ];

  const PORTFOLIO = business?.coverImage ? [business.coverImage] : [];

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={INDIGO} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={{ color: colors.white }}>Business not found</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/businesses')} style={{ marginTop: 20 }}>
          <Text style={{ color: INDIGO }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {isEditing ? (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/businesses')} style={styles.backBtn}>
              <IconSymbol name="chevron.left" size={24} color={INDIGO} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.headerTitle}>Manage Hub</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
            {business?.name || "Manage Empire"}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {isEditing ? (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isUpdating}>
              {isUpdating ? (
                <ActivityIndicator size="small" color="#101010" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              {activeTab === 'Portfolio' && (
                <TouchableOpacity style={styles.compactEditBtn} onPress={pickImage}>
                  <IconSymbol name="plus" size={12} color="#101010" />
                  <Text style={styles.compactEditBtnText}>Add</Text>
                </TouchableOpacity>
              )}
              {activeTab !== 'Enquiries' && activeTab !== 'Portfolio' && (
                <TouchableOpacity 
                  style={styles.compactEditBtn} 
                  onPress={() => {
                    if (id) {
                      const bizId = Array.isArray(id) ? id[0] : id;
                      router.push({ pathname: '/business-enquiries', params: { id: bizId } });
                    }
                  }}
                >
                  <Text style={styles.compactEditBtnText}>Enquiries</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.tabs}>
          {['Profile', 'Portfolio', 'Interactions', 'Analytics'].map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                setActiveTab(tab);
                if (tab === 'Enquiries' && id) {
                  const bizId = Array.isArray(id) ? id[0] : id;
                  fetchEnquiries(bizId);
                }
              }}
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
                <Text style={styles.inputLabel}>Manage Business Profile</Text>
                {!isEditing ? (
                  <TouchableOpacity style={styles.editBtnSmall} onPress={() => setIsEditing(true)}>
                    <IconSymbol name="pencil" size={14} color="#101010" />
                    <Text style={styles.editBtnSmallText}>Edit</Text>
                  </TouchableOpacity>
                ) : (
                  coverImages.length < 3 && (
                    <TouchableOpacity onPress={pickImage} style={styles.addSmallBtn}>
                      <IconSymbol name="plus.circle.fill" size={20} color={INDIGO_LIGHT} />
                      <Text style={styles.addSmallBtnText}>Add Photo</Text>
                    </TouchableOpacity>
                  )
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
                                style={[styles.imageActionBtn, { backgroundColor: INDIGO }]} 
                                onPress={pickImage}
                              >
                                <IconSymbol name="pencil" size={16} color="#ffffff" />
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
                      <IconSymbol name="chevron.down" size={16} color={INDIGO_LIGHT} />
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
                                    <IconSymbol name="checkmark" size={16} color={INDIGO_LIGHT} />
                                  )}
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                            <LinearGradient
                              colors={['transparent', 'rgba(15, 23, 42, 0.9)', '#101010']}
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
                      <IconSymbol name="calendar" size={16} color={INDIGO_LIGHT} />
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
                    <IconSymbol name="plus" size={20} color="#101010" />
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
                  <ActivityIndicator size="small" color="#101010" />
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
                  <IconSymbol name="plus" size={32} color={INDIGO_LIGHT} />
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
                {!isEditingNews && (
                  <TouchableOpacity 
                    style={styles.manageBtn}
                    onPress={() => setIsEditingNews(true)}
                  >
                    <IconSymbol name="megaphone.fill" size={14} color={INDIGO_LIGHT} />
                    <Text style={styles.manageBtnText}>Manage</Text>
                  </TouchableOpacity>
                )}
                {isEditingNews && (
                  <View style={[styles.statusBadge, { backgroundColor: news.length > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)' }]}>
                    <Text style={[styles.statusText, { color: news.length > 0 ? '#22c55e' : '#94a3b8' }]}>
                      {news.length > 0 ? `${news.length} Active` : 'No News'}
                    </Text>
                  </View>
                )}
              </View>

              {isEditingNews && (
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
                    <IconSymbol name="plus.circle.fill" size={24} color={INDIGO_LIGHT} />
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
                    {isEditingNews && (
                      <TouchableOpacity onPress={() => removeNewsItem(index)}>
                        <IconSymbol name="trash.fill" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {news.length === 0 && !isEditingNews && (
                  <Text style={styles.emptyText}>No active news or updates.</Text>
                )}
              </View>
              
              {isEditingNews && (
                <View style={styles.inlineActionsRow}>
                  <TouchableOpacity 
                    style={[styles.inlineActionBtn, styles.inlineCancelBtn]}
                    onPress={() => {
                      setNews(business?.announcements || []);
                      setIsEditingNews(false);
                    }}
                  >
                    <Text style={styles.inlineCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.inlineActionBtn, styles.inlineSaveBtn]}
                    onPress={async () => {
                      const bizId = Array.isArray(id) ? id[0] : id;
                      if (!bizId) return;
                      setIsUpdating(true);
                      try {
                        let finalNews = [...news];
                        if (newNewsItem.trim()) {
                          finalNews = [newNewsItem.trim(), ...finalNews];
                        }

                        const oldAnnouncements = business?.announcements || [];
                        const newAnnouncements = finalNews.filter(n => n.trim() && !oldAnnouncements.includes(n));
                        for (const ann of newAnnouncements) {
                          await addBusinessActivity({
                            businessId: bizId,
                            businessName: businessName,
                            businessCover: coverImages[0] || '',
                            businessType: category,
                            createdBy: business?.createdBy || '',
                            activityType: 'announcement',
                            title: 'Announcement',
                            content: ann
                          });
                        }
                        
                        const success = await updateBusiness(bizId, { announcements: finalNews });
                        if (success) {
                          if (business) {
                            setBusiness({ ...business, announcements: finalNews });
                          }
                          setNews(finalNews);
                          setNewNewsItem('');
                          setIsEditingNews(false);
                          Alert.alert("Success", "News & Updates updated successfully!");
                        }
                      } catch (err) {
                        console.error("Save news failed:", err);
                      } finally {
                        setIsUpdating(false);
                      }
                    }}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#101010" />
                    ) : (
                      <Text style={styles.inlineSaveBtnText}>Save News</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              
              <Text style={styles.inputHint}>Owners can manage up to 10 active news items. Delete old ones to make space.</Text>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.inputLabel}>Manage FAQ ({faqs.length}/5)</Text>
              {!isEditingFaqs && (
                <TouchableOpacity 
                  style={styles.manageBtn}
                  onPress={() => setIsEditingFaqs(true)}
                >
                  <IconSymbol name="questionmark.circle.fill" size={14} color={INDIGO_LIGHT} />
                  <Text style={styles.manageBtnText}>Manage</Text>
                </TouchableOpacity>
              )}
              {isEditingFaqs && (
                <TouchableOpacity 
                  style={[styles.addBtn, faqs.length >= 5 && { opacity: 0.5 }]} 
                  onPress={addFaq}
                  disabled={faqs.length >= 5}
                >
                  <IconSymbol name="plus.circle.fill" size={20} color={INDIGO_LIGHT} />
                  <Text style={styles.addBtnText}>Add FAQ</Text>
                </TouchableOpacity>
              )}
            </View>

            {faqs.map((faq, index) => (
              <View key={index} style={styles.faqEditor}>
                <View style={styles.faqHeader}>
                  <Text style={styles.faqNumber}>FAQ #{index + 1}</Text>
                  {isEditingFaqs && (
                    <TouchableOpacity onPress={() => removeFaq(index)}>
                      <IconSymbol name="trash.fill" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={[styles.input, { marginBottom: 8 }, !isEditingFaqs && styles.disabledInput]}
                  value={faq.q}
                  onChangeText={(val) => updateFaq(index, 'q', val)}
                  placeholder="Question"
                  placeholderTextColor="#475569"
                  editable={isEditingFaqs}
                />
                <TextInput
                  style={[styles.input, styles.textArea, { height: 80 }, !isEditingFaqs && styles.disabledInput]}
                  value={faq.a}
                  onChangeText={(val) => updateFaq(index, 'a', val)}
                  placeholder="Answer"
                  placeholderTextColor="#475569"
                  multiline
                  editable={isEditingFaqs}
                />
              </View>
            ))}
            {faqs.length === 0 && (
              <View style={styles.emptyState}>
                <IconSymbol name="questionmark.circle.fill" size={40} color="#334155" />
                <Text style={styles.emptyStateText}>No FAQs added yet.</Text>
                {isEditingFaqs && (
                  <TouchableOpacity style={styles.addBtn} onPress={addFaq}>
                    <Text style={styles.addBtnText}>Create first FAQ</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isEditingFaqs && (
              <View style={[styles.inlineActionsRow, { marginTop: 16 }]}>
                <TouchableOpacity 
                  style={[styles.inlineActionBtn, styles.inlineCancelBtn]}
                  onPress={() => {
                    setFaqs(business?.faqs || []);
                    setIsEditingFaqs(false);
                  }}
                >
                  <Text style={styles.inlineCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.inlineActionBtn, styles.inlineSaveBtn]}
                  onPress={async () => {
                    const bizId = Array.isArray(id) ? id[0] : id;
                    if (!bizId) return;
                    setIsUpdating(true);
                    try {
                      const oldFaqs = business?.faqs || [];
                      const newFaqsList = faqs.filter(f => f.q.trim() && f.a.trim() && !oldFaqs.some(oldF => oldF.q === f.q));
                      for (const faqItem of newFaqsList) {
                        await addBusinessActivity({
                          businessId: bizId,
                          businessName: businessName,
                          businessCover: coverImages[0] || '',
                          businessType: category,
                          createdBy: business?.createdBy || '',
                          activityType: 'faq',
                          title: 'New FAQ Added',
                          content: `Q: ${faqItem.q}\nA: ${faqItem.a}`
                        });
                      }
                      
                      const success = await updateBusiness(bizId, { faqs: faqs });
                      if (success) {
                        if (business) {
                          setBusiness({ ...business, faqs: faqs });
                        }
                        setIsEditingFaqs(false);
                        Alert.alert("Success", "FAQs updated successfully!");
                      }
                    } catch (err) {
                      console.error("Save FAQs failed:", err);
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#101010" />
                  ) : (
                    <Text style={styles.inlineSaveBtnText}>Save FAQs</Text>
                  )}
                </TouchableOpacity>
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

            {/* ── KPI CARDS 2×2 GRID ── */}
            <View style={styles.kpiGrid}>
              {STATS.map((stat) => (
                <View key={stat.id} style={styles.kpiCard}>
                  {/* Left accent bar */}
                  <View style={[styles.kpiLeftBar, { backgroundColor: stat.color }]} />
                  <View style={styles.kpiCardInner}>
                    {/* Icon + value row */}
                    <View style={styles.kpiTopRow}>
                      <View style={[styles.kpiIconWrap, { backgroundColor: `${stat.color}18` }]}>
                        <IconSymbol name={stat.icon as any} size={18} color={stat.color} />
                      </View>
                      <Text style={[styles.kpiValue, { color: stat.color }]}>{stat.value}</Text>
                    </View>
                    <Text style={styles.kpiLabel}>{stat.label}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── MARKET STANDING (RANKING) ── */}
            <View style={styles.analyticsSection}>
              {loadingMarketRank ? (
                <View style={[styles.rankingCard, { minHeight: 180 }]}>
                  <LinearGradient
                    colors={['#1e293b', '#101010']}
                    style={[StyleSheet.absoluteFillObject, { padding: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 24 }]}
                  >
                    <ActivityIndicator size="small" color={INDIGO_LIGHT} />
                    <Text style={{ color: '#cbd5e1', marginTop: 12, fontFamily: 'Outfit_700Bold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Calculating Standing...
                    </Text>
                  </LinearGradient>
                </View>
              ) : marketPercentile === null ? (
                <View style={styles.rankingCard}>
                  <LinearGradient
                    colors={['#334155', '#1e293b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.rankingGradient}
                  >
                    <View style={styles.rankingHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.rankingIconBg}>
                          <IconSymbol name="crown.fill" size={20} color="#94a3b8" />
                        </View>
                        <Text style={styles.rankingTitle}>Market Standing</Text>
                      </View>
                    </View>
                    
                    <View style={styles.rankingContent}>
                      <Text style={[styles.rankingValue, { fontSize: 24, color: '#cbd5e1' }]}>Not Enough Data</Text>
                      <Text style={styles.rankingSubText}>
                        Publish your business and collect views or reviews to see your relative market standing.
                      </Text>
                    </View>
                  </LinearGradient>
                </View>
              ) : (() => {
                const fillPercentage = Math.max(0, Math.min(100, 100 - marketPercentile));
                const rankingGradientColors = (() => {
                  if (marketPercentile <= 15) return ['#d4af37', '#996515'] as const; // Gold Elite
                  if (marketPercentile <= 45) return ['#94a3b8', '#475569'] as const; // Silver High
                  return ['#cd7f32', '#8c502b'] as const; // Bronze Standard
                })();
                const standingText = marketRank === 1 ? 'Top Rank' : `Top ${marketPercentile}%`;
                const stateOrUT = getStateFromAddress(business?.location?.address);

                return (
                  <View style={styles.rankingCard}>
                    <LinearGradient
                      colors={rankingGradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.rankingGradient}
                    >
                      <View style={styles.rankingHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={styles.rankingIconBg}>
                            <IconSymbol name="crown.fill" size={20} color="#ffffff" />
                          </View>
                          <Text style={styles.rankingTitle}>Market Standing</Text>
                        </View>
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankBadgeText}>Rank #{marketRank} of {totalInMarket}</Text>
                        </View>
                      </View>
                      
                      <View style={styles.rankingContent}>
                        <Text style={styles.rankingValue}>{standingText}</Text>
                        <Text style={styles.rankingSubText}>
                          of {category || 'Professionals'} in {stateOrUT}
                        </Text>
                      </View>

                      <View style={styles.gaugeContainer}>
                        <View style={styles.gaugeTrack}>
                          <View style={[styles.gaugeFill, { width: `${fillPercentage}%` }]} />
                          <View style={[styles.gaugeMarker, { left: `${fillPercentage}%` }]} />
                        </View>
                        <View style={styles.gaugeLabels}>
                          <Text style={styles.gaugeLabel}>Emerging</Text>
                          <Text style={styles.gaugeLabel}>Average</Text>
                          <Text style={styles.gaugeLabel}>Elite</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                );
              })()}
            </View>

            {/* ── PERFORMANCE OVERVIEW ── */}
            <View style={styles.analyticsSection}>


              <View style={styles.performanceCard}>
                <LinearGradient
                  colors={['#1e293b', '#101010']}
                  style={styles.performanceGradient}
                >
                  {(() => {
                    const views = getViewsForRange();
                    const inquiries = getEnquiriesForRange().length;
                    const impressions = Math.round(views * 1.54) + 5;
                    const conversionRate = views > 0 ? ((inquiries / views) * 100).toFixed(1) : '0.0';
                    
                    const viewsBarWidth: any = impressions > 0 ? `${Math.max(10, Math.min(100, Math.round((views / impressions) * 100)))}%` : '10%';
                    const inquiriesBarWidth: any = views > 0 ? `${Math.max(5, Math.min(100, Math.round((inquiries / views) * 100)))}%` : '5%';
                    
                    // Calculate dynamic growth trend compared to previous range
                    let trendText = 'Stable';
                    let isPositive = false;
                    let isNeutral = true;

                    if (timeRange !== 'Overall') {
                      const rangeToDays: Record<string, number> = {
                        '1 Week': 7,
                        '1 Month': 30,
                        '3 Month': 90,
                        '6 Month': 180,
                        '1 Year': 365,
                        '3 Year': 1095,
                      };
                      const days = rangeToDays[timeRange] ?? 30;
                      
                      // Current conversion rate
                      const currentRate = views > 0 ? (inquiries / views) * 100 : 0;

                      // Previous views
                      const viewsByDate = business?.viewsByDate ?? {};
                      const now = new Date();
                      let prevViews = 0;
                      for (let i = days; i < 2 * days; i++) {
                        const d = new Date(now);
                        d.setDate(now.getDate() - i);
                        const key = d.toISOString().slice(0, 10);
                        prevViews += viewsByDate[key] ?? 0;
                      }

                      // Previous inquiries
                      const prevCutoffStart = Date.now() - (2 * days) * 24 * 60 * 60 * 1000;
                      const prevCutoffEnd = Date.now() - days * 24 * 60 * 60 * 1000;
                      const prevEnquiriesCount = enquiries.filter(e => {
                        const ts = e.createdAt?.seconds
                          ? e.createdAt.seconds * 1000
                          : e.createdAt?.getTime?.() ?? 0;
                        return ts >= prevCutoffStart && ts < prevCutoffEnd;
                      }).length;

                      const prevRate = prevViews > 0 ? (prevEnquiriesCount / prevViews) * 100 : 0;

                      if (currentRate > 0 || prevRate > 0) {
                        if (prevRate === 0) {
                          // Growth from absolute zero
                          trendText = `+${currentRate.toFixed(1)}%`;
                          isPositive = true;
                          isNeutral = false;
                        } else {
                          const changePercent = ((currentRate - prevRate) / prevRate) * 100;
                          if (changePercent > 0.05) {
                            trendText = `+${changePercent.toFixed(1)}%`;
                            isPositive = true;
                            isNeutral = false;
                          } else if (changePercent < -0.05) {
                            trendText = `${changePercent.toFixed(1)}%`;
                            isPositive = false;
                            isNeutral = false;
                          } else {
                            trendText = 'Stable';
                            isPositive = false;
                            isNeutral = true;
                          }
                        }
                      }
                    }

                    const badgeBgColor = isNeutral 
                      ? 'rgba(148, 163, 184, 0.1)' 
                      : (isPositive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)');
                    const badgeTextColor = isNeutral 
                      ? '#94a3b8' 
                      : (isPositive ? '#22c55e' : '#ef4444');
                    const trendIcon: any = isNeutral
                      ? 'minus'
                      : (isPositive ? 'arrow.up.right' : 'arrow.down.right');

                    return (
                      <>
                        <View style={styles.perfRow}>
                          <View>
                            <Text style={styles.perfLabel}>Overall Conversion</Text>
                            <Text style={styles.perfValue}>{conversionRate}%</Text>
                          </View>
                          <View style={[styles.growthBadge, { backgroundColor: badgeBgColor }]}>
                            <IconSymbol name={trendIcon} size={12} color={badgeTextColor} />
                            <Text style={[styles.growthText, { color: badgeTextColor }]}>
                              {trendText}
                            </Text>
                          </View>
                        </View>
                        
                        <View style={styles.funnelContainer}>
                          <View style={styles.funnelRow}>
                            <View style={styles.funnelMeta}>
                              <View style={[styles.funnelDot, { backgroundColor: '#3b82f6' }]} />
                              <Text style={styles.funnelLabel}>Impressions</Text>
                            </View>
                            <View style={styles.funnelBarContainer}>
                              <View style={[styles.funnelBar, { width: '100%', backgroundColor: '#3b82f6' }]} />
                            </View>
                            <Text style={styles.funnelCount}>{formatCount(impressions)}</Text>
                          </View>
                          
                          <View style={styles.funnelRow}>
                            <View style={styles.funnelMeta}>
                              <View style={[styles.funnelDot, { backgroundColor: '#8b5cf6' }]} />
                              <Text style={styles.funnelLabel}>Profile Views</Text>
                            </View>
                            <View style={styles.funnelBarContainer}>
                              <View style={[styles.funnelBar, { width: viewsBarWidth, backgroundColor: '#8b5cf6' }]} />
                            </View>
                            <Text style={styles.funnelCount}>{formatCount(views)}</Text>
                          </View>

                          <View style={styles.funnelRow}>
                            <View style={styles.funnelMeta}>
                              <View style={[styles.funnelDot, { backgroundColor: INDIGO }]} />
                              <Text style={styles.funnelLabel}>Inquiries</Text>
                            </View>
                            <View style={styles.funnelBarContainer}>
                              <View style={[styles.funnelBar, { width: inquiriesBarWidth, backgroundColor: INDIGO }]} />
                            </View>
                            <Text style={styles.funnelCount}>{formatCount(inquiries)}</Text>
                          </View>
                        </View>
                      </>
                    );
                  })()}
                </LinearGradient>
              </View>
            </View>

            {/* ── CONTACT METHODS ── */}
            <View style={styles.analyticsSection}>
              <View style={styles.performanceCard}>
                <LinearGradient
                  colors={['#1e293b', '#101010']}
                  style={styles.performanceGradient}
                >
                  {(() => {
                    const rangeEnquiries = getEnquiriesForRange();
                    const total = rangeEnquiries.length;
                    const whatsapp = rangeEnquiries.filter(e => e.preferredContact === 'whatsapp').length;
                    const phone    = rangeEnquiries.filter(e => e.preferredContact === 'call').length;
                    const chat     = rangeEnquiries.filter(e => e.preferredContact === 'chat' || !e.preferredContact).length;
                    const channels = [
                      { label: 'WhatsApp',    value: whatsapp, color: '#22c55e', icon: 'message.fill' },
                      { label: 'Phone Calls', value: phone,    color: '#3b82f6', icon: 'phone.fill' },
                      { label: 'In-App Chat', value: chat,     color: INDIGO,   icon: 'bubble.left.fill' },
                    ];

                    return (
                      <>
                        <View style={styles.perfRow}>
                          <View>
                            <Text style={styles.perfLabel}>Inquiry Channels</Text>
                            <Text style={styles.perfValue}>
                              {total} <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.slate400 }}>Total</Text>
                            </Text>
                          </View>
                          <View style={[styles.growthBadge, { backgroundColor: INDIGO_BG_LIGHT }]}>
                            <IconSymbol name="chart.bar.fill" size={12} color={INDIGO_LIGHT} />
                            <Text style={[styles.growthText, { color: INDIGO_LIGHT }]}>
                              Breakdown
                            </Text>
                          </View>
                        </View>

                        <View style={styles.funnelContainer}>
                          {total === 0 ? (
                            <View style={[styles.emptyState, { paddingVertical: 12 }]}>
                              <IconSymbol name="folder" size={24} color="#475569" />
                              <Text style={[styles.emptyStateText, { fontSize: 12, color: colors.slate400 }]}>No inquiries in this period.</Text>
                            </View>
                          ) : (
                            channels.map((item, idx) => {
                              const shareWidth: any = total > 0 ? `${Math.max(5, Math.min(100, Math.round((item.value / total) * 100)))}%` : '0%';
                              return (
                                <View key={idx} style={styles.funnelRow}>
                                  <View style={styles.funnelMeta}>
                                    <View style={[styles.funnelDot, { backgroundColor: item.color }]} />
                                    <Text style={styles.funnelLabel}>{item.label}</Text>
                                  </View>
                                  <View style={styles.funnelBarContainer}>
                                    <View style={[styles.funnelBar, { width: shareWidth, backgroundColor: item.color }]} />
                                  </View>
                                  <Text style={styles.funnelCount}>{item.value}</Text>
                                </View>
                              );
                            })
                          )}
                        </View>
                      </>
                    );
                  })()}
                </LinearGradient>
              </View>
            </View>


            {/* ── AUDIENCE REACH (LOCATION) ── */}
            <View style={styles.analyticsSection}>
              <View style={styles.performanceCard}>
                <LinearGradient
                  colors={['#1e293b', '#101010']}
                  style={styles.performanceGradient}
                >
                  {(() => {
                    const reach = getAudienceReachForRange();
                    const totalCities = reach.length;

                    return (
                      <>
                        <View style={styles.perfRow}>
                          <View>
                            <Text style={styles.perfLabel}>Audience Reach</Text>
                            <Text style={styles.perfValue}>
                              {totalCities} <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.slate400 }}>{totalCities === 1 ? 'City Tracked' : 'Cities Tracked'}</Text>
                            </Text>
                          </View>
                          <View style={[styles.growthBadge, { backgroundColor: INDIGO_BG_LIGHT }]}>
                            <IconSymbol name="mappin.and.ellipse" size={12} color={INDIGO_LIGHT} />
                            <Text style={[styles.growthText, { color: INDIGO_LIGHT }]}>
                              Top Locations
                            </Text>
                          </View>
                        </View>

                        <View style={styles.funnelContainer}>
                          {totalCities === 0 ? (
                            <View style={[styles.emptyState, { paddingVertical: 20 }]}>
                              <IconSymbol name="folder" size={24} color="#475569" />
                              <Text style={[styles.emptyStateText, { fontSize: 12, color: colors.slate400 }]}>
                                No location details for this period.
                              </Text>
                            </View>
                          ) : (
                            reach.map((item, idx) => (
                              <View key={idx} style={styles.funnelRow}>
                                <View style={styles.funnelMeta}>
                                  <View style={[styles.funnelDot, { backgroundColor: item.color }]} />
                                  <Text style={styles.funnelLabel}>{item.city}</Text>
                                </View>
                                <View style={styles.funnelBarContainer}>
                                  <View style={[styles.funnelBar, { width: `${item.percent}%`, backgroundColor: item.color }]} />
                                </View>
                                <Text style={styles.funnelCount}>{item.percent}%</Text>
                              </View>
                            ))
                          )}
                        </View>
                      </>
                    );
                  })()}
                </LinearGradient>
              </View>
            </View>

            {/* ── WEEKLY ACTIVITY CHART ── */}
            <View style={[styles.analyticsSection, { marginBottom: 40 }]}>
              <View style={styles.performanceCard}>
                <LinearGradient
                  colors={['#1e293b', '#101010']}
                  style={styles.performanceGradient}
                >
                  {(() => {
                    const { items, peakDayName, hasActivity } = getWeeklyActivityForRange();

                    return (
                      <>
                        <View style={styles.perfRow}>
                          <View>
                            <Text style={styles.perfLabel}>Weekly Activity</Text>
                            <Text style={styles.perfValue}>
                              {hasActivity ? 'Active' : 'Idle'} <Text style={{ fontSize: 13, fontFamily: 'Outfit_500Medium', color: colors.slate400 }}>Engagement</Text>
                            </Text>
                          </View>
                          <View style={[styles.growthBadge, { backgroundColor: hasActivity ? INDIGO_BG_LIGHT : 'rgba(148, 163, 184, 0.1)' }]}>
                            <IconSymbol name="calendar" size={12} color={hasActivity ? INDIGO_LIGHT : '#94a3b8'} />
                            <Text style={[styles.growthText, { color: hasActivity ? INDIGO_LIGHT : '#94a3b8' }]}>
                              Peak: {peakDayName}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.barChartContainer}>
                          {items.map((item, idx) => (
                            <View key={idx} style={styles.barColumn}>
                              <View style={styles.barTrack}>
                                <LinearGradient
                                  colors={item.peak ? [INDIGO_LIGHT, INDIGO_DARK] : ['#38bdf8', '#0ea5e9']}
                                  style={[styles.barFill, { height: `${item.value}%` }]}
                                />
                              </View>
                              <Text style={[styles.dayLabel, item.peak && styles.peakDayText]}>{item.day}</Text>
                            </View>
                          ))}
                        </View>

                        <View style={styles.chartLegend}>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: '#0ea5e9' }]} />
                            <Text style={styles.legendText}>Normal Activity</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: INDIGO }]} />
                            <Text style={styles.legendText}>Peak Day</Text>
                          </View>
                        </View>
                      </>
                    );
                  })()}
                </LinearGradient>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    paddingTop: insets.top + 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: colors.slate400,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
  },
  headerLeft: {
    minWidth: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    color: colors.white,
    fontFamily: 'AkayaKanadaka_400Regular',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginTop: -18,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: INDIGO,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  compactEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INDIGO,
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: 9,
  },
  editBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: INDIGO,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editBtnText: {
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  compactEditBtnText: {
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12.5,
  },
  editBtnSmallText: {
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  },
  saveBtn: {
    backgroundColor: INDIGO,
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
    minWidth: 60,
  },
  saveBtnText: {
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 40,
  },
  // ── KPI 2×2 GRID CARDS ──
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  kpiCard: {
    width: '47%',
    backgroundColor: colors.deepSlate,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  kpiLeftBar: {
    width: 3,
    borderRadius: 3,
  },
  kpiCardInner: {
    flex: 1,
    padding: 12,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 10,
    color: colors.slate400,
    fontFamily: 'Outfit_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // kept for any other references
  kpiScrollWrapper: {
    marginTop: 12,
    marginBottom: 28,
  },
  kpiScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  kpiAccentBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
    marginHorizontal: -16,
  },

  // kept for any other references
  statsGrid: {
    paddingHorizontal: 20,
    marginBottom: 24,
    marginTop: 10,
  },
  unifiedStatCard: {
    backgroundColor: colors.deepSlate,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
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
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },
  statLabel: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: 'Outfit_600SemiBold',
    marginLeft: 2,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {},
  emptyText: {
    color: colors.slate400,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 12,
  },
  tabText: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Outfit_600SemiBold',
  },
  activeTabText: {
    color: INDIGO,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: INDIGO,
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
    color: colors.slate400,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.deepSlate,
    borderRadius: 16,
    padding: 16,
    color: colors.white,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  disabledInput: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.02)',
    color: colors.slate400,
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
    backgroundColor: INDIGO,
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
    backgroundColor: colors.slate800,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tagText: {
    color: colors.white,
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
    color: INDIGO,
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  faqEditor: {
    backgroundColor: colors.deepSlate,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  faqNumber: {
    color: colors.slate400,
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
    color: '#ffffff',
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
    borderColor: INDIGO_BORDER,
    borderStyle: 'dashed',
    backgroundColor: INDIGO_BG_SUPER_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoText: {
    color: INDIGO_LIGHT,
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
    backgroundColor: colors.deepSlate,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  newsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  newsDate: {
    color: colors.slate400,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  newsTitle: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  newsBody: {
    color: colors.slate400,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  analyticsSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyStateText: {
    color: colors.slate400,
    fontFamily: 'Inter_500Medium',
  },
  newsInput: {
    backgroundColor: colors.deepSlate,
    borderRadius: 16,
    padding: 16,
    color: colors.white,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: colors.slate400,
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
    backgroundColor: colors.deepSlate,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    marginBottom: 24,
  },
  newsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: INDIGO_BG_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsStatus: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },
  newsPreviewText: {
    fontSize: 14,
    color: colors.slate700,
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
    backgroundColor: INDIGO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  updateNewsBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Outfit_800ExtraBold',
  },
  newsInputSmall: {
    flex: 1,
    minHeight: 50,
    backgroundColor: colors.deepSlate,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
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
    backgroundColor: INDIGO,
    marginTop: 6,
  },
  newsItemText: {
    flex: 1,
    color: colors.slate800,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    textAlign: 'center',
  },
  timeBadge: {
    backgroundColor: INDIGO_BG_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
  },
  timeBadgeText: {
    color: INDIGO_LIGHT,
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  performanceCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  performanceGradient: {
    padding: 16,
  },
  perfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  perfLabel: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Outfit_600SemiBold',
  },
  perfValue: {
    fontSize: 26,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    marginTop: 2,
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
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
  funnelContainer: {
    gap: 10,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  funnelMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 105,
    gap: 6,
  },
  funnelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  funnelLabel: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: 'Outfit_500Medium',
  },
  funnelBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  funnelBar: {
    height: '100%',
    borderRadius: 3,
  },
  funnelCount: {
    fontSize: 12,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
    minWidth: 35,
    textAlign: 'right',
  },
  channelsCard: {
    backgroundColor: colors.deepSlate,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    color: colors.white,
    fontFamily: 'Outfit_600SemiBold',
  },
  channelValue: {
    fontSize: 14,
    color: colors.slate400,
    fontFamily: 'Outfit_700Bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  peakCard: {
    backgroundColor: colors.deepSlate,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  peakInfo: {
    flex: 1,
  },
  peakTitle: {
    fontSize: 16,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  peakDesc: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  peakDayLabel: {
    fontSize: 12,
    color: INDIGO_LIGHT,
    fontFamily: 'Outfit_700Bold',
    backgroundColor: INDIGO_BG_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chartCard: {
    backgroundColor: colors.deepSlate,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
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
    color: colors.slate400,
    fontFamily: 'Outfit_700Bold',
  },
  peakDayText: {
    color: INDIGO_LIGHT,
  },
  chartLegend: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
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
    color: colors.slate400,
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
    backgroundColor: colors.deepSlate,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  activeRangeChip: {
    borderColor: INDIGO,
    backgroundColor: INDIGO_BG_LIGHT,
  },
  rangeText: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Outfit_600SemiBold',
  },
  activeRangeText: {
    color: INDIGO,
  },
  locationCard: {
    backgroundColor: colors.deepSlate,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    color: colors.slate400,
    fontFamily: 'Outfit_600SemiBold',
  },
  locationTotal: {
    fontSize: 12,
    color: colors.slate400,
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
    color: colors.white,
    fontFamily: 'Outfit_600SemiBold',
  },
  cityPercent: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Outfit_700Bold',
  },
  locationBarTrack: {
    height: 6,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  locationBarFill: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.8,
  },
  shortlistCard: {
    backgroundColor: colors.deepSlate,
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
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
  },
  shortlistLabel: {
    fontSize: 14,
    color: colors.slate400,
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
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    marginTop: 12,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  rankingCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
    elevation: 4,
    shadowColor: INDIGO,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  rankingGradient: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rankBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  rankBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rankingIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankingTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rankingContent: {
    marginBottom: 12,
  },
  rankingValue: {
    fontSize: 26,
    color: colors.white,
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: 30,
  },
  rankingSubText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  gaugeContainer: {
    gap: 6,
  },
  gaugeTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  gaugeFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
    opacity: 0.4,
  },
  gaugeMarker: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: INDIGO_LIGHT,
    marginLeft: -5,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gaugeLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
  },
  displayTextMain: {
    fontSize: 20,
    color: colors.white,
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
    color: colors.slate400,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  storageCard: {
    backgroundColor: colors.deepSlate,
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
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  storageStats: {
    fontSize: 13,
    color: colors.slate400,
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
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
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
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
  },
  coverPreviewContainer: {
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: INDIGO,
    width: 14,
  },
  emptyCoverPlaceholder: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    color: INDIGO_LIGHT,
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
    borderColor: colors.cardBorder,
  },
  datePickerBtn: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.slate800,
    marginTop: 4,
  },
  datePickerBtnText: {
    color: colors.white,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  experienceContainer: {
    marginTop: 4,
  },
  startedHint: {
    fontSize: 12,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  dropdownBtn: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.slate800,
    marginTop: 4,
  },
  dropdownBtnText: {
    color: colors.white,
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
    backgroundColor: colors.deepSlate,
    width: '85%',
    maxHeight: '70%',
    minHeight: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    borderBottomColor: colors.cardBorder,
  },
  pickerTitle: {
    fontSize: 18,
    color: colors.white,
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
    backgroundColor: INDIGO_BG_SUPER_LIGHT,
  },
  pickerItemText: {
    fontSize: 15,
    color: colors.slate400,
    fontFamily: 'Inter_500Medium',
  },
  pickerItemTextActive: {
    color: INDIGO,
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
    borderTopColor: colors.cardBorder,
  },
  pickerFooterText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'Inter_500Medium',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INDIGO_BG_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
  },
  manageBtnText: {
    color: INDIGO_LIGHT,
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
  },
  leadsOverviewCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: INDIGO_BG_SUPER_LIGHT,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  leadsOverviewTitle: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  leadsCountBadge: {
    backgroundColor: INDIGO,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  leadsCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.5,
  },
  leadCard: {
    backgroundColor: colors.deepSlate,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadUserMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leadUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: INDIGO_BG_LIGHT,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leadAvatarText: {
    color: INDIGO_LIGHT,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  leadClientName: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  leadTimestamp: {
    color: colors.slate400,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  leadDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  leadDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: INDIGO_BG_SUPER_LIGHT,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  leadDetailPillText: {
    color: INDIGO_LIGHT,
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  leadMessageContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.slate800,
  },
  leadMessageLabel: {
    color: colors.slate400,
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  leadMessageContent: {
    color: colors.slate800,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  leadActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  leadActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  callBtn: {
    backgroundColor: '#2563eb',
  },
  whatsappBtn: {
    backgroundColor: '#16a34a',
  },
  emailBtn: {
    backgroundColor: '#475569',
  },
  leadActionBtnText: {
    color: colors.white,
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  noContactBadge: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  noContactText: {
    color: '#ef4444',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: INDIGO_BG_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 14,
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  inlineActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  inlineActionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineCancelBtn: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  inlineSaveBtn: {
    backgroundColor: INDIGO,
  },
  inlineCancelBtnText: {
    color: colors.slate400,
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  inlineSaveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },

  // ── ENQUIRY CARDS (Recent Inquiries section) ──
  enquiryCard: {
    backgroundColor: colors.deepSlate,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  enquiryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  enquiryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: INDIGO_BG_LIGHT,
    borderWidth: 1,
    borderColor: INDIGO_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enquiryAvatarText: {
    color: INDIGO_LIGHT,
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  enquiryName: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    marginBottom: 2,
  },
  enquiryDate: {
    color: colors.slate400,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  enquiryChannelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  enquiryChannelText: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
  },
  enquiryMessage: {
    color: colors.slate400,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 6,
  },
  enquiryEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  enquiryEventDate: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
});
