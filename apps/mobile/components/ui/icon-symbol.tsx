// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'photo.fill': 'photo-library',
  'photo': 'photo',
  'person.fill': 'person',
  'line.3.horizontal': 'menu',
  'heart.fill': 'favorite',
  'heart': 'favorite-border',
  'bubble.right': 'chat-bubble-outline',
  'xmark': 'close',
  'star.fill': 'star',
  'checkmark': 'check',
  'info.circle': 'info',
  'person.2.fill': 'people',
  'camera.fill': 'photo-camera',
  'camera': 'camera-alt',
  'phone.fill': 'phone',
  'envelope.fill': 'mail',
  'clock.fill': 'schedule',
  'ellipsis': 'more-horiz',
  'plus': 'add',
  'photo.on.rectangle': 'collections',
  'shield.fill': 'shield',
  'rectangle.portrait.and.arrow.right': 'logout',
  'folder': 'folder',
  'calendar': 'event',
} as const;

type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
