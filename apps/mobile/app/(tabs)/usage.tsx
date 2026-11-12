import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getUserEventCount, getUserTotalStorage, getUserBusinesses } from '@/lib/database';
import { getPlanDetails, getUsagePercent, planAccentText } from '@/lib/planLimits';
import { getSubscriptionStatus } from '@/lib/subscriptionStatus';
import { supabase } from '@/lib/supabase';
import { TabScreenHeader, HeaderAction } from '@/components/ui/TabScreenHeader';
import { APP_VERSION } from '@/lib/appVersion';
import { useAppTheme } from '@/context/ThemeContext';
import { MidnightColors } from '@/constants/theme';

const { width } = Dimensions.get('window');

/** Business listings are hidden until Phase 2 (they come with EB Business and EB Network). */
const SHOW_BUSINESS_USAGE = false;

export default function UsageScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ eventCount: 0, storageUsed: 0, businessCount: 0 });

  const plan = getPlanDetails(user?.role);
  const planColor = planAccentText(plan.accent, isDark);
  const subscriptionStatus = getSubscriptionStatus({
    role: user?.role,
    planStartDate: user?.planStartDate,
    planEndDate: user?.planEndDate,
  });
  const statusColor = subscriptionStatus.tone === 'danger'
    ? (isDark ? '#f87171' : colors.danger)
    : subscriptionStatus.tone === 'warning'
      ? (isDark ? '#fbbf24' : colors.warning)
      : planColor;
  // Over-limit red, deeper on the light look
  const overColor = isDark ? '#f87171' : colors.danger;
  const statusBackground = subscriptionStatus.tone === 'danger'
    ? 'rgba(248, 113, 113, 0.12)'
    : subscriptionStatus.tone === 'warning'
      ? 'rgba(251, 191, 36, 0.12)'
      : plan.accentSoft;

  const fetchStats = React.useCallback(async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
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
        if (!silent) setLoading(false);
      }
    }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useFocusEffect(
    React.useCallback(() => {
      fetchStats(true);
    }, [fetchStats])
  );

  useEffect(() => {
    if (!user?.uid) return;

    const identifiers = [user.uid, user.email, user.phone].filter(Boolean) as string[];
    const channels = identifiers.map((identifier) =>
      supabase
        .channel(`usage-storage-${identifier}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${identifier}` },
          () => fetchStats(true)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'events', filter: `created_by=eq.${identifier}` },
          () => fetchStats(true)
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user?.uid, user?.email, user?.phone, fetchStats]);

  const formatStorage = (bytes: number) => {
    if (bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 0.1) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${gb.toFixed(2)} GB`;
  };

  const storageProgress = getUsagePercent(stats.storageUsed, plan.storageBytes) / 100;
  const eventProgress = getUsagePercent(stats.eventCount, plan.eventLimit) / 100;
  const businessLimit = user?.role === 'admin'
    ? Infinity
    : user?.role === 'elite'
      ? 10
      : user?.role === 'premium'
        ? 3
        : 0;
  const businessLabel = businessLimit === Infinity ? 'Unlimited' : String(businessLimit);
  const businessProgress = getUsagePercent(stats.businessCount, businessLimit) / 100;
  const isStorageOver = stats.storageUsed > plan.storageBytes && plan.storageBytes !== Infinity;
  const isEventsOver = stats.eventCount > plan.eventLimit && plan.eventLimit !== Infinity;
  const isBizOver = stats.businessCount > businessLimit && businessLimit !== Infinity;

  const usageData = [
    {
      label: 'Storage Used',
      value: formatStorage(stats.storageUsed),
      limit: plan.storageLabel,
      progress: storageProgress,
      icon: 'cloud.fill',
      isOver: isStorageOver
    },
    {
      label: 'Active Events',
      value: stats.eventCount.toString(),
      limit: plan.eventLabel,
      progress: eventProgress,
      icon: 'calendar',
      isOver: isEventsOver
    },
    ...(SHOW_BUSINESS_USAGE ? [{
      label: 'Active Businesses',
      value: stats.businessCount.toString(),
      limit: businessLabel,
      progress: businessProgress,
      icon: 'briefcase.fill',
      isOver: isBizOver
    }] : []),
  ];

  return (
    <View style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <TabScreenHeader
        title="Plan & Usage"
        left={
          <HeaderAction
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')}
            accessibilityLabel="Back"
          >
            <IconSymbol name="chevron.left" size={24} color={colors.gold} />
          </HeaderAction>
        }
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Current Plan Card */}
        <View style={styles.planCard}>
          <LinearGradient
            colors={[plan.accentSoft, isDark ? 'rgba(27, 33, 31,0.8)' : 'rgba(255, 255, 255, 0.8)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planLabel}>Current Plan</Text>
              <Text style={styles.planName}>{plan.name}</Text>
            </View>
            <View style={[styles.planBadge, { backgroundColor: statusBackground, borderColor: statusColor }]}>
              <Text style={[styles.planBadgeText, { color: statusColor }]}>{subscriptionStatus.label}</Text>
            </View>
          </View>

          {subscriptionStatus.message ? (
            <View style={[
              styles.planStatusBox,
              {
                borderColor: subscriptionStatus.tone === 'danger' ? 'rgba(248, 113, 113, 0.35)' : 'rgba(251, 191, 36, 0.35)',
                backgroundColor: subscriptionStatus.tone === 'danger' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(251, 191, 36, 0.1)',
              }
            ]}>
              <Text style={[
                styles.planStatusTitle,
                { color: subscriptionStatus.tone === 'danger' ? (isDark ? '#fca5a5' : colors.danger) : (isDark ? '#fde68a' : colors.warning) }
              ]}>
                {subscriptionStatus.label}
              </Text>
              <Text style={styles.planStatusText}>{subscriptionStatus.message}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={{ height: 200, justifyContent: 'center' }}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : (
            <View style={styles.usageContainer}>
              {usageData.map((item, idx) => (
                <View key={idx} style={styles.usageItem}>
                  <View style={styles.usageInfo}>
                    <View style={styles.usageLabelRow}>
                      <IconSymbol name={item.icon as any} size={14} color={item.isOver ? overColor : colors.slate400} />
                      <Text style={[styles.usageLabel, item.isOver && { color: overColor }]}>{item.label}</Text>
                    </View>
                    <Text style={[styles.usageValue, item.isOver && { color: overColor }]}>
                      {item.value} <Text style={styles.usageLimit}>/ {item.limit}</Text>
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <LinearGradient
                      colors={item.isOver ? ['#ef4444', '#b91c1c'] : ['#CA9C68', '#A77B52']}
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
              onPress={() => router.push('/(tabs)/pricing')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(202, 156, 104, 0.1)' }]}>
                  <IconSymbol name="sparkles" size={18} color={colors.gold} />
                </View>
                <Text style={styles.itemText}>Upgrade Plan</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color={isDark ? '#475569' : colors.slate600} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/pricing')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                  <IconSymbol name="creditcard.fill" size={18} color={colors.slate400} />
                </View>
                <Text style={styles.itemText}>Billing History</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color={isDark ? '#475569' : colors.slate600} />
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
                  <IconSymbol name="message.fill" size={18} color={colors.slate400} />
                </View>
                <Text style={styles.itemText}>Support Chat</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color={isDark ? '#475569' : colors.slate600} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.listItem}
              activeOpacity={0.7}
              onPress={() => router.push('/contact')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.listIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.1)' }]}>
                  <IconSymbol name="questionmark.circle.fill" size={18} color={colors.slate400} />
                </View>
                <Text style={styles.itemText}>Help Center</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color={isDark ? '#475569' : colors.slate600} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.versionText}>EveBash v{APP_VERSION}</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  planCard: {
    backgroundColor: colors.deepSlate,
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: isDark ? '#64748b' : colors.slate600,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  planName: {
    fontSize: 24,
    color: colors.white,
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
  planStatusBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
  },
  planStatusTitle: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  planStatusText: {
    fontSize: 13,
    lineHeight: 19,
    color: isDark ? '#e2e8f0' : colors.slate300,
    fontFamily: 'Inter_500Medium',
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
    color: colors.slate400,
    fontFamily: 'Inter_500Medium',
  },
  usageValue: {
    fontSize: 14,
    color: isDark ? '#f1f5f9' : colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  usageLimit: {
    color: isDark ? '#475569' : colors.slate600,
    fontSize: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.tint(0.07),
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
    color: isDark ? '#64748b' : colors.slate600,
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
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.cardBorder,
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
    color: isDark ? '#f1f5f9' : colors.white,
    fontFamily: 'Outfit_600SemiBold',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 12,
    color: isDark ? '#594C3D' : colors.slate600,
    fontFamily: 'Inter_400Regular',
  },
});
