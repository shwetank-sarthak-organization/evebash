import { supabase } from "./supabase";
import { formatEventDate } from "./utils";
import { sendPushNotification } from "./pushNotifications";
import { getApiUrl } from "./apiBase";

// Memory caches to optimize lookups
const eventCache: Record<string, Event> = {};
const userCache: Record<string, any> = {};
const COVER_USAGE_TAG = "__cover_usage__";
const BUSINESS_PORTFOLIO_EVENTS_KEY = "__portfolio_events__";
const DEFAULT_EVENT_COVER_IMAGE = "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop";
const PLAN_EXPIRY_GRACE_DAYS = 7;
const FREE_PLAN_STORAGE_BYTES = 1024 * 1024 * 1024;
let photoInteractionChannelCounter = 0;

// --- Types ---

export interface Event {
    isPublic?: boolean;
    id: string; // "haldi", "wedding", etc.
    title: string;
    date: string;
    coverImage: string;
    description: string;
    createdBy?: string; // UID of the user who created it
    type?: 'main' | 'sub';
    parentId?: string;
    legacyId?: string; // Captures original truncated/mismatched ID for backward compatibility
    category?: string;
    templateId?: string; // 'hero' | 'classic', defaults to 'hero'
    joinId?: string; // 6-digit unique code for guests to join
    vendors?: string[];
    coverOffset?: number;
    coverOffsetX?: number;
    coverScale?: number;
    coverMode?: 'fit' | 'fill';
    order?: number;
    isSampleGallery?: boolean;
    sampleGalleryOrder?: number;
    createdAt?: any;
}

export interface Photo {
    id: string;
    eventId: string;
    storageKey: string; // Legacy field name; stores the media storage key
    url: string;                // The public URL
    driveDownloadUrl?: string;  // Fallback
    height?: number;
    width?: number;
    uploadedAt: any;
    tags?: string[];
    userId?: string;            // UID of the owner
    size?: number;              // File size in bytes
    format?: string;            // e.g., 'jpg', 'png'
    thumbnailUrl?: string;      // The thumbnail URL
    mediaType?: 'photo' | 'video';
    resourceType?: 'image' | 'video' | string;
    order?: number;
    status?: 'uploading' | 'processing' | 'processed' | 'failed';
    processingError?: string | null;
    transcodeAttempts?: number;
}

export interface Business {
    id: string;
    name: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    type: string;
    tags: string[];
    location: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    rating: number;
    coverImage: string;
    coverImages?: string[];
    createdBy: string;
    admins?: string[];
    allowedUsers?: string[];
    description?: string;
    experience?: number;
    startedDate?: any;
    eventsHosted?: number;
    services?: string[];
    faqs?: { q: string; a: string }[];
    portfolioEvents?: BusinessPortfolioEvent[];
    status: 'created' | 'published';
    shortId?: string;
    vendorCode?: string;
    announcements?: string[];
    createdAt?: any;
    profileViews?: number;
    viewsByDate?: Record<string, number>;
    shortlistCount?: number;
}

export interface BusinessPortfolioEvent {
    id: string;
    name: string;
    type: string;
    date: string;
    coverImage?: string;
    coverOffset?: number;
    coverOffsetX?: number;
    coverScale?: number;
    coverMode?: 'fit' | 'fill';
    media?: BusinessPortfolioMedia[];
    templateId?: string;
    createdAt?: any;
}

export interface BusinessPortfolioMedia {
    id: string;
    url: string;
    type?: 'image' | 'video';
    createdAt?: any;
}

export interface FaceRecord {
    id?: string;
    imageId: string;
    descriptor: number[]; // The 512-float FaceNet vector (L2-normalized)
    eventId: string;
    imageUrl: string;
    width: number;
    height: number;
    createdAt?: any;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    roleType?: 'primary' | 'event';
    delegatedBy?: string;
    assignedEvents?: string[];
    profileImage?: string;
    createdAt?: any;
    lastLogin?: any;
    username?: string;
    isPrivate?: boolean;
    location?: string;
    gender?: string;
    relationshipStatus?: string;
    persona?: string | string[];
    discoverable?: boolean;
    birthday?: string;
    anniversaryDate?: string;
    subscriptionDuration?: string;
    planStartDate?: string;
    planEndDate?: string;
    pendingPlanRole?: string;
    pendingSubscriptionDuration?: string;
    pendingPlanStartDate?: string;
    pendingPlanEndDate?: string;
    pushToken?: string;
    notificationPreferences?: any;
}

const USER_PROFILE_COLUMN_MAP: Record<keyof Partial<UserProfile>, string> = {
    id: "id",
    name: "name",
    email: "email",
    phone: "phone",
    role: "role",
    roleType: "role_type",
    delegatedBy: "delegated_by",
    assignedEvents: "assigned_events",
    profileImage: "profile_image",
    createdAt: "created_at",
    lastLogin: "last_login",
    username: "username",
    isPrivate: "is_private",
    location: "location",
    gender: "gender",
    relationshipStatus: "relationship_status",
    persona: "persona",
    discoverable: "discoverable",
    birthday: "birthday",
    anniversaryDate: "anniversary_date",
    subscriptionDuration: "subscription_duration",
    planStartDate: "plan_start_date",
    planEndDate: "plan_end_date",
    pendingPlanRole: "pending_plan_role",
    pendingSubscriptionDuration: "pending_subscription_duration",
    pendingPlanStartDate: "pending_plan_start_date",
    pendingPlanEndDate: "pending_plan_end_date",
    pushToken: "push_token",
    notificationPreferences: "notification_preferences",
};

function formatSupabaseError(error: unknown) {
    if (error && typeof error === "object") {
        const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
        return {
            message: supabaseError.message,
            details: supabaseError.details,
            hint: supabaseError.hint,
            code: supabaseError.code,
        };
    }
    return error;
}

export interface GuestLog {
    id: string;
    name: string;
    phone: string;
    email?: string;
    eventId?: string;
    parentEventId?: string;
    parentEventOwnerId?: string;
    eventTitle?: string;
    loginAt?: any;
    status: 'pending' | 'approved' | 'rejected';
    canAdmin?: boolean;
    canUpload?: boolean;
    canComment?: boolean;
    /** Account that joined (rows made by request_gallery_access / open_gallery) */
    userId?: string;
}

export interface Like {
    id: string;
    photoId: string;
    userId: string;
    userName: string;
    createdAt: any;
}

export interface EventFavouritePhoto {
    id: string;
    eventId: string;
    photoId: string;
    markedBy?: string;
    createdAt: any;
}

export interface Comment {
    id: string;
    photoId: string;
    userId: string;
    userName: string;
    text: string;
    parentId?: string; // ID of the comment being replied to
    createdAt: any;
}

// --- Helper mapping functions ---

function mapSqlToEvent(e: any): Event {
    return {
        id: e.id,
        title: e.title,
        date: formatEventDate(e.date),
        coverImage: e.cover_image,
        description: e.description,
        createdBy: e.created_by,
        type: e.type,
        parentId: e.parent_id,
        legacyId: e.legacy_id,
        category: e.category,
        templateId: e.template_id,
        joinId: e.join_id,
        vendors: e.vendors || [],
        coverOffset: e.cover_offset,
        coverOffsetX: e.cover_offset_x,
        coverScale: e.cover_scale,
        coverMode: e.cover_mode,
        order: e.order,
        isPublic: !!e.is_public,
        isSampleGallery: !!e.is_sample_gallery,
        sampleGalleryOrder: e.sample_gallery_order,
        createdAt: e.created_at
    };
}

function mapSqlToPhoto(p: any): Photo {
    return {
        id: p.id,
        eventId: p.event_id,
        storageKey: p.storage_key,
        url: p.url,
        driveDownloadUrl: p.drive_download_url,
        height: p.height,
        width: p.width,
        uploadedAt: p.uploaded_at,
        tags: p.tags,
        userId: p.user_id,
        size: p.size,
        format: p.format,
        thumbnailUrl: p.thumbnail_url,
        mediaType: p.media_type,
        resourceType: p.resource_type,
        order: p.order,
        status: p.status,
        processingError: p.processing_error,
        transcodeAttempts: p.transcode_attempts
    };
}

function isCoverUsagePhoto(photo: Photo): boolean {
    return Boolean(photo.tags?.includes(COVER_USAGE_TAG));
}

function isMediaVisibleInGallery(photo: Photo): boolean {
    if (isCoverUsagePhoto(photo)) return false;
    if (photo.status === 'uploading') return false;
    const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
    // Strict requirement: Videos must NOT show until 100% processed and fully available
    if (isVideo && photo.status !== "processed") return false;
    return true;
}

function getMediaCounts(photos: Photo[]) {
    return photos.reduce(
        (counts, photo) => {
            if (photo.mediaType === "video" || photo.resourceType === "video") {
                counts.videos += 1;
            } else {
                counts.photos += 1;
            }
            return counts;
        },
        { photos: 0, videos: 0 }
    );
}

function isPaidPlanRole(role?: string | null): boolean {
    const cleanRole = String(role || "free").toLowerCase();
    return cleanRole !== "admin" && cleanRole !== "free" && cleanRole !== "user" && cleanRole !== "freemium";
}

function isBeyondPlanGracePeriod(profile?: { role?: string | null; plan_end_date?: string | null } | null): boolean {
    if (!profile || !isPaidPlanRole(profile.role) || !profile.plan_end_date) return false;

    const endDate = new Date(`${profile.plan_end_date}T23:59:59.999Z`);
    if (Number.isNaN(endDate.getTime())) return false;

    const graceEndsAt = new Date(endDate);
    graceEndsAt.setUTCDate(graceEndsAt.getUTCDate() + PLAN_EXPIRY_GRACE_DAYS);
    return Date.now() > graceEndsAt.getTime();
}

function isPastPlanEndDate(profile?: { role?: string | null; plan_end_date?: string | null } | null): boolean {
    if (!profile || !isPaidPlanRole(profile.role) || !profile.plan_end_date) return false;
    const endDate = new Date(`${profile.plan_end_date}T23:59:59.999Z`);
    if (Number.isNaN(endDate.getTime())) return false;
    return Date.now() > endDate.getTime();
}

