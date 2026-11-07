import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image, type ImageProps } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { COVER_DRAFT_FIELDS, PHONE_COVER_DRAFT_FIELDS, draftSummaryText, editableMessage } from '../../../../../shared/guestEdit/draft';
import { hasPhoneFraming, hasPhonePhoto } from '../../../../../shared/themes/phoneCover';
import { clampCoverZoom, coverFocus, focusToOffsets, MAX_COVER_ZOOM, MIN_COVER_ZOOM } from '../../../../../shared/themes/coverFocus';
import { editableFieldsFor, type EditableField } from '../../../../../shared/themes/editableFields';
import {
  COUPLE_LIMITS,
  COUPLE_SIDES,
  SOCIAL_NETWORKS,
  SOCIAL_NETWORK_NAMES,
  emptyCouplePerson,
  socialLinkUrl,
  type CouplePerson,
  type CoupleSide,
  type SocialNetwork,
} from '../../../../../shared/themes/themeContent';
import { eventDateValue } from '../../../../../shared/text/eventDate';
import { BottomSheet, BottomSheetHeader } from '@/components/ui/BottomSheet';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { SOCIAL_ICONS } from '@/components/icons/SocialIcons';
import { Fonts, MidnightColors } from '@/constants/theme';
import { getGalleryVideos, type Event, type Photo } from '@/lib/database';
import { COVER_PICKER_OPTIONS } from '@/lib/eventCoverUpload';
import { getEventCoverSource, withPhoneCover } from '@/lib/eventCovers';
import { getGridThumbnail } from '@/lib/imageUrl';
import { appAlert } from '@/lib/feedback';
import type { GuestEdit } from './useGuestEdit';

// The bar at the bottom of the guest view in Preview Guest Theme's edit mode (todo #11). Its buttons come from the
// theme's edit list (shared/themes/editableFields.ts); each opens a sheet, and the guest view behind it shows every
// change at once. Nothing reaches guests until Save.

const FIELD_ICONS: Record<EditableField['kind'], IconSymbolName> = {
  cover: 'photo',
  text: 'pencil',
  date: 'calendar',
  longText: 'pencil',
  video: 'video.fill',
  // Theme content: Confetti Circle's couple
  couple: 'heart.fill',
};

/** Same date text the event screen saves ("Nov 6, 2026") */
const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface GuestEditBarProps {
  edit: GuestEdit;
  /** The gallery on screen */
  galleryId: string;
  templateId?: string;
  userId: string;
  /** Photos of the gallery on screen, for choosing the cover */
  photos: { id: string; url?: string; thumbnailUrl?: string; mediaType?: string; resourceType?: string }[];
  onSelectGallery: (gallery: Event) => void;
  /** Stop editing (the screen asks first if there are unsaved changes) */
  onDone: () => void;
  /** The bar's height from the bottom of the screen, for themes that lift their bottom text above it */
  onHeightChange?: (height: number) => void;
}

