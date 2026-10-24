import { Tabs } from 'expo-router';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

import { HapticTab } from '@/components/haptic-tab';
import { DashboardTabIcon, EbNetworkTabIcon, HostTabIcon, ProfileTabIcon, appTabBarMetrics } from '@/components/navigation/appTabs';
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
          ...appTabBarMetrics(insets.bottom),
        },
      }}>

      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <DashboardTabIcon color={color} />,
        }}
      />

      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Host',
          tabBarIcon: ({ color }) => <HostTabIcon color={color} />,
        }}
      />

      <Tabs.Screen
        name="vendors"
        options={{
          // EB Network "coming soon" page; the route stays "vendors" so existing links keep working.
          title: 'EB Network',
          tabBarIcon: ({ color }) => <EbNetworkTabIcon color={color} />,
        }}
      />

      <Tabs.Screen
        name="businesses"
        options={{
          // Hidden for v1; restore by removing href: null (Phase 2)
          href: null,
          title: 'EB Business',
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
        name="explore-business"
        options={{
          // Hidden for v1; restore by removing href: null (Phase 2)
          href: null,
          title: 'EB Network',
          tabBarIcon: ({ color }) => <EbNetworkTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileTabIcon color={color} />,
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
        name="vault"
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
    </Tabs>
  );
}