async function getEventOwnerExpiryProfile(eventIds: string[]) {
    const ids = eventIds.filter(Boolean);
    if (ids.length === 0) return null;

    const { data: eventRows, error: eventError } = await supabase
        .from("events")
        .select("created_by")
        .in("id", ids);

    if (eventError) throw eventError;

    const ownerIdentifier = String(eventRows?.find(row => row.created_by)?.created_by || "").trim();
    if (!ownerIdentifier) return null;

    let profileQuery = supabase
        .from("profiles")
        .select("id, email, role, plan_end_date")
        .limit(1);

    profileQuery = ownerIdentifier.includes("@")
        ? profileQuery.eq("email", ownerIdentifier)
        : profileQuery.eq("id", ownerIdentifier);

    const { data: profiles, error: profileError } = await profileQuery;
    if (profileError) throw profileError;

    return profiles?.[0] || null;
}

async function getVisiblePhotoIdsForExpiredOwner(ownerProfile: { id?: string; email?: string }) {
    const ownerIdentifiers = [ownerProfile.id, ownerProfile.email].filter(Boolean) as string[];
    if (ownerIdentifiers.length === 0) return new Set<string>();

    const { data: ownerEvents, error: eventsError } = await supabase
        .from("events")
        .select("id")
        .in("created_by", ownerIdentifiers);

    if (eventsError) throw eventsError;

    const ownerEventIds = (ownerEvents || []).map(event => event.id).filter(Boolean);
    if (ownerEventIds.length === 0) return new Set<string>();

    const { data: mediaRows, error: mediaError } = await supabase
        .from("photos")
        .select("id, size, uploaded_at, tags")
        .in("event_id", ownerEventIds);

    if (mediaError) throw mediaError;

    const visibleIds = new Set<string>();
    let visibleBytes = 0;

    (mediaRows || [])
        .filter(row => !Array.isArray(row.tags) || !row.tags.includes(COVER_USAGE_TAG))
        .sort((a, b) => {
            const aTime = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
            const bTime = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
            return aTime - bTime;
        })
        .forEach(row => {
            const size = Number(row.size) || 0;
            if (visibleBytes + size > FREE_PLAN_STORAGE_BYTES) return;
            visibleBytes += size;
            visibleIds.add(row.id);
        });

    return visibleIds;
}

type MediaPlanLimit = { state: 'active' | 'grace' | 'expired'; retainedIds: Set<string> };

/**
 * Expired-plan media limit for a gallery (grace: past the plan's end date; expired: more than 7 days past, when only
 * the oldest media within the free allowance shows). Worked out in the database by get_media_plan_limit, because the
 * owner's profile and other galleries aren't readable to guests once RLS is on. Falls back to the device-side lookup
 * below until that function exists.
 */
async function getMediaPlanLimit(eventIds: string[]): Promise<MediaPlanLimit> {
    const ids = eventIds.filter(Boolean);
    if (ids.length === 0) return { state: 'active', retainedIds: new Set() };

    const { data, error } = await supabase.rpc('get_media_plan_limit', { p_event_id: ids[0] });
    if (!error) {
        const state = data?.state === 'grace' || data?.state === 'expired' ? data.state : 'active';
        return { state, retainedIds: new Set<string>(Array.isArray(data?.retained_ids) ? data.retained_ids : []) };
    }

    const ownerProfile = await getEventOwnerExpiryProfile(ids);
    if (!ownerProfile || !isPastPlanEndDate(ownerProfile)) return { state: 'active', retainedIds: new Set() };
    return {
        state: isBeyondPlanGracePeriod(ownerProfile) ? 'expired' : 'grace',
        retainedIds: await getVisiblePhotoIdsForExpiredOwner(ownerProfile),
    };
}

async function filterPhotosForPlanExpiry(photos: Photo[], eventIds: string[]): Promise<Photo[]> {
    if (photos.length === 0) return photos;

    let planLimit: MediaPlanLimit;
    try {
        planLimit = await getMediaPlanLimit(eventIds);
    } catch (error) {
        console.warn("[PlanExpiry] Skipping media visibility filter:", error);
        return photos;
    }

    if (planLimit.state !== 'expired') return photos;
    return photos.filter(photo => planLimit.retainedIds.has(photo.id));
}

function getCoverUsagePhotoId(eventId: string, storageKey: string, url: string): string {
    const source = storageKey || url;
    const safeSource = source.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-120);
    return `cover_${eventId}_${safeSource}`;
}

function mapSqlToProfile(u: any): UserProfile {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        roleType: u.role_type,
        delegatedBy: u.delegated_by,
        profileImage: u.profile_image,
        createdAt: u.created_at,
        lastLogin: u.last_login,
        username: u.username,
        isPrivate: u.is_private ?? false,
        location: u.location,
        gender: u.gender,
        relationshipStatus: u.relationship_status,
        persona: u.persona,
        discoverable: u.discoverable ?? true,
        birthday: u.birthday,
        anniversaryDate: u.anniversary_date,
        subscriptionDuration: u.subscription_duration,
        planStartDate: u.plan_start_date,
        planEndDate: u.plan_end_date,
        pendingPlanRole: u.pending_plan_role,
        pendingSubscriptionDuration: u.pending_subscription_duration,
        pendingPlanStartDate: u.pending_plan_start_date,
        pendingPlanEndDate: u.pending_plan_end_date,
        assignedEvents: [], // Will be populated when querying assignments
        pushToken: u.push_token,
        notificationPreferences: u.notification_preferences
    };
}

function getGuestLogEmail(g: any): string | undefined {
    if (g.email) return g.email;
    if (typeof g.id !== "string") return undefined;

    const [possibleEmail] = g.id.split("_");
    return possibleEmail?.includes("@") ? possibleEmail : undefined;
}

function guestLogMatchesIdentifier(g: any, identifier: string): boolean {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!normalizedIdentifier) return false;

    const derivedEmail = getGuestLogEmail(g);
    const idPrefix = typeof g.id === "string" ? g.id.split("_")[0] : undefined;
    // user_id: rows made by request_gallery_access are tied to the account, not a phone number
    const candidates = [g.phone, g.email, derivedEmail, idPrefix, g.user_id]
        .filter(Boolean)
        .map(value => String(value).trim().toLowerCase());

    return candidates.includes(normalizedIdentifier);
}

function mapSqlToGuestLog(g: any): GuestLog {
    return {
        id: g.id,
        name: g.name,
        phone: g.phone,
        email: getGuestLogEmail(g),
        eventId: g.event_id,
        parentEventId: g.parent_event_id,
        parentEventOwnerId: g.parent_event_owner_id,
        eventTitle: g.event_title,
        loginAt: g.login_at,
        status: g.status,
        canAdmin: g.can_admin,
        canUpload: g.can_upload,
        canComment: g.can_comment,
        userId: g.user_id || undefined
    };
}

function mapSqlToBusiness(b: any): Business {
    const viewsByDate = sanitizeBusinessViewsByDate(b.views_by_date);

    return {
        id: b.id,
        name: b.name,
        ownerName: b.owner_name,
        ownerEmail: b.owner_email,
        ownerPhone: b.owner_phone,
        type: b.type,
        tags: b.tags || [],
        location: {
            latitude: b.latitude || 0,
            longitude: b.longitude || 0,
            address: b.address || undefined,
        },
        rating: b.rating || 0,
        coverImage: b.cover_image,
        coverImages: b.cover_images || [],
        createdBy: b.created_by,
        admins: b.admins || [],
        allowedUsers: b.allowed_users || [],
        description: b.description,
        experience: b.experience,
        startedDate: b.started_date,
        eventsHosted: b.events_hosted || 0,
        services: b.services || [],
        faqs: b.faqs || [],
        portfolioEvents: b.portfolio_events || b.views_by_date?.[BUSINESS_PORTFOLIO_EVENTS_KEY] || [],
        status: b.status || 'created',
        shortId: b.short_id,
        vendorCode: b.vendor_code,
        announcements: b.announcements || [],
        createdAt: b.created_at,
        profileViews: b.profile_views || 0,
        viewsByDate,
        shortlistCount: b.shortlist_count || 0,
    };
}

function sanitizeBusinessViewsByDate(value: any): Record<string, number> {
    if (!value || typeof value !== 'object') return {};

    return Object.entries(value).reduce<Record<string, number>>((acc, [key, count]) => {
        if (key === BUSINESS_PORTFOLIO_EVENTS_KEY) return acc;
        if (typeof count === 'number') acc[key] = count;
        return acc;
    }, {});
}

export function safeParseDateToISO(dateInput?: string | Date): string | null {
    if (!dateInput) return null;
    if (dateInput instanceof Date) {
        if (Number.isNaN(dateInput.getTime())) return null;
        return dateInput.toISOString();
    }

    try {
        const trimmed = String(dateInput).trim();
        if (!trimmed) return null;

        const lowerStr = trimmed.toLowerCase();
        const monthMap: Record<string, number> = {
            jan: 0, january: 0,
            feb: 1, february: 1,
            mar: 2, march: 2,
            apr: 3, april: 3,
            may: 4,
            jun: 5, june: 5,
            jul: 6, july: 6,
            aug: 7, august: 7,
            sep: 8, september: 8,
            oct: 9, october: 9,
            nov: 10, november: 10,
            dec: 11, december: 11,
        };

        let foundMonth: number | null = null;
        let foundMonthName = "";
        for (const key of Object.keys(monthMap)) {
            if (lowerStr.includes(key) && key.length > foundMonthName.length) {
                foundMonth = monthMap[key];
                foundMonthName = key;
            }
        }

        if (foundMonth !== null) {
            const numbers = lowerStr.match(/\d+/g);
            if (numbers?.length) {
                const yearMatch = numbers.find(n => n.length === 4);
                const year = yearMatch ? Number(yearMatch) : new Date().getFullYear();
                const dayMatch = numbers.find(n => n !== yearMatch && (n.length === 1 || n.length === 2));
                const day = dayMatch ? Number(dayMatch) : 1;
                const dateObj = new Date(year, foundMonth, day);
                if (!Number.isNaN(dateObj.getTime())) return dateObj.toISOString();
            }
        }

        const dateObj = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
            ? new Date(trimmed.replace(/-/g, "/"))
            : new Date(trimmed);

        if (!Number.isNaN(dateObj.getTime())) return dateObj.toISOString();

        console.warn(`[SafeDate] Failed to parse date string: "${trimmed}". Falling back to current date.`);
        return new Date().toISOString();
    } catch (error) {
        console.error("[SafeDate] Error parsing date:", error);
        return new Date().toISOString();
    }
}

// --- Database Functions ---

/**
 * Fetches all events from the events table.
 */
export async function getEvents(): Promise<Event[]> {
    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('title', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapSqlToEvent);
    } catch (error) {
        console.error("Error fetching events:", error);
        return [];
    }
}

/**
 * Fetches public sample galleries selected by the admin.
 */