export function GuestEditBar({ edit, galleryId, templateId, userId, photos, onSelectGallery, onDone, onHeightChange }: GuestEditBarProps) {
  const insets = useSafeAreaInsets();
  const [choosingGallery, setChoosingGallery] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  const gallery = edit.galleries.find((item) => item.id === galleryId);
  const isHome = galleryId === edit.rootId;
  const fields = editableFieldsFor(templateId, 'app', isHome);
  // The open sheet (opened here or by a pencil on the page) belongs to the gallery it was opened on
  const openFieldDef = edit.openPanel?.galleryId === galleryId ? fields.find((field) => field.key === edit.openPanel?.key) : undefined;
  const setOpenField = edit.openPanelFor;
  // Theme content belongs to the whole event: edited and saved on the main gallery from any gallery
  const draftGalleryId = (field: EditableField) => (field.block && edit.rootId ? edit.rootId : galleryId);
  const isChanged = (field: EditableField) => {
    const draft = edit.draft[draftGalleryId(field)];
    if (field.block) return draft?.themeContent?.[field.block] !== undefined;
    return draft?.[field.column] !== undefined || (field.kind === 'cover' && COVER_DRAFT_FIELDS.some((cover) => draft?.[cover] !== undefined));
  };

  if (!edit.rootId) return null;

  const save = async () => {
    setOpenField(null);
    const { failed, reasons } = await edit.save(userId);
    if (failed.length > 0) {
      appAlert("Some changes weren't saved", reasons.length > 0
        ? `Saving ${failed.join(', ')} failed. ${reasons.join(' ')} Those changes are still here.`
        : `Saving ${failed.join(', ')} failed. Those changes are still here: check your connection and tap Save again.`);
    } else {
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2500);
    }
  };

  const discard = () => {
    appAlert('Discard your changes?', 'Everything you changed since the last Save goes back to how guests see it now.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { setOpenField(null); edit.discard(); } },
    ]);
  };

  if (edit.viewingAsGuest) {
    return (
      <View pointerEvents="box-none" style={[styles.pillWrap, { bottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.pill} onPress={() => edit.setViewingAsGuest(false)} accessibilityRole="button">
          <IconSymbol name="pencil" size={16} color={MidnightColors.onAccent} />
          <Text style={styles.pillText}>Back to editing{edit.hasChanges ? ` · ${draftSummaryText(edit.draft)}` : ''}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const galleryLabel = (item?: Event) => !item ? 'This gallery' : item.id === edit.rootId ? 'Home' : item.title || 'Album';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]} onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}>
      <View style={styles.bar} accessibilityLabel="Edit this page">
        {/* Which gallery the changes go to */}
        <View style={styles.row}>
          <TouchableOpacity style={styles.galleryChip} onPress={() => setChoosingGallery(true)} disabled={!edit.galleriesLoaded} accessibilityRole="button" accessibilityLabel={`Editing ${galleryLabel(gallery)}. Choose another gallery`}>
            <Text style={styles.editingLabel}>EDITING</Text>
            <Text style={styles.galleryName} numberOfLines={1}>{galleryLabel(gallery)}{gallery?.isHidden ? ' (hidden)' : ''}</Text>
            <IconSymbol name="chevron.down" size={14} color={MidnightColors.gold} />
          </TouchableOpacity>
          <View style={styles.rowEnd}>
            <TouchableOpacity onPress={() => { setOpenField(null); edit.setViewingAsGuest(true); }} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="View as guest">
              <IconSymbol name="eye.fill" size={18} color={MidnightColors.slate300} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDone} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Stop editing">
              <IconSymbol name="xmark" size={18} color={MidnightColors.slate300} />
            </TouchableOpacity>
          </View>
        </View>

        {/* The theme's edit buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fieldRow}>
          {fields.map((field) => {
            const changed = isChanged(field);
            return (
              <TouchableOpacity key={field.key} style={styles.fieldButton} onPress={() => setOpenField({ galleryId, key: field.key })} accessibilityRole="button" accessibilityLabel={`${field.label}${changed ? ', changed' : ''}`}>
                <IconSymbol name={FIELD_ICONS[field.kind]} size={15} color={MidnightColors.gold} />
                <Text style={styles.fieldText}>{field.label}</Text>
                {changed && <View style={styles.changedDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Save */}
        <View style={styles.row}>
          <Text style={styles.summary} accessibilityLiveRegion="polite">
            {edit.saving ? 'Saving...' : savedNote ? 'Saved' : draftSummaryText(edit.draft)}
          </Text>
          <View style={styles.rowEnd}>
            <TouchableOpacity style={[styles.quietButton, (!edit.hasChanges || edit.saving) && styles.disabled]} disabled={!edit.hasChanges || edit.saving} onPress={discard} accessibilityRole="button">
              <Text style={styles.quietText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.goldButton, (!edit.hasChanges || edit.saving) && styles.disabled]} disabled={!edit.hasChanges || edit.saving} onPress={() => void save()} accessibilityRole="button">
              {edit.saving && <ActivityIndicator size="small" color={MidnightColors.onAccent} />}
              <Text style={styles.goldText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <BottomSheet visible={choosingGallery} onClose={() => setChoosingGallery(false)}>
        <BottomSheetHeader title="Edit which gallery?" icon="photo.on.rectangle" onClose={() => setChoosingGallery(false)} />
        <ScrollView style={styles.sheetScroll}>
          {edit.galleries.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.galleryOption}
              onPress={() => { setChoosingGallery(false); if (item.id !== galleryId) onSelectGallery(item); }}
              accessibilityRole="button"
            >
              <Text style={styles.galleryOptionText} numberOfLines={1}>{galleryLabel(edit.apply(item))}</Text>
              {item.isHidden && <Text style={styles.hint}>Hidden from guests</Text>}
              {item.id === galleryId && <IconSymbol name="checkmark" size={16} color={MidnightColors.gold} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={!!openFieldDef} onClose={() => setOpenField(null)}>
        {openFieldDef && (
          <EditSheet
            field={openFieldDef}
            edit={edit}
            galleryId={draftGalleryId(openFieldDef)}
            part={edit.openPanel?.part}
            changed={isChanged(openFieldDef)}
            legacyId={gallery?.legacyId}
            photos={photos}
            onClose={() => setOpenField(null)}
          />
        )}
      </BottomSheet>
    </View>
  );
}

