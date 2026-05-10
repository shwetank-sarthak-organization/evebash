import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const STATS = [
  { id: '1', label: 'Total Views', value: '1.2k', icon: 'eye.fill', color: '#3b82f6' },
  { id: '2', label: 'Inquiries', value: '48', icon: 'message.fill', color: '#d4af37' },
  { id: '3', label: 'Rating', value: '4.9', icon: 'star.fill', color: '#22c55e' },
];

const PORTFOLIO = [
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=400',
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=400',
];

export default function ManageBusinessScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Profile');
  const [businessName, setBusinessName] = useState('Eternal Frames');
  const [category, setCategory] = useState('Photography');
  const [about, setAbout] = useState('Creating timeless memories through our lens. Specialized in cinematic coverage for sports, weddings, and corporate events.');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Manager</Text>
        <TouchableOpacity style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── STATS SECTION ── */}
        <View style={styles.statsGrid}>
          {STATS.map((stat) => (
            <View key={stat.id} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                <IconSymbol name={stat.icon as any} size={16} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── TAB NAVIGATION ── */}
        <View style={styles.tabs}>
          {['Profile', 'Portfolio', 'Analytics'].map((tab) => (
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

        {/* ── PROFILE CONTENT ── */}
        {activeTab === 'Profile' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.tabContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Business Name</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>About Business</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={about}
                onChangeText={setAbout}
                multiline
                numberOfLines={4}
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.promotionBtn}>
                <LinearGradient
                  colors={['#d4af37', '#b8860b']}
                  style={styles.promotionGradient}
                >
                  <IconSymbol name="sparkles" size={16} color="#0f172a" />
                  <Text style={styles.promotionBtnText}>Boost Visibility</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* ── PORTFOLIO CONTENT ── */}
        {activeTab === 'Portfolio' && (
          <View style={styles.tabContent}>
            <View style={styles.portfolioGrid}>
              <TouchableOpacity style={styles.addPhotoCard}>
                <IconSymbol name="plus" size={32} color="#d4af37" />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
              {PORTFOLIO.map((img, idx) => (
                <View key={idx} style={styles.photoCard}>
                  <ExpoImage source={{ uri: img }} style={styles.photo} contentFit="cover" />
                  <TouchableOpacity style={styles.deletePhotoBtn}>
                    <IconSymbol name="xmark.circle.fill" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── ANALYTICS CONTENT ── */}
        {activeTab === 'Analytics' && (
          <View style={styles.tabContent}>
            <View style={styles.analyticsSection}>
              <Text style={styles.sectionTitle}>Recent Inquiries</Text>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.inquiryCard}>
                  <View style={styles.inquiryHeader}>
                    <Text style={styles.inquiryName}>Rahul Sharma</Text>
                    <Text style={styles.inquiryDate}>2h ago</Text>
                  </View>
                  <Text style={styles.inquiryText} numberOfLines={1}>
                    Interested in photography package for Oct 24th...
                  </Text>
                  <TouchableOpacity style={styles.replyBtn}>
                    <Text style={styles.replyBtnText}>Reply</Text>
                  </TouchableOpacity>
                </View>
              ))}
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
  headerTitle: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  saveBtn: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  saveBtnText: {
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tab: {
    paddingVertical: 12,
    marginRight: 24,
    position: 'relative',
  },
  activeTab: {
    // marginBottom: -1,
  },
  tabText: {
    fontSize: 15,
    color: '#64748b',
    fontFamily: 'Outfit_600SemiBold',
  },
  activeTabText: {
    color: '#d4af37',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#d4af37',
    borderRadius: 1,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Outfit_700Bold',
    marginBottom: 8,
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
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  actionRow: {
    marginTop: 10,
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
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
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
  analyticsSection: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 16,
  },
  inquiryCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inquiryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inquiryName: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
  },
  inquiryDate: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_500Medium',
  },
  inquiryText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  replyBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  replyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
});
