import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import type { SocialNetwork } from '../../../../shared/themes/themeContent';

// The social networks a theme links to (shared/themes/themeContent.ts), drawn like the website's icons
// (src/components/icons/SocialIcons.tsx: lucide's Instagram and Facebook, and the X logo).

interface Props {
  size?: number;
  color?: string;
}

function InstagramIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={2} y={2} width={20} height={20} rx={5} ry={5} />
      <Path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <Path d="M17.5 6.5h.01" />
    </Svg>
  );
}

function FacebookIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </Svg>
  );
}

function XIcon({ size = 24, color = '#000' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </Svg>
  );
}

export const SOCIAL_ICONS: Readonly<Record<SocialNetwork, React.ComponentType<Props>>> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  x: XIcon,
};