function EditSheet({ field, edit, galleryId, part, changed, legacyId, photos, onClose }: {
  field: EditableField;
  edit: GuestEdit;
  /** The gallery whose draft the sheet changes (the main gallery for theme content) */
  galleryId: string;
  /** The part to show first (a pencil's) */
  part?: string;
  changed: boolean;
  legacyId?: string;
  photos: GuestEditBarProps['photos'];
  onClose: () => void;
}) {
  const savedText = String(edit.currentValue(galleryId, field.column) ?? '');
  // A new main gallery's automatic "Main Event: <title>" message isn't for guests: the sheet starts empty
  const textValue = field.column === 'description' && !changed ? editableMessage(savedText, edit.galleries[0]?.title) : savedText;

  return (
    <>
      <BottomSheetHeader title={field.label} icon={FIELD_ICONS[field.kind]} onClose={onClose} />
      {/* The cover sheet is taller than a phone screen: the middle scrolls, the title and Done stay put */}
      <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
      {changed && (
        <TouchableOpacity
          style={styles.undo}
          onPress={() => field.block
            ? edit.undoBlock(galleryId, field.block)
            : edit.undo(galleryId, field.kind === 'cover' ? [...COVER_DRAFT_FIELDS] : [field.column])}
          accessibilityRole="button"
        >
          <IconSymbol name="arrow.uturn.backward" size={14} color={MidnightColors.gold} />
          <Text style={styles.undoText}>Undo this change</Text>
        </TouchableOpacity>
      )}

      {(field.kind === 'text' || field.kind === 'longText') && (
        <>
          <TextInput
            autoFocus
            value={textValue}
            onChangeText={(text) => edit.setField(galleryId, field.column, text)}
            maxLength={field.maxLength}
            multiline={field.kind === 'longText'}
            placeholder={field.kind === 'longText' ? 'Write a brief, elegant welcome note...' : undefined}
            placeholderTextColor={MidnightColors.slate600}
            style={[styles.input, field.kind === 'longText' && styles.inputLong]}
          />
          {field.maxLength ? (
            <Text style={styles.counter}>{textValue.length}/{field.maxLength}</Text>
          ) : null}
        </>
      )}

      {field.kind === 'date' && <DateField edit={edit} galleryId={galleryId} />}
      {field.kind === 'cover' && <CoverField edit={edit} galleryId={galleryId} photos={photos} />}
      {field.kind === 'video' && <VideoField edit={edit} galleryId={galleryId} legacyId={legacyId} />}
      {field.kind === 'couple' && <CoupleField edit={edit} galleryId={galleryId} firstSide={part === 'right' ? 'right' : 'left'} />}
      </ScrollView>

      <TouchableOpacity style={[styles.goldButton, styles.doneButton]} onPress={onClose} accessibilityRole="button">
        <Text style={styles.goldText}>Done</Text>
      </TouchableOpacity>
    </>
  );
}

function DateField({ edit, galleryId }: { edit: GuestEdit; galleryId: string }) {
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const value = String(edit.currentValue(galleryId, 'date') ?? '');
  // Dates are saved as "22 October 2026", which the app's JavaScript engine can't read with Date.parse
  const parsed = eventDateValue(value);
  const pickerValue = parsed === null ? new Date() : new Date(parsed);

  const onChange = (event: DateTimePickerEvent, selected?: Date) => {
    setAndroidPickerOpen(false);
    if (event.type === 'set' && selected) edit.setField(galleryId, 'date', formatDate(selected));
  };

  return (
    <View>
      <Text style={styles.hint}>{value || 'No date'}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker value={pickerValue} mode="date" display="spinner" onChange={onChange} themeVariant="dark" />
      ) : (
        <>
          <TouchableOpacity style={styles.quietButton} onPress={() => setAndroidPickerOpen(true)} accessibilityRole="button">
            <Text style={styles.quietText}>Choose date</Text>
          </TouchableOpacity>
          {androidPickerOpen && <DateTimePicker value={pickerValue} mode="date" display="default" onChange={onChange} />}
        </>
      )}
    </View>
  );
}

/** The app edits the phone cover (shared/themes/phoneCover.ts): the gallery's values with the draft, what phones
 *  show now, and how to change it */
