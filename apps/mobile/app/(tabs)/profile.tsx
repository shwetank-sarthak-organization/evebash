import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme } from '@/context/ThemeContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getFollowersCount, getFollowingCount, updateUserPrivacy, isUsernameUnique, updateUserProfile } from '@/lib/firestore';
import { uploadProfileImage } from '@/lib/storage';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { theme, setTheme, colors, isDark } = useAppTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);

  // Edit Profile States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editImageBase64, setEditImageBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [isUsernameValid, setIsUsernameValid] = useState(true);

  // Debounced username checker
  useEffect(() => {
    if (!isEditing) return;

    const normalized = editUsername.trim().toLowerCase();

    // If it matches current username exactly, it's valid
    if (normalized === user?.username?.toLowerCase()) {
      setUsernameStatus('idle');
      setIsUsernameValid(true);
      return;
    }

    if (!normalized) {
      setUsernameStatus('idle');
      setIsUsernameValid(false);
      return;
    }

    // Check syntax format (3-30 chars, lowercase alphanumeric, dot, underscore)
    const regex = /^[a-z0-9_.]+$/;
    if (normalized.length < 3 || normalized.length > 30 || !regex.test(normalized)) {
      setUsernameStatus('invalid');
      setIsUsernameValid(false);
      return;
    }

    setUsernameStatus('checking');

    const timer = setTimeout(async () => {
      try {
        const isUnique = await isUsernameUnique(normalized, user?.uid);
        if (isUnique) {
          setUsernameStatus('available');
          setIsUsernameValid(true);
        } else {
          setUsernameStatus('taken');
          setIsUsernameValid(false);
        }
      } catch (err) {
        console.error('Error checking username uniqueness:', err);
        setUsernameStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editUsername, isEditing, user]);

  const openEditModal = () => {
    setEditName(user?.name || '');
    setEditUsername(user?.username || '');
    setEditImage(user?.profileImage || null);
    setEditImageBase64(null);
    setUsernameStatus('idle');
    setIsUsernameValid(true);
    setIsEditing(true);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'We need access to your photos to update your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setEditImage(asset.uri);
        setEditImageBase64(`data:image/jpeg;base64,${asset.base64}`);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const handleSaveChanges = async () => {
    if (!user?.uid) return;
    if (!editName.trim()) {
      Alert.alert('Error', 'Full name cannot be empty.');
      return;
    }
    if (!isUsernameValid) {
      Alert.alert('Error', 'Please choose a valid and available username.');
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = user.profileImage || '';

      if (editImageBase64) {
        const uploadResult = await uploadProfileImage(editImageBase64, user.uid);
        if (uploadResult && uploadResult.url) {
          finalImageUrl = uploadResult.url;
        }
      }

      const success = await updateUserProfile(user.uid, {
        name: editName.trim(),
        username: editUsername.trim().toLowerCase(),
        profileImage: finalImageUrl,
      });

      if (success) {
        Alert.alert('Success', 'Profile updated successfully.');
        setIsEditing(false);
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (user?.uid) {
        const [followers, following] = await Promise.all([
          getFollowersCount(user.uid),
          getFollowingCount(user.uid)
        ]);
        setStats({ followers, following });
        if (user.isPrivate !== undefined) setIsPrivate(user.isPrivate);
      }
    };
    fetchData();
  }, [user]);

  const togglePrivacy = async () => {
    if (!user?.uid || updatingPrivacy) return;
    setUpdatingPrivacy(true);
    const newStatus = !isPrivate;
    const success = await updateUserPrivacy(user.uid, newStatus);
    if (success) {
      setIsPrivate(newStatus);
    }
    setUpdatingPrivacy(false);
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Profile Header */}
        <LinearGradient
          colors={[colors.deepSlate, colors.background]}
          style={styles.header}
        >

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
              {user.username && (
                <Text style={styles.userHandle}>@{user.username}</Text>
              )}
              <View style={styles.headerBadgeRow}>
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
            <Text style={styles.sectionLabel}>Account Info</Text>
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.7} onPress={openEditModal}>
              <IconSymbol name="pencil" size={14} color="#60a5fa" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
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
                <IconSymbol name="person.fill" size={18} color="#d4af37" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Username</Text>
                <Text style={styles.infoValue}>@{user.username || 'Not set'}</Text>
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

            <TouchableOpacity style={styles.usageCard} activeOpacity={0.8} onPress={() => router.push('/usage')}>
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.15)', 'rgba(212, 175, 55, 0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.usageGradient}
              >
                <View style={styles.usageIconBox}>
                  <IconSymbol name="chart.bar.fill" size={20} color="#d4af37" />
                </View>
                <View style={styles.usageTextContent}>
                  <Text style={styles.usageTitle}>Usage & Plan</Text>
                  <Text style={styles.usageSubtitle}>View limits and upgrade</Text>
                </View>
                <View style={styles.usageArrowBox}>
                  <IconSymbol name="chevron.right" size={14} color="#d4af37" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={togglePrivacy} disabled={updatingPrivacy}>
              <View style={[styles.infoIconBox, { backgroundColor: isPrivate ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                <IconSymbol name={isPrivate ? "lock.fill" : "globe"} size={18} color={isPrivate ? "#ef4444" : "#10b981"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionText}>{isPrivate ? 'Private Account' : 'Public Account'}</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                  {isPrivate ? 'Followers must be approved' : 'Anyone can follow you'}
                </Text>
              </View>
              <View style={[styles.toggleBtn, isPrivate && styles.toggleBtnActive]}>
                {updatingPrivacy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={[styles.toggleDot, isPrivate && styles.toggleDotActive]} />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.actionItem}>
              <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                <IconSymbol name={isDark ? "moon.fill" : "sun.max.fill"} size={18} color="#d4af37" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionText}>App Theme</Text>
                <Text style={{ fontSize: 11, color: colors.slate400, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                  Switch appearance style
                </Text>
              </View>
              <View style={styles.themeToggleContainer}>
                <TouchableOpacity 
                  style={[styles.themePill, isDark && styles.themePillActive]} 
                  activeOpacity={0.8}
                  onPress={() => setTheme('dark')}
                >
                  <Text style={[styles.themePillText, isDark && styles.themePillTextActive]}>Dark</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.themePill, !isDark && styles.themePillActive]} 
                  activeOpacity={0.8}
                  onPress={() => setTheme('light')}
                >
                  <Text style={[styles.themePillText, !isDark && styles.themePillTextActive]}>Light</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionItem} activeOpacity={0.7} onPress={() => router.push('/(tabs)/')}>
              <View style={[styles.infoIconBox, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                <IconSymbol name="house.fill" size={18} color="#d4af37" />
              </View>
              <Text style={styles.actionText}>About Us</Text>
              <IconSymbol name="chevron.right" size={16} color={colors.slate400} />
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

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditing}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!saving) setIsEditing(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity 
                onPress={() => setIsEditing(false)} 
                disabled={saving}
                style={styles.modalCloseBtn}
              >
                <IconSymbol name="xmark" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Profile Image Picking Area */}
              <View style={styles.editAvatarSection}>
                <TouchableOpacity 
                  onPress={handlePickImage} 
                  disabled={saving}
                  activeOpacity={0.8}
                  style={styles.editAvatarWrapper}
                >
                  {editImage ? (
                    <Image source={{ uri: editImage }} style={styles.editAvatar} />
                  ) : (
                    <View style={styles.editAvatarPlaceholder}>
                      <IconSymbol name="person.fill" size={40} color="#64748b" />
                    </View>
                  )}
                  <View style={styles.changePhotoOverlay}>
                    <IconSymbol name="camera.fill" size={16} color="#ffffff" />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handlePickImage} 
                  disabled={saving}
                  style={styles.changePhotoTextBtn}
                >
                  <Text style={styles.changePhotoText}>Change Profile Photo</Text>
                </TouchableOpacity>
              </View>

              {/* Edit Form */}
              <View style={styles.formContainer}>
                
                {/* Full Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <IconSymbol name="person.fill" size={16} color="#d4af37" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Enter full name"
                      placeholderTextColor="#475569"
                      editable={!saving}
                    />
                  </View>
                </View>

                {/* Username Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Username</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.usernamePrefix}>@</Text>
                    <TextInput
                      style={[styles.textInput, { paddingLeft: 4 }]}
                      value={editUsername}
                      onChangeText={(val) => setEditUsername(val.replace(/\s+/g, '').toLowerCase())}
                      placeholder="username"
                      placeholderTextColor="#475569"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!saving}
                    />
                    {usernameStatus === 'checking' && (
                      <ActivityIndicator size="small" color="#d4af37" style={styles.inputSpinner} />
                    )}
                  </View>
                  
                  {/* Validation Feedback */}
                  {editUsername.trim().toLowerCase() !== user?.username?.toLowerCase() && (
                    <View style={styles.feedbackContainer}>
                      {usernameStatus === 'available' && (
                        <Text style={[styles.feedbackText, styles.feedbackAvailable]}>
                          ✓ Username is available
                        </Text>
                      )}
                      {usernameStatus === 'taken' && (
                        <Text style={[styles.feedbackText, styles.feedbackTaken]}>
                          ✗ Username is already taken
                        </Text>
                      )}
                      {usernameStatus === 'invalid' && (
                        <Text style={[styles.feedbackText, styles.feedbackInvalid]}>
                          ⚠ 3-30 chars, lowercase, letters, numbers, underscores, or dots
                        </Text>
                      )}
                    </View>
                  )}
                </View>

              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => setIsEditing(false)}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.saveBtn,
                    (!editName.trim() || !isUsernameValid || saving) && styles.saveBtnDisabled
                  ]} 
                  onPress={handleSaveChanges}
                  disabled={!editName.trim() || !isUsernameValid || saving}
                  activeOpacity={0.7}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#020617" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  container: { 
    flex: 1 
  },
  header: { 
    paddingTop: 20, 
    paddingBottom: 40,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
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
    borderColor: colors.border,
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
    backgroundColor: colors.slate900, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: colors.cardBorder 
  },
  userName: { 
    fontSize: 26, 
    fontFamily: 'Outfit_800ExtraBold', 
    color: colors.white, 
    letterSpacing: -0.5 
  },
  userHandle: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: colors.gold,
    marginTop: 2,
    textTransform: 'lowercase',
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
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
  },
  socialStatNumber: {
    color: colors.white,
    fontFamily: 'Outfit_700Bold',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.slate700,
  },
  content: { 
    paddingHorizontal: 24, 
    marginTop: 32 
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: 4,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editBtnText: {
    color: '#60a5fa',
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  sectionLabel: {
    fontSize: 13,
    color: colors.slate400,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingsCard: { 
    backgroundColor: colors.deepSlate, 
    borderRadius: 24, 
    padding: 24, 
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: isDark ? 0.3 : 0.05, 
    shadowRadius: 20, 
    elevation: isDark ? 10 : 2 
  },
  usageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  usageGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  usageIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageTextContent: {
    flex: 1,
  },
  usageTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: colors.gold,
    marginBottom: 4,
  },
  usageSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.slate400,
  },
  usageArrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: colors.slate400, 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  infoValue: { 
    fontSize: 16, 
    fontFamily: 'Outfit_600SemiBold', 
    color: colors.white,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
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
    color: colors.white 
  },
  toggleBtn: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.slate800,
    padding: 2,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#10b981',
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
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
    color: colors.slate400,
    fontFamily: 'Inter_400Regular',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.deepSlate,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: isDark ? 0.5 : 0.08,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    color: colors.white,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  editAvatarSection: {
    alignItems: 'center',
    marginVertical: 28,
  },
  editAvatarWrapper: {
    position: 'relative',
    padding: 3,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: colors.border,
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoOverlay: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: colors.gold,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.deepSlate,
  },
  changePhotoTextBtn: {
    marginTop: 12,
  },
  changePhotoText: {
    color: '#60a5fa',
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  formContainer: {
    gap: 20,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  usernamePrefix: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: colors.gold,
    marginRight: 2,
  },
  textInput: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    height: '100%',
  },
  inputSpinner: {
    marginLeft: 8,
  },
  feedbackContainer: {
    marginTop: 4,
    marginLeft: 4,
  },
  feedbackText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  feedbackAvailable: {
    color: '#10b981',
  },
  feedbackTaken: {
    color: '#ef4444',
  },
  feedbackInvalid: {
    color: '#f43f5e',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
  },
  cancelBtnText: {
    color: colors.slate400,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  saveBtn: {
    flex: 2,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: colors.slate800,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#020617',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  themeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  themePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 52,
    alignItems: 'center',
  },
  themePillActive: {
    backgroundColor: colors.gold,
  },
  themePillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.slate400,
  },
  themePillTextActive: {
    color: '#020617',
    fontFamily: 'Inter_700Bold',
  },
});
