import { supabase } from "./supabase";

export const generateShortId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `WA-${result}`;
};

export interface Event {
    id: string;
    title: string;
    date: string;
    coverImage: string;
    description: string;
    createdBy?: string;
    type?: 'main' | 'sub';
    parentId?: string;
    legacyId?: string;
    joinId?: string;
    category?: string;
    templateId?: string;
    vendors?: string[];
    createdAt?: any;
    coverOffset?: number;
    coverOffsetX?: number;
    coverScale?: number;
    coverMode?: 'fit' | 'fill';
    order?: number;
    titleAlign?: 'left' | 'center' | 'right';
    hostName?: string;
    showWelcomeCard?: boolean;
}

export interface Photo {
    id: string;
    eventId: string;
    cloudinaryPublicId: string;
    url: string;
    mediaType?: 'photo' | 'video';
    resourceType?: 'image' | 'video' | string;
    uploadedAt: any;
    userId?: string;
    width?: number;
    height?: number;
    size?: number;
    format?: string;
    order?: number;
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
    status: 'created' | 'published';
    shortId?: string;
    vendorCode?: string;
    announcements?: string[];
    createdAt?: any;
    profileViews?: number;
    viewsByDate?: Record<string, number>;
    shortlistCount?: number;
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
    username?: string;
    isPrivate?: boolean;
    createdAt?: any;
    location?: string;
    gender?: string;
    relationshipStatus?: string;
    persona?: string | string[];
    discoverable?: boolean;
    notificationPreferences?: any;
    birthday?: string;
    anniversaryDate?: string;
}

export interface GuestLog {
    id: string;
    name: string;
    phone: string;
    email?: string;
    eventId: string;
    parentEventId?: string;
    eventTitle?: string;
    parentEventOwnerId?: string;
    loginAt: any;
    status: 'pending' | 'approved' | 'rejected';
    canAdmin?: boolean;
    canUpload?: boolean;
    canComment?: boolean;
}

export interface Enquiry {
    id?: string;
    businessId: string;
    businessName: string;
    name: string;
    date: string;
    message: string;
    phone?: string;
    email?: string;
    userId?: string | null;
    vendorOwnerId: string;
    vendorOwnerEmail: string;
    preferredContact?: 'chat' | 'whatsapp' | 'call' | 'email';
    city?: string;
    createdAt?: any;
    status?: 'active' | 'ended';
    category?: string;
}

export interface ChatRoom {
  id?: string;
  clientUid: string;
  clientName: string;
  clientAvatar?: string;
  vendorUid: string;
  vendorName: string; // Business name
  businessId: string;
  lastMessage?: string;
  lastMessageAt?: any;
  createdAt: any;
  status?: 'active' | 'closed';
  enquiryId?: string;
  clientDeleted?: boolean;
  vendorDeleted?: boolean;
}

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

// --- Helper mapping functions ---

function mapSqlToEvent(e: any): Event {
    return {
        id: e.id,
        title: e.title,
        date: e.date,
        coverImage: e.cover_image,
        description: e.description,
        createdBy: e.created_by,
        type: e.type,
        parentId: e.parent_id,
        legacyId: e.legacy_id,
        templateId: e.template_id,
        joinId: e.join_id,
        order: e.order,
        category: e.category,
        showWelcomeCard: e.show_welcome_card,
        coverOffset: e.cover_offset,
        coverOffsetX: e.cover_offset_x,
        coverScale: e.cover_scale,
        coverMode: e.cover_mode,
        titleAlign: e.title_align,
        vendors: e.vendors || [],
        hostName: e.host_name
    };
}

function mapSqlToPhoto(p: any): Photo {
    return {
        id: p.id,
        eventId: p.event_id,
        cloudinaryPublicId: p.cloudinary_public_id,
        url: p.url,
        mediaType: p.media_type,
        resourceType: p.resource_type,
        uploadedAt: p.uploaded_at,
        userId: p.user_id,
        width: p.width,
        height: p.height,
        size: p.size,
        format: p.format,
        order: p.order
    };
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
        username: u.username,
        isPrivate: u.is_private || false,
        assignedEvents: []
    };
}

