import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function MenuScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const getPlanLabel = (role?: string) => {
    switch (role) {
      case "admin":    return "Super Admin";
      case "elite":    return "Elite Plan";
      case "premium":  return "Premium Plan";
      case "standard": return "Standard Plan";
      case "basic":    return "Basic Plan";
      default:         return "Free Plan";
    }
  };

  const menuItems = [
    { id: 'sample-galleries', title: 'Sample Galleries', route: '/sample-galleries', icon: 'photo.fill' },
    { id: 'pricing', title: 'Pricing', route: '/pricing', icon: 'star.fill' },
    { id: 'contact', title: 'Contact Us', route: '/contact', icon: 'paperplane.fill' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        
        {/* Header with Logo */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIconBox}>
              <IconSymbol name="camera.fill" size={24} color="#ffffff" />
            </View>
            <Text style={styles.logoText}>Lens & Frame</Text>
          </View>
        </View>

        {/* User Info Card */}
        {user && (
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <IconSymbol name="person.fill" size={20} color="#64748b" />
              </View>
              <View>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userPlan}>{getPlanLabel(user.role)}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.manageButton}
              onPress={() => router.push('/dashboard')}
            >
              <Text style={styles.manageButtonText}>Manage Galleries</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Navigation Links */}
        <View style={styles.listContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={item.id} 
              style={[
                styles.listItem, 
                index === menuItems.length - 1 && styles.lastItem
              ]}
              activeOpacity={0.7}
              onPress={() => item.route ? router.push(item.route as any) : null}
            >
              <View style={styles.listItemLeft}>
                <View style={styles.listIconBox}>
                  <IconSymbol name={item.icon as any} size={18} color="#64748b" />
                </View>
                <Text style={styles.itemText}>{item.title}</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        {user && (
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIconBox: {
    backgroundColor: '#0f172a',
    padding: 8,
    borderRadius: 12,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  userCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  userPlan: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  manageButton: {
    backgroundColor: '#f0f9ff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  manageButtonText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
  },
  logoutButton: {
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 40,
  },
  logoutText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
