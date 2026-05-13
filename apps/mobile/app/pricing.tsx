import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

const packages = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    badge: null,
    badgeColor: "",
    description: "Get started and explore the platform at no cost.",
    features: [
      "2 Events",
      "1 GB Storage",
      "1 Standard Template Only",
      "Guest Sharing via Link",
      "Basic Gallery View",
      "Watermark on Images",
      "No Authorized Guest Sign-In",
    ],
    cta: "Get Started",
    accentColor: "#f1f5f9",
    btnBg: "#1e293b",
    checkColor: "#94a3b8",
  },
  {
    name: "Basic",
    price: "₹499",
    period: "/ month",
    badge: null,
    badgeColor: "",
    description: "For individuals & small events.",
    features: [
      "5 Events",
      "15 GB Storage",
      "All Templates",
      "Authorized Guest Sign-In",
      "Guest Approval System",
      "Face Recognition Search",
      "Standard Support",
      "Optimized Image Delivery (JPG)",
    ],
    cta: "Choose Basic",
    accentColor: "#ccfbf1",
    btnBg: "#0d9488",
    checkColor: "#14b8a6",
  },
  {
    name: "Standard",
    price: "₹1,499",
    period: "/ month",
    badge: null,
    badgeColor: "",
    description: "Best for frequent users & families.",
    features: [
      "20 Events",
      "60 GB Storage",
      "All Templates",
      "Authorized Guest Sign-In",
      "Guest Approval + Traffic Logs",
      "Face Recognition Search",
      "Custom Subdomain",
      "Priority Support",
      "Faster CDN Delivery",
    ],
    cta: "Choose Standard",
    accentColor: "#e0f2fe",
    btnBg: "#0284c7",
    checkColor: "#0ea5e9",
  },
  {
    name: "Premium",
    price: "₹3,999",
    period: "/ month",
    badge: "Most Popular",
    badgeColor: "#0284c7",
    description: "For professional photographers.",
    features: [
      "Unlimited Events",
      "200 GB Storage",
      "All Templates",
      "Authorized Guest Sign-In",
      "Guest Approval + Traffic Logs",
      "Face Recognition Search",
      "Custom Subdomain",
      "Delegate Team Members",
      "Dedicated Support",
      "RAW + JPG Download Options",
      "Advanced Analytics",
    ],
    cta: "Choose Premium",
    accentColor: "#0ea5e9",
    btnBg: "#0284c7",
    checkColor: "#0284c7",
    isPopular: true,
  },
  {
    name: "Elite",
    price: "₹9,999",
    period: "/ month",
    badge: "Best Value",
    badgeColor: "#9333ea",
    description: "For studios & heavy users.",
    features: [
      "Unlimited Events",
      "1 TB Storage",
      "All Templates",
      "Authorized Guest Sign-In",
      "Guest Approval + Traffic Logs",
      "Face Recognition Search",
      "Custom Subdomain",
      "Unlimited Team Members",
      "White-Label Branding",
      "Dedicated Account Manager",
      "Priority CDN (Fastest Delivery)",
      "Bulk Upload Tools",
      "API Access",
    ],
    cta: "Choose Elite",
    accentColor: "#c084fc",
    btnBg: "#9333ea",
    checkColor: "#9333ea",
  },
];

export default function PricingScreen() {
  const router = useRouter();

  return (
    <View style={styles.mainContainer}>
      <Stack.Screen options={{ 
        headerShown: true,
        headerTransparent: true,
        headerTitle: 'Pricing',
        headerTintColor: '#0f172a',
        headerLeft: () => (
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/dashboard');
              }
            }} 
            style={styles.nativeBackButton}
            hitSlop={{ top: 50, bottom: 50, left: 50, right: 50 }}
          >
            <IconSymbol name="chevron.left" size={28} color="#0f172a" />
          </TouchableOpacity>
        ),
        headerShadowVisible: false,
      }} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Simple, Transparent Pricing</Text>
          <Text style={styles.subtitle}>From free to enterprise — find the plan that fits your story.</Text>
        </View>

        <View style={styles.cardsContainer}>
          {packages.map((pkg, index) => (
            <View key={index} style={[styles.card, pkg.isPopular && styles.cardPopular, { borderColor: pkg.accentColor }]}>
              {pkg.badge && (
                <View style={[styles.badge, { backgroundColor: pkg.badgeColor }]}>
                  <Text style={styles.badgeText}>{pkg.badge}</Text>
                </View>
              )}
              
              <View style={styles.cardContent}>
                <Text style={styles.planName}>{pkg.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{pkg.price}</Text>
                  <Text style={styles.planPeriod}>{pkg.period}</Text>
                </View>
                <Text style={styles.planDesc}>{pkg.description}</Text>

                <View style={styles.divider} />

                <View style={styles.featuresList}>
                  {pkg.features.map((feature, fIndex) => {
                    const isRestriction = feature.startsWith("No ");
                    return (
                      <View key={fIndex} style={styles.featureRow}>
                        <View style={[styles.iconBox, { backgroundColor: isRestriction ? '#fef2f2' : `${pkg.checkColor}20` }]}>
                          <IconSymbol 
                            name={isRestriction ? 'xmark' : 'checkmark'} 
                            size={12} 
                            color={isRestriction ? '#f87171' : pkg.checkColor} 
                          />
                        </View>
                        <Text style={[styles.featureText, isRestriction && styles.featureTextRestricted]}>
                          {feature}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity 
                  style={[styles.ctaButton, { backgroundColor: pkg.btnBg }]}
                  onPress={() => {
                    // Navigate to a contact or upgrade form
                    router.push('/(tabs)/menu'); 
                  }}
                >
                  <Text style={styles.ctaText}>{pkg.cta}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <IconSymbol name="info.circle" size={18} color="#94a3b8" />
          <Text style={styles.footerText}>
            Fair Usage Policy: Bandwidth usage beyond fair limits may incur additional charges. Extra Storage: ₹5/GB • Extra Bandwidth: ₹7–₹10/GB.
          </Text>
        </View>

        <View style={styles.customPlanCard}>
          <Text style={styles.customPlanTitle}>Need a custom plan?</Text>
          <Text style={styles.customPlanDesc}>
            {`Running a large studio or enterprise operation? Let's build a plan tailored to your exact needs.`}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/menu')}>
            <Text style={styles.customPlanLink}>Contact Us for Custom Quote →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  nativeBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: 8,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  cardsContainer: {
    gap: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPopular: {
    borderWidth: 2,
    shadowOpacity: 0.15,
  },
  badge: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardContent: {
    padding: 20,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0f172a',
  },
  planPeriod: {
    fontSize: 14,
    color: '#94a3b8',
    marginLeft: 4,
  },
  planDesc: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    minHeight: 40,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 20,
  },
  featuresList: {
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  featureText: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
    lineHeight: 20,
  },
  featureTextRestricted: {
    color: '#f87171',
    textDecorationLine: 'line-through',
  },
  ctaButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    marginLeft: 12,
    lineHeight: 18,
  },
  customPlanCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customPlanTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  customPlanDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  customPlanLink: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
