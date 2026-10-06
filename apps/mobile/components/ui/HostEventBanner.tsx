import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from './icon-symbol';

interface HostEventBannerProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Shared entry point to event creation from Dashboard and Your Events. */
export function HostEventBanner({ onPress, style }: HostEventBannerProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.card, style]}
      accessibilityRole="button"
      accessibilityLabel="Host an event. Create now"
    >
      <LinearGradient colors={['#151B21', '#10161C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.content}>
        <View style={styles.text}>
          <View style={styles.badge}><Text style={styles.badgeText}>FOR HOSTS</Text></View>
          <Text style={styles.title}>Host an Event</Text>
          <Text style={styles.subtitle}>Create a stunning private gallery for weddings, parties or corporate meets.</Text>
          <View style={styles.action}>
            <Text style={styles.actionText}>Create Now</Text>
            <IconSymbol name="chevron.right" size={12} color="#13191F" />
          </View>
        </View>
        <View style={styles.icon} accessible={false}>
          <IconSymbol name="calendar.badge.plus" size={60} color="rgba(202,156,104,0.22)" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 24, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(202,156,104,0.16)' },
  content: { padding: 18, flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, marginBottom: 8, backgroundColor: 'rgba(202,156,104,0.1)', borderWidth: 1, borderColor: 'rgba(202,156,104,0.18)' },
  badgeText: { color: '#CA9C68', fontSize: 10, fontFamily: 'Outfit_800ExtraBold', letterSpacing: 0.8 },
  title: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Outfit_800ExtraBold', marginBottom: 2 },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 16, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#CA9C68', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: '#13191F', fontSize: 12, fontFamily: 'Outfit_700Bold' },
  icon: { marginLeft: 8 },
});