function mapSqlToGuestLog(g: any): GuestLog {
    return {
        id: g.id,
        name: g.name,
        phone: g.phone,
        email: g.email || undefined,
        eventId: g.event_id,
        parentEventId: g.parent_event_id,
        parentEventOwnerId: g.parent_event_owner_id,
        eventTitle: g.event_title,
        loginAt: g.login_at,
        status: g.status,
        canAdmin: g.can_admin,
        canUpload: g.can_upload,
        canComment: g.can_comment
    };
}

function mapSqlToBusiness(b: any): Business {
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
            address: b.address || undefined
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
        status: b.status || 'created',
        shortId: b.short_id,
        vendorCode: b.vendor_code,
        announcements: b.announcements || [],
        createdAt: b.created_at,
        profileViews: b.profile_views || 0,
        viewsByDate: b.views_by_date || {},
        shortlistCount: b.shortlist_count || 0
    };
}

// --- Database Functions ---

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const profile = mapSqlToProfile(data);
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

export async function getUserById(uid: string): Promise<UserProfile | null> {
    return getUserProfile(uid);
}

export async function getUsers(): Promise<UserProfile[]> {
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

export async function updateUserRole(
    uid: string,
    newRole: string | null,
    delegatedBy?: string,
    roleType?: 'primary' | 'event',
    assignedEvents?: string[]
) {
    if (!uid) return false;
    try {
        const updateData: any = {};
        if (newRole) updateData.role = newRole;

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

        // Manage assignments
        if (delegatedBy && roleType === 'event' && assignedEvents) {
            await supabase.from('profile_assigned_events').delete().eq('profile_id', uid);
            const pairs = assignedEvents.map(eventId => ({ profile_id: uid, event_id: eventId }));
            if (pairs.length > 0) {
                await supabase.from('profile_assigned_events').insert(pairs);
            }
        } else {
            await supabase.from('profile_assigned_events').delete().eq('profile_id', uid);
        }

        return true;
    } catch (error) {
        console.error("Error updating user role:", error);
        return false;
    }
}

export async function getUserTotalStorage(identifiers: string[]): Promise<number> {
    try {
        const { data, error } = await supabase
            .from('photos')
            .select('size')
            .in('user_id', identifiers);

        if (error) throw error;
        return (data || []).reduce((acc, p) => acc + (p.size || 0), 0);
    } catch (error) {
        console.error("Error fetching storage stats:", error);
        return 0;
    }
}

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

export async function getUserEvents(userIds: string | string[], type?: 'main' | 'sub', parentId?: string, legacyParentId?: string): Promise<Event[]> {
    try {
        const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
        if (ids.length === 0) return [];

        const { data, error } = await supabase
            .from('events')
            .select('*')
            .in('created_by', ids);

        if (error) throw error;

        const events = (data || []).map(mapSqlToEvent);
        let filteredEvents = [...events];

        if (type === 'sub') {
            filteredEvents = filteredEvents.filter(e => {
                const matchesParent = e.parentId === parentId || (!!legacyParentId && e.parentId === legacyParentId);
                const isNotSelf = e.id !== parentId && (!legacyParentId || e.id !== legacyParentId);
                const looksSub = e.type === 'sub' || !!e.parentId;
                return matchesParent && isNotSelf && looksSub;
            });
        } else {
            filteredEvents = filteredEvents.filter(e => {
                const isMain = e.type === 'main' || (!e.type && !e.parentId);
                if (isMain) return true;
                const parentExists = events.some(ev => ev.id === e.parentId);
                return !parentExists;
            });
        }

        return filteredEvents.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching user events:", error);
        return [];
    }
}

export async function updateUserProfileImage(uid: string, imageUrl: string) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ profile_image: imageUrl })
            .eq('id', uid);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating profile image:", error);
        return false;
    }
}