function usePhoneCoverEditor(edit: GuestEdit, galleryId: string) {
  const gallery = edit.galleries.find((item) => item.id === galleryId);
  const withDraft = gallery ? edit.apply(gallery) : undefined;
  const shown = withDraft ? withPhoneCover(withDraft) : undefined;
  const ownPhone = !!withDraft && (hasPhonePhoto(withDraft) || hasPhoneFraming(withDraft));
  const category = gallery?.category || edit.galleries[0]?.category;
  const { setField } = edit;

  // The phone cover starts from what phones show now (the computer cover's framing), so changing one part of it
  // doesn't move the rest
  const ownFraming = () => {
    if (edit.currentValue(galleryId, 'phoneCoverMode')) return;
    setField(galleryId, 'phoneCoverMode', shown?.coverMode || 'fill');
    setField(galleryId, 'phoneCoverOffset', Number(shown?.coverOffset || 0));
    setField(galleryId, 'phoneCoverOffsetX', Number(shown?.coverOffsetX || 0));
    setField(galleryId, 'phoneCoverScale', Number(shown?.coverScale || 1));
  };
  const setPosition = (fields: { offset?: number; offsetX?: number; scale?: number }) => {
    ownFraming();
    if (fields.offset !== undefined) setField(galleryId, 'phoneCoverOffset', fields.offset);
    if (fields.offsetX !== undefined) setField(galleryId, 'phoneCoverOffsetX', fields.offsetX);
    if (fields.scale !== undefined) setField(galleryId, 'phoneCoverScale', fields.scale);
  };
  // A new photo starts filled and centred
  const fillCentred = () => {
    setField(galleryId, 'phoneCoverMode', 'fill');
    setField(galleryId, 'phoneCoverOffset', 0);
    setField(galleryId, 'phoneCoverOffsetX', 0);
    setField(galleryId, 'phoneCoverScale', 1);
  };

  return {
    source: getEventCoverSource(shown?.coverImage, 'preview', category),
    mode: (shown?.coverMode || 'fill') as 'fit' | 'fill',
    focus: coverFocus(shown || {}),
    ownPhone,
    chosenPhoto: withDraft?.phoneCoverImage,
    setPosition,
    centre: () => setPosition({ offset: 0, offsetX: 0, scale: 1 }),
    // Fit shows the whole photo; switching resets the position, as the host view does
    setMode: (mode: 'fit' | 'fill') => {
      setField(galleryId, 'phoneCoverMode', mode);
      setField(galleryId, 'phoneCoverOffset', 0);
      setField(galleryId, 'phoneCoverOffsetX', 0);
      setField(galleryId, 'phoneCoverScale', 1);
    },
    choosePhoto: (url: string) => {
      setField(galleryId, 'phoneCoverImage', url);
      fillCentred();
    },
    uploadPhoto: (uri: string) => {
      edit.setCoverUri(galleryId, uri);
      fillCentred();
    },
    // Phones show the computer cover again
    useComputerCover: () => {
      for (const field of PHONE_COVER_DRAFT_FIELDS) setField(galleryId, field, null);
    },
  };
}

const GRID_GAP = 6;

/** Equal tiles in rows of `columns`, sized from the grid's measured width (a percent width with aspectRatio draws
 *  nothing inside the sheet on iOS) */