export async function getSampleGalleryEvents(): Promise<Event[]> {
    try {
        // Listed by get_sample_galleries, which logged-out visitors can call once RLS is on; until it exists, read the table
        const { data: samples, error: samplesError } = await supabase.rpc('get_sample_galleries');
        if (!samplesError && Array.isArray(samples)) return samples.map(mapSqlToEvent);

        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('is_sample_gallery', true)
            .or('type.eq.main,and(type.is.null,parent_id.is.null)')
            .order('sample_gallery_order', { ascending: true, nullsFirst: false })
            .order('title', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapSqlToEvent);
    } catch (error) {
        console.error("Error fetching sample gallery events:", error);
        return [];
    }
}

/**
 * Fetches a single event by its ID.
 */
export async function getEvent(id: string): Promise<Event | null> {
    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        return data ? mapSqlToEvent(data) : null;
    } catch (error) {
        console.error("Error fetching event:", error);
        return null;
    }
}

/**
 * Fetches photos for a specific event with legacy ID support.
 */
export async function getEventPhotos(eventId: string, legacyId?: string): Promise<Photo[]> {
    if (!eventId) {
        console.warn("[Supabase] getEventPhotos: eventId is missing.");
        return [];
    }
    try {
        const ids = legacyId && legacyId !== eventId ? [eventId, legacyId] : [eventId];
        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .in('event_id', ids);

        if (error) throw error;
        const photos = (data || []).map(mapSqlToPhoto).filter(isMediaVisibleInGallery);
        const visiblePhotos = await filterPhotosForPlanExpiry(photos, ids);
        return visiblePhotos.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
    } catch (error) {
        console.error("Error fetching photos:", error);
        return [];
    }
}

/**
 * Fetches photos for a specific event with pagination.
 * @param eventId The primary event ID
 * @param legacyId An optional legacy event ID
 * @param page 0-indexed page number
 * @param limit Number of items per page (default: 20)
 * @returns Object containing the photos and a boolean indicating if there are more
 */
export async function getEventPhotosPaginated(
    eventId: string,
    legacyId?: string,
    page: number = 0,
    limit: number = 20
): Promise<{ photos: Photo[], hasMore: boolean, totalPhotos: number, totalVideos: number, retainedMediaIds: string[] }> {
    if (!eventId) {
        console.warn("[Supabase] getEventPhotosPaginated: eventId is missing.");
        return { photos: [], hasMore: false, totalPhotos: 0, totalVideos: 0, retainedMediaIds: [] };
    }
    try {
        const ids = legacyId && legacyId !== eventId ? [eventId, legacyId] : [eventId];

        let planLimit: MediaPlanLimit | null = null;
        try {
            planLimit = await getMediaPlanLimit(ids);
        } catch (error) {
            console.warn("[PlanExpiry] Skipping paginated media visibility filter:", error);
        }
        const shouldApplyExpiryVisibility = planLimit?.state === 'expired';

        if (shouldApplyExpiryVisibility) {
            const { data, error } = await supabase
                .from('photos')
                .select('*')
                .in('event_id', ids)
                .order('order', { ascending: true, nullsFirst: false })
                .order('uploaded_at', { ascending: false });

            if (error) throw error;

            const rawPhotos = (data || []).map(mapSqlToPhoto).filter(isMediaVisibleInGallery);
            const visibleIds = planLimit?.retainedIds ?? new Set<string>();
            const visiblePhotos = rawPhotos.filter(photo => visibleIds.has(photo.id));
            const start = page * limit;
            const photosToReturn = visiblePhotos.slice(start, start + limit);
            const mediaCounts = getMediaCounts(visiblePhotos);

            return {
                photos: photosToReturn,
                hasMore: visiblePhotos.length > start + limit,
                totalPhotos: mediaCounts.photos,
                totalVideos: mediaCounts.videos,
                retainedMediaIds: Array.from(visibleIds)
            };
        }

        const { data: countData, error: countError } = await supabase
            .from('photos')
            .select('id,event_id,storage_key,url,uploaded_at,tags,media_type,resource_type,status')
            .in('event_id', ids);

        if (countError) throw countError;

        const countedPhotos = (countData || []).map(mapSqlToPhoto).filter(isMediaVisibleInGallery);
        const mediaCounts = getMediaCounts(countedPhotos);
        let retainedMediaIds = countedPhotos.map(photo => photo.id);

        if (planLimit && planLimit.state !== 'active') {
            retainedMediaIds = Array.from(planLimit.retainedIds);
        }

        // Fetch one extra item to quickly determine if there are more items to load
        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .in('event_id', ids)
            .order('order', { ascending: true, nullsFirst: false })
            .order('uploaded_at', { ascending: false })
            .range(page * limit, (page + 1) * limit);

        if (error) throw error;

        const rawPhotos = (data || []).map(mapSqlToPhoto).filter(isMediaVisibleInGallery);
        const hasMore = rawPhotos.length > limit;
        const photosToReturn = hasMore ? rawPhotos.slice(0, limit) : rawPhotos;

        return {
            photos: photosToReturn,
            hasMore,
            totalPhotos: mediaCounts.photos,
            totalVideos: mediaCounts.videos,
            retainedMediaIds
        };
    } catch (error) {
        console.error("Error fetching paginated photos:", error);
        return { photos: [], hasMore: false, totalPhotos: 0, totalVideos: 0, retainedMediaIds: [] };
    }
}

function mapSqlToEventFavouritePhoto(row: any): EventFavouritePhoto {
    return {
        id: row.id,
        eventId: row.event_id,
        photoId: row.photo_id,
        markedBy: row.marked_by,
        createdAt: row.created_at
    };
}

function isEventFavouriteTableUnavailable(error: unknown) {
    const formatted = formatSupabaseError(error);
    if (!formatted || typeof formatted !== "object") return false;
    const code = (formatted as any).code;
    return code === "42P01" || code === "PGRST205";
}

function isEventFavouritePolicyBlocked(error: unknown) {
    const formatted = formatSupabaseError(error);
    if (!formatted || typeof formatted !== "object") return false;
    const code = (formatted as any).code;
    const message = String((formatted as any).message || "").toLowerCase();
    return code === "42501" || message.includes("row-level security") || message.includes("permission denied");
}

/**
 * Fetches host-curated favourite photos for an event group.
 * These are event-level favourites, not personal viewer likes.
 */
export async function getFavouritePhotosForEvents(eventIds: string[]): Promise<Photo[]> {
    const cleanEventIds = Array.from(new Set(eventIds.filter(Boolean)));
    if (cleanEventIds.length === 0) return [];

    try {
        const { data: favouriteRows, error: favouritesError } = await supabase
            .from('event_favourite_photos')
            .select('photo_id, created_at')
            .in('event_id', cleanEventIds)
            .order('created_at', { ascending: false });

        if (favouritesError) throw favouritesError;

        const favouritePhotoIds = Array.from(new Set((favouriteRows || []).map((row: any) => row.photo_id).filter(Boolean)));
        if (favouritePhotoIds.length === 0) return [];

        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .in('id', favouritePhotoIds);

        if (error) throw error;

        const favouriteOrder = new Map(favouritePhotoIds.map((id, index) => [id, index]));
        return (data || [])
            .map(mapSqlToPhoto)
            .filter(photo => !isCoverUsagePhoto(photo))
            .sort((a, b) => (favouriteOrder.get(a.id) ?? 0) - (favouriteOrder.get(b.id) ?? 0));
    } catch (error) {
        if (isEventFavouriteTableUnavailable(error)) {
            console.warn("Favourite gallery table is not available yet. Apply the Supabase migration for event_favourite_photos.");
            return [];
        }
        if (isEventFavouritePolicyBlocked(error)) {
            console.warn("Favourite gallery table exists, but RLS policies are not allowing access yet.");
            return [];
        }
        console.warn("Error fetching favourite photos:", formatSupabaseError(error));
        return [];
    }
}

export async function getEventFavouritePhotos(eventId: string): Promise<EventFavouritePhoto[]> {
    if (!eventId) return [];

    try {
        const { data, error } = await supabase
            .from('event_favourite_photos')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapSqlToEventFavouritePhoto);
    } catch (error) {
        if (isEventFavouriteTableUnavailable(error)) {
            console.warn("Favourite gallery table is not available yet. Apply the Supabase migration for event_favourite_photos.");
            return [];
        }
        if (isEventFavouritePolicyBlocked(error)) {
            console.warn("Favourite gallery table exists, but RLS policies are not allowing access yet.");
            return [];
        }
        console.warn("Error fetching event favourite photos:", formatSupabaseError(error));
        return [];
    }
}

export async function toggleEventFavouritePhoto(eventId: string, photoId: string, markedBy?: string) {
    if (!eventId || !photoId) return { favourited: false, error: "Missing event or photo." };

    try {
        const { data: existing, error: selectError } = await supabase
            .from('event_favourite_photos')
            .select('id')
            .eq('event_id', eventId)
            .eq('photo_id', photoId)
            .maybeSingle();

        if (selectError) throw selectError;

        if (existing) {
            const { error: deleteError } = await supabase
                .from('event_favourite_photos')
                .delete()
                .eq('id', existing.id);
            if (deleteError) throw deleteError;
            return { favourited: false };
        }

        const { error: insertError } = await supabase
            .from('event_favourite_photos')
            .insert({
                event_id: eventId,
                photo_id: photoId,
                marked_by: markedBy || null
            });

        if (insertError) throw insertError;
        return { favourited: true };
    } catch (error) {
        if (isEventFavouriteTableUnavailable(error)) {
            return {
                favourited: false,
                error: "Primary Gallery selection is not ready yet. Apply the Supabase migration for event_favourite_photos."
            };
        }

        if (isEventFavouritePolicyBlocked(error)) {
            return {
                favourited: false,
                error: "Primary Gallery selection exists, but Supabase RLS policies are not allowing access yet."
            };
        }

        const formattedError = formatSupabaseError(error);
        console.warn("Error toggling event favourite photo:", formattedError);
        const message = formattedError && typeof formattedError === "object" && "message" in formattedError
            ? String(formattedError.message || "")
            : "";
        return {
            favourited: false,
            error: message || "Failed to update Primary Gallery."
        };
    }
}

/**
 * Saves a detected face descriptor to the faces table.
 */
