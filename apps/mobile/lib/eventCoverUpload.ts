import * as ImageManipulator from 'expo-image-manipulator';
import { deleteCoverUsagePhoto, saveCoverUsagePhoto, updateEvent } from '@/lib/database';
import { uploadEventImage } from '@/lib/storage';
import type { CoverTarget } from '../../../shared/themes/phoneCover';

// Uploading and removing a gallery's cover picture: one copy for the event screen's Change Cover / Remove Cover and
// Preview Guest Theme's edit mode. A new cover always starts centred (the position fields are reset).

export const RESET_COVER_POSITION = { coverOffset: 0, coverOffsetX: 0, coverScale: 1.0 };
/** The phone cover with its own photo starts filled and centred */
export const RESET_PHONE_COVER_POSITION = { phoneCoverMode: 'fill' as const, phoneCoverOffset: 0, phoneCoverOffsetX: 0, phoneCoverScale: 1 };
/** No phone cover: phones show the computer cover */
export const NO_PHONE_COVER = { phoneCoverImage: null, phoneCoverMode: null, phoneCoverOffset: null, phoneCoverOffsetX: null, phoneCoverScale: null };

/** Picks the same picture options as the event screen: cropped to 16:9 in the picker */
export const COVER_PICKER_OPTIONS = { allowsEditing: true, aspect: [16, 9] as [number, number], quality: 0.8 };

/** Resizes a picked picture to 1200 px wide and uploads it as the gallery's computer cover (or phone cover), then
 *  counts it in the host's storage. `storageEventId` is the event the file is stored under. Returns the new cover
 *  link; throws if the upload or the save fails. */
export async function uploadEventCover(options: {
  uri: string;
  eventId: string;
  storageEventId: string;
  userId: string;
  target?: CoverTarget;
  onStep?: (message: string) => void;
}): Promise<string> {
  const { uri, eventId, storageEventId, userId, target = 'computer', onStep } = options;
  onStep?.('Preparing your cover image...');
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  const file = { uri: manipulated.uri, name: 'cover.jpg', type: 'image/jpeg' } as any;
  onStep?.('Uploading your cover image...');
  const upload = await uploadEventImage(file, storageEventId, userId);

  const saved = await updateEvent(eventId, target === 'phone'
    ? { phoneCoverImage: upload.url, ...RESET_PHONE_COVER_POSITION }
    : { coverImage: upload.url, ...RESET_COVER_POSITION });
  if (!saved) throw new Error('updateEvent returned false');

  const usageSaved = await saveCoverUsagePhoto({
    eventId,
    storageKey: upload.storageKey || upload.publicId || upload.url,
    url: upload.url,
    userId,
    width: upload.width,
    height: upload.height,
    size: upload.bytes,
    format: upload.format,
    mediaType: (upload.mediaType as 'photo' | 'video') || 'photo',
    resourceType: upload.resourceType || 'image',
  });

  if (!usageSaved) {
    console.warn("[Cover] Cover updated, but storage usage could not be synced.");
  }

  return upload.url;
}

/** Takes the cover off the gallery and stops counting it in the host's storage: the computer cover goes back to the
 *  default cover, the phone cover back to "same as the computer cover". Throws if the save fails. */
export async function removeEventCover(eventId: string, coverUrl: string, target: CoverTarget = 'computer'): Promise<void> {
  const saved = await updateEvent(eventId, target === 'phone' ? NO_PHONE_COVER : { coverImage: '', ...RESET_COVER_POSITION });
  if (!saved) throw new Error('updateEvent returned false');

  const usageDeleted = await deleteCoverUsagePhoto(eventId, coverUrl);
  if (!usageDeleted) {
    console.warn("[Cover] Cover removed, but storage usage could not be synced.");
  }
}
