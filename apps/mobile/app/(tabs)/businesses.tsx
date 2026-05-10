import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

const BENEFITS = [
  { id: '1', title: 'Reach Event Organizers', desc: 'Connect with professionals planning sports tournaments, corporate meets, and celebrations.', icon: 'person.2.fill' },
  { id: '2', title: 'Smart Analytics', desc: 'Track your profile views, inquiries, and growth in real-time.', icon: 'chart.bar.fill' },
  { id: '3', title: 'Premium Portfolio', desc: 'Showcase your work to a diverse audience with high-resolution galleries.', icon: 'photo.on.rectangle.fill' },
];

export default function BusinessLandingScreen() {
  const router = useRouter();
  const [showListingForm, setShowListingForm] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── HERO SECTION ── */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#0f172a', '#020617']}
            style={styles.heroGradient}
          >
            <View style={styles.heroBadge}>
              <IconSymbol name="briefcase.fill" size={14} color="#d4af37" />
              <Text style={styles.heroBadgeText}>FOR BUSINESS OWNERS</Text>
            </View>
            <Text style={styles.heroTitle}>Partner Hub</Text>
            <Text style={styles.heroSubtitle}>
              The premium platform for event professionals to showcase their work and find organizers for any occasion.
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
                  <Text style={styles.primaryBtnText}>Start Your Business</Text>
                  <IconSymbol name="chevron.right" size={16} color="#0f172a" />
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryBtn}
                onPress={() => router.push('/manage-business')}
              >
                <Text style={styles.secondaryBtnText}>Already have one? Manage Now</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ── BENEFITS SECTION ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why Join Us?</Text>
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

        {/* ── CTA CARD ── */}
        <View style={styles.ctaCardContainer}>
          <LinearGradient
            colors={['#1e293b', '#0f172a']}
            style={styles.ctaCard}
          >
            <IconSymbol name="sparkles" size={40} color="#d4af37" />
            <Text style={styles.ctaCardTitle}>Ready to Shine?</Text>
            <Text style={styles.ctaCardSubtitle}>
              It only takes 2 minutes to list your business and start reaching event organizers.
            </Text>
            <TouchableOpacity 
              style={styles.ctaCardBtn}
              onPress={() => setShowListingForm(true)}
            >
              <Text style={styles.ctaCardBtnText}>Create Listing Now</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* ── CREATE BUSINESS MODAL (Re-using the form logic) ── */}
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
              <TextInput style={styles.formInput} placeholder="e.g. Photography, Venue..." placeholderTextColor="#475569" />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.formInput} placeholder="+91 98765 43210" placeholderTextColor="#475569" keyboardType="phone-pad" />

              <TouchableOpacity style={styles.submitFormBtn} onPress={() => {
                setShowListingForm(false);
                Alert.alert("Success", "Your business listing has been submitted!");
              }}>
                <Text style={styles.submitFormText}>Create Business</Text>
              </TouchableOpacity>
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
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    textDecorationLine: 'underline',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 24,
  },
  benefitsGrid: {
    gap: 20,
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
  ctaCardContainer: {
    paddingHorizontal: 24,
  },
  ctaCard: {
    padding: 32,
    borderRadius: 32,
    alignItems: 'center',
    gap: 16,
  },
  ctaCardTitle: {
    fontSize: 28,
    color: '#ffffff',
    fontFamily: 'Outfit_800ExtraBold',
  },
  ctaCardSubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  ctaCardBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaCardBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  // ── Form Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.9)',
    justifyContent: 'flex-end',
  },
  formContainer: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '70%',
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
    gap: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
  },
  formInput: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: '#1e293b',
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
  },
});