export async function saveFaceToIndex(face: FaceRecord) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            console.warn("Skipping face index save: no authenticated Supabase session.");
            return false;
        }

        const response = await fetch(getApiUrl("/api/find-you/index-face"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                image_id: face.imageId,
                descriptor: face.descriptor,
                event_id: face.eventId,
                image_url: face.imageUrl,
                width: face.width,
                height: face.height
            }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            console.warn("Face index save skipped:", result.error || `status ${response.status}`);
            return false;
        }

        return true;
    } catch (error) {
        console.warn("Face index save skipped:", error instanceof Error ? error.message : formatSupabaseError(error));
        return false;
    }
}

/**
 * Saves photo metadata to the photos table.
 */
export async function savePhoto(photo: Photo) {
    try {
        const upsertData: any = {
            id: photo.id,
            event_id: photo.eventId,
            storage_key: photo.storageKey,
            url: photo.url,
            drive_download_url: photo.driveDownloadUrl || null,
            height: photo.height || null,
            width: photo.width || null,
            uploaded_at: photo.uploadedAt ? new Date(photo.uploadedAt).toISOString() : new Date().toISOString(),
            tags: photo.tags || [],
            user_id: photo.userId || null,
            size: photo.size || null,
            format: photo.format || null,
            media_type: photo.mediaType || 'photo',
            resource_type: photo.resourceType || (photo.mediaType === 'video' ? 'video' : 'image'),
            order: photo.order ?? null
        };

        if (photo.thumbnailUrl) {
            upsertData.thumbnail_url = photo.thumbnailUrl;
        }

        const { error } = await supabase.from('photos').upsert(upsertData);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error saving photo:", error);
        return false;
    }
}

export async function saveCoverUsagePhoto(photo: Omit<Photo, "id" | "uploadedAt" | "tags"> & { uploadedAt?: any }) {
    const storageKey = photo.storageKey || photo.url;
    return savePhoto({
        ...photo,
        id: getCoverUsagePhotoId(photo.eventId, storageKey, photo.url),
        storageKey,
        uploadedAt: photo.uploadedAt || Date.now(),
        tags: [COVER_USAGE_TAG],
    });
}

