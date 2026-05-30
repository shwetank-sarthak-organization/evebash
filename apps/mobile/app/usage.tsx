import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getUserEventCount, getUserTotalStorage, getUserBusinesses } from '@/lib/firestore';

const { width } = Dimensions.get('window');

export default function UsageScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ eventCount: 0, storageUsed: 0, businessCount: 0 });

  const getPlanDetails = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "admin":    return { name: "Super Admin", storage: "Unlimited", events: "Unlimited", businesses: "Unlimited", color: "#d4af37", storageGB: Infinity, eventsCount: Infinity, businessLimit: Infinity };
      case "elite":    return { name: "Elite Plan", storage: "500 GB", events: "100", businesses: "10", color: "#d4af37", storageGB: 500, eventsCount: 100, businessLimit: 10 };
      case "premium":  return { name: "Premium Plan", storage: "100 GB", events: "25", businesses: "3", color: "#818cf8", storageGB: 100, eventsCount: 25, businessLimit: 3 };
      default:         return { name: "Free Plan", storage: "5 GB", events: "1", businesses: "0", color: "#94a3b8", storageGB: 5, eventsCount: 1, businessLimit: 0 };
    }
  };

  const plan = getPlanDetails(user?.role);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const identifiers = [user.uid];
        if (user.email) identifiers.push(user.email);
        if (user.phone) identifiers.push(user.phone);

        const [count, storage, businesses] = await Promise.all([
          getUserEventCount(user.uid),
          getUserTotalStorage(identifiers),
          getUserBusinesses(user.uid)
        ]);
        setStats({ 
          eventCount: count, 
          storageUsed: storage,
          businessCount: businesses.length 
        });
      } catch (error) {
        console.error("Error fetching usage stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const formatStorage = (bytes: number) => {
    if (bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 0.1) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${gb.toFixed(2)} GB`;
  };

  const getProgress = (current: number, limit: number) => {
    if (limit === Infinity) return 0.05;
    if (limit === 0) return current > 0 ? 1 : 0.05;
    return Math.min(current / limit, 1);
  };

  const storageGBUsed = stats.storageUsed / (1024 * 1024 * 1024);
  const isStorageOver = storageGBUsed > plan.storageGB && plan.storageGB !== Infinity;
  const isEventsOver = stats.eventCount > plan.eventsCount && plan.eventsCount !== Infinity;
  const isBizOver = stats.businessCount > plan.businessLimit && plan.businessLimit !== Infinity;

  const usageData = [
    { 
      label: 'Storage Used', 
      value: formatStorage(stats.storageUsed), 
      limit: plan.storage, 
      progress: getProgress(storageGBUsed, plan.storageGB), 
      icon: 'cloud.fill',
      isOver: isStorageOver
    },
    { 
      label: 'Active Events', 
      value: stats.eventCount.toString(), 
      limit: plan.events, 
      progress: getProgress(stats.eventCount, plan.eventsCount), 
      icon: 'calendar.fill',
      isOver: isEventsOver
    },
    { 
      label: 'Active Businesses', 
      value: stats.businessCount.toString(), 
      limit: plan.businesses, 
      progress: getProgress(stats.businessCount, plan.businessLimit), 
      icon: 'briefcase.fill',
      isOver: isBizOver
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <LinearGradient
          colors={['#0f172a', '#020617']}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity 
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
              style={styles.backButton}
            >
              <IconSymbol name="chevron.left" size={24} color="#94a3b8" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Plan & Usage</Text>
            <View style={{ width: 40 }} /> 
          </View>
        </LinearGradient>

        {/* Current Plan Card */}
        <View style={styles.planCard}>
          <LinearGradient 
            colors={['rgba(212,175,55,0.15)', 'rgba(15,23,42,0.8)']} 
            style={StyleSheet.absoluteFill} 
          />
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planLabel}>Current Plan</Text>
              <Text style={styles.planName}>{plan.name}</Text>
            </View>
            <View style={[styles.planBadge, { backgroundColor: plan.color + '20', borderColor: plan.color + '40' }]}>
              <Text style={[styles.planBadgeText, { color: plan.color }]}>ACTIVE</Text>
            </View>
          </View>

          {loading ? (
            <View style={{ height: 200, justifyContent: 'center' }}>
              <ActivityIndicator color="#d4af37" />
            </View>
          ) : (
            <View style={styles.usageContainer}>
              {usageData.map((item, idx) => (
                <View key={idx} style={styles.usageItem}>
                  <View style={styles.usageInfo}>
                    <View style={styles.usageLabelRow}>
                      <IconSymbol name={item.icon as any} size={14} color={item.isOver ? '#f87171' : '#94a3b8'} />
                      <Text style={[styles.usageLabel, item.isOver && { color: '#f87171' }]}>{item.label}</Text>
                    </View>
                    <Text style={[styles.usageValue, item.isOver && { color: '#f87171' }]}>
                      {item.value} <Text style={styles.usageLimit}>/ {item.limit}</Text>
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <LinearGradient
                      colors={item.isOver ? ['#ef4444', '#b91c1c'] : ['#d4af37', '#b49430']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressBarFill, { width: `${item.progress * 100}%` }]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Plan Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Management</Text>
          <View style={styles.listContainer}>
            <TouchableOpacity 
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/pricing')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                  <IconSymbol name="sparkles.fill" size={18} color="#d4af37" />
                </View>
                <Text style={styles.itemText}>Upgrade Plan</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/billing')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                  <IconSymbol name="creditcard.fill" size={18} color="#94a3b8" />
                </View>
                <Text style={styles.itemText}>Billing History</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Feedback</Text>
          <View style={styles.listContainer}>
            <TouchableOpacity 
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/contact')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                  <IconSymbol name="message.fill" size={18} color="#94a3b8" />
                </View>
                <Text style={styles.itemText}>Support Chat</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/help')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                  <IconSymbol name="questionmark.circle.fill" size={18} color="#94a3b8" />
                </View>
                <Text style={styles.itemText}>Help Center</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>EveBash v1.0.4</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1 },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: 20, 
    paddingBottom: 24, 
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  headerTitle: { 
    fontSize: 13, 
    fontFamily: 'Inter_700Bold', 
    color: '#94a3b8', 
    textTransform: 'uppercase', 
    letterSpacing: 2 
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  planCard: {
    backgroundColor: '#0f172a',
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    overflow: 'hidden',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  planLabel: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  planName: {
    fontSize: 24,
    color: '#f8fafc',
    fontFamily: 'Outfit_800ExtraBold',
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
  },
  usageContainer: {
    gap: 20,
  },
  usageItem: {
    gap: 8,
  },
  usageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  usageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  usageLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'Inter_500Medium',
  },
  usageValue: {
    fontSize: 14,
    color: '#f1f5f9',
    fontFamily: 'Outfit_700Bold',
  },
  usageLimit: {
    color: '#475569',
    fontSize: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  section: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 4,
  },
  listContainer: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  listIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 16,
    color: '#f1f5f9',
    fontFamily: 'Outfit_600SemiBold',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 12,
    color: '#334155',
    fontFamily: 'Inter_400Regular',
  },
});
