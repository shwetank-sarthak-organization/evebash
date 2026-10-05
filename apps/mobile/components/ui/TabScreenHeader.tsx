import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/ThemeContext';
import { EveBashLogoBadge } from '@/components/EveBashLogo';
import { MidnightColors } from '@/constants/theme';

interface TabScreenHeaderProps {
  title: string;
  /** Single action shown on the right (e.g. <HeaderAction />). */
  right?: React.ReactNode;
}

/** Shared top header for the main tabs: EB logo left, title centre, one action right. */
export function TabScreenHeader({ title, right }: TabScreenHeaderProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <LinearGradient
      colors={isDark ? ['#151C22', '#22302F', MidnightColors.background] : [colors.deepSlate, colors.background]}
      style={[styles.header, { paddingTop: insets.top + 4 }]}
    >
      <View style={[styles.side, { justifyContent: 'flex-start' }]}>
        <EveBashLogoBadge />
      </View>
      <View style={styles.center}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
      </View>
      <View style={[styles.side, { justifyContent: 'flex-end' }]}>{right}</View>
    </LinearGradient>
  );
}

interface HeaderActionProps {
  onPress: () => void;
  accessibilityLabel: string;
  showBadge?: boolean;
  children: React.ReactNode;
}

/** 24pt icon button with a large hit area and optional unread dot. */
export function HeaderAction({ onPress, accessibilityLabel, showBadge, children }: HeaderActionProps) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center', position: 'relative' }}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      {children}
      {showBadge && (
        <View style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold }} />
      )}
    </TouchableOpacity>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.background,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(202, 156, 104, 0.12)',
  },
  side: { width: 48, flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    // lineHeight stays 38 (= logo badge height) so the header doesn't grow
    fontSize: 32,
    lineHeight: 38,
    fontFamily: 'AkayaKanadakaHeader_400Regular',
    color: colors.gold,
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