export async function deleteCoverUsagePhoto(eventId: string, coverUrl: string): Promise<boolean> {
    if (!eventId || !coverUrl) return true;

    try {
        const { error } = await supabase
            .from('photos')
            .delete()
            .eq('event_id', eventId)
            .eq('url', coverUrl)
            .contains('tags', [COVER_USAGE_TAG]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting cover usage photo:", error);
        return false;
    }
}

/**
 * Checks if a phone number is allow-listed.
 */
export async function getAllowedUser(phone: string): Promise<any | null> {
    try {
        const { data, error } = await supabase
            .from('allowed_users')
            .select('*')
            .eq('phone', phone)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    } catch (error) {
        console.error("Error checking allowed user:", error);
        return null;
    }
}

/**
 * Updates the status of a guest request.
 */
export async function updateGuestStatus(logId: string, status: 'pending' | 'approved' | 'rejected') {
    try {
        const updateData: any = { status };
        if (status === 'approved') {
            updateData.can_upload = true;
            updateData.can_comment = true;
        }

        const { error } = await supabase
            .from('guests')
            .update(updateData)
            .eq('id', logId);
        if (error) throw error;

        // Fetch the guest's details to notify them of approval/update in background
        (async () => {
            try {
                const { data: guestLog } = await supabase
                    .from('guests')
                    .select('phone, event_title')
                    .eq('id', logId)
                    .maybeSingle();

                if (guestLog && guestLog.phone) {
                    const { data: guestProfile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('phone', guestLog.phone)
                        .maybeSingle();

                    if (guestProfile) {
                        const title = status === 'approved' ? "Access Approved! ✨" : "Access Request Update";
                        const body = status === 'approved'
                            ? `You have been approved to join the event "${guestLog.event_title || 'Wedding'}"!`
                            : `Your access request to "${guestLog.event_title || 'Wedding'}" was updated.`;

                        await sendPushNotification(
                            guestProfile.id,
                            title,
                            body,
                            { eventId: logId.split('_')[1] || null },
                            'eventInvites'
                        );
                    }
                }
            } catch (err) {
                console.error("[PushNotifications] Error in guest approval background task:", err);
            }
        })();


        return true;
    } catch (error) {
        console.error("Error updating guest status:", error);
        return false;
    }
}

export async function updateGuestPermissions(logId: string, permissions: Partial<{ canAdmin: boolean, canUpload: boolean, canComment: boolean }>) {
    try {
        const updateData: any = {};
        if (permissions.canAdmin !== undefined) updateData.can_admin = permissions.canAdmin;
        if (permissions.canUpload !== undefined) updateData.can_upload = permissions.canUpload;
        if (permissions.canComment !== undefined) updateData.can_comment = permissions.canComment;

        const { error } = await supabase
            .from('guests')
            .update(updateData)
            .eq('id', logId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating guest permissions:", error);
        return false;
    }
}

/**
 * Deletes a guest log.
 */
export async function deleteGuest(logId: string) {
    try {
        const { error } = await supabase
            .from('guests')
            .delete()
            .eq('id', logId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting guest:", error);
        return false;
    }
}

/**
 * Fetches guest logs for a specific event or parent event.
 */
export async function getEventLogs(eventId: string): Promise<GuestLog[]> {
    if (!eventId) {
        console.warn("[Supabase] getEventLogs: eventId is missing.");
        return [];
    }
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('*')
            .or(`event_id.eq.${eventId},parent_event_id.eq.${eventId}`)
            .order('login_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapSqlToGuestLog);
    } catch (error) {
        console.error("Error fetching event logs:", error);
        return [];
    }
}

/**
 * Fetches guest logs, optionally filtered by ownerId(s).
 */
export async function getGuestLogs(ownerIds?: string | string[]): Promise<GuestLog[]> {
    try {
        let queryBuilder = supabase.from('guests').select('*');

        if (ownerIds) {
            const ids = Array.isArray(ownerIds) ? ownerIds.filter(Boolean) : [ownerIds].filter(Boolean);
            if (ids.length > 0) {
                queryBuilder = queryBuilder.in('parent_event_owner_id', ids);
            }
        }

        const { data, error } = await queryBuilder.order('login_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapSqlToGuestLog);
    } catch (error) {
        console.error("Error fetching guest logs:", error);
        return [];
    }
}

/**
 * Adds a user to the allowed_users table.
 */
export async function addAllowedUser(name: string, phone: string, role: string = "guest") {
    try {
        const { error } = await supabase.from('allowed_users').upsert({
            phone,
            name,
            role,
            added_at: new Date().toISOString()
        });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error adding allowed user:", error);
        return false;
    }
}

/**
 * Creates a request for access in the pending_requests table.
 */
export async function requestAccess(name: string, phone: string) {
    try {
        const { error } = await supabase.from('pending_requests').upsert({
            phone,
            name,
            requested_at: new Date().toISOString()
        });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error requesting access:", error);
        return false;
    }
}

/**
 * Fetches all pending requests.
 */
export async function getPendingRequests(): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('pending_requests')
            .select('*')
            .order('requested_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(r => ({
            id: r.phone,
            phone: r.phone,
            name: r.name,
            requestedAt: r.requested_at
        }));
    } catch (error) {
        console.error("Error fetching pending requests:", error);
        return [];
    }
}

export function generateShortId(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function getUserBusinesses(uid: string): Promise<Business[]> {
    if (!uid) return [];
    try {
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .or(`created_by.eq.${uid},admins.cs.{${uid}},allowed_users.cs.{${uid}}`);

        if (error) throw error;
        return (data || []).map(mapSqlToBusiness).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } catch (error) {
        console.error("Error fetching user businesses:", error);
        return [];
    }
}

export async function getBusinessById(id: string): Promise<Business | null> {
    if (!id) return null;
    try {
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        return data ? mapSqlToBusiness(data) : null;
    } catch (error) {
        console.error("Error fetching business by ID:", error);
        return null;
    }
}

export async function createBusiness(businessData: Omit<Business, 'id' | 'createdAt'>) {
    try {
        const randomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        const vendorCode = businessData.vendorCode || `VEN-${randomCode}`;
        const generatedId = `biz_${Math.random().toString(36).slice(2, 15)}`;

        const { error } = await supabase.from('businesses').insert({
            id: generatedId,
            name: businessData.name,
            owner_name: businessData.ownerName,
            owner_email: businessData.ownerEmail || null,
            owner_phone: businessData.ownerPhone || null,
            type: businessData.type,
            tags: businessData.tags || [],
            latitude: businessData.location?.latitude || null,
            longitude: businessData.location?.longitude || null,
            address: businessData.location?.address || null,
            rating: businessData.rating || 0,
            cover_image: businessData.coverImage || null,
            cover_images: businessData.coverImages || [],
            created_by: businessData.createdBy || null,
            admins: businessData.admins || [],
            allowed_users: businessData.allowedUsers || [],
            description: businessData.description || null,
            experience: businessData.experience || null,
            started_date: businessData.startedDate ? new Date(businessData.startedDate).toISOString() : null,
            events_hosted: businessData.eventsHosted || 0,
            services: businessData.services || [],
            faqs: businessData.faqs || [],
            status: businessData.status || 'created',
            short_id: businessData.shortId || null,
            vendor_code: vendorCode,
            announcements: businessData.announcements || [],
            views_by_date: businessData.portfolioEvents !== undefined
                ? { [BUSINESS_PORTFOLIO_EVENTS_KEY]: businessData.portfolioEvents }
                : {},
            created_at: new Date().toISOString(),
        });

        if (error) throw error;
        return generatedId;
    } catch (error) {
        console.error("Error adding business:", error);
        return null;
    }
}

export async function updateBusiness(bizId: string, data: Partial<Business>): Promise<boolean> {
    try {
        const updateObj: any = {};
        if (data.name !== undefined) updateObj.name = data.name;
        if (data.ownerName !== undefined) updateObj.owner_name = data.ownerName;
        if (data.ownerEmail !== undefined) updateObj.owner_email = data.ownerEmail;
        if (data.ownerPhone !== undefined) updateObj.owner_phone = data.ownerPhone;
        if (data.type !== undefined) updateObj.type = data.type;
        if (data.tags !== undefined) updateObj.tags = data.tags;
        if (data.location !== undefined) {
            if (data.location.latitude !== undefined) updateObj.latitude = data.location.latitude;
            if (data.location.longitude !== undefined) updateObj.longitude = data.location.longitude;
            if (data.location.address !== undefined) updateObj.address = data.location.address;
        }
        if (data.rating !== undefined) updateObj.rating = data.rating;
        if (data.coverImage !== undefined) updateObj.cover_image = data.coverImage;
        if (data.coverImages !== undefined) updateObj.cover_images = data.coverImages;
        if (data.admins !== undefined) updateObj.admins = data.admins;
        if (data.allowedUsers !== undefined) updateObj.allowed_users = data.allowedUsers;
        if (data.description !== undefined) updateObj.description = data.description;
        if (data.experience !== undefined) updateObj.experience = data.experience;
        if (data.startedDate !== undefined) updateObj.started_date = data.startedDate ? new Date(data.startedDate).toISOString() : null;
        if (data.eventsHosted !== undefined) updateObj.events_hosted = data.eventsHosted;
        if (data.services !== undefined) updateObj.services = data.services;
        if (data.faqs !== undefined) updateObj.faqs = data.faqs;
        if (data.portfolioEvents !== undefined) {
            const { data: existingBusiness } = await supabase
                .from('businesses')
                .select('views_by_date')
                .eq('id', bizId)
                .maybeSingle();

            updateObj.views_by_date = {
                ...(existingBusiness?.views_by_date || {}),
                [BUSINESS_PORTFOLIO_EVENTS_KEY]: data.portfolioEvents,
            };
        }
        if (data.status !== undefined) updateObj.status = data.status;
        if (data.shortId !== undefined) updateObj.short_id = data.shortId;
        if (data.vendorCode !== undefined) updateObj.vendor_code = data.vendorCode;
        if (data.announcements !== undefined) updateObj.announcements = data.announcements;
        if (data.profileViews !== undefined) updateObj.profile_views = data.profileViews;
        if (data.viewsByDate !== undefined) updateObj.views_by_date = data.viewsByDate;

        const { error } = await supabase.from('businesses').update(updateObj).eq('id', bizId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating business:", error);
        return false;
    }
}

export const BUSINESS_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    'Venue': { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', text: '#ec4899' },
    'Photography': { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)', text: '#38bdf8' },
    'Videography': { bg: 'rgba(129, 140, 248, 0.12)', border: 'rgba(129, 140, 248, 0.3)', text: '#818cf8' },
    'Catering': { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' },
    'Food Stalls': { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' },
    'Music & DJ': { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', text: '#a855f7' },
    'Lighting': { bg: 'rgba(253, 224, 71, 0.12)', border: 'rgba(253, 224, 71, 0.3)', text: '#fde047' },
    'Decor': { bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)', text: '#20b8a6' },
    'Event Planner': { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)', text: '#f43f5e' },
    'Security': { bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)', text: '#64748b' },
    'Anchors': { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)', text: '#06b6d4' },
    'Gifts': { bg: 'rgba(219, 39, 119, 0.12)', border: 'rgba(219, 39, 119, 0.3)', text: '#db2777' },
    'Travel': { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.3)', text: '#0ea5e9' },
    'Staff': { bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.3)', text: '#4ade80' },
    'Invitations': { bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.3)', text: '#fb923c' },
    'Makeup': { bg: 'rgba(244, 114, 182, 0.12)', border: 'rgba(244, 114, 182, 0.3)', text: '#f472b6' },
    'Apparel': { bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.3)', text: '#a78bfa' },
    'Trophies': { bg: 'rgba(250, 204, 21, 0.12)', border: 'rgba(250, 204, 21, 0.3)', text: '#facc15' },
};

export const getBusinessTypeColor = (type: string) => {
    return BUSINESS_TYPE_COLORS[type] || { bg: 'rgba(202, 156, 104, 0.12)', border: 'rgba(202, 156, 104, 0.25)', text: '#CA9C68' };
};

export async function getTopRatedBusinesses(limitCount: number = 10): Promise<Business[]> {
    try {
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('status', 'published')
            .order('rating', { ascending: false })
            .limit(limitCount);

        if (error) throw error;
        return (data || []).map(mapSqlToBusiness);
    } catch (error) {
        console.error("Error fetching top rated businesses:", error);
        return [];
    }
}

export async function getPublishedBusinesses(category?: string): Promise<Business[]> {
    try {
        let queryBuilder = supabase.from('businesses').select('*').eq('status', 'published');
        if (category) {
            queryBuilder = queryBuilder.eq('type', category);
        }
        const { data, error } = await queryBuilder;
        if (error) throw error;
        return (data || []).map(mapSqlToBusiness);
    } catch (error) {
        console.error("Error fetching published businesses:", error);
        return [];
    }
}

export async function toggleShortlistBusiness(userId: string, businessId: string): Promise<boolean> {
    if (!userId || !businessId) return false;
    try {
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('shortlisted')
            .eq('id', userId)
            .maybeSingle();

        if (fetchError) throw fetchError;

        const current: string[] = Array.isArray(profile?.shortlisted) ? profile.shortlisted : [];
        const isShortlisted = current.includes(businessId);
        const next = isShortlisted
            ? current.filter(id => id !== businessId)
            : [...current, businessId];

        const { error } = await supabase
            .from('profiles')
            .update({ shortlisted: next })
            .eq('id', userId);

        if (error) throw error;
        return !isShortlisted;
    } catch (error) {
        console.error("Error toggling business shortlist:", error);
        return false;
    }
}

/**
 * Denies (deletes) a pending request.
 */
export async function denyRequest(phone: string) {
    try {
        const { error } = await supabase
            .from('pending_requests')
            .delete()
            .eq('phone', phone);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error denying request:", error);
        return false;
    }
}

/**
 * Checks if a username is unique.
 */
const USERNAME_PATTERN = /^(?!.*[._]{2})[a-z0-9](?:[a-z0-9._]{1,10}[a-z0-9])$/;

export function isValidUsername(username: string): boolean {
    return USERNAME_PATTERN.test(username.trim().toLowerCase());
}

export async function isUsernameUnique(username: string, excludeUid?: string): Promise<boolean> {
    try {
        const normalizedUsername = username.trim().toLowerCase();
        if (!isValidUsername(normalizedUsername)) return false;

        // is_username_available answers without reading anyone's profile (other people's profiles aren't readable once
        // RLS is on). It treats your own username as free. Until the function exists, fall back to the direct lookup.
        const { data: available, error: availabilityError } = await supabase.rpc('is_username_available', { p_username: normalizedUsername });
        if (!availabilityError && typeof available === 'boolean') return available;

        let queryBuilder = supabase
            .from('profiles')
            .select('id')
            .eq('username', normalizedUsername);

        if (excludeUid) {
            queryBuilder = queryBuilder.neq('id', excludeUid);
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;
        return (data || []).length === 0;
    } catch (error) {
        console.error("Error checking username uniqueness:", error);
        throw error;
    }
}

/**
 * Auto-generates a unique username.
 */
export async function generateUniqueUsername(base: string): Promise<string> {
    let username = base.toLowerCase().replace(/[^a-z0-9_.]/g, "_");
    username = username.replace(/_+/g, "_").replace(/\.+/g, ".");
    username = username.replace(/^[_.]+|[_.]+$/g, "");
    
    if (username.length < 3) {
        username = username ? `user_${username}` : "user";
    }
    if (username.length > 12) {
        username = username.substring(0, 12);
        username = username.replace(/[_.]+$/g, "");
    }
    if (username.length < 3) {
        username = username.padEnd(3, "0");
    }
    
    let candidate = username;
    let suffix = 1;
    let isUnique = false;
    
    while (!isUnique && suffix < 50) {
        try {
            const unique = await isUsernameUnique(candidate);
            if (unique) {
                isUnique = true;
            } else {
                const suffixStr = suffix.toString();
                const maxBaseLen = 12 - suffixStr.length;
                let trimmedBase = username.substring(0, maxBaseLen).replace(/[_.]+$/g, "");
                if (trimmedBase.length < 2) trimmedBase = "u";
                candidate = `${trimmedBase}${suffixStr}`;
                suffix++;
            }
        } catch (error) {
            console.error("Failed to check username uniqueness, breaking loop:", error);
            candidate = `${username.substring(0, 5)}_${Date.now().toString().slice(-6)}`;
            break;
        }
    }
    
    return candidate;
}

/**
 * Updates user profile details in Supabase.
 */
export async function updateUserProfile(uid: string, updateData: Partial<UserProfile>) {
    try {
        const { data: existingProfile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", uid)
            .maybeSingle();

        if (profileError) throw profileError;

        const writableColumns = new Set(
            existingProfile ? Object.keys(existingProfile) : ["name", "username", "profile_image", "phone", "email", "push_token"]
        );
        const updateObj = Object.entries(updateData).reduce<Record<string, unknown>>((acc, [key, value]) => {
            if (value === undefined) return acc;
            const column = USER_PROFILE_COLUMN_MAP[key as keyof UserProfile];
            if (column && writableColumns.has(column)) {
                acc[column] = value;
            }
            return acc;
        }, {});

        if (Object.keys(updateObj).length === 0) {
            return true;
        }

        if (typeof updateObj.username === "string") {
            const username = updateObj.username.trim().toLowerCase();
            if (!isValidUsername(username)) {
                throw new Error("Invalid username format");
            }
            updateObj.username = username;
        }

        const { error } = await supabase
            .from('profiles')
            .update(updateObj)
            .eq('id', uid);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating user profile:", formatSupabaseError(error));
        return false;
    }
}

export async function updateUserPrivacy(uid: string, isPrivate: boolean) {
    return updateUserProfile(uid, { isPrivate });
}

/**
 * Creates or updates a user profile.
 */
export async function createUserProfile(uid: string, name: string, email: string, phone: string = "", role: string = "user") {
    try {
        const { data: existing } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .maybeSingle();

        let username = existing?.username;
        if (!username) {
            const base = email ? email.split("@")[0] : name;
            username = await generateUniqueUsername(base);
        }

        const { error } = await supabase.from('profiles').upsert({
            id: uid,
            name: existing?.name || name,
            email: existing?.email || email,
            phone: existing?.phone || phone,
            role: existing?.role || role,
            role_type: existing?.role_type || (existing?.delegated_by ? 'event' : 'primary'),
            created_at: existing?.created_at || new Date().toISOString(),
            last_login: new Date().toISOString(),
            username
        });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error creating user profile:", error);
        return false;
    }
}

/**
 * Fetches a user profile by UID.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const { data: user, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .maybeSingle();

        if (error) throw error;
        if (!user) return null;

        const profile = mapSqlToProfile(user);

        // Fetch assigned events
        const { data: assignments } = await supabase
            .from('profile_assigned_events')
            .select('event_id')
            .eq('profile_id', uid);

        profile.assignedEvents = (assignments || []).map(a => a.event_id);
        return profile;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

/**
 * Updates just the profile image of a user.
 */
export async function updateUserProfileImage(uid: string, imageUrl: string) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ profile_image: imageUrl })
            .eq('id', uid);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating user profile image:", error);
        return false;
    }
}

/**
 * Fetches all registered users.
 */
export async function getUsers(): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapSqlToProfile);
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

export interface GuestProfile {
    id?: string;
    name?: string;
    username?: string;
    email?: string;
    phone?: string;
    profileImage?: string;
}

/**
 * Profile details of a guest row, for the gallery host's guest panel. Rows made by request_gallery_access carry the
 * account (user_id): name and photo come from profile_cards, which hosts can still read once RLS is on (username and
 * email are private then). Older phone/email rows keep the direct profile lookup, which works until the lockdown;
 * after it the panel shows the guest row's own name and phone.
 */
export async function getGuestProfile(log: { userId?: string; email?: string; phone?: string }): Promise<GuestProfile | null> {
    if (log.userId) {
        const { data, error } = await supabase.from('profile_cards').select('id, name, profile_image').eq('id', log.userId).maybeSingle();
        if (error) throw error;
        return data ? { id: data.id, name: data.name, profileImage: data.profile_image } : null;
    }

    const identifiers = [log.email, log.phone].filter(Boolean) as string[];
    if (identifiers.length === 0) return null;
    const filters = identifiers.flatMap((identifier) => [`id.eq.${identifier}`, `email.eq.${identifier}`, `phone.eq.${identifier}`]);
    const { data } = await supabase.from('profiles').select('*').or(filters.join(',')).limit(1).maybeSingle();
    return data ? {
        id: data.id,
        name: data.name,
        username: data.username,
        email: data.email,
        phone: data.phone,
        profileImage: data.profile_image,
    } : null;
}

/**
 * Fetches a single user document by its UID.
 */
export async function getUserById(uid: string): Promise<any | null> {
    if (!uid) return null;
    const decodedUid = decodeURIComponent(uid);
    if (userCache[decodedUid]) {
        return userCache[decodedUid];
    }
    try {
        const profile = await getUserProfile(decodedUid);
        if (profile) {
            userCache[decodedUid] = profile;
        }
        return profile;
    } catch (error) {
        console.error("Error fetching user by ID:", error);
        return null;
    }
}

/**
 * Fetches events created by a specific user.
 */
export async function getUserEvents(userIds: string | string[], type?: 'main' | 'sub', parentId?: string, legacyParentId?: string): Promise<Event[]> {
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);

    if (ids.length === 0) {
        console.warn("[Supabase] getUserEvents: userIds are missing.");
        return [];
    }

    try {
        let queryBuilder = supabase.from('events').select('*').in('created_by', ids);
        const { data, error } = await queryBuilder;
        if (error) throw error;

        const events = (data || []).map(mapSqlToEvent);

        let filteredEvents = [...events];

        if (type === 'sub') {
            filteredEvents = filteredEvents.filter(e => {
                const isMatch = e.parentId === parentId || (legacyParentId && e.parentId === legacyParentId);
                const isNotSelf = e.id !== parentId && (!legacyParentId || e.id !== legacyParentId);
                const isSubLevel = e.type === 'sub' || (!!e.parentId);
                return isMatch && isNotSelf && isSubLevel;
            });
        } else {
            filteredEvents = filteredEvents.filter(e => {
                const isMain = e.type === 'main' || (!e.type && !e.parentId);
                if (!isMain) {
                    const parentExists = events.some(ev => ev.id === e.parentId);
                    if (!parentExists) return true;
                }
                return isMain;
            });
        }

        return filteredEvents.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching user events:", error);
        return [];
    }
}

/**
 * Fetches all sub-events for a given parent event ID.
 */
export async function getSubEvents(parentId: string, legacyParentId?: string): Promise<Event[]> {
    if (!parentId) {
        console.warn("[Supabase] getSubEvents: parentId is missing.");
        return [];
    }
    try {
        const ids = legacyParentId && legacyParentId !== parentId ? [parentId, legacyParentId] : [parentId];
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .in('parent_id', ids);

        if (error) throw error;

        const subEvents = (data || [])
            .map(mapSqlToEvent)
            .filter(e => e.id !== parentId && (!legacyParentId || e.id !== legacyParentId));

        return subEvents.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching sub-events:", error);
        return [];
    }
}

/**
 * Updates a user's role and delegation metadata.
 */
export async function updateUserRole(uid: string, newRole: string | null, delegatedBy?: string, roleType?: 'primary' | 'event', assignedEvents?: string[]) {
    if (!uid) {
        console.warn("[Supabase] updateUserRole: uid is missing.");
        return false;
    }
    try {
        const updateData: any = {};
        if (newRole !== null) updateData.role = newRole;

        if (delegatedBy) {
            updateData.delegated_by = delegatedBy;
            if (roleType) updateData.role_type = roleType;
        } else {
            updateData.delegated_by = null;
            updateData.role_type = null;
        }

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', uid);

        if (error) throw error;

        // Manage assigned events pairings
        if (delegatedBy && roleType === 'event' && assignedEvents) {
            // Clear existing assignments first
            await supabase.from('profile_assigned_events').delete().eq('profile_id', uid);
            // Insert new assignments
            const pairs = assignedEvents.map(eventId => ({ profile_id: uid, event_id: eventId }));
            if (pairs.length > 0) {
                await supabase.from('profile_assigned_events').insert(pairs);
            }
        } else {
            await supabase.from('profile_assigned_events').delete().eq('profile_id', uid);
        }

        const decodedUid = decodeURIComponent(uid);
        delete userCache[decodedUid];
        delete userCache[uid];

        return true;
    } catch (error) {
        console.error("Error updating user role:", error);
        return false;
    }
}

/**
 * Counts how many people a specific user has promoted to admin/editor.
 */
export async function getDelegatedAdminsCount(ownerUid: string): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('delegated_by', ownerUid);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error("Error counting delegated admins:", error);
        return 0;
    }
}

