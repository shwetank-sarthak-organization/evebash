import { Tabs } from 'expo-router';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import * as React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/context/ThemeContext';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CREATE_BUSINESS_SECTION_ROUTES = new Set(['manage-business']);
const EB_NETWORK_SECTION_ROUTES = new Set(['business/[id]']);

export default function TabLayout() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      backBehavior="none"
      tabBar={(props) => {
        const currentRoute = props.state.routes[props.state.index];
        const shouldHighlightCreateBusiness = currentRoute && CREATE_BUSINESS_SECTION_ROUTES.has(currentRoute.name);
        const shouldHighlightEbNetwork = currentRoute && EB_NETWORK_SECTION_ROUTES.has(currentRoute.name);

        if (!shouldHighlightCreateBusiness && !shouldHighlightEbNetwork) {
          return <BottomTabBar {...props} />;
        }

        const targetRouteName = shouldHighlightEbNetwork ? 'explore-business' : 'businesses';
        const targetTabIndex = props.state.routes.findIndex((route) => route.name === targetRouteName);
        if (targetTabIndex < 0) {
          return <BottomTabBar {...props} />;
        }

        return <BottomTabBar {...props} state={{ ...props.state, index: targetTabIndex }} />;
      }}
      screenOptions={{
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.slate400,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
          paddingTop: 8,
          height: 55 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 5 : 10,
        },
      }}>

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
          title: 'Create Business',
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
        name="explore-business"
        options={{
          title: 'EB Network',
          tabBarIcon: ({ color }) => (
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/>
              <Path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/>
              <Path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>
            </Svg>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="your-events"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="business/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="manage-business"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="usage"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="pricing"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
