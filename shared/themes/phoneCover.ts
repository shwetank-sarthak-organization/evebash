// Website and app (one copy): a gallery's two covers (todo #11, issue #64, decided 2026-11-06). The cover fields
// (coverImage, coverMode, coverOffset, coverOffsetX, coverScale) are the computer cover; the phoneCover* fields are the
// phone cover, for the app and phone browsers (supabase/migrations/20261106120000_phone_cover.sql). Empty phone fields
// mean "same as the computer cover", so a gallery looks as before until a host sets a phone cover.

export type CoverTarget = 'computer' | 'phone';

/** The website shows the phone cover on screens narrower than this, the computer cover from it (tablets too) */
export const PHONE_COVER_MAX_WIDTH = 767;

type Mode = 'fit' | 'fill';

export interface TwoCovers {
  coverImage?: string | null;
  coverMode?: Mode | null;
  coverOffset?: number | null;
  coverOffsetX?: number | null;
  coverScale?: number | null;
  phoneCoverImage?: string | null;
  phoneCoverMode?: Mode | null;
  phoneCoverOffset?: number | null;
  phoneCoverOffsetX?: number | null;
  phoneCoverScale?: number | null;
}

/** The fields each cover is saved in */
export const COVER_FIELD_NAMES = {
  computer: { image: 'coverImage', mode: 'coverMode', offset: 'coverOffset', offsetX: 'coverOffsetX', scale: 'coverScale' },
  phone: { image: 'phoneCoverImage', mode: 'phoneCoverMode', offset: 'phoneCoverOffset', offsetX: 'phoneCoverOffsetX', scale: 'phoneCoverScale' },
} as const;

/** The phone cover has its own photo */
export const hasPhonePhoto = (gallery: TwoCovers) => !!gallery.phoneCoverImage?.trim();
/** The phone cover has its own Fit / Fill and position */
export const hasPhoneFraming = (gallery: TwoCovers) => !!gallery.phoneCoverMode;

interface ShownCover {
  coverImage?: string | null;
  coverMode?: Mode | null;
  coverOffset?: number | null;
  coverOffsetX?: number | null;
  coverScale?: number | null;
}

function phoneCover(gallery: TwoCovers): ShownCover {
  const framing = hasPhoneFraming(gallery)
    ? { coverMode: gallery.phoneCoverMode, coverOffset: gallery.phoneCoverOffset ?? 0, coverOffsetX: gallery.phoneCoverOffsetX ?? 0, coverScale: gallery.phoneCoverScale ?? 1 }
    : { coverMode: gallery.coverMode, coverOffset: gallery.coverOffset, coverOffsetX: gallery.coverOffsetX, coverScale: gallery.coverScale };
  return { coverImage: hasPhonePhoto(gallery) ? gallery.phoneCoverImage : gallery.coverImage, ...framing };
}

/** The cover a screen shows, in the plain cover fields themes read. A host who only set a phone cover (say, only
 *  uses the app) gets it on computers too, rather than the default photo. `isDefaultPhoto` tells the default and
 *  placeholder covers apart from an uploaded or chosen one (each platform has its own list). */
export function shownCover(gallery: TwoCovers, target: CoverTarget, isDefaultPhoto: (image?: string | null) => boolean): ShownCover {
  if (target === 'phone' || (isDefaultPhoto(gallery.coverImage) && hasPhonePhoto(gallery))) return phoneCover(gallery);
  return { coverImage: gallery.coverImage, coverMode: gallery.coverMode, coverOffset: gallery.coverOffset, coverOffsetX: gallery.coverOffsetX, coverScale: gallery.coverScale };
}

/** The gallery with its cover fields set to the cover this screen shows. The same object when nothing changes. */
export function withShownCover<T extends TwoCovers>(gallery: T, target: CoverTarget, isDefaultPhoto: (image?: string | null) => boolean): T {
  const cover = shownCover(gallery, target, isDefaultPhoto);
  const same = (Object.keys(cover) as (keyof ShownCover)[]).every((field) => (cover[field] ?? null) === (gallery[field] ?? null));
  return same ? gallery : { ...gallery, ...cover };
}
