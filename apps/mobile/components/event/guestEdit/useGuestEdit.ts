import { useCallback, useMemo, useRef, useState } from 'react';
import {
  EMPTY_DRAFT,
  applyGalleryDraft,
  setDraftField,
  withoutGallery,
  type DraftField,
  type EventDraft,
  type GalleryDraft,
} from '../../../../../shared/guestEdit/draft';
import { getSubEvents, setGalleryVideo, updateEvent, type Event, type GalleryVideo, type Photo } from '@/lib/database';
import { removeEventCover, uploadEventCover, RESET_COVER_POSITION } from '@/lib/eventCoverUpload';

// Preview Guest Theme's edit mode in the app (todo #11): the host edits the real guest view and saves once.
// The event screen shows the guest view of every gallery itself, so the edits live in the screen while it's open.

/** Off by default; EXPO_PUBLIC_GUEST_EDIT_MODE=true turns it on */
export const GUEST_EDIT_ENABLED = process.env.EXPO_PUBLIC_GUEST_EDIT_MODE === 'true';

interface GuestEditState {
  /** The main gallery being edited; null when not editing */
  rootId: string | null;
  viewingAsGuest: boolean;
  /** Saved values of the main gallery and every album (hidden ones too), main gallery first */
  galleries: Event[];
  galleriesLoaded: boolean;
  draft: EventDraft;
  /** Saved during this visit, shown until the screen loads its data again */
  saved: EventDraft;
  /** New phone cover pictures from the phone, uploaded on Save (the draft's phoneCoverImage holds the same local link) */
  coverUris: Readonly<Record<string, string>>;
  /** The chosen highlight video of a gallery (draft or saved this visit), so the screen can play it */
  videos: Readonly<Record<string, GalleryVideo | null>>;
  saving: boolean;
  /** The edit sheet that is open: a field of the theme's edit list, for one gallery */
  openPanel: { galleryId: string; key: string } | null;
}

const INITIAL: GuestEditState = {
  rootId: null,
  viewingAsGuest: false,
  galleries: [],
  galleriesLoaded: false,
  draft: EMPTY_DRAFT,
  saved: EMPTY_DRAFT,
  coverUris: {},
  videos: {},
  saving: false,
  openPanel: null,
};

/** The gallery's own processed, visible video in the shape the guest view plays */
function playableVideo(video: Photo | null): GalleryVideo | null {
  if (!video || video.status !== 'processed' || video.isHidden || !video.url) return null;
  return { id: video.id, streamUrl: video.url, posterUrl: video.thumbnailUrl, width: video.width, height: video.height };
}

function savedValueIn<K extends DraftField>(state: GuestEditState, galleryId: string, field: K): GalleryDraft[K] | undefined {
  const savedThisVisit = state.saved[galleryId]?.[field];
  if (savedThisVisit !== undefined) return savedThisVisit;
  const gallery = state.galleries.find((item) => item.id === galleryId);
  if (!gallery) return undefined;
  switch (field) {
    case 'coverMode': return (gallery.coverMode || 'fill') as GalleryDraft[K];
    case 'coverOffset': return Number(gallery.coverOffset || 0) as GalleryDraft[K];
    case 'coverOffsetX': return Number(gallery.coverOffsetX || 0) as GalleryDraft[K];
    case 'coverScale': return Number(gallery.coverScale || 1) as GalleryDraft[K];
    // The phone cover: null = same as the computer cover
    case 'phoneCoverImage': return (gallery.phoneCoverImage || null) as GalleryDraft[K];
    case 'phoneCoverMode': return (gallery.phoneCoverMode || null) as GalleryDraft[K];
    case 'phoneCoverOffset':
    case 'phoneCoverOffsetX':
    case 'phoneCoverScale': {
      const value = gallery[field as 'phoneCoverOffset' | 'phoneCoverOffsetX' | 'phoneCoverScale'];
      return (value == null ? null : Number(value)) as GalleryDraft[K];
    }
    case 'galleryVideoId': return (gallery.galleryVideoId ?? null) as GalleryDraft[K];
    default: return (gallery[field as 'title' | 'date' | 'description' | 'coverImage'] ?? '') as GalleryDraft[K];
  }
}

