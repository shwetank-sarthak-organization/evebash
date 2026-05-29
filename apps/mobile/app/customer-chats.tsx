import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter, Stack } from 'expo-router';
import { getUserChatRooms, ChatRoom } from '@/lib/firestore';
import { useAuth } from '@/context/AuthContext';

export default function CustomerChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);

  useEffect(() => {
    if (user?.uid) {
      fetchChatRooms();
    }
  }, [user]);

  const fetchChatRooms = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await getUserChatRooms(user.uid, 'client');
      setChatRooms(data);
    } catch (error) {
      console.error('Error fetching customer chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#d4af37" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>My Messages</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {chatRooms.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBg}>
              <IconSymbol name="bubble.left.fill" size={36} color="#d4af37" />
            </View>
            <Text style={styles.emptyStateTitle}>No Messages Yet</Text>
            <Text style={styles.emptyStateDesc}>
              Enquiries marked as "In-App Chat (Private)" will appear here once started. Explore vendors to connect!
            </Text>
            <TouchableOpacity 
              style={styles.exploreBtn} 
              onPress={() => router.push('/(tabs)/explore-business')}
            >
              <Text style={styles.exploreBtnText}>Browse Vendors</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {chatRooms.map((room) => {
              const dateStr = room.lastMessageAt?.toDate 
                ? room.lastMessageAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Recent';

              const isClosed = room.status === 'closed';
              const getIsExpired = () => {
                if (!room.createdAt) return false;
                let createdTime = 0;
                if (typeof room.createdAt.toDate === 'function') {
                  createdTime = room.createdAt.toDate().getTime();
                } else if (room.createdAt.seconds) {
                  createdTime = room.createdAt.seconds * 1000;
                } else if (room.createdAt instanceof Date) {
                  createdTime = room.createdAt.getTime();
                } else {
                  createdTime = new Date().getTime();
                }
                return (new Date().getTime() - createdTime) > 48 * 60 * 60 * 1000;
              };
              const isExpired = getIsExpired();

              return (
                <TouchableOpacity 
                  key={room.id}
                  style={[styles.chatCard, (isClosed || isExpired) && styles.inactiveCard]}
                  onPress={() => router.push({
                    pathname: '/chat',
                    params: { roomId: room.id, otherUserName: room.vendorName }
                  })}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {room.vendorName ? room.vendorName.charAt(0).toUpperCase() : 'V'}
                      </Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={styles.nameRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                          <Text style={styles.vendorName} numberOfLines={1}>{room.vendorName}</Text>
                          {isClosed && (
                            <View style={styles.closedBadge}>
                              <Text style={styles.badgeText}>Ended</Text>
                            </View>
                          )}
                          {!isClosed && isExpired && (
                            <View style={styles.expiredBadge}>
                              <Text style={styles.badgeText}>Expired</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.dateText}>{dateStr}</Text>
                      </View>
                      <Text style={styles.lastMessage} numberOfLines={1}>{room.lastMessage}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    color: '#ffffff',
    fontFamily: 'Outfit_700Bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  exploreBtn: {
    backgroundColor: '#d4af37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: '#020617',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  listContainer: {
    gap: 12,
  },
  chatCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#d4af37',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vendorName: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  lastMessage: {
    color: '#94a3b8',
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  inactiveCard: {
    opacity: 0.6,
  },
  closedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(100, 116, 139, 0.4)',
  },
  expiredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: '#cbd5e1',
  },
});
