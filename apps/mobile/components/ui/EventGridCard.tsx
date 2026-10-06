import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts, MidnightColors } from '@/constants/theme';
import { EventGrid, getEventGridCardWidth } from '@/constants/layout';
import { useAppTheme } from '@/context/ThemeContext';
import { EVENT_PLACEHOLDER_IMAGES, resolveEventCoverImage } from '@/lib/eventCovers';

type EventGridCardProps = {
  title: string;
  date?: string;
  category?: string;
  /** The event's stored cover image; events without their own cover show the bundled placeholder. */
  coverImage?: string | null;
  onPress: () => void;
  /** Taller card and image, for cards that show extra details below the date. */
  tall?: boolean;
  /** Extra content rendered under the date (e.g. owner details). */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const TALL_CARD_HEIGHT = 260;
const TALL_IMAGE_HEIGHT = 160;

export const EVENT_PLACEHOLDER_ASSET = require('@/assets/images/memories_bg.png');

/** Empty covers and the stock photos saved on event creation both count as "no cover uploaded". */
function getCardImageSource(coverImage?: string | null) {
  const trimmed = coverImage?.trim();
  if (!trimmed || EVENT_PLACEHOLDER_IMAGES.includes(trimmed)) return EVENT_PLACEHOLDER_ASSET;
  return { uri: resolveEventCoverImage(trimmed) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 September 2026" -> "26 Sep 26". Dates in any other shape are shown unchanged. */
function formatCardDate(date?: string): string {
  if (!date) return '';
  const match = date.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (!match) return date;
  const monthIndex = MONTHS.findIndex((m) => match[2].toLowerCase().startsWith(m.toLowerCase()));
  if (monthIndex === -1) return date;
  return `${match[1]} ${MONTHS[monthIndex]} ${match[3].slice(-2)}`;
}

/** Event card used in the two-column event grids on the Dashboard and Host tabs. */
export function EventGridCard({ title, date, category, coverImage, onPress, tall = false, children, style }: EventGridCardProps) {
  const { colors, isDark } = useAppTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <TouchableOpacity
      style={[styles.card, tall && styles.cardTall, style]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={[styles.imageWrap, tall && styles.imageWrapTall]}>
        <ExpoImage
          source={getCardImageSource(coverImage)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          transition={400}
        />
        <LinearGradient
          colors={['rgba(19, 25, 31,0.15)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        {category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{category.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.infoStrip}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.date}>{formatCardDate(date)}</Text>
        {children}
      </View>
    </TouchableOpacity>
  );
}

const getStyles = (colors: typeof MidnightColors, isDark: boolean) => StyleSheet.create({
  card: {
    width: getEventGridCardWidth(Dimensions.get('window').width),
    height: EventGrid.cardHeight,
    borderRadius: EventGrid.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104,0.14)',
    backgroundColor: isDark ? colors.surface : '#ffffff',
    marginBottom: EventGrid.rowGap,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 6,
  },
  cardTall: {
    height: TALL_CARD_HEIGHT,
  },
  imageWrap: {
    width: '100%',
    height: EventGrid.imageHeight,
    backgroundColor: isDark ? colors.surface : '#f1f5f9',
    position: 'relative',
    overflow: 'hidden',
  },
  imageWrapTall: {
    height: TALL_IMAGE_HEIGHT,
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(19, 25, 31,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(202, 156, 104,0.3)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 10,
    color: colors.gold,
    fontFamily: Fonts.inter.bold,
    letterSpacing: 0.7,
  },
  infoStrip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    flex: 1,
    backgroundColor: isDark ? colors.surface : '#ffffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(202, 156, 104, 0.08)',
  },
  title: {
    fontSize: 14,
    color: colors.white,
    fontFamily: Fonts.outfit.bold,
  },
  date: {
    marginTop: 4,
    fontSize: 11,
    color: colors.slate400,
    fontFamily: Fonts.inter.medium,
  },
});
