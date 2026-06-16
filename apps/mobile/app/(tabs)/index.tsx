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
  console.log('HomeScreen mounting...');
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: 'red', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: 'white', fontSize: 24 }}>HOME SCREEN REACHED</Text>
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
    backgroundColor: '#101010',
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
    color: '#101010',
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
    color: '#101010',
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