export async function isUsernameUnique(username: string, excludeUid?: string): Promise<boolean> {
    try {
        let queryBuilder = supabase
            .from('profiles')
            .select('id')
            .eq('username', username.toLowerCase());

        if (excludeUid) {
            queryBuilder = queryBuilder.neq('id', excludeUid);
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;
        return (data || []).length === 0;
    } catch (error) {
        console.error("Error checking username uniqueness:", error);
        return false;
    }
}

export async function updateUserProfile(uid: string, updateData: Partial<UserProfile>) {
    try {
        const updateObj: any = {};
        if (updateData.name !== undefined) updateObj.name = updateData.name;
        if (updateData.username !== undefined) updateObj.username = updateData.username;
        if (updateData.profileImage !== undefined) updateObj.profile_image = updateData.profileImage;
        if (updateData.phone !== undefined) updateObj.phone = updateData.phone;
        if (updateData.email !== undefined) updateObj.email = updateData.email;

        const { error } = await supabase
            .from('profiles')
            .update(updateObj)
            .eq('id', uid);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating user profile:", error);
        return false;
    }
}

export async function submitFeedback(userId: string, userName: string, text: string, category: string) {
    try {
        console.log(`[Supabase] Feedback received: ${userName} (${userId}) - [${category}] ${text}`);
        return true;
    } catch (error) {
        console.error("Error submitting feedback:", error);
        return false;
    }
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

export async function getEventById(eventId: string): Promise<Event | null> {
    try {
        const decodedId = decodeURIComponent(eventId);
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', decodedId)
            .maybeSingle();

        if (data) return mapSqlToEvent(data);

        // Fallbacks
        const { data: legacy } = await supabase.from('events').select('*').eq('legacy_id', decodedId).maybeSingle();
        if (legacy) return mapSqlToEvent(legacy);

        const { data: title } = await supabase.from('events').select('*').eq('title', decodedId).maybeSingle();
        if (title) return mapSqlToEvent(title);

        return null;
    } catch (error) {
        console.error("Error fetching event by ID:", error);
        return null;
    }
}

export async function getSubEvents(parentId: string, legacyParentId?: string): Promise<Event[]> {
    if (!parentId) return [];
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

        return subEvents.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
    } catch (error) {
        console.error("Error fetching sub-events:", error);
        return [];
    }
}

export async function getEventPhotos(eventId: string, legacyId?: string): Promise<Photo[]> {
    if (!eventId) return [];
    try {
        const ids = legacyId && legacyId !== eventId ? [eventId, legacyId] : [eventId];
        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .in('event_id', ids);

        if (error) throw error;
        const photos = (data || []).map(mapSqlToPhoto);
        return photos.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
    } catch (error) {
        console.error("Error fetching photos:", error);
        return [];
    }
}

export async function updatePhotosOrder(orderedIds: string[]): Promise<boolean> {
    try {
        const promises = orderedIds.map((id, index) =>
            supabase.from('photos').update({ order: index }).eq('id', id)
        );
        await Promise.all(promises);
        return true;
    } catch (error) {
        console.error("Error updating photo order:", error);
        return false;
    }
}

export async function updateSubEventsOrder(orderedIds: string[]): Promise<boolean> {
    try {
        const promises = orderedIds.map((id, index) =>
            supabase.from('events').update({ order: index }).eq('id', id)
        );
        await Promise.all(promises);
        return true;
    } catch (error) {
        console.error("Error updating sub-events order:", error);
        return false;
    }
}

export async function createEvent(event: Event) {
    try {
        const { error } = await supabase.from('events').upsert({
            id: event.id,
            title: event.title,
            date: event.date ? new Date(event.date).toISOString() : null,
            cover_image: event.coverImage || null,
            description: event.description || null,
            created_by: event.createdBy || null,
            type: event.type || null,
            parent_id: event.parentId || null,
            legacy_id: event.legacyId || null,
            template_id: event.templateId || 'hero',
            join_id: event.joinId || null,
            category: event.category || null,
            order: event.order ?? null,
            show_welcome_card: event.showWelcomeCard ?? true,
            title_align: event.titleAlign || null
        });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error creating event:", error);
        return false;
    }
}

export async function toggleLike(photoId: string, userId: string, userName: string) {
    try {
        const { data: existing, error } = await supabase
            .from('likes')
            .select('id')
            .eq('photo_id', photoId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;

        if (existing) {
            await supabase.from('likes').delete().eq('id', existing.id);
            return { liked: false };
        } else {
            await supabase.from('likes').insert({
                photo_id: photoId,
                user_id: userId
            });
            return { liked: true };
        }
    } catch (error) {
        console.error("Error toggling like:", error);
        throw error;
    }
}

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

export function onPhotoInteractions(photoId: string, callback: (data: { likes: any[], comments: any[] }) => void) {
    let currentLikes: any[] = [];
    let currentComments: any[] = [];

    const fetchAndTrigger = async () => {
        const [likesRes, commentsRes] = await Promise.all([
            supabase.from('likes').select('id, created_at, user_id, profiles(name)').eq('photo_id', photoId),
            supabase.from('comments').select('id, text, created_at, user_id, parent_id, profiles(name)').eq('photo_id', photoId)
        ]);

        if (!likesRes.error && likesRes.data) {
            currentLikes = likesRes.data.map((l: any) => ({
                id: l.id,
                photoId: photoId,
                userId: l.user_id,
                userName: l.profiles?.name || 'Guest User',
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
                text: c.text,
                parentId: c.parent_id || null,
                createdAt: c.created_at
            }));
            currentComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        callback({ likes: currentLikes, comments: currentComments });
    };

    fetchAndTrigger();

    const likesChannel = supabase
        .channel(`likes-${photoId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `photo_id=eq.${photoId}` }, () => fetchAndTrigger())
        .subscribe();

    const commentsChannel = supabase
        .channel(`comments-${photoId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `photo_id=eq.${photoId}` }, () => fetchAndTrigger())
        .subscribe();

    return () => {
        supabase.removeChannel(likesChannel);
        supabase.removeChannel(commentsChannel);
    };
}

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

export async function getUserVisits(identifier: string): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('*')
            .eq('phone', identifier)
            .eq('status', 'approved')
            .order('login_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapSqlToGuestLog);
    } catch (error) {
        console.error("Error fetching user visits:", error);
        return [];
    }
}

export async function getSharedEvents(identifier: string): Promise<Event[]> {
    try {
        const visits = await getUserVisits(identifier);
        if (visits.length === 0) return [];

        const eventIds = [...new Set(visits.map(v => v.eventId).filter(id => !!id))];
        const eventPromises = eventIds.map(id => getEventById(id));
        const events = await Promise.all(eventPromises);

        return events.filter((e): e is Event => e !== null);
    } catch (error) {
        console.error("Error fetching shared events:", error);
        throw error;
    }
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
            const isApproved = vList.some(v => v.status === "approved");
            const isAdminMatch = isAdminOnly ? vList.some(v => !!v.canAdmin) : true;
            return isApproved && isAdminMatch;
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

export async function logGuestLogin(
    name: string, 
    phone: string, 
    eventId?: string, 
    parentEventId?: string, 
    eventTitle?: string, 
    ownerId?: string, 
    status: 'pending' | 'approved' | 'rejected' = 'pending'
) {
    if (!phone) return false;
    try {
        const logId = eventId ? `${phone}_${eventId}` : phone;

        const { data: existing } = await supabase
            .from('guests')
            .select('status')
            .eq('id', logId)
            .maybeSingle();

        const { error } = await supabase.from('guests').upsert({
            id: logId,
            name,
            phone,
            event_id: eventId || null,
            parent_event_id: parentEventId || null,
            parent_event_owner_id: ownerId || null,
            event_title: eventTitle || null,
            login_at: new Date().toISOString(),
            status: existing?.status || status
        });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error logging guest login:", error);
        return false;
    }
}

export async function checkGuestRequestStatus(userId: string, eventId: string): Promise<'pending' | 'approved' | 'rejected' | null> {
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('status')
            .eq('id', `${userId}_${eventId}`)
            .maybeSingle();

        if (error) throw error;
        return data ? (data.status as any) : null;
    } catch (e) {
        console.error("Error checking guest request status:", e);
        return null;
    }
}

export function onGuestStatusChange(logId: string, callback: (status: string) => void) {
    const channel = supabase
        .channel(`guest-status-${logId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'guests', filter: `id=eq.${logId}` },
            (payload) => {
                if (payload.new && payload.new.status) {
                    callback(payload.new.status);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

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

export async function getEventLogs(eventId: string): Promise<GuestLog[]> {
    if (!eventId) return [];
    const logs = await getGuestLogs();
    return logs.filter(log => log.eventId === eventId || log.parentEventId === eventId);
}

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

// --- NEW MOBILE MARKETPLACE SPECIFIC FUNCTIONS ---

export async function removeGuestChatPermission(logId: string) {
    try {
        const { error } = await supabase.from('guests').update({ can_chat: false }).eq('id', logId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error removing guest chat permission:", error);
        return false;
    }
}

export async function deletePhoto(photoId: string) {
    try {
        const { error } = await supabase.from('photos').delete().eq('id', photoId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting photo:", error);
        return false;
    }
}

export async function deleteEvent(eventId: string) {
    try {
        const { error } = await supabase.from('events').delete().eq('id', eventId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting event:", error);
        return false;
    }
}

export async function updateEvent(eventId: string, data: Partial<Event>) {
    try {
        const updateObj: any = {};
        if (data.title !== undefined) updateObj.title = data.title;
        if (data.description !== undefined) updateObj.description = data.description;
        if (data.coverImage !== undefined) updateObj.cover_image = data.coverImage;
        if (data.date !== undefined) updateObj.date = data.date;
        if (data.category !== undefined) updateObj.category = data.category;
        if (data.templateId !== undefined) updateObj.template_id = data.templateId;
        if (data.showWelcomeCard !== undefined) updateObj.show_welcome_card = data.showWelcomeCard;
        if (data.coverOffset !== undefined) updateObj.cover_offset = data.coverOffset;
        if (data.coverOffsetX !== undefined) updateObj.cover_offset_x = data.coverOffsetX;
        if (data.coverScale !== undefined) updateObj.cover_scale = data.coverScale;
        if (data.coverMode !== undefined) updateObj.cover_mode = data.coverMode;
        if (data.order !== undefined) updateObj.order = data.order;
        if (data.titleAlign !== undefined) updateObj.title_align = data.titleAlign;
        if (data.vendors !== undefined) updateObj.vendors = data.vendors;

        const { error } = await supabase.from('events').update(updateObj).eq('id', eventId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating event:", error);
        return false;
    }
}

export async function getUserBusinesses(uid: string): Promise<Business[]> {
    if (!uid) return [];
    try {
        // Query businesses where creator is current user OR user is listed in admins OR allowed_users
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

export async function addPhoto(data: Omit<Photo, 'id'>) {
    try {
        const generatedId = Math.random().toString(36).substring(2, 15);
        const { error } = await supabase.from('photos').insert({
            id: generatedId,
            event_id: data.eventId,
            cloudinary_public_id: data.cloudinaryPublicId,
            url: data.url,
            user_id: data.userId || null,
            width: data.width || null,
            height: data.height || null,
            size: data.size || null,
            format: data.format || null,
            media_type: data.mediaType || 'photo',
            resource_type: data.resourceType || (data.mediaType === 'video' ? 'video' : 'image'),
            uploaded_at: new Date().toISOString()
        });
        if (error) throw error;
        return generatedId;
    } catch (error) {
        console.error("Error adding photo:", error);
        return null;
    }
}

export async function createBusiness(businessData: Omit<Business, 'id' | 'createdAt'>) {
  try {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const vendorCode = businessData.vendorCode || `VEN-${randomCode}`;
    const generatedId = `biz_${Math.random().toString(36).substring(2, 15)}`;
    
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
      created_at: new Date().toISOString()
    });

    if (error) throw error;
    return generatedId;
  } catch (e) {
    console.error("Error adding business: ", e);
    return null;
  }
}

export async function getBusinessById(id: string): Promise<Business | null> {
  try {
    const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;
    return data ? mapSqlToBusiness(data) : null;
  } catch (e) {
    console.error("Error fetching business by ID:", e);
    return null;
  }
}

export async function getEventsCountForVendor(vendorId: string): Promise<number> {
  try {
    const { data, error } = await supabase
        .from('businesses')
        .select('events_hosted')
        .eq('id', vendorId)
        .maybeSingle();

    if (error) throw error;
    return data?.events_hosted || 0;
  } catch (e) {
    console.error("Error fetching event count for vendor:", e);
    return 0;
  }
}

export async function getBusinessByVendorCode(code: string): Promise<Business | null> {
  try {
    const formattedCode = code.toUpperCase().trim();
    const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('vendor_code', formattedCode)
        .maybeSingle();

    if (error) throw error;
    if (data) return mapSqlToBusiness(data);

    // Fallback search by ID prefix
    if (formattedCode.startsWith('VEN-')) {
      const docIdPrefix = formattedCode.replace('VEN-', '').toLowerCase();
      const { data: direct } = await supabase.from('businesses').select('*').eq('id', docIdPrefix).maybeSingle();
      if (direct) return mapSqlToBusiness(direct);
    }
    return null;
  } catch (e) {
    console.error("Error fetching business by vendor code:", e);
    return null;
  }
}

export async function incrementBusinessViewCount(bizId: string): Promise<void> {
    try {
        const { data: biz } = await supabase.from('businesses').select('profile_views').eq('id', bizId).maybeSingle();
        const currentViews = biz?.profile_views || 0;
        await supabase.from('businesses').update({ profile_views: currentViews + 1 }).eq('id', bizId);
    } catch (e) {
        console.warn('Silent ignore: Failed to increment view count', e);
    }
}

export async function updateBusiness(bizId: string, data: Partial<Business>): Promise<boolean> {
  try {
    const updateObj: any = {};
    if (data.name !== undefined) updateObj.name = data.name;
    if (data.description !== undefined) updateObj.description = data.description;
    if (data.coverImage !== undefined) updateObj.cover_image = data.coverImage;
    if (data.status !== undefined) updateObj.status = data.status;

    const { error } = await supabase.from('businesses').update(updateObj).eq('id', bizId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error updating business: ", e);
    return false;
  }
}

export async function getUserRatingForBusiness(userId: string, bizId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
        .from('business_ratings')
        .select('rating')
        .eq('id', `${userId}_${bizId}`)
        .maybeSingle();

    if (error) throw error;
    return data ? data.rating : null;
  } catch (e) {
    console.error("Error getting user rating for business: ", e);
    return null;
  }
}

export async function saveUserRating(
  userId: string, 
  bizId: string, 
  rating: number, 
  comment?: string, 
  userName?: string
): Promise<boolean> {
  try {
    const ratingId = `${userId}_${bizId}`;
    const { error } = await supabase.from('business_ratings').upsert({
      id: ratingId,
      user_id: userId,
      business_id: bizId,
      rating: rating,
      review: comment || '',
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error saving user rating: ", e);
    return false;
  }
}

export async function getReviewsForBusiness(bizId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
        .from('business_ratings')
        .select('*, profiles(name)')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      businessId: r.business_id,
      rating: r.rating,
      comment: r.review,
      userName: r.profiles?.name || 'Anonymous User',
      createdAt: r.created_at
    }));
  } catch (e) {
    console.error("Error getting reviews for business: ", e);
    return [];
  }
}

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
    } catch (e) {
      console.error("Error fetching top rated businesses:", e);
      return [];
    }
}

export function onTopRatedBusinesses(limitCount: number = 10, callback: (businesses: Business[]) => void) {
    const fetchAndTrigger = async () => {
        const list = await getTopRatedBusinesses(limitCount);
        callback(list);
    };
    
    fetchAndTrigger();
    const channel = supabase
        .channel('top-rated-businesses')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `status=eq.published` }, () => fetchAndTrigger())
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
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
    } catch (e) {
        console.error("Error fetching published businesses:", e);
        return [];
    }
}

// --- SOCIAL NETWORK FUNCTIONS (STUBBED FOR STABILITY) ---

export async function updateUserPrivacy(uid: string, isPrivate: boolean) {
    try {
        await supabase.from('profiles').update({ is_private: isPrivate }).eq('id', uid);
        return true;
    } catch (error) {
        console.error("Error updating privacy:", error);
        return false;
    }
}

export async function followUser(followerId: string, followedId: string) {
    return { success: true, status: 'accepted' };
}

export async function getPendingFollowRequests(userId: string): Promise<any[]> {
    return [];
}

export async function approveFollowRequest(relationshipId: string) {
    return true;
}

export async function rejectFollowRequest(relationshipId: string) {
    return true;
}

export async function unfollowUser(followerId: string, followedId: string) {
    return true;
}

export async function getFollowing(userId: string): Promise<string[]> {
    return [];
}

export async function getFollowersCount(userId: string): Promise<number> {
    return 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
    return 0;
}

export async function getSocialFeed(followingIds: string[]): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapSqlToEvent).map(e => ({ ...e, type: 'event' }));
    } catch (error) {
        console.error("[SocialFeed] Error fetching feed:", error);
        return [];
    }
}

export async function toggleEventPostLike(eventId: string, userId: string) {
    return { liked: true };
}

export async function isEventPostLikedByUser(eventId: string, userId: string): Promise<boolean> {
    return false;
}

export async function getEventPostLikes(eventId: string) {
    return { count: 0 };
}

export async function addEventPostComment(eventId: string, userId: string, userName: string, text: string) {
    return true;
}

export async function getEventPostComments(eventId: string) {
    return [];
}

export async function toggleShortlistBusiness(userId: string, businessId: string) {
    return true;
}

export async function getBusinessShortlistStatus(userId: string, businessId: string): Promise<boolean> {
    return false;
}

export async function toggleBusinessShortlist(
    userId: string,
    businessId: string,
    currentlyShortlisted: boolean
): Promise<boolean> {
    return !currentlyShortlisted;
}

export async function addBusinessActivity(activity: any): Promise<boolean> {
    return true;
}

export async function getBusinessActivities(creatorIds: string[]): Promise<any[]> {
    return [];
}

export async function getNotifications(userId: string): Promise<any[]> {
    return [];
}

export async function getAnnouncementsForBusiness(bizId: string): Promise<any[]> {
    return [];
}

// --- ENQUIRY AND IN-APP CHAT FUNCTIONS ---

export async function addEnquiry(enquiry: Omit<Enquiry, 'id' | 'createdAt' | 'status'>) {
    try {
        const { data, error } = await supabase.from('enquiries').insert({
            user_id: enquiry.userId || null,
            vendor_owner_id: enquiry.vendorOwnerId,
            vendor_owner_email: enquiry.vendorOwnerEmail || null,
            text: enquiry.message || '',
            category: enquiry.category || null,
            created_at: new Date().toISOString()
        }).select('id').maybeSingle();

        if (error) throw error;
        return data ? data.id : `enq_${Math.random()}`;
    } catch (error) {
        console.error("Error adding enquiry:", error);
        return null;
    }
}

export async function getEnquiriesForBusiness(businessId: string, userId: string): Promise<Enquiry[]> {
    try {
        const { data, error } = await supabase
            .from('enquiries')
            .select('*, profiles(name)')
            .eq('vendor_owner_id', userId);

        if (error) throw error;
        return (data || []).map(e => ({
            id: e.id,
            businessId: businessId,
            businessName: 'Wedding Vendor',
            name: e.profiles?.name || 'Client',
            date: e.created_at,
            message: e.text,
            userId: e.user_id,
            vendorOwnerId: e.vendor_owner_id,
            vendorOwnerEmail: e.vendor_owner_email
        }));
    } catch (error) {
        console.error("Error fetching enquiries for business:", error);
        return [];
    }
}

export async function getOrCreateChatRoom(
  clientUid: string, 
  clientName: string, 
  vendorUid: string, 
  vendorName: string, 
  businessId: string,
  enquiryId?: string
): Promise<string> {
  try {
    const roomId = `${clientUid}_${vendorUid}_${businessId}`;
    const { error } = await supabase.from('chat_rooms').upsert({
        id: roomId,
        client_uid: clientUid,
        vendor_uid: vendorUid,
        status: 'active',
        created_at: new Date().toISOString(),
        last_read: {}
    });

    if (error) throw error;
    return roomId;
  } catch (error) {
    console.error("Error getOrCreateChatRoom:", error);
    throw error;
  }
}

export async function sendMessage(
  roomId: string, 
  senderId: string, 
  senderName: string, 
  text: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: senderId,
        text: text,
        created_at: new Date().toISOString()
    });
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
}

export function onChatMessages(roomId: string, callback: (messages: ChatMessage[]) => void) {
  const fetchAndTrigger = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles(name)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (!error && data) {
          const list = data.map(m => ({
              id: m.id,
              senderId: m.sender_id,
              senderName: m.profiles?.name || 'User',
              text: m.text,
              createdAt: m.created_at
          }));
          callback(list);
      }
  };

  fetchAndTrigger();

  const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, () => fetchAndTrigger())
      .subscribe();

  return () => {
      supabase.removeChannel(channel);
  };
}

export async function getUserChatRooms(userId: string, role: 'client' | 'vendor'): Promise<ChatRoom[]> {
  try {
    const field = role === 'client' ? 'client_uid' : 'vendor_uid';
    const { data, error } = await supabase
        .from('chat_rooms')
        .select('*, profiles(name)')
        .eq(field, userId);

    if (error) throw error;
    return (data || []).map(r => ({
        id: r.id,
        clientUid: r.client_uid,
        clientName: role === 'client' ? 'My Chat' : (r.profiles?.name || 'Client'),
        vendorUid: r.vendor_uid,
        vendorName: role === 'vendor' ? 'My Chat' : (r.profiles?.name || 'Vendor'),
        businessId: 'vendor-listing',
        createdAt: r.created_at,
        status: r.status,
        clientDeleted: r.client_deleted,
        vendorDeleted: r.vendor_deleted
    }));
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    return [];
  }
}

export async function closeChatRoom(roomId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('chat_rooms').update({ status: 'closed' }).eq('id', roomId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error closing chat room:", error);
    return false;
  }
}

export async function deleteChatRoom(roomId: string, role: 'client' | 'vendor'): Promise<boolean> {
  try {
    const field = role === 'client' ? 'client_deleted' : 'vendor_deleted';
    const { error } = await supabase.from('chat_rooms').update({ [field]: true }).eq('id', roomId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting chat room:", error);
    return false;
  }
}

export function serializeFirestoreData<T>(data: T): T {
    return data;
}

export async function getEventByJoinId(joinId: string): Promise<Event | null> {
    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('join_id', joinId.toUpperCase().trim())
            .maybeSingle();

        if (error) throw error;
        return data ? mapSqlToEvent(data) : null;
    } catch (error) {
        console.error("Error fetching event by joinId:", error);
        return null;
    }
}

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

export const BUSINESS_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Venue': { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', text: '#ec4899' }, // Pink
  'Photography': { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)', text: '#38bdf8' }, // Sky Blue
  'Videography': { bg: 'rgba(129, 140, 248, 0.12)', border: 'rgba(129, 140, 248, 0.3)', text: '#818cf8' }, // Indigo
  'Catering': { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' }, // Orange
  'Food Stalls': { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' }, // Yellow
  'Music & DJ': { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', text: '#a855f7' }, // Purple
  'Lighting': { bg: 'rgba(253, 224, 71, 0.12)', border: 'rgba(253, 224, 71, 0.3)', text: '#fde047' }, // Gold/Yellow
  'Decor': { bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)', text: '#20b8a6' }, // Teal
  'Event Planner': { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)', text: '#f43f5e' }, // Rose
  'Security': { bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)', text: '#64748b' }, // Slate
  'Anchors': { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)', text: '#06b6d4' }, // Cyan
  'Gifts': { bg: 'rgba(219, 39, 119, 0.12)', border: 'rgba(219, 39, 119, 0.3)', text: '#db2777' }, // Dark Pink
  'Travel': { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.3)', text: '#0ea5e9' }, // Ocean Blue
  'Staff': { bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.3)', text: '#4ade80' }, // Green
  'Invitations': { bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.3)', text: '#fb923c' }, // Light Orange
  'Makeup': { bg: 'rgba(244, 114, 182, 0.12)', border: 'rgba(244, 114, 182, 0.3)', text: '#f472b6' }, // Light Pink
  'Apparel': { bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.3)', text: '#a78bfa' }, // Violet
  'Trophies': { bg: 'rgba(250, 204, 21, 0.12)', border: 'rgba(250, 204, 21, 0.3)', text: '#facc15' }, // Bright Gold
};

export const getBusinessTypeColor = (type: string) => {
  const normalized = type ? type.trim() : '';
  const match = Object.keys(BUSINESS_TYPE_COLORS).find(
    key => key.toLowerCase() === normalized.toLowerCase()
  );
  if (match) {
    return BUSINESS_TYPE_COLORS[match];
  }
  return { bg: 'rgba(212, 175, 55, 0.12)', border: 'rgba(212, 175, 55, 0.25)', text: '#d4af37' };
};
