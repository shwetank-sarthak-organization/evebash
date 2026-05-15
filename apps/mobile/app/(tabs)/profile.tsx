import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { getFollowersCount, getFollowingCount } from '@/lib/firestore';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      if (user?.uid) {
        const [followers, following] = await Promise.all([
          getFollowersCount(user.uid),
          getFollowingCount(user.uid)
        ]);
        setStats({ followers, following });
      }
    };
    fetchStats();
  }, [user]);

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Profile Header */}
        <LinearGradient
          colors={['#0f172a', '#020617']}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle}>My Profile</Text>
          </View>
          
          <View style={styles.profileRow}>
            <View style={styles.avatarRing}>
              {user.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <IconSymbol name="person.fill" size={32} color="#64748b" />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <View style={styles.headerBadgeRow}>
                <View style={styles.planChip}>
                  <IconSymbol name="crown.fill" size={8} color="#d4af37" />
                  <Text style={styles.planChipText}>{user.role || 'Elite User'}</Text>
                </View>
                <View style={styles.socialStatsRow}>
                  <Text style={styles.socialStatText}>
                    <Text style={styles.socialStatNumber}>{stats.followers}</Text> Followers
                  </Text>
                  <View style={styles.dotSeparator} />
                  <Text style={styles.socialStatText}>
                    <Text style={styles.socialStatNumber}>{stats.following}</Text> Following
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Account Settings</Text>
          </View>

          <View style={styles.settingsCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="person.fill" size={18} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{user.name}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <IconSymbol name="envelope.fill" size={16} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{user.email || 'Not provided'}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity 
              style={styles.actionItem} 
              activeOpacity={0.7} 
              onPress={() => router.push('/usage')}
            >
              <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                <IconSymbol name="chart.bar.fill" size={18} color="#d4af37" />
              </View>
              <Text style={styles.actionText}>Usage & Plan</Text>
              <IconSymbol name="chevron.right" size={16} color="#475569" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => router.push('/(tabs)/')}>
              <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                <IconSymbol name="house.fill" size={18} color="#d4af37" />
              </View>
              <Text style={styles.actionText}>About Us</Text>
              <IconSymbol name="chevron.right" size={16} color="#475569" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7}>
              <View style={[styles.infoIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <IconSymbol name="pencil" size={18} color="#60a5fa" />
              </View>
              <Text style={styles.actionText}>Edit Profile Info</Text>
              <IconSymbol name="chevron.right" size={16} color="#475569" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8} onPress={logout}>
            <IconSymbol name="rectangle.portrait.and.arrow.right" size={20} color="#f87171" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Wedding Album v1.0.4</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#020617' 
  },
  container: { 
    flex: 1 
  },
  header: { 
    paddingTop: 20, 
    paddingBottom: 40,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.25)',
  },
  headerTopRow: { 
    paddingHorizontal: 24, 
    marginBottom: 24, 
    alignItems: 'center' 
  },
  headerTitle: { 
    fontSize: 13, 
    fontFamily: 'Inter_700Bold', 
    color: '#94a3b8', 
    textTransform: 'uppercase', 
    letterSpacing: 2 
  },
  profileRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24 
  },
  profileInfo: { 
    marginLeft: 20, 
    flex: 1 
  },
  avatarRing: {
    padding: 3,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
  },
  avatarPlaceholder: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#0f172a', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)' 
  },
  userName: { 
    fontSize: 26, 
    fontFamily: 'Outfit_800ExtraBold', 
    color: '#f8fafc', 
    letterSpacing: -0.5 
  },
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  planChipText: {
    fontSize: 10,
    color: '#d4af37',
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerBadgeRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  socialStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socialStatText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
  },
  socialStatNumber: {
    color: '#f1f5f9',
    fontFamily: 'Outfit_700Bold',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#334155',
  },
  content: { 
    paddingHorizontal: 24, 
    marginTop: 32 
  },
  sectionHead: {
    marginBottom: 16,
    marginLeft: 4,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingsCard: { 
    backgroundColor: '#0f172a', 
    borderRadius: 24, 
    padding: 24, 
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 20, 
    elevation: 10 
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: { 
    fontSize: 11, 
    fontFamily: 'Inter_700Bold', 
    color: '#64748b', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  infoValue: { 
    fontSize: 16, 
    fontFamily: 'Outfit_600SemiBold', 
    color: '#f1f5f9',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 20,
  },
  actionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16,
  },
  actionText: { 
    flex: 1, 
    fontSize: 16, 
    fontFamily: 'Outfit_600SemiBold', 
    color: '#f1f5f9' 
  },
  signOutBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 12, 
    marginTop: 32, 
    paddingVertical: 18, 
    borderRadius: 20, 
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.15)',
  },
  signOutText: { 
    color: '#f87171', 
    fontFamily: 'Outfit_800ExtraBold', 
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#475569',
    fontFamily: 'Inter_400Regular',
  },
});
