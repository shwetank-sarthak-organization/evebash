import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#d4af37',
        tabBarInactiveTintColor: '#94a3b8',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#020617',
          borderTopWidth: 0,
          paddingTop: 8,
          height: 55 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 5 : 10,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'About Us',
          href: null,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore-business"
        options={{
          title: 'Marketplace',
          href: null,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Host',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="businesses"
        options={{
          title: 'Biz Hub',
          tabBarIcon: ({ color }) => (
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="m11 17 2 2a1 1 0 1 0 3-3"/>
              <Path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/>
              <Path d="m21 3 1 11h-2"/>
              <Path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/>
              <Path d="M3 4h8"/>
            </Svg>
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Rect width="7" height="9" x="3" y="3" rx="1" />
              <Rect width="7" height="5" x="14" y="3" rx="1" />
              <Rect width="7" height="9" x="14" y="12" rx="1" />
              <Rect width="7" height="5" x="3" y="16" rx="1" />
            </Svg>
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="line.3.horizontal" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