export function useGuestEdit() {
  const [state, setState] = useState<GuestEditState>(INITIAL);
  // Read by callbacks that run after awaits (loading the galleries, Save), so they see the latest state
  const stateRef = useRef(state);

  const update = useCallback((next: (current: GuestEditState) => Partial<GuestEditState>) => {
    setState((current) => {
      const merged = { ...current, ...next(current) };
      stateRef.current = merged;
      return merged;
    });
  }, []);

  const start = useCallback((root: Event) => {
    if (!GUEST_EDIT_ENABLED) return;
    if (stateRef.current.rootId === root.id) {
      update(() => ({ viewingAsGuest: false }));
      return;
    }
    update(() => ({ ...INITIAL, rootId: root.id, galleries: [root] }));
    getSubEvents(root.id, root.legacyId)
      .then((albums) => {
        if (stateRef.current.rootId !== root.id) return;
        update(() => ({ galleries: [root, ...albums.filter((album) => album.id !== root.id)], galleriesLoaded: true }));
      })
      .catch((error) => {
        console.error('[GuestEdit] Could not load the event\'s galleries:', error);
        if (stateRef.current.rootId === root.id) update(() => ({ galleriesLoaded: true }));
      });
  }, [update]);

  const stop = useCallback(() => update(() => INITIAL), [update]);

  const setViewingAsGuest = useCallback((viewingAsGuest: boolean) => update(() => ({ viewingAsGuest, ...(viewingAsGuest && { openPanel: null }) })), [update]);

  /** Opens a field's sheet (from the bar or from a pencil on the page); null closes it */
  const openPanelFor = useCallback((openPanel: { galleryId: string; key: string } | null) => update(() => ({ openPanel })), [update]);

  const savedValue = useCallback(<K extends DraftField>(galleryId: string, field: K) => savedValueIn(state, galleryId, field), [state]);

  const currentValue = useCallback(<K extends DraftField>(galleryId: string, field: K): GalleryDraft[K] | undefined => {
    const drafted = state.draft[galleryId]?.[field];
    return drafted !== undefined ? drafted : savedValueIn(state, galleryId, field);
  }, [state]);

  const setField = useCallback(<K extends DraftField>(galleryId: string, field: K, value: GalleryDraft[K]) => {
    update((current) => {
      const next: Partial<GuestEditState> = {
        draft: setDraftField(current.draft, galleryId, field, value, savedValueIn(current, galleryId, field)),
      };
      if (field === 'phoneCoverImage' && current.coverUris[galleryId] && current.coverUris[galleryId] !== value) {
        const coverUris = { ...current.coverUris };
        delete coverUris[galleryId];
        next.coverUris = coverUris;
      }
      return next;
    });
  }, [update]);

  /** A new phone cover picture from the phone: shown at once, uploaded on Save */
  const setCoverUri = useCallback((galleryId: string, uri: string) => {
    update((current) => ({
      draft: setDraftField(current.draft, galleryId, 'phoneCoverImage', uri, savedValueIn(current, galleryId, 'phoneCoverImage')),
      coverUris: { ...current.coverUris, [galleryId]: uri },
    }));
  }, [update]);

  const setVideo = useCallback((galleryId: string, video: Photo | null) => {
    update((current) => ({
      draft: setDraftField(current.draft, galleryId, 'galleryVideoId', video?.id ?? null, savedValueIn(current, galleryId, 'galleryVideoId')),
      videos: { ...current.videos, [galleryId]: playableVideo(video) },
    }));
  }, [update]);

  /** Takes fields of one gallery out of the draft (the panel's Undo) */
  const undo = useCallback((galleryId: string, fields: DraftField[]) => {
    update((current) => {
      const gallery: GalleryDraft = { ...current.draft[galleryId] };
      fields.forEach((field) => delete gallery[field]);
      const coverUris = { ...current.coverUris };
      if (fields.includes('phoneCoverImage')) delete coverUris[galleryId];
      const videos = { ...current.videos };
      if (fields.includes('galleryVideoId') && current.saved[galleryId]?.galleryVideoId === undefined) delete videos[galleryId];
      return {
        draft: Object.keys(gallery).length > 0 ? { ...current.draft, [galleryId]: gallery } : withoutGallery(current.draft, galleryId),
        coverUris,
        videos,
      };
    });
  }, [update]);

  const discard = useCallback(() => {
    update((current) => {
      const videos = { ...current.videos };
      Object.keys(current.draft).forEach((galleryId) => {
        if (current.saved[galleryId]?.galleryVideoId === undefined) delete videos[galleryId];
      });
      return { draft: EMPTY_DRAFT, coverUris: {}, videos };
    });
  }, [update]);

  /** Saves the draft gallery by gallery with the same calls the event screen uses. A gallery that fails keeps its
   *  unsaved part, so Save can be pressed again. Returns the names of the galleries that failed. */
  const save = useCallback(async (userId: string): Promise<{ failed: string[] }> => {
    const startState = stateRef.current;
    if (startState.saving || !startState.rootId) return { failed: [] };
    const rootId = startState.rootId;
    update(() => ({ saving: true }));
    const failed: string[] = [];

    for (const [galleryId, changes] of Object.entries(startState.draft)) {
      const done = (fields: GalleryDraft) => update((current) => {
        const remaining: GalleryDraft = { ...current.draft[galleryId] };
        (Object.keys(fields) as DraftField[]).forEach((field) => delete remaining[field]);
        return {
          draft: Object.keys(remaining).length > 0 ? { ...current.draft, [galleryId]: remaining } : withoutGallery(current.draft, galleryId),
          saved: { ...current.saved, [galleryId]: { ...current.saved[galleryId], ...fields } },
        };
      });

      try {
        // 1. A new phone cover picture: uploaded only now, the same way Change Cover does
        const coverUri = startState.coverUris[galleryId];
        if (coverUri && changes.phoneCoverImage === coverUri) {
          const coverUrl = await uploadEventCover({ uri: coverUri, eventId: galleryId, storageEventId: rootId, userId, target: 'phone' });
          update((current) => {
            const coverUris = { ...current.coverUris };
            delete coverUris[galleryId];
            return { coverUris };
          });
          done({ phoneCoverImage: coverUrl });
        } else if (changes.phoneCoverImage === null && savedValueIn(startState, galleryId, 'phoneCoverImage')) {
          // Back to the computer cover
          await removeEventCover(galleryId, savedValueIn(startState, galleryId, 'phoneCoverImage') || '', 'phone');
          done({ phoneCoverImage: null, phoneCoverMode: null, phoneCoverOffset: null, phoneCoverOffsetX: null, phoneCoverScale: null });
        }
        if (changes.coverImage === '') {
          const previousCover = savedValueIn(startState, galleryId, 'coverImage');
          if (previousCover) await removeEventCover(galleryId, previousCover);
          done({ coverImage: '' });
        }

        // 2. Text, date, a cover picked from the gallery, Fit / Fill (which resets the position)
        const fields: Partial<Event> = {};
        const savedFields: GalleryDraft = {};
        if (changes.title !== undefined) { fields.title = changes.title; savedFields.title = changes.title; }
        if (changes.date !== undefined) { fields.date = changes.date; savedFields.date = changes.date; }
        if (changes.description !== undefined) { fields.description = changes.description; savedFields.description = changes.description; }
        if (changes.coverImage) { fields.coverImage = changes.coverImage; savedFields.coverImage = changes.coverImage; }
        // The phone cover's photo chosen from the gallery, and its framing (each set as it is: Fit / Fill in the sheet
        // sets the position too)
        if (typeof changes.phoneCoverImage === 'string' && changes.phoneCoverImage !== coverUri) {
          fields.phoneCoverImage = changes.phoneCoverImage;
          savedFields.phoneCoverImage = changes.phoneCoverImage;
        }
        for (const field of ['phoneCoverMode', 'phoneCoverOffset', 'phoneCoverOffsetX', 'phoneCoverScale'] as const) {
          if (changes[field] !== undefined && !(changes.phoneCoverImage === null && changes[field] === null)) {
            Object.assign(fields, { [field]: changes[field] });
            Object.assign(savedFields, { [field]: changes[field] });
          }
        }
        if (changes.coverMode !== undefined) {
          Object.assign(fields, { coverMode: changes.coverMode, ...RESET_COVER_POSITION });
          savedFields.coverMode = changes.coverMode;
        }
        // Moved or zoomed: a percent focus point and zoom (shared/themes/coverFocus.ts)
        for (const field of ['coverOffset', 'coverOffsetX', 'coverScale'] as const) {
          if (changes[field] !== undefined) { fields[field] = changes[field]; savedFields[field] = changes[field]; }
        }
        if (Object.keys(fields).length > 0) {
          const ok = await updateEvent(galleryId, fields);
          if (!ok) throw new Error('updateEvent returned false');
          done(savedFields);
        }

        // 3. Highlight video
        if (changes.galleryVideoId !== undefined) {
          const result = await setGalleryVideo(galleryId, changes.galleryVideoId);
          if (!result.success) throw new Error(result.error || 'setGalleryVideo failed');
          done({ galleryVideoId: changes.galleryVideoId });
        }
      } catch (error) {
        console.error(`[GuestEdit] Saving ${galleryId} failed:`, error);
        const gallery = startState.galleries.find((item) => item.id === galleryId);
        failed.push(gallery ? (gallery.parentId ? gallery.title || 'Album' : 'Home') : 'a gallery');
      }
    }

    update(() => ({ saving: false }));
    return { failed };
  }, [update]);

  /** A gallery as guests will see it once saved: the saved values of this visit, then the draft */
  const apply = useCallback(<T extends Event | null | undefined>(gallery: T): T => {
    if (!gallery || !state.rootId) return gallery;
    return applyGalleryDraft(applyGalleryDraft(gallery, state.saved[gallery.id]), state.draft[gallery.id]) as T;
  }, [state.draft, state.rootId, state.saved]);

  /** The highlight video to show for a gallery while editing; undefined = not changed, use the saved one */
  const videoFor = useCallback((galleryId: string): GalleryVideo | null | undefined => {
    const changed = state.draft[galleryId]?.galleryVideoId !== undefined || state.saved[galleryId]?.galleryVideoId !== undefined;
    return changed ? state.videos[galleryId] ?? null : undefined;
  }, [state.draft, state.saved, state.videos]);

  return useMemo(() => ({
    ...state,
    active: state.rootId !== null,
    hasChanges: Object.keys(state.draft).length > 0,
    savedSomething: Object.keys(state.saved).length > 0,
    start, stop, setViewingAsGuest, openPanelFor, savedValue, currentValue, setField, setCoverUri, setVideo, undo, discard, save, apply, videoFor,
  }), [state, start, stop, setViewingAsGuest, openPanelFor, savedValue, currentValue, setField, setCoverUri, setVideo, undo, discard, save, apply, videoFor]);
}

export type GuestEdit = ReturnType<typeof useGuestEdit>;
