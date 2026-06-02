import { supabase } from "./supabase";

// Memory caches to optimize lookups
const eventCache: Record<string, Event> = {};
const userCache: Record<string, any> = {};

// --- Types ---

export interface Event {
    id: string; // "haldi", "wedding", etc.
    title: string;
    date: string;
    coverImage: string;
    description: string;
    createdBy?: string; // UID of the user who created it
    type?: 'main' | 'sub';
    parentId?: string;
    legacyId?: string; // Captures original truncated/mismatched ID for backward compatibility
    templateId?: string; // 'hero' | 'classic', defaults to 'hero'
    joinId?: string; // 6-digit unique code for guests to join
}

export interface Photo {
    id: string;
    eventId: string;
    cloudinaryPublicId: string; // Legacy field name; stores the media storage key
    url: string;                // The public URL
    driveDownloadUrl?: string;  // Fallback
    height?: number;
    width?: number;
    uploadedAt: any;
    tags?: string[];
    userId?: string;            // UID of the owner
    size?: number;              // File size in bytes
    format?: string;            // e.g., 'jpg', 'png'
}

export interface FaceRecord {
    id?: string;
    imageId: string;
    descriptor: number[]; // The 128-float vector
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
}

export interface GuestLog {
    id: string;
    name: string;
    phone: string;
    eventId?: string;
    parentEventId?: string;
    parentEventOwnerId?: string;
    eventTitle?: string;
    loginAt?: any;
    status: 'pending' | 'approved' | 'rejected';
}

export interface Like {
    id: string;
    photoId: string;
    userId: string;
    userName: string;
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
        date: e.date,
        coverImage: e.cover_image,
        description: e.description,
        createdBy: e.created_by,
        type: e.type,
        parentId: e.parent_id,
        legacyId: e.legacy_id,
        templateId: e.template_id,
        joinId: e.join_id
    };
}

function mapSqlToPhoto(p: any): Photo {
    return {
        id: p.id,
        eventId: p.event_id,
        cloudinaryPublicId: p.cloudinary_public_id,
        url: p.url,
        driveDownloadUrl: p.drive_download_url,
        height: p.height,
        width: p.width,
        uploadedAt: p.uploaded_at,
        tags: p.tags,
        userId: p.user_id,
        size: p.size,
        format: p.format
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
        lastLogin: u.last_login,
        username: u.username,
        assignedEvents: [] // Will be populated when querying assignments
    };
}

function mapSqlToGuestLog(g: any): GuestLog {
    return {
        id: g.id,
        name: g.name,
        phone: g.phone,
        eventId: g.event_id,
        parentEventId: g.parent_event_id,
        parentEventOwnerId: g.parent_event_owner_id,
        eventTitle: g.event_title,
        loginAt: g.login_at,
        status: g.status
    };
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
            .in('event_id', ids)
            .order('uploaded_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapSqlToPhoto);
    } catch (error) {
        console.error("Error fetching photos:", error);
        return [];
    }
}

/**
 * Saves a detected face descriptor to the faces table.
 */
export async function saveFaceToIndex(face: FaceRecord) {
    try {
        const { error } = await supabase.from('faces').insert({
            image_id: face.imageId,
            descriptor: face.descriptor,
            event_id: face.eventId,
            image_url: face.imageUrl,
            width: face.width,
            height: face.height
        });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error saving face to index:", error);
        return false;
    }
}

/**
 * Saves photo metadata to the photos table.
 */
export async function savePhoto(photo: Photo) {
    try {
        const { error } = await supabase.from('photos').upsert({
            id: photo.id,
            event_id: photo.eventId,
            cloudinary_public_id: photo.cloudinaryPublicId,
            url: photo.url,
            drive_download_url: photo.driveDownloadUrl || null,
            height: photo.height || null,
            width: photo.width || null,
            uploaded_at: photo.uploadedAt ? new Date(photo.uploadedAt).toISOString() : new Date().toISOString(),
            tags: photo.tags || [],
            user_id: photo.userId || null,
            size: photo.size || null,
            format: photo.format || null
        });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error saving photo:", error);
        return false;
    }
}

/**
 * Fetches all face descriptors from the faces table.
 */
export async function getAllFaceEncodings(): Promise<FaceRecord[]> {
    try {
        const { data, error } = await supabase.from('faces').select('*');
        if (error) throw error;
        return (data || []).map(f => ({
            id: f.id,
            imageId: f.image_id,
            descriptor: f.descriptor,
            eventId: f.event_id,
            imageUrl: f.image_url,
            width: f.width,
            height: f.height,
            createdAt: f.created_at
        }));
    } catch (error) {
        console.error("Error fetching face index:", error);
        return [];
    }
}

/**
 * Fetches face descriptors for a specific event (and its legacy ID).
 */
