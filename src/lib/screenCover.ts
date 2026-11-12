import { useSyncExternalStore } from "react";
import { PHONE_COVER_MAX_WIDTH, withShownCover, type CoverTarget, type TwoCovers } from "../../shared/themes/phoneCover";
import { isDefaultEventCover, resolveEventCoverImage } from "@/lib/eventCovers";

// The website's guest pages, dashboard cards and sample galleries show a gallery's phone cover on phone-sized screens
// and its computer cover from 768 px (shared/themes/phoneCover.ts). The host page edits the computer cover and
// always shows it.

const PHONE_QUERY = `(max-width: ${PHONE_COVER_MAX_WIDTH}px)`;

function subscribe(onChange: () => void) {
    const media = window.matchMedia(PHONE_QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

/** Which cover this screen shows; follows the window as it is resized */
export function useCoverTarget(): CoverTarget {
    return useSyncExternalStore(subscribe, () => (window.matchMedia(PHONE_QUERY).matches ? "phone" : "computer"), () => "computer");
}

/** Default covers, also once resolved for display (the category covers in public/event-covers/) */
export function isDefaultCoverPhoto(image?: string | null) {
    return isDefaultEventCover(image) || !!image?.startsWith("/event-covers/");
}

/** The gallery with the cover this screen shows in its cover fields, the photo ready to display. The same object
 *  when that's the cover it already has. */
export function withScreenCover<T extends (TwoCovers & { category?: string }) | null | undefined>(
    gallery: T,
    target: CoverTarget,
    mode: "preview" | "thumbnail" = "preview",
): T {
    if (!gallery) return gallery;
    const shown = withShownCover(gallery, target, isDefaultCoverPhoto);
    if (shown === gallery) return gallery;
    const image = shown.coverImage;
    // A new picture from the computer (edit mode) shows as it is until it's uploaded
    return { ...shown, coverImage: image?.startsWith("blob:") ? image : resolveEventCoverImage(image, mode, gallery.category) };
}
