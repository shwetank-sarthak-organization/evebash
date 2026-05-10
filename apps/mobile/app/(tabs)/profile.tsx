import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerGradient}>
          <View style={styles.headerTopRow}>
            <Text style={styles.mainTitle}>Profile</Text>
          </View>
          
          <View style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              {user.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <IconSymbol name="person.fill" size={32} color="#94a3b8" />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.settingsCard}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputText}>{user.name}</Text>
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputBox}>
                <Text style={styles.inputText}>{user.email}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.actionItem}>
              <View style={[styles.iconBox, { backgroundColor: '#f0f9ff' }]}>
                <IconSymbol name="pencil" size={18} color="#0284c7" />
              </View>
              <Text style={styles.actionText}>Edit Profile Info</Text>
              <IconSymbol name="chevron.right" size={16} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutBtn} onPress={logout}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="#ef4444" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  headerGradient: { paddingTop: 20, paddingBottom: 40 },
  headerTopRow: { paddingHorizontal: 24, marginBottom: 20, alignItems: 'center' },
  mainTitle: { fontSize: 14, fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2 },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 },
  profileInfo: { marginLeft: 16, flex: 1 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(255,255,255,0.1)' },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.05)' },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: 4 },
  userEmail: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  content: { paddingHorizontal: 20, marginTop: 20 },
  settingsCard: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  inputBox: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  inputText: { color: '#1e293b', fontWeight: '500' },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 8 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#334155' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, paddingVertical: 16, borderRadius: 16, backgroundColor: '#fef2f2' },
  signOutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
});
