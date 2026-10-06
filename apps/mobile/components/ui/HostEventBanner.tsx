import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MidnightColors } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';

type HostEventBannerProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** "FOR HOSTS / Host an Event / Create Now" banner shown on the Dashboard and Your Events screens. */
export function HostEventBanner({ onPress, style }: HostEventBannerProps) {
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <TouchableOpacity activeOpacity={0.9} style={[styles.card, style]} onPress={onPress}>
      <LinearGradient
        colors={['#151B21', '#10161C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>FOR HOSTS</Text>
          </View>
          <Text style={styles.title}>Host an Event</Text>
          <Text style={styles.subtitle}>
            Create a stunning private gallery for weddings, parties or corporate meets.
          </Text>
          <View style={styles.button}>
            <IconSymbol name="plus.circle.fill" size={12} color={MidnightColors.onAccent} />
            <Text style={styles.buttonText}>Create Now</Text>
          </View>
        </View>
        <View style={styles.iconContainer}>
          <IconSymbol name="calendar.badge.plus" size={60} color="rgba(202,156,104,0.22)" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  card: {
    marginHorizontal: 24,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.16)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
  },
  gradient: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(202, 156, 104,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104, 0.18)',
  },
  badgeText: {
    color: colors.gold,
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.8,
  },
  title: {
    color: isDark ? '#ffffff' : colors.deepSlate,
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
    lineHeight: 16,
  },
  // Same look as the Dashboard's "Join Event" pill
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    fontSize: 12,
    color: colors.onAccent,
    fontFamily: 'Outfit_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  iconContainer: {
    marginLeft: 8,
  },
});
