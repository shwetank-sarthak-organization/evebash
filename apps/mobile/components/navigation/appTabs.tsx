import * as React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/icon-symbol';

// The app's bottom bar: the visible tabs, their icons and the bar's height. app/(tabs)/_layout.tsx builds the real
// tab bar from these; ThemedAppBar draws the same bar on screens outside the tabs (a gallery) in the gallery
// theme's colours.

type IconProps = { color: string };

export function DashboardTabIcon({ color }: IconProps) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Rect width="7" height="9" x="3" y="3" rx="1" />
      <Rect width="7" height="5" x="14" y="3" rx="1" />
      <Rect width="7" height="9" x="14" y="12" rx="1" />
      <Rect width="7" height="5" x="3" y="16" rx="1" />
    </Svg>
  );
}

export function HostTabIcon({ color }: IconProps) {
  return <IconSymbol size={28} name="calendar" color={color} />;
}

export function EbNetworkTabIcon({ color }: IconProps) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/>
      <Path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/>
      <Path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>
    </Svg>
  );
}

export function ProfileTabIcon({ color }: IconProps) {
  return <IconSymbol size={28} name="person.fill" color={color} />;
}

/** The tabs shown in the bottom bar, in order; `name` is the route in app/(tabs) */
export const APP_TABS = [
  { name: 'dashboard', title: 'Dashboard', Icon: DashboardTabIcon },
  { name: 'gallery', title: 'Host', Icon: HostTabIcon },
  // EB Network "coming soon" page; the route stays "vendors" so existing links keep working.
  { name: 'vendors', title: 'EB Network', Icon: EbNetworkTabIcon },
  { name: 'profile', title: 'Profile', Icon: ProfileTabIcon },
] as const;

export type AppTabName = (typeof APP_TABS)[number]['name'];

/** Size of the bottom bar for a given bottom safe-area inset */
export function appTabBarMetrics(insetBottom: number) {
  return {
    height: 55 + insetBottom,
    paddingTop: 8,
    paddingBottom: insetBottom > 0 ? insetBottom - 5 : 10,
  };
}