function useTileSize(columns: number, aspect: number) {
  const [width, setWidth] = useState(0);
  const tileWidth = Math.max(0, Math.floor((width - GRID_GAP * (columns - 1)) / columns));
  return {
    size: { width: tileWidth, height: tileWidth / aspect },
    onLayout: (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
  };
}

function CoverField({ edit, galleryId, photos }: { edit: GuestEdit; galleryId: string; photos: GuestEditBarProps['photos'] }) {
  const cover = usePhoneCoverEditor(edit, galleryId);
  const pickable = photos.filter((photo) => photo.url && photo.mediaType !== 'video' && photo.resourceType !== 'video').slice(0, 60);
  const tile = useTileSize(4, 1);

  const pickFromPhone = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, ...COVER_PICKER_OPTIONS });
    if (!result.canceled) cover.uploadPhoto(result.assets[0].uri);
  };

  return (
    <View style={styles.coverField}>
      {/* Which cover this is, and where the other one is set */}
      <View style={styles.coverNote}>
        <IconSymbol name="iphone" size={16} color={MidnightColors.gold} />
        <Text style={styles.coverNoteText}>
          {cover.ownPhone
            ? 'Phone cover: the EveBash app and phone browsers. The computer cover is set on the website from a computer.'
            : 'Phones show the computer cover, set on the website. Change anything here to give phones (the app and phone browsers) their own cover.'}
        </Text>
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.goldButton} onPress={() => void pickFromPhone()} accessibilityRole="button">
          <Text style={styles.goldText}>{cover.ownPhone ? 'Upload new' : 'Use a different photo'}</Text>
        </TouchableOpacity>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {(['fill', 'fit'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => cover.setMode(mode)}
              style={[styles.segmentItem, cover.mode === mode && styles.segmentItemOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: cover.mode === mode }}
            >
              <Text style={[styles.segmentText, cover.mode === mode && styles.segmentTextOn]}>{mode === 'fill' ? 'Fill' : 'Fit'}</Text>
            </Pressable>
          ))}
        </View>
        {cover.ownPhone ? (
          <TouchableOpacity style={styles.quietButton} onPress={cover.useComputerCover} accessibilityRole="button">
            <Text style={styles.quietText}>Use the computer cover</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {cover.mode === 'fill' && (
        <CoverPositioner
          source={cover.source}
          focus={cover.focus}
          onMove={(x, y) => {
            const offsets = focusToOffsets(x, y);
            cover.setPosition({ offset: offsets.coverOffset, offsetX: offsets.coverOffsetX });
          }}
          onZoom={(zoom) => cover.setPosition({ scale: clampCoverZoom(zoom) })}
          onCentre={cover.centre}
        />
      )}
      <Text style={styles.sectionLabel}>OR CHOOSE A PHOTO FROM THIS GALLERY</Text>
      {pickable.length === 0 ? (
        <Text style={styles.hint}>No photos in this gallery yet.</Text>
      ) : (
        <View style={styles.photoGrid} onLayout={tile.onLayout}>
          {pickable.map((photo) => (
            <TouchableOpacity
              key={photo.id}
              onPress={() => cover.choosePhoto(photo.url!)}
              style={[styles.photoTile, tile.size, cover.chosenPhoto === photo.url && styles.photoTileOn]}
              accessibilityRole="button"
              accessibilityLabel="Use this photo as the phone cover"
            >
              {/* The gallery grid's small copies, already cached; the originals are too big for 60 tiles */}
              <Image source={{ uri: getGridThumbnail(photo.url, photo.thumbnailUrl) }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={photo.id} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/** Move and zoom: the whole photo with a dot on the part to keep in view, and the zoom. The guest view follows. */
function CoverPositioner({ source, focus, onMove, onZoom, onCentre }: {
  source: ImageProps['source'];
  focus: { x: number; y: number; zoom: number };
  onMove: (x: number, y: number) => void;
  onZoom: (zoom: number) => void;
  onCentre: () => void;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [aspect, setAspect] = useState<number | null>(null);
  const { x, y, zoom } = focus;
  // Where the whole photo is drawn inside the box
  const drawn = useMemo(() => aspect && box.width > 0 && box.height > 0
    ? (box.width / box.height > aspect ? { width: box.height * aspect, height: box.height } : { width: box.width, height: box.width / aspect })
    : null, [aspect, box.width, box.height]);
  const left = drawn ? (box.width - drawn.width) / 2 : 0;
  const top = drawn ? (box.height - drawn.height) / 2 : 0;

  const responder = useMemo(() => {
    const moveTo = (locationX: number, locationY: number) => {
      if (!drawn) return;
      onMove(((locationX - left) / drawn.width) * 100, ((locationY - top) / drawn.height) * 100);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the drag here, not in the sheet
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => moveTo(event.nativeEvent.locationX, event.nativeEvent.locationY),
      onPanResponderMove: (event) => moveTo(event.nativeEvent.locationX, event.nativeEvent.locationY),
    });
  }, [drawn, left, top, onMove]);

  return (
    <View style={styles.positioner}>
      <View style={styles.positionerHead}>
        <Text style={styles.sectionLabel}>MOVE AND ZOOM</Text>
        <TouchableOpacity onPress={onCentre} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.undoText}>Centre</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Drag the dot to the part of the photo that should stay in view.</Text>
      <View
        style={styles.positionerBox}
        onLayout={(event) => setBox({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
        accessibilityLabel={`Part of the photo kept in view: ${Math.round(x)}% from the left, ${Math.round(y)}% from the top`}
        {...responder.panHandlers}
      >
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          onLoad={(event) => {
            const { width, height } = event.source;
            if (width > 0 && height > 0) setAspect(width / height);
          }}
        />
        {drawn && (
          <View pointerEvents="none" style={[styles.positionerDot, { left: left + (drawn.width * x) / 100 - 11, top: top + (drawn.height * y) / 100 - 11 }]} />
        )}
      </View>
      <View style={styles.zoomRow}>
        <Text style={styles.quietText}>Zoom</Text>
        <TouchableOpacity style={[styles.zoomButton, zoom <= MIN_COVER_ZOOM && styles.disabled]} disabled={zoom <= MIN_COVER_ZOOM} onPress={() => onZoom(zoom - 0.1)} accessibilityRole="button" accessibilityLabel="Zoom out">
          <Text style={styles.zoomButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.zoomValue}>{Math.round(zoom * 100)}%</Text>
        <TouchableOpacity style={[styles.zoomButton, zoom >= MAX_COVER_ZOOM && styles.disabled]} disabled={zoom >= MAX_COVER_ZOOM} onPress={() => onZoom(zoom + 0.1)} accessibilityRole="button" accessibilityLabel="Zoom in">
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function VideoField({ edit, galleryId, legacyId }: { edit: GuestEdit; galleryId: string; legacyId?: string }) {
  const [loaded, setLoaded] = useState<{ galleryId: string; videos: Photo[] } | null>(null);
  const videos = loaded?.galleryId === galleryId ? loaded.videos : null;
  const chosenId = edit.currentValue(galleryId, 'galleryVideoId') ?? null;
  const chosen = videos?.find((video) => video.id === chosenId);
  const tile = useTileSize(3, 16 / 9);

  useEffect(() => {
    let cancelled = false;
    void getGalleryVideos(galleryId, legacyId).then((list) => {
      if (!cancelled) setLoaded({ galleryId, videos: list.filter((video) => video.status !== 'failed') });
    });
    return () => { cancelled = true; };
  }, [galleryId, legacyId]);

  return (
    <View>
      <Text style={styles.hint}>
        {!chosenId ? "No highlight video. Pick one of this gallery's videos."
          : !videos ? 'Loading...'
          : !chosen ? "The chosen video is no longer in this gallery, so guests don't see it."
          : chosen.isHidden ? "This video is hidden from guests, so they don't see it until you show it again."
          : chosen.status !== 'processed' ? "Processing: guests will see it once it's ready."
          : 'Plays at the top of this gallery.'}
      </Text>
      {!videos ? (
        <ActivityIndicator color={MidnightColors.gold} />
      ) : (
        <View style={styles.photoGrid} onLayout={tile.onLayout}>
          <TouchableOpacity onPress={() => edit.setVideo(galleryId, null)} style={[styles.videoTile, tile.size, styles.noneTile, !chosenId && styles.photoTileOn]} accessibilityRole="button">
            <Text style={styles.quietText}>None</Text>
          </TouchableOpacity>
          {videos.map((video) => (
            <TouchableOpacity
              key={video.id}
              onPress={() => edit.setVideo(galleryId, video)}
              style={[styles.videoTile, tile.size, video.id === chosenId && styles.photoTileOn]}
              accessibilityRole="button"
              accessibilityLabel={video.isHidden ? 'Hidden video' : video.status !== 'processed' ? 'Video still processing' : 'Video'}
            >
              {video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {(video.isHidden || video.status !== 'processed') && (
                <Text style={styles.videoBadge}>{video.isHidden ? 'Hidden' : 'Processing'}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={styles.hint}>To upload a new video, use Cinematic Highlight Video in the host view.</Text>
    </View>
  );
}

const LINK_HINTS: Readonly<Record<SocialNetwork, string>> = {
  instagram: 'instagram.com/name or @name',
  facebook: 'facebook.com/name',
  x: 'x.com/name or @name',
};

/** The couple (Confetti Circle), as on the website: each side's label, name, a few words and links. Only a side with
 *  a name shows, and only the links that are filled in; nothing is taken from the gallery title. */
function CoupleField({ edit, galleryId, firstSide }: { edit: GuestEdit; galleryId: string; firstSide: CoupleSide }) {
  const [side, setSide] = useState<CoupleSide>(firstSide);
  const couple = edit.currentCouple(galleryId);
  const person = couple[side];
  const sideName = (key: CoupleSide) => couple[key].label.trim() || couple[key].name.trim() || (key === 'left' ? 'Left side' : 'Right side');
  const hasContent = !!(person.name.trim() || person.about.trim() || SOCIAL_NETWORKS.some((network) => person.links[network]?.trim()));
  const setPerson = (changes: Partial<CouplePerson>) => edit.setCouple(galleryId, { ...couple, [side]: { ...person, ...changes } });

  return (
    <View style={styles.coupleField}>
      <View style={[styles.segment, styles.sideSegment]} accessibilityRole="tablist">
        {COUPLE_SIDES.map((key) => (
          <Pressable
            key={key}
            onPress={() => setSide(key)}
            style={[styles.segmentItem, styles.sideItem, side === key && styles.segmentItemOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: side === key }}
          >
            <Text style={[styles.segmentText, side === key && styles.segmentTextOn]} numberOfLines={1}>{sideName(key)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.hint}>
        {person.name.trim()
          ? `Shows on the ${side} under the video, on Home and every album. Only what you fill in shows.`
          : hasContent
            ? 'Add a name: guests see this side only once it has one.'
            : "Guests don't see this side until you add a name."}
      </Text>

      <View style={styles.coupleRow}>
        <View style={styles.coupleLabelColumn}>
          <Text style={styles.sectionLabel}>SHOWN AS</Text>
          <TextInput
            value={person.label}
            onChangeText={(label) => setPerson({ label })}
            maxLength={COUPLE_LIMITS.label}
            placeholder="e.g. The Bride"
            placeholderTextColor={MidnightColors.slate600}
            style={[styles.input, styles.inputSmall]}
          />
        </View>
        <View style={styles.coupleNameColumn}>
          <Text style={styles.sectionLabel}>NAME</Text>
          <TextInput
            value={person.name}
            onChangeText={(name) => setPerson({ name })}
            maxLength={COUPLE_LIMITS.name}
            placeholder="Their name"
            placeholderTextColor={MidnightColors.slate600}
            autoCapitalize="words"
            style={[styles.input, styles.inputSmall]}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>A FEW WORDS</Text>
      <TextInput
        value={person.about}
        onChangeText={(about) => setPerson({ about })}
        maxLength={COUPLE_LIMITS.about}
        multiline
        placeholder="Optional"
        placeholderTextColor={MidnightColors.slate600}
        style={[styles.input, styles.inputSmall, styles.inputAbout]}
      />
      <Text style={styles.counter}>{person.about.length}/{COUPLE_LIMITS.about}</Text>

      <Text style={styles.sectionLabel}>SOCIAL LINKS (OPTIONAL)</Text>
      {SOCIAL_NETWORKS.map((network) => {
        const Icon = SOCIAL_ICONS[network];
        const value = person.links[network] || '';
        const wrong = !!value.trim() && !socialLinkUrl(network, value);
        return (
          <View key={network} style={styles.linkField}>
            <View>
              <View style={styles.linkIcon} pointerEvents="none">
                <Icon size={16} color={MidnightColors.slate400} />
              </View>
              <TextInput
                value={value}
                onChangeText={(text) => setPerson({ links: { ...person.links, [network]: text } })}
                maxLength={COUPLE_LIMITS.link}
                placeholder={LINK_HINTS[network]}
                placeholderTextColor={MidnightColors.slate600}
                accessibilityLabel={SOCIAL_NETWORK_NAMES[network]}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                style={[styles.input, styles.inputSmall, styles.inputLink, wrong && styles.inputWrong]}
              />
            </View>
            {wrong && <Text style={styles.wrongText}>{`Not a ${SOCIAL_NETWORK_NAMES[network]} profile link, so it won't show.`}</Text>}
          </View>
        );
      })}

      {hasContent && (
        <TouchableOpacity style={[styles.quietButton, styles.clearButton]} onPress={() => setPerson(emptyCouplePerson(person.label))} accessibilityRole="button">
          <Text style={[styles.quietText, styles.clearText]}>Clear this side</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, zIndex: 1100, elevation: 1100 },
  bar: {
    gap: 8,
    padding: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: MidnightColors.border,
    backgroundColor: 'rgba(27, 33, 31, 0.97)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  galleryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: MidnightColors.border, backgroundColor: MidnightColors.background },
  editingLabel: { color: MidnightColors.gold, fontSize: 10, letterSpacing: 1.4, fontFamily: Fonts.inter.bold },
  galleryName: { color: MidnightColors.text, fontSize: 13, fontFamily: Fonts.inter.semiBold, flexShrink: 1 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: MidnightColors.border },
  fieldRow: { gap: 6, paddingVertical: 2 },
  fieldButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: MidnightColors.border },
  fieldText: { color: MidnightColors.slate300, fontSize: 13, fontFamily: Fonts.inter.semiBold },
  changedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MidnightColors.gold },
  summary: { color: MidnightColors.slate400, fontSize: 12, fontFamily: Fonts.inter.medium, flexShrink: 1 },
  quietButton: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: MidnightColors.border },
  quietText: { color: MidnightColors.slate300, fontSize: 13, fontFamily: Fonts.inter.semiBold },
  goldButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: MidnightColors.gold },
  goldText: { color: MidnightColors.onAccent, fontSize: 13, fontFamily: Fonts.inter.bold },
  disabled: { opacity: 0.45 },
  pillWrap: { position: 'absolute', right: 16, zIndex: 1100, elevation: 1100 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, backgroundColor: MidnightColors.gold, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  pillText: { color: MidnightColors.onAccent, fontSize: 13, fontFamily: Fonts.inter.bold },
  sheetScroll: { maxHeight: 360 },
  sheetBody: { flexShrink: 1 },
  galleryOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: MidnightColors.border },
  galleryOptionText: { flex: 1, color: MidnightColors.text, fontSize: 15, fontFamily: Fonts.inter.semiBold },
  hint: { color: MidnightColors.slate400, fontSize: 12, lineHeight: 17, fontFamily: Fonts.inter.regular, marginVertical: 6 },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 10 },
  undoText: { color: MidnightColors.gold, fontSize: 13, fontFamily: Fonts.inter.semiBold },
  input: { borderWidth: 1, borderColor: MidnightColors.border, borderRadius: 16, backgroundColor: MidnightColors.background, color: MidnightColors.text, fontSize: 16, fontFamily: Fonts.inter.regular, paddingHorizontal: 16, paddingVertical: 12 },
  inputLong: { minHeight: 110, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', marginTop: 6, color: MidnightColors.slate600, fontSize: 12, fontFamily: Fonts.inter.regular },
  doneButton: { marginTop: 16, paddingVertical: 13 },
  coverField: { gap: 6 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  segment: { flexDirection: 'row', padding: 2, borderRadius: 999, borderWidth: 1, borderColor: MidnightColors.border },
  segmentItem: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999 },
  segmentItemOn: { backgroundColor: MidnightColors.gold },
  segmentText: { color: MidnightColors.slate300, fontSize: 13, fontFamily: Fonts.inter.semiBold },
  segmentTextOn: { color: MidnightColors.onAccent },
  sectionLabel: { marginTop: 10, color: MidnightColors.slate400, fontSize: 10, letterSpacing: 1.4, fontFamily: Fonts.inter.bold },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  photoTile: { borderRadius: 8, overflow: 'hidden', backgroundColor: MidnightColors.background },
  photoTileOn: { borderWidth: 2, borderColor: MidnightColors.gold },
  videoTile: { borderRadius: 8, overflow: 'hidden', backgroundColor: MidnightColors.background, justifyContent: 'flex-end' },
  noneTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: MidnightColors.border },
  coverNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(202, 156, 104, 0.08)', borderWidth: 1, borderColor: MidnightColors.border },
  coverNoteText: { flex: 1, color: MidnightColors.slate300, fontSize: 12, lineHeight: 17, fontFamily: Fonts.inter.regular },
  positioner: { marginTop: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: MidnightColors.border, backgroundColor: 'rgba(19, 25, 31, 0.6)' },
  positionerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  positionerBox: { height: 170, marginTop: 4, borderRadius: 10, overflow: 'hidden', backgroundColor: MidnightColors.background },
  positionerDot: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff', backgroundColor: MidnightColors.gold },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  zoomButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: MidnightColors.border },
  zoomButtonText: { color: MidnightColors.text, fontSize: 18, fontFamily: Fonts.inter.bold },
  zoomValue: { minWidth: 48, textAlign: 'center', color: MidnightColors.text, fontSize: 14, fontFamily: Fonts.inter.bold },
  coupleField: { gap: 4 },
  sideSegment: { alignSelf: 'flex-start', maxWidth: '100%' },
  sideItem: { maxWidth: 170 },
  coupleRow: { flexDirection: 'row', gap: 8 },
  coupleLabelColumn: { flex: 2 },
  coupleNameColumn: { flex: 3 },
  inputSmall: { marginTop: 6, fontSize: 15, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  inputAbout: { minHeight: 84, textAlignVertical: 'top' },
  linkField: { marginTop: 6 },
  linkIcon: { position: 'absolute', left: 14, top: 6, bottom: 0, zIndex: 1, justifyContent: 'center' },
  inputLink: { paddingLeft: 40 },
  inputWrong: { borderColor: '#f87171' },
  wrongText: { marginTop: 4, color: '#fca5a5', fontSize: 12, fontFamily: Fonts.inter.regular },
  clearButton: { marginTop: 12, borderColor: 'rgba(248, 113, 113, 0.45)' },
  clearText: { color: '#fca5a5' },
  videoBadge: { margin: 4, alignSelf: 'flex-start', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 10, fontFamily: Fonts.inter.bold },
});
