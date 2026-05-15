import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { getUsers, followUser, unfollowUser, getFollowing, getSocialFeed } from '@/lib/firestore';

const { width } = Dimensions.get('window');

type TabType = 'suggestions' | 'following' | 'feed';

export default function SocialScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'feed' && followingIds.length > 0) {
      fetchFeed();
    }
  }, [activeTab, followingIds]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [allUsers, following] = await Promise.all([
        getUsers(),
        getFollowing(user.uid)
      ]);
      setUsersList(allUsers.filter(u => u.id !== user.uid));
      setFollowingIds(following || []);
    } catch (error) {
      console.error("Error fetching social data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeed = async () => {
    if (followingIds.length === 0) {
      setFeedItems([]);
      return;
    }
    try {
      const feed = await getSocialFeed(followingIds);
      setFeedItems(feed);
    } catch (error) {
      console.error("Error fetching feed:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), fetchFeed()]);
    setRefreshing(false);
  };

  const handleFollowToggle = async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    if (!user || actionLoading) return;
    setActionLoading(targetUserId);
    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(user.uid, targetUserId);
        setFollowingIds(prev => prev.filter(id => id !== targetUserId));
      } else {
        await followUser(user.uid, targetUserId);
        setFollowingIds(prev => [...prev, targetUserId]);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const navigateToDetail = (item: any) => {
    if (item.type === 'event' || item.type === 'join' || item.type === 'like' || item.type === 'comment') {
      const id = item.eventId || item.id;
      if (id) router.push(`/events/${id}`);
    } else if (item.type === 'business') {
      router.push(`/business/${item.id}`);
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const followingList = filteredUsers.filter(u => followingIds.includes(u.id));
  const suggestionsList = filteredUsers.filter(u => !followingIds.includes(u.id));

  const renderFeedItem = (item: any) => {
    const itemUser = usersList.find(u => u.id === (item.userId || item.createdBy));
    const date = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Recently';

    let icon = "sparkles";
    let actionText = "activity";
    let color = "#d4af37";
    let showViewBtn = true;

    if (item.type === 'like') {
      icon = "heart.fill";
      actionText = "liked a photo";
      color = "#ef4444";
    } else if (item.type === 'comment') {
      icon = "bubble.right";
      actionText = "commented on a photo";
      color = "#3b82f6";
    } else if (item.type === 'event') {
      icon = "calendar.fill";
      actionText = `created event "${item.title}"`;
      color = "#10b981";
    } else if (item.type === 'business') {
      icon = "briefcase.fill";
      actionText = `registered a new business: "${item.name}"`;
      color = "#8b5cf6";
    } else if (item.type === 'join') {
      icon = "checkmark.seal.fill";
      actionText = `joined event "${item.eventTitle || 'Gallery'}"`;
      color = "#d4af37";
    }

    return (
      <View key={item.id} style={styles.feedCard}>
        <View style={styles.feedHeader}>
          <View style={styles.feedUserInfo}>
            <View style={styles.feedAvatarPlaceholder}>
              {itemUser?.profileImage ? (
                <Image source={{ uri: itemUser.profileImage }} style={styles.feedAvatar} />
              ) : (
                <Text style={styles.feedAvatarText}>{itemUser?.name?.charAt(0).toUpperCase() || '?'}</Text>
              )}
            </View>
            <View>
              <Text style={styles.feedUserName}>{itemUser?.name || item.userName || 'Someone'}</Text>
              <Text style={styles.feedTime}>{date}</Text>
            </View>
          </View>
          <View style={[styles.activityIcon, { backgroundColor: `${color}15` }]}>
            <IconSymbol name={icon as any} size={14} color={color} />
          </View>
        </View>
        
        <View style={styles.feedBody}>
          <Text style={styles.feedActionText}>
            {actionText}
            {item.text ? <Text style={styles.feedCommentText}>: "{item.text}"</Text> : null}
          </Text>

          {showViewBtn && (
            <TouchableOpacity 
              style={[styles.viewActionBtn, { borderColor: `${color}40` }]}
              onPress={() => navigateToDetail(item)}
            >
              <Text style={[styles.viewActionBtnText, { color: color }]}>View Details</Text>
              <IconSymbol name="chevron.right" size={12} color={color} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        
        {/* Header */}
        <LinearGradient
          colors={['#0f172a', '#020617']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Social Hub</Text>
          
          <View style={styles.searchContainer}>
            <IconSymbol name="magnifyingglass" size={18} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Tab Bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'feed' && styles.activeTab]}
              onPress={() => setActiveTab('feed')}
            >
              <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>Feed</Text>
              {activeTab === 'feed' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
              onPress={() => setActiveTab('suggestions')}
            >
              <Text style={[styles.tabText, activeTab === 'suggestions' && styles.activeTabText]}>Suggestions</Text>
              {activeTab === 'suggestions' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'following' && styles.activeTab]}
              onPress={() => setActiveTab('following')}
            >
              <View style={styles.tabContent}>
                <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>Following</Text>
                {followingIds.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{followingIds.length}</Text>
                  </View>
                )}
              </View>
              {activeTab === 'following' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />
          }
        >
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator color="#d4af37" size="large" />
              <Text style={styles.loadingText}>Syncing network...</Text>
            </View>
          ) : activeTab === 'feed' ? (
            <View style={styles.feedList}>
              {feedItems.length === 0 ? (
                <View style={styles.centerContainer}>
                  <View style={styles.emptyIconBox}>
                    <IconSymbol name="sparkles" size={48} color="#1e293b" />
                  </View>
                  <Text style={styles.emptyTitle}>Your feed is quiet</Text>
                  <Text style={styles.emptySubtitle}>Follow more people to see their latest activities and event updates.</Text>
                  <TouchableOpacity 
                    style={styles.browseBtn}
                    onPress={() => setActiveTab('suggestions')}
                  >
                    <Text style={styles.browseBtnText}>Explore People</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                feedItems.map(renderFeedItem)
              )}
            </View>
          ) : (
            <View style={styles.userList}>
              <Text style={styles.sectionTitle}>
                {activeTab === 'following' ? `People you follow (${followingList.length})` : 'Recommended for you'}
              </Text>
              {(activeTab === 'following' ? followingList : suggestionsList).map((item) => {
                const isFollowing = followingIds.includes(item.id);
                const isLoading = actionLoading === item.id;

                return (
                  <View key={item.id} style={styles.userCard}>
                    <View style={styles.userInfo}>
                      <View style={styles.avatarContainer}>
                        {item.profileImage ? (
                          <Image source={{ uri: item.profileImage }} style={styles.avatar} />
                        ) : (
                          <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{item.name?.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.nameContainer}>
                        <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{item.role || 'Member'}</Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={[
                        styles.followBtn, 
                        isFollowing && styles.followingBtn,
                        isLoading && { opacity: 0.7 }
                      ]}
                      onPress={() => handleFollowToggle(item.id, isFollowing)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={isFollowing ? "#94a3b8" : "#020617"} />
                      ) : (
                        <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                          {isFollowing ? 'Unfollow' : 'Follow'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  container: { flex: 1 },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: 20, 
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.15)',
  },
  headerTitle: { 
    fontSize: 28, 
    fontFamily: 'Outfit_800ExtraBold', 
    color: '#f8fafc', 
    marginBottom: 20,
    letterSpacing: -0.5
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#f8fafc',
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 20,
  },
  tab: {
    paddingBottom: 12,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#64748b',
  },
  activeTabText: {
    color: '#d4af37',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#d4af37',
    borderRadius: 2,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  countBadgeText: {
    color: '#d4af37',
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  content: { flex: 1 },
  centerContainer: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  emptyIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyTitle: {
    fontSize: 20,
    color: '#f8fafc',
    fontFamily: 'Outfit_700Bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  browseBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  browseBtnText: {
    color: '#d4af37',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  userList: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#475569',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    padding: 2,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#d4af37',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  nameContainer: {
    marginLeft: 14,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    color: '#f1f5f9',
    fontFamily: 'Outfit_600SemiBold',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  followBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#334155',
  },
  followBtnText: {
    color: '#020617',
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  followingBtnText: {
    color: '#94a3b8',
  },
  feedList: {
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  feedCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  feedAvatarText: {
    color: '#d4af37',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  feedUserName: {
    fontSize: 14,
    color: '#f1f5f9',
    fontFamily: 'Outfit_600SemiBold',
  },
  feedTime: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedBody: {
    marginTop: 4,
  },
  feedActionText: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  feedCommentText: {
    color: '#f1f5f9',
    fontFamily: 'Inter_500Medium',
    fontStyle: 'italic',
  },
  viewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 6,
  },
  viewActionBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
});
