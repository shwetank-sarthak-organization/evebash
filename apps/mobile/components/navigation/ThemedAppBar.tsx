import * as React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_TABS, appTabBarMetrics, type AppTabName } from './appTabs';

// The app's bottom bar on a screen outside the tabs (a gallery), drawn in the gallery theme's colours. Same tabs,
// icons and size as the real tab bar (app/(tabs)/_layout.tsx); tapping a tab opens that tab.

export type AppBarColors = {
  background: string;
  border: string;
  active: string;
  inactive: string;
};

export function ThemedAppBar({ colors, activeTab }: { colors: AppBarColors; activeTab?: AppTabName }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const metrics = appTabBarMetrics(insets.bottom);

  return (
    <View
      accessibilityRole="tablist"
      style={[local.bar, metrics, { backgroundColor: colors.background, borderTopColor: colors.border }]}
    >
      {APP_TABS.map(({ name, title, Icon }) => {
        const active = name === activeTab;
        const color = active ? colors.active : colors.inactive;
        return (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={title}
            onPressIn={() => {
              // Same soft tap as the real tab bar (components/haptic-tab.tsx)
              if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onPress={() => router.navigate(`/(tabs)/${name}` as any)}
            style={local.tab}
          >
            <Icon color={color} />
            <Text style={[local.label, { color }]} numberOfLines={1}>{title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10, fontWeight: '500' },
});