export async function getEventFaceEncodings(eventIds: string | string[], legacyIds?: string[]): Promise<FaceRecord[]> {
    try {
        const ids = Array.isArray(eventIds) ? eventIds : [eventIds];
        if (legacyIds) ids.push(...legacyIds);

        const { data, error } = await supabase
            .from('faces')
            .select('*')
            .in('event_id', ids);

        if (error) throw error;
        return (data || []).map(f => ({
            id: f.id,
            imageId: f.image_id,
            descriptor: f.descriptor,
            eventId: f.event_id,
            imageUrl: f.image_url,
            width: f.width,
            height: f.height,
            createdAt: f.created_at
        }));
    } catch (error) {
        console.error("Error fetching event face index:", error);
        return [];
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
 * Logs a successful login or event access to the guests table.
 */
export async function logGuestLogin(
    name: string, 
    phone: string, 
    eventId?: string, 
    parentEventId?: string, 
    eventTitle?: string, 
    ownerId?: string, 
    status: 'pending' | 'approved' | 'rejected' = 'pending'
) {
    try {
        const logId = eventId ? `${phone}_${eventId}` : phone;

        // Fetch existing status
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
            event_title: eventTitle || "General Access",
            login_at: new Date().toISOString(),
            status: existing?.status || status
        });
        if (error) throw error;
    } catch (error) {
        console.error("Error logging guest login:", error);
    }
}

/**
 * Updates the status of a guest request.
 */
export async function updateGuestStatus(logId: string, status: 'pending' | 'approved' | 'rejected') {
    try {
        const { error } = await supabase
            .from('guests')
            .update({ status })
            .eq('id', logId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating guest status:", error);
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
 * Real-time listener for guest status changes.
 */
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
            .eq('parent_event_id', eventId)
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

/**
 * Auto-generates a unique username.
 */
export async function generateUniqueUsername(base: string): Promise<string> {
    let username = base.toLowerCase().replace(/[^a-z0-9_.]/g, "_");
    username = username.replace(/_+/g, "_").replace(/\.+/g, ".");
    username = username.replace(/^[_.]+|[_.]+$/g, "");
    
    if (username.length < 3) {
        username = "user_" + username;
    }
    if (username.length > 30) {
        username = username.substring(0, 30);
    }
    
    let candidate = username;
    let suffix = 1;
    let isUnique = false;
    
    while (!isUnique) {
        const unique = await isUsernameUnique(candidate);
        if (unique) {
            isUnique = true;
        } else {
            const suffixStr = suffix.toString();
            const maxBaseLen = 30 - suffixStr.length;
            candidate = `${username.substring(0, maxBaseLen)}${suffixStr}`;
            suffix++;
        }
    }
    
    return candidate;
}

/**
 * Updates user profile details in Supabase.
 */
export async function updateUserProfile(uid: string, updateData: { name: string; username: string; email?: string; phone?: string }) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                name: updateData.name,
                username: updateData.username,
                email: updateData.email || undefined,
                phone: updateData.phone || undefined
            })
            .eq('id', uid);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating user profile:", error);
        return false;
    }
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
            join_id: event.joinId || null
        });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error creating event:", error);
        throw error;
    }
}

/**
 * Fetches a single event by ID with fallback support.
 */
export async function getEventById(eventId: string): Promise<Event | null> {
    const decodedId = decodeURIComponent(eventId);
    if (eventCache[decodedId]) {
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

/**
 * Fetches an event by its unique join code.
 */
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

/**
 * Deletes a specific photo record.
 */
export async function deletePhoto(photoId: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('photos').delete().eq('id', photoId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting photo:", error);
        return false;
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

        // 2. Delete the parent event (Cascading foreign key triggers automatically delete associated photos, likes, & comments!)
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
        if (data.templateId !== undefined) updateData.template_id = data.templateId;
        if (data.joinId !== undefined) updateData.join_id = data.joinId;

        const { error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', eventId);

        if (error) throw error;

        delete eventCache[eventId];
        return true;
    } catch (error) {
        console.error("Error updating event:", error);
        return false;
    }
}

/**
 * Calculates the total size of all photos uploaded by a specific user.
 */
export async function getUserTotalStorage(identifiers: string | string[]): Promise<number> {
    try {
        const ids = Array.isArray(identifiers) ? identifiers : [identifiers];
        const { data, error } = await supabase
            .from('photos')
            .select('size')
            .in('user_id', ids);

        if (error) throw error;
        return (data || []).reduce((acc, p) => acc + (p.size || 0), 0);
    } catch (error) {
        console.error("Error calculating total storage:", error);
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

    // Setup Postgres real-time listeners for updates
    const likesChannel = supabase
        .channel(`likes-${photoId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'likes', filter: `photo_id=eq.${photoId}` },
            () => fetchAndTrigger()
        )
        .subscribe();

    const commentsChannel = supabase
        .channel(`comments-${photoId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'comments', filter: `photo_id=eq.${photoId}` },
            () => fetchAndTrigger()
        )
        .subscribe();

    return () => {
        supabase.removeChannel(likesChannel);
        supabase.removeChannel(commentsChannel);
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
            .eq('phone', identifier)
            .eq('status', 'approved')
            .order('login_at', { ascending: false });

        if (error) throw error;
        return data || [];
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
export function serializeFirestoreData<T>(data: T): T {
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