/**
 * Deletes a user profile.
 */
export async function deleteUser(uid: string) {
    try {
        const { error } = await supabase.from('profiles').delete().eq('id', uid);
        if (error) throw error;

        const decodedUid = decodeURIComponent(uid);
        delete userCache[decodedUid];
        delete userCache[uid];

        return true;
    } catch (error) {
        console.error("Error deleting user:", error);
        return false;
    }
}

/**
 * Creates a new event.
 */
export async function createEvent(event: Event): Promise<{ success: boolean; error?: string }> {
    try {
        const payload = {
            id: event.id,
            title: event.title,
            date: event.date ? safeParseDateToISO(event.date) : null,
            cover_image: event.coverImage || DEFAULT_EVENT_COVER_IMAGE,
            description: event.description || null,
            created_by: event.createdBy || null,
            type: event.type || null,
            parent_id: event.parentId || null,
            legacy_id: event.legacyId || null,
            category: event.category || null,
            template_id: event.templateId || 'hero',
            join_id: event.joinId || null
        };

        const { error } = await supabase.from('events').upsert(payload);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        const details = error && typeof error === "object"
            ? {
                code: "code" in error ? error.code : undefined,
                message: "message" in error ? error.message : undefined,
                details: "details" in error ? error.details : undefined,
                hint: "hint" in error ? error.hint : undefined,
            }
            : error;
        console.error("Error creating event:", details);
        const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
            ? error.message
            : "Failed to create event.";
        return { success: false, error: message };
    }
}

/**
 * Fetches a single event by ID with fallback support.
 */
export async function getEventById(eventId: string, refresh = false): Promise<Event | null> {
    const decodedId = decodeURIComponent(eventId);
    if (!refresh && eventCache[decodedId]) {
        return eventCache[decodedId];
    }
    try {
        // Attempt point read
        const { data: direct, error: directError } = await supabase
            .from('events')
            .select('*')
            .eq('id', decodedId)
            .maybeSingle();

        if (direct) {
            const event = mapSqlToEvent(direct);
            eventCache[decodedId] = event;
            return event;
        }

        // Strategy A: Check legacy_id == decodedId
        const { data: legacy } = await supabase
            .from('events')
            .select('*')
            .eq('legacy_id', decodedId)
            .maybeSingle();

        if (legacy) {
            const event = mapSqlToEvent(legacy);
            eventCache[decodedId] = event;
            return event;
        }

        // Strategy B: Check title == decodedId (slug fallback)
        const { data: title } = await supabase
            .from('events')
            .select('*')
            .eq('title', decodedId)
            .maybeSingle();

        if (title) {
            const event = mapSqlToEvent(title);
            eventCache[decodedId] = event;
            return event;
        }

        return null;
    } catch (error) {
        console.error("Error fetching event by ID:", error);
        return null;
    }
}

// --- Gallery links (supabase/migrations/20261007000000_rls_part1_gallery_link_functions.sql) ---

/** What the current viewer may do with a gallery link, as decided by open_gallery() */
export type GalleryAccess = 'manage' | 'member' | 'public_view' | 'pending' | 'rejected' | 'none' | 'login_required' | 'not_found';

export interface OpenedGallery {
    access: GalleryAccess;
    /** The gallery's own id; links may use a join code or legacy id */
    eventId?: string;
    title?: string;
    /** public_view only: display fields of the gallery and the sub-galleries of its top-level event */
    event?: Event;
    subEvents: Event[];
}

/**
 * Resolves a gallery link (id, legacy id or join code) for the current viewer.
 * Opening a public gallery while logged in joins it. Throws if the lookup fails.
 */
export async function openGallery(ref: string): Promise<OpenedGallery> {
    const { data, error } = await supabase.rpc('open_gallery', { p_ref: decodeURIComponent(ref) });
    if (error) throw error;

    const result = (data || {}) as any;
    const event: Event | undefined = result.event ? { ...mapSqlToEvent(result.event), isPublic: true } : undefined;
    const rootId = event?.parentId || event?.id;
    const subEvents: Event[] = Array.isArray(result.sub_events)
        ? result.sub_events
            .map((sub: any) => ({ ...mapSqlToEvent(sub), type: 'sub' as const, parentId: rootId, isPublic: true }))
            .sort((a: Event, b: Event) => (a.title || "").localeCompare(b.title || ""))
        : [];

    return {
        access: (result.access || 'not_found') as GalleryAccess,
        eventId: result.event_id || event?.id,
        title: result.title || event?.title,
        event,
        subEvents,
    };
}

