import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  StatusBar 
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

const { width, height } = Dimensions.get('window');

const HERO_IMAGE = "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767692961/0D2A5755_1_cipyfz.jpg";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={HERO_IMAGE}
            style={styles.heroImage}
            contentFit="cover"
            transition={1000}
          />
          <LinearGradient
            colors={['transparent', 'rgba(15, 23, 42, 0.7)']}
            style={styles.heroOverlay}
          />
          
          <View style={styles.heroContent}>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>Professional Photography</Text>
            </View>
            
            <Text style={styles.heroTitle}>
              Capturing{"\n"}
              <Text style={styles.heroTitleItalic}>Timeless</Text> Moments
            </Text>
            
            <Text style={styles.heroSubtitle}>
              We believe that every moment is a piece of art waiting to be captured. 
              Let us tell your story with elegance and simplicity.
            </Text>
            
            <View style={styles.heroActions}>
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => router.push('/(tabs)/gallery')}
              >
                <Text style={styles.primaryButtonText}>View Our Work</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryButton}
                onPress={() => router.push('/contact')}
              >
                <Text style={styles.secondaryButtonText}>Book a Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.aboutSection}>
          <View style={styles.aboutHeader}>
            <Text style={styles.aboutBadge}>About The Artist</Text>
            <Text style={styles.aboutTitle}>Preserving Your Legacy</Text>
          </View>
          
          <View style={styles.aboutImageWrapper}>
            <Image
              source={HERO_IMAGE}
              style={styles.aboutImage}
              contentFit="cover"
              transition={1000}
            />
          </View>
          
          <View style={styles.aboutTextContainer}>
            <Text style={styles.aboutParagraph}>
              With over a decade of experience in capturing weddings, portraits, and events, 
              we strive to create images that are not just photographs, but heirlooms.
            </Text>
            <Text style={styles.aboutParagraph}>
              Our style is a blend of fine art and photojournalism, ensuring that every 
              emotion is captured authentically.
            </Text>
            
            <TouchableOpacity 
              style={styles.readMoreLink}
              onPress={() => router.push('/contact')}
            >
              <Text style={styles.readMoreText}>Read More About Us</Text>
              <IconSymbol name="chevron.right" size={16} color="#0284c7" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  heroSection: {
    width: width,
    height: height * 0.8,
    justifyContent: 'flex-end',
    backgroundColor: '#0f172a',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    alignItems: 'center',
    textAlign: 'center',
  },
  badgeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 20,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 42,
    color: '#ffffff',
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 50,
    marginBottom: 16,
  },
  heroTitleItalic: {
    fontStyle: 'italic',
    color: '#bae6fd',
    fontWeight: '300',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  heroActions: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aboutSection: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  aboutHeader: {
    marginBottom: 32,
  },
  aboutBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0284c7',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  aboutTitle: {
    fontSize: 32,
    color: '#0f172a',
    fontWeight: '700',
    letterSpacing: -1,
  },
  aboutImageWrapper: {
    width: '100%',
    height: 400,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  aboutImage: {
    width: '100%',
    height: '100%',
  },
  aboutTextContainer: {
    gap: 16,
  },
  aboutParagraph: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 26,
    fontWeight: '300',
  },
  readMoreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  readMoreText: {
    fontSize: 16,
    color: '#0284c7',
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#0284c7',
  }
});
