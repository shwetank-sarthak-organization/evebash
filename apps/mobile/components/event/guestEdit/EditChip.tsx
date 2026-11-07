import React, { createContext, useContext } from 'react';
import { StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, MidnightColors } from '@/constants/theme';

// The pencils a theme puts on its own content in Preview Guest Theme's edit mode (todo #11): on the cover, the
// title, the message... Each opens that field's sheet from the edit bar. A theme places them inside its own views;
// for guests (and while the host views the page as a guest) they render nothing.

/** Given by the event screen only while the host edits the guest view: the gallery on screen, and how to open a sheet
 *  (and the part of it to show first, e.g. the couple's right side) */
export const GuestEditSpots = createContext<{ galleryId: string; open: (galleryId: string, key: string, part?: string) => void } | null>(null);

/** True while the guest view is being edited with the bar showing: a theme can then show places to add missing content */
export function useGuestEditSpots(): boolean {
  return !!useContext(GuestEditSpots);
}

export function EditChip({ field, part, label, galleryId, adding = false, at, style }: {
  /** The field's key in the theme's edit list (shared/themes/editableFields.ts) */
  field: string;
  /** The part of the field's sheet to show first (the couple: "left" or "right") */
  part?: string;
  label: string;
  /** Leave out for the gallery on screen */
  galleryId?: string;
  /** Nothing there yet: the chip invites to add it ("Add message") */
  adding?: boolean;
  /** Where it sits inside the theme's view (absolute); leave out to place it in the flow */
  at?: { top?: number; right?: number; bottom?: number; left?: number };
  style?: StyleProp<ViewStyle>;
}) {
  const spots = useContext(GuestEditSpots);
  if (!spots) return null;

  return (
    <TouchableOpacity
      onPress={() => spots.open(galleryId || spots.galleryId, field, part)}
      accessibilityRole="button"
      accessibilityLabel={adding ? label : `Edit ${label.toLowerCase()}`}
      hitSlop={8}
      activeOpacity={0.85}
      style={[local.chip, adding && local.adding, at && [local.placed, at], style]}
    >
      <IconSymbol name={adding ? 'plus' : 'pencil'} size={13} color={adding ? MidnightColors.gold : MidnightColors.onAccent} />
      <Text style={[local.text, adding && local.addingText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const local = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: MidnightColors.gold,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  placed: { position: 'absolute', zIndex: 30 },
  adding: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: MidnightColors.gold, backgroundColor: 'rgba(19, 25, 31, 0.8)' },
  text: { color: MidnightColors.onAccent, fontSize: 12, fontFamily: Fonts.inter.bold },
  addingText: { color: '#F5E7D4' },
});