/** Previews and video streams of a public gallery, for viewers who aren't logged in. Never photo originals. */
export async function getPublicGalleryMedia(eventId: string, limit = 60, offset = 0): Promise<Photo[]> {
    const { data, error } = await supabase.rpc('get_public_gallery_media', { p_event_id: eventId, p_limit: limit, p_offset: offset });
    if (error) throw error;

    return (data || []).map((row: any): Photo => {
        const isVideo = row.media_type === 'video';
        return {
            id: row.id,
            eventId: row.event_id,
            storageKey: '',
            // Photos carry the preview image and videos the HLS stream, so `url` is never an original
            url: (isVideo ? row.stream_url : row.preview_url) || '',
            thumbnailUrl: row.thumbnail_url || undefined,
            width: row.width ?? undefined,
            height: row.height ?? undefined,
            mediaType: isVideo ? 'video' : 'photo',
            resourceType: isVideo ? 'video' : 'image',
            order: row.sort_order ?? undefined,
            status: 'processed',
            uploadedAt: row.uploaded_at,
        };
    });
}

/** Logged-in viewer asks to join a gallery: public ones approve at once, private ones wait for the host. */
export async function requestGalleryAccess(ref: string): Promise<string> {
    const { data, error } = await supabase.rpc('request_gallery_access', { p_ref: decodeURIComponent(ref) });
    if (error) throw error;
    return String(data || 'pending');
}

export function generateEventJoinId(eventId: string): string {
    const cleanId = eventId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const parts = eventId.split('-');
    const suffix = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
    const prefix = cleanId.slice(0, 4);

    if (suffix && suffix.length >= 3 && /^[A-Z0-9]+$/.test(suffix)) {
        return `${prefix}-${suffix}`;
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${randomSuffix}`;
}

/**
 * Deletes a specific photo record.
 */
export async function deletePhoto(photoId: string): Promise<boolean> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error("Authentication required");
        }

        const response = await fetch(getApiUrl("/api/media/delete"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ photoId }),
        });

        if (!response.ok) {
            const errResult = await response.json().catch(() => ({}));
            throw new Error(errResult.error || `Failed with status: ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error("Error deleting photo:", error);
        return false;
    }
}

export async function rotatePhoto(
    photoId: string,
    direction: "left" | "right"
): Promise<{
    success: boolean;
    url?: string;
    thumbnailUrl?: string;
    width?: number | null;
    height?: number | null;
    size?: number;
    cacheBuster?: number;
    error?: string;
}> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error("Authentication required");
        }

        const response = await fetch(getApiUrl("/api/media/rotate"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ photoId, direction }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || `Failed with status: ${response.status}`);
        }

        return { success: true, ...result };
    } catch (error) {
        console.error("Error rotating photo:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to rotate photo",
        };
    }
}

/**
 * Deletes an event and recursively deletes sub-events.
 */
export async function deleteEvent(eventId: string): Promise<boolean> {
    try {
        // 1. Delete sub-events recursively
        const { data: subs } = await supabase.from('events').select('id').eq('parent_id', eventId);
        if (subs && subs.length > 0) {
            for (const sub of subs) {
                await deleteEvent(sub.id);
            }
        }

        // 2. Fetch photos metadata and delete B2 assets for all photos associated with this event
        const { data: photos } = await supabase.from('photos').select('id, size, overhead_size, media_type, uploaded_at').eq('event_id', eventId);

        if (photos && photos.length > 0) {
            console.log(`[deleteEvent] Cleaning up B2 files for ${photos.length} photos under event ${eventId}`);
            // Run deletions in chunks of 4 to prevent network socket exhaustion and 502 Bad Gateway timeouts on the server
            const chunkSize = 4;
            for (let i = 0; i < photos.length; i += chunkSize) {
                const chunk = photos.slice(i, i + chunkSize);
                await Promise.all(chunk.map(photo => deletePhoto(photo.id)));
            }
        }

        // 3. Record compact 1-row financial ledger entry so Backblaze byte-hours and transactions can be accurately billed
        try {
            const totalBytes = (photos || []).reduce((s: number, p: any) => s + (Number(p.size) || 0) + (Number(p.overhead_size) || 0), 0);
            const photosCount = (photos || []).filter((p: any) => String(p.media_type || '').toLowerCase() !== 'video').length;
            const videosCount = (photos || []).filter((p: any) => String(p.media_type || '').toLowerCase() === 'video').length;
            const earliestUpload = photos && photos.length > 0
                ? photos.map((p: any) => p.uploaded_at).filter(Boolean).sort()[0]
                : null;
            const eventCreatedAt = earliestUpload || new Date().toISOString();

            // archive_deleted_event writes the record with the gallery's real owner and title; only people who
            // may manage the gallery can call it (the archive table itself is admin-only once RLS is on)
            const { error: archiveError } = await supabase.rpc('archive_deleted_event', {
                p_event_id: eventId,
                p_photos_count: photosCount,
                p_videos_count: videosCount,
                p_total_bytes: totalBytes,
                p_deleted_by: 'user_web',
                p_event_created_at: eventCreatedAt,
            });
            if (archiveError) console.warn('[deleteEvent] Could not record deletion ledger (non-blocking):', archiveError.message);
        } catch (archiveErr) {
            console.warn('[deleteEvent] Could not record deletion ledger (non-blocking):', archiveErr);
        }

        // 4. Explicitly delete facial indexes associated with this event (for guest privacy)
        await supabase.from('faces').delete().eq('event_id', eventId);

        // 5. Delete the parent event (Cascading foreign key triggers automatically delete associated photos, likes, & comments!)
        const { error } = await supabase.from('events').delete().eq('id', eventId);
        if (error) throw error;

        delete eventCache[eventId];
        return true;
    } catch (error) {
        console.error("Error deleting event:", error);
        return false;
    }
}

/**
 * Updates an event's data.
 */
export async function updateEvent(eventId: string, data: Partial<Event>): Promise<boolean> {
    try {
        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title;
        if (data.date !== undefined) updateData.date = data.date ? new Date(data.date).toISOString() : null;
        if (data.coverImage !== undefined) updateData.cover_image = data.coverImage;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.templateId !== undefined) updateData.template_id = data.templateId;
        if (data.joinId !== undefined) updateData.join_id = data.joinId;
        if (data.vendors !== undefined) updateData.vendors = data.vendors;
        if (data.coverOffset !== undefined) updateData.cover_offset = data.coverOffset;
        if (data.coverOffsetX !== undefined) updateData.cover_offset_x = data.coverOffsetX;
        if (data.coverScale !== undefined) updateData.cover_scale = data.coverScale;
        if (data.coverMode !== undefined) updateData.cover_mode = data.coverMode;
        if (data.order !== undefined) updateData.order = data.order;
        if (data.isSampleGallery !== undefined) updateData.is_sample_gallery = data.isSampleGallery;
        if (data.sampleGalleryOrder !== undefined) updateData.sample_gallery_order = data.sampleGalleryOrder;

        if (Object.keys(updateData).length === 0) {
            return true;
        }

        const { error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', eventId);

        if (error) {
            if (error.code === 'PGRST204') {
                const match = error.message.match(/Could not find the '([^']+)' column/i);
                const missingCol = match?.[1];
                const dbToPropMap: Record<string, keyof Event> = {
                    title: 'title',
                    date: 'date',
                    cover_image: 'coverImage',
                    description: 'description',
                    category: 'category',
                    template_id: 'templateId',
                    join_id: 'joinId',
                    vendors: 'vendors',
                    cover_offset: 'coverOffset',
                    cover_offset_x: 'coverOffsetX',
                    cover_scale: 'coverScale',
                    cover_mode: 'coverMode',
                    order: 'order',
                    is_sample_gallery: 'isSampleGallery',
                    sample_gallery_order: 'sampleGalleryOrder',
                };
                const prop = missingCol ? dbToPropMap[missingCol] : undefined;

                if (prop && data[prop] !== undefined) {
                    console.warn(`[Supabase database] Column '${missingCol}' does not exist on 'events' table. Pruning and retrying...`);
                    const nextData = { ...data };
                    delete nextData[prop];
                    return updateEvent(eventId, nextData);
                }
            }

            throw error;
        }

        delete eventCache[eventId];
        return true;
    } catch (error) {
        console.error("Error updating event:", formatSupabaseError(error));
        return false;
    }
}

export async function setEventSampleGalleryStatus(eventId: string, isSampleGallery: boolean): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('events')
            .update({ is_sample_gallery: isSampleGallery })
            .eq('id', eventId);

        if (error) throw error;
        delete eventCache[eventId];
        return true;
    } catch (error) {
        console.error("Error updating sample gallery status:", formatSupabaseError(error));
        return false;
    }
}

export async function updatePhotosOrder(orderedIds: string[]): Promise<boolean> {
    try {
        await Promise.all(
            orderedIds.map((id, index) => supabase.from('photos').update({ order: index }).eq('id', id))
        );
        return true;
    } catch (error) {
        console.error("Error updating photo order:", error);
        return false;
    }
}

/**
 * Moves photos/videos to another gallery of the same event. Likes, comments and
 * Primary Gallery favourites stay attached because they reference the photo id.
 */
export async function movePhotosToGallery(photoIds: string[], targetEventId: string): Promise<{ moved: number; error?: string }> {
    if (photoIds.length === 0 || !targetEventId) return { moved: 0 };
    const { data, error } = await supabase.rpc('move_photos_to_gallery', {
        p_photo_ids: photoIds,
        p_target_event_id: targetEventId,
    });
    if (error) {
        console.error("Error moving media:", formatSupabaseError(error));
        return { moved: 0, error: error.message || "Could not move media." };
    }
    return { moved: typeof data === "number" ? data : 0 };
}

export async function updateSubEventsOrder(orderedIds: string[]): Promise<boolean> {
    try {
        await Promise.all(
            orderedIds.map((id, index) => supabase.from('events').update({ order: index }).eq('id', id))
        );
        return true;
    } catch (error) {
        console.error("Error updating sub-events order:", error);
        return false;
    }
}

/**
 * Calculates the total size of all photos uploaded by a specific user.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StorageBreakdown = { events: number; vault: number; total: number };

/** Bytes used by event media (originals plus streaming/preview assets). */
export async function getUserEventStorage(identifiers: string | string[]): Promise<number> {
    try {
        const ids = Array.isArray(identifiers) ? identifiers : [identifiers];
        const { data, error } = await supabase
            .from('photos')
            .select('size, overhead_size')
            .in('user_id', ids);

        if (error) throw error;
        return (data || []).reduce((acc, p: any) => acc + (Number(p.size) || 0) + (Number(p.overhead_size) || 0), 0);
    } catch (error) {
        console.error("Error calculating event storage:", error);
        return 0;
    }
}

/**
 * Bytes used by EB Vault, from its running total. Returns 0 until the Vault
 * tables exist, so storage totals keep working before Vault launches.
 */
export async function getUserVaultStorage(identifiers: string | string[]): Promise<number> {
    try {
        // Vault rows are keyed by the auth user id; emails/phones in the identifier list don't apply.
        const ids = (Array.isArray(identifiers) ? identifiers : [identifiers]).filter(id => UUID_PATTERN.test(id));
        if (ids.length === 0) return 0;
        const { data, error } = await supabase
            .from('vault_accounts')
            .select('used_bytes')
            .in('owner_id', ids);

        if (error) return 0;
        return (data || []).reduce((acc, row: any) => acc + (Number(row.used_bytes) || 0), 0);
    } catch {
        return 0;
    }
}

/** Event and Vault usage share one plan-wide storage limit. */
export async function getUserStorageBreakdown(identifiers: string | string[]): Promise<StorageBreakdown> {
    const [events, vault] = await Promise.all([getUserEventStorage(identifiers), getUserVaultStorage(identifiers)]);
    return { events, vault, total: events + vault };
}

/** Total plan storage used, events plus Vault; upload limit checks use this. */
export async function getUserTotalStorage(identifiers: string | string[]): Promise<number> {
    return (await getUserStorageBreakdown(identifiers)).total;
}

export async function getUserPhotosCount(uid: string): Promise<number> {
    if (!uid) return 0;
    try {
        const { count, error } = await supabase
            .from('photos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', uid);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error("Error fetching user photos count:", error);
        return 0;
    }
}

/**
 * Counts how many main events a user has created.
 */
export async function getUserEventCount(uid: string): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', uid)
            .eq('type', 'main');

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error("Error counting user events:", error);
        return 0;
    }
}

/**
 * Toggles a like for a photo.
 */
export async function toggleLike(photoId: string, userId: string, userName: string) {
    try {
        // Query to check if like exists
        const { data: existing, error: selectError } = await supabase
            .from('likes')
            .select('id')
            .eq('photo_id', photoId)
            .eq('user_id', userId)
            .maybeSingle();

        if (selectError) throw selectError;

        if (existing) {
            const { error: deleteError } = await supabase
                .from('likes')
                .delete()
                .eq('id', existing.id);
            if (deleteError) throw deleteError;
            return { liked: false };
        } else {
            const { error: insertError } = await supabase.from('likes').insert({
                photo_id: photoId,
                user_id: userId
            });
            if (insertError) throw insertError;
            return { liked: true };
        }
    } catch (error) {
        console.error("Error toggling like:", error);
        throw error;
    }
}

/**
 * Adds a comment (or reply) to a photo.
 */
export async function addComment(photoId: string, userId: string, userName: string, text: string, parentId?: string) {
    try {
        const { error } = await supabase.from('comments').insert({
            photo_id: photoId,
            user_id: userId,
            text,
            parent_id: parentId || null
        });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error adding comment:", error);
        return false;
    }
}

/**
 * Real-time listener for likes and comments for a specific photo.
 */
export function onPhotoInteractions(photoId: string, callback: (data: { likes: any[], comments: any[] }) => void) {
    let currentLikes: any[] = [];
    let currentComments: any[] = [];

    const fetchAndTrigger = async () => {
        // Fetch profiles alongside likes/comments using Postgres joins
        // Signed in: names come from profile_cards (name and photo only), since other people's profiles aren't
        // readable once RLS is on. Signed out keeps the old embed; likes and comments are members-only after the lockdown.
        const { data: { session } } = await supabase.auth.getSession();
        const people = session ? 'profiles:profile_cards(name, profile_image)' : 'profiles(name, profile_image)';
        const [likesRes, commentsRes] = await Promise.all([
            supabase.from('likes').select(`id, created_at, user_id, ${people}`).eq('photo_id', photoId),
            supabase.from('comments').select(`id, text, created_at, user_id, parent_id, ${people}`).eq('photo_id', photoId)
        ]);

        if (!likesRes.error && likesRes.data) {
            currentLikes = likesRes.data.map((l: any) => ({
                id: l.id,
                photoId: photoId,
                userId: l.user_id,
                userName: l.profiles?.name || 'Guest User',
                profileImage: l.profiles?.profile_image || null,
                createdAt: l.created_at
            }));
            currentLikes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        if (!commentsRes.error && commentsRes.data) {
            currentComments = commentsRes.data.map((c: any) => ({
                id: c.id,
                photoId: photoId,
                userId: c.user_id,
                userName: c.profiles?.name || 'Guest User',
                profileImage: c.profiles?.profile_image || null,
                text: c.text,
                parentId: c.parent_id || null,
                createdAt: c.created_at
            }));
            currentComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        callback({ likes: currentLikes, comments: currentComments });
    };

    fetchAndTrigger();

    const channelName = `photo-interactions-${photoId}-${Date.now()}-${photoInteractionChannelCounter++}`;

    // Configure all callbacks before subscribe; Supabase does not allow adding
    // postgres_changes handlers after a channel has subscribed. The unique name
    // lets multiple components watch the same photo at the same time.
    const interactionsChannel = supabase
        .channel(channelName)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'likes', filter: `photo_id=eq.${photoId}` },
            () => fetchAndTrigger()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'comments', filter: `photo_id=eq.${photoId}` },
            () => fetchAndTrigger()
        )
        .subscribe();

    return () => {
        supabase.removeChannel(interactionsChannel);
    };
}

/**
 * Deletes a comment.
 */
export async function deletePhotoComment(commentId: string) {
    try {
        const { error } = await supabase.from('comments').delete().eq('id', commentId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting comment:", error);
        return false;
    }
}

/**
 * Fetches events visited by a specific user.
 */
export async function getUserVisits(identifier: string): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('*')
            .eq('status', 'approved')
            .order('login_at', { ascending: false });

        if (error) throw error;
        return (data || [])
            .filter(row => guestLogMatchesIdentifier(row, identifier))
            .map(mapSqlToGuestLog);
    } catch (error) {
        console.error("Error fetching user visits:", error);
        return [];
    }
}

/**
 * Searches for a name associated with a phone number in the guests collection.
 */
export async function findGuestNameByPhone(phone: string): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('name')
            .eq('phone', phone)
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data?.name || null;
    } catch (error) {
        console.error("Error finding guest name:", error);
        return null;
    }
}

/**
 * Fetches all likes by a specific user.
 */
export async function getUserLikes(userId: string): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('likes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(l => ({
            id: l.id,
            photoId: l.photo_id,
            userId: l.user_id,
            createdAt: l.created_at
        }));
    } catch (error) {
        console.error("Error fetching user likes:", error);
        return [];
    }
}

/**
 * Helper serialization logic.
 */
export function serializeDatabaseData<T>(data: T): T {
    // supabse data already formatted in ISO strings, simply return
    return data;
}

/**
 * Follows another user.
 */
export async function followUser(followerId: string, followedId: string) {
    try {
        // relationships doesn't exist in current basic Supabase tables schema, we can ignore or stub safely
        return true;
    } catch (error) {
        console.error("Error following user:", error);
        return false;
    }
}

/**
 * Unfollows another user.
 */
export async function unfollowUser(followerId: string, followedId: string) {
    try {
        return true;
    } catch (error) {
        console.error("Error unfollowing user:", error);
        return false;
    }
}

/**
 * Fetches the list of user IDs that a specific user is following.
 */
export async function getFollowing(userId: string): Promise<string[]> {
    return [];
}

/**
 * Counts how many people are following a specific user.
 */
export async function getFollowersCount(userId: string): Promise<number> {
    return 0;
}

/**
 * Counts how many people a specific user is following.
 */
export async function getFollowingCount(userId: string): Promise<number> {
    return 0;
}


export async function getApprovedSharedEventsForUser(identifiers: string | string[], isAdminOnly: boolean = false): Promise<Event[]> {
    try {
        const ids = Array.isArray(identifiers) ? identifiers.filter(Boolean) : [identifiers].filter(Boolean);
        if (ids.length === 0) return [];

        const visitsByIdentifier = await Promise.all(ids.map((identifier) => getUserVisits(identifier)));
        const visits = visitsByIdentifier.flat();

        const eventVisits: { [eventId: string]: any[] } = {};
        visits.forEach(v => {
            const eid = v.eventId;
            if (eid) {
                if (!eventVisits[eid]) eventVisits[eid] = [];
                eventVisits[eid].push(v);
            }
        });

        const eventIds = Object.keys(eventVisits).filter(eid => {
            const vList = eventVisits[eid];
            return vList.some(v => v.status === "approved" && (!isAdminOnly || !!v.canAdmin));
        });

        const uniqueEventIds = [...new Set(eventIds)];
        const events = await Promise.all(uniqueEventIds.map((eventId) => getEventById(eventId)));

        return events
            .filter((event): event is Event => event !== null)
            .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching approved shared events:", error);
        return [];
    }
}

export async function getUserPendingVisits(identifier: string): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('*')
            .eq('status', 'pending')
            .order('login_at', { ascending: false });

        if (error) throw error;
        return (data || [])
            .filter(row => guestLogMatchesIdentifier(row, identifier))
            .map(mapSqlToGuestLog);
    } catch (error) {
        console.error("Error fetching user pending visits:", error);
        return [];
    }
}

export async function getPendingSharedEventsForUser(identifiers: string | string[]): Promise<Event[]> {
    try {
        const ids = Array.isArray(identifiers) ? identifiers.filter(Boolean) : [identifiers].filter(Boolean);
        if (ids.length === 0) return [];

        const visitsByIdentifier = await Promise.all(ids.map((identifier) => getUserPendingVisits(identifier)));
        const visits = visitsByIdentifier.flat();

        const eventVisits: { [eventId: string]: any[] } = {};
        visits.forEach(v => {
            const eid = v.eventId;
            if (eid) {
                if (!eventVisits[eid]) eventVisits[eid] = [];
                eventVisits[eid].push(v);
            }
        });

        const eventIds = Object.keys(eventVisits).filter(eid => {
            const vList = eventVisits[eid];
            return vList.some(v => v.status === "pending");
        });

        const uniqueEventIds = [...new Set(eventIds)];
        const events = await Promise.all(uniqueEventIds.map((eventId) => getEventById(eventId)));

        return events
            .filter((event): event is Event => event !== null)
            .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching pending shared events:", error);
        return [];
    }
}
