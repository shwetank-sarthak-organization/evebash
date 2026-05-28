import { db } from "./firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  DocumentData,
  addDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  limit,
  QueryDocumentSnapshot
} from "firebase/firestore";

export const generateShortId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars like I, O, 0, 1
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
    createdAt?: Timestamp;
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

function mapDocToEvent(docSnapshot: QueryDocumentSnapshot<DocumentData>): Event {
    const data = docSnapshot.data();
    const event = { ...data, id: docSnapshot.id } as Event;
    if (data.id && data.id !== docSnapshot.id) {
        event.legacyId = data.id;
    }
    return event;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

export async function getUserById(uid: string): Promise<UserProfile | null> {
    if (!uid) return null;
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user by ID:", error);
        return null;
    }
}

export async function getUsers(): Promise<UserProfile[]> {
    try {
        const usersCol = collection(db, "users");
        const snapshot = await getDocs(usersCol);
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
        return users.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

export async function getDelegatedAdminsCount(ownerUid: string): Promise<number> {
    if (!ownerUid) return 0;
    try {
        const usersCol = collection(db, "users");
        const q = query(usersCol, where("delegatedBy", "==", ownerUid));
        const snapshot = await getDocs(q);
        return snapshot.size;
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
        const docRef = doc(db, "users", uid);
        const updateData: Record<string, unknown> = {};

        if (newRole) updateData.role = newRole;

        if (delegatedBy) {
            updateData.delegatedBy = delegatedBy;
            if (roleType) updateData.roleType = roleType;
            if (assignedEvents) updateData.assignedEvents = assignedEvents;
        } else {
            updateData.delegatedBy = deleteField();
            updateData.roleType = deleteField();
            updateData.assignedEvents = deleteField();
        }

        await updateDoc(docRef, updateData);
        return true;
    } catch (error) {
        console.error("Error updating user role:", error);
        return false;
    }
}

export async function getUserTotalStorage(identifiers: string[]): Promise<number> {
    try {
        const photosCol = collection(db, "photos");
        const q = query(photosCol, where("userId", "in", identifiers));
        const snapshot = await getDocs(q);
        return snapshot.docs.reduce((acc, doc) => acc + (doc.data().size || 0), 0);
    } catch (error) {
        console.error("Error fetching storage stats:", error);
        return 0;
    }
}

export async function getUserEventCount(uid: string): Promise<number> {
    try {
        const eventsCol = collection(db, "events");
        const q = query(eventsCol, where("createdBy", "==", uid));
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Event));
        
        // Filter out sub-events
        const mainEvents = events.filter(e => {
            const isMain = e.type === 'main' || (!e.type && !e.parentId);
            if (!isMain) {
                const parentExists = events.some(ev => ev.id === e.parentId);
                if (!parentExists) return true;
            }
            return isMain;
        });
        
        return mainEvents.length;
    } catch (error) {
        console.error("Error fetching event count:", error);
        return 0;
    }
}

export async function getUserEvents(userIds: string | string[], type?: 'main' | 'sub', parentId?: string, legacyParentId?: string): Promise<Event[]> {
    try {
        const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
        if (ids.length === 0) return [];
        const eventsCol = collection(db, "events");
        const q = query(eventsCol, where("createdBy", "in", ids));
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(mapDocToEvent);
        
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
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, { profileImage: imageUrl });
        return true;
    } catch (error) {
        console.error("Error updating profile image:", error);
        return false;
    }
}

export async function isUsernameUnique(username: string, excludeUid?: string): Promise<boolean> {
    try {
        const usersCol = collection(db, "users");
        const q = query(usersCol, where("username", "==", username.toLowerCase()));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return true;
        
        if (excludeUid) {
            const matches = snapshot.docs.filter(doc => doc.id !== excludeUid);
            return matches.length === 0;
        }
        
        return false;
    } catch (error) {
        console.error("Error checking username uniqueness:", error);
        return false;
    }
}

export async function updateUserProfile(uid: string, updateData: { name: string; username: string; profileImage?: string; phone?: string }) {
    try {
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, updateData);
        return true;
    } catch (error) {
        console.error("Error updating user profile:", error);
        return false;
    }
}

export async function getEventById(eventId: string): Promise<Event | null> {
    try {
        const decodedId = decodeURIComponent(eventId);
        const docRef = doc(db, "events", decodedId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const event = { id: docSnap.id, ...data } as Event;
            if (data.id && data.id !== docSnap.id) event.legacyId = data.id;
            return event;
        }

        const eventsCol = collection(db, "events");
        const qId = query(eventsCol, where("id", "==", decodedId));
        const snapId = await getDocs(qId);
        if (!snapId.empty) return mapDocToEvent(snapId.docs[0]);

        const qLegacy = query(eventsCol, where("legacyId", "==", decodedId));
        const snapLegacy = await getDocs(qLegacy);
        if (!snapLegacy.empty) return mapDocToEvent(snapLegacy.docs[0]);

        const qTitle = query(eventsCol, where("title", "==", decodedId));
        const snapTitle = await getDocs(qTitle);
        if (!snapTitle.empty) return mapDocToEvent(snapTitle.docs[0]);

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
        const eventsCol = collection(db, "events");
        const q = query(eventsCol, where("parentId", "in", ids));
        const snapshot = await getDocs(q);
        const subEvents = snapshot.docs
            .map(mapDocToEvent)
            .filter(e => e.id !== parentId && (!legacyParentId || e.id !== legacyParentId));
        const hasOrder = subEvents.some(s => typeof s.order === 'number');
        if (hasOrder) {
            return subEvents.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
        }
        return subEvents.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching sub-events:", error);
        return [];
    }
}

export async function getEventPhotos(eventId: string, legacyId?: string): Promise<Photo[]> {
    if (!eventId) return [];
    try {
        const ids = legacyId && legacyId !== eventId ? [eventId, legacyId] : [eventId];
        const photosCol = collection(db, "photos");
        const q = query(photosCol, where("eventId", "in", ids));
        const snapshot = await getDocs(q);
        const photos = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Photo));
        // Sort by custom order if available, otherwise fall back to newest-first
        const hasOrder = photos.some(p => typeof p.order === 'number');
        if (hasOrder) {
            return photos.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
        }
        return photos.sort((a, b) => ((b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0)));
    } catch (error) {
        console.error("Error fetching photos:", error);
        return [];
    }
}

/** Save the display order for a batch of photos (called after drag-reorder in admin) */
export async function updatePhotosOrder(orderedIds: string[]): Promise<boolean> {
    try {
        await Promise.all(
            orderedIds.map((id, index) =>
                updateDoc(doc(db, "photos", id), { order: index })
            )
        );
        return true;
    } catch (error) {
        console.error("Error updating photo order:", error);
        return false;
    }
}

/** Save the display order for a batch of sub-events/galleries (called after drag-reorder in admin) */
export async function updateSubEventsOrder(orderedIds: string[]): Promise<boolean> {
    try {
        await Promise.all(
            orderedIds.map((id, index) =>
                updateDoc(doc(db, "events", id), { order: index })
            )
        );
        return true;
    } catch (error) {
        console.error("Error updating sub-events order:", error);
        return false;
    }
}

export async function createEvent(event: Event) {
    try {
        const docRef = doc(db, "events", event.id);
        const sanitizedEvent = { ...event } as Record<string, unknown>;
        Object.keys(sanitizedEvent).forEach((key) => {
            if (sanitizedEvent[key] === undefined) delete sanitizedEvent[key];
        });

        await setDoc(docRef, {
            ...sanitizedEvent,
            createdAt: Timestamp.now()
        });
        return true;
    } catch (error) {
        console.error("Error creating event:", error);
        return false;
    }
}

export async function toggleLike(photoId: string, userId: string, userName: string) {
    try {
        const likeId = `${userId.replace(/[^a-zA-Z0-9]/g, '_')}_${photoId}`;
        const likeRef = doc(db, "likes", likeId);
        const likeDoc = await getDoc(likeRef);

        if (likeDoc.exists()) {
            await deleteDoc(likeRef);
            return { liked: false };
        } else {
            await setDoc(likeRef, {
                photoId,
                userId,
                userName,
                createdAt: serverTimestamp()
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
        const commentsCol = collection(db, "comments");
        await addDoc(commentsCol, {
            photoId,
            userId,
            userName,
            text,
            parentId: parentId || null,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error adding comment:", error);
        return false;
    }
}

export function onPhotoInteractions(photoId: string, callback: (data: { likes: any[], comments: any[] }) => void) {
    const likesQuery = query(collection(db, "likes"), where("photoId", "==", photoId));
    const commentsQuery = query(collection(db, "comments"), where("photoId", "==", photoId));

    let currentLikes: any[] = [];
    let currentComments: any[] = [];

    const unsubLikes = onSnapshot(likesQuery, (snapshot) => {
        currentLikes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        currentLikes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        callback({ likes: currentLikes, comments: currentComments });
    }, (error) => {
        console.error("likes listener error:", error);
    });

    const unsubComments = onSnapshot(commentsQuery, (snapshot) => {
        currentComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        currentComments.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        callback({ likes: currentLikes, comments: currentComments });
    }, (error) => {
        console.error("comments listener error:", error);
    });

    return () => {
        unsubLikes();
        unsubComments();
    };
}

export async function deletePhotoComment(commentId: string) {
    try {
        const docRef = doc(db, "comments", commentId);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error deleting comment:", error);
        return false;
    }
}

export async function getUserVisits(identifier: string): Promise<any[]> {
    try {
        const guestsCol = collection(db, "guests");

        // Try both phone and email fields so both login types work
        const [phoneSnap, emailSnap] = await Promise.all([
            getDocs(query(guestsCol, where("phone", "==", identifier), limit(20))),
            getDocs(query(guestsCol, where("email", "==", identifier), limit(20))),
        ]);

        const allDocs = [
            ...phoneSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)),
            ...emailSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)),
        ];

        // Deduplicate by doc id, filter approved
        const seen = new Set<string>();
        return allDocs
            .filter(v => {
                if (seen.has(v.id)) return false;
                seen.add(v.id);
                return v.status === "approved";
            })
            .sort((a, b) => (b.loginAt?.seconds || 0) - (a.loginAt?.seconds || 0));
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
        throw error; // Rethrow to catch in the UI
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
            const eid = v.parentEventId || v.eventId;
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

export async function logGuestLogin(name: string, phone: string, eventId?: string, parentEventId?: string, eventTitle?: string, ownerId?: string, status: 'pending' | 'approved' | 'rejected' = 'pending') {
    if (!phone) {
        console.error("logGuestLogin failed: No identifier (phone/email/uid) provided.");
        return false;
    }
    try {
        const logId = eventId ? `${phone}_${eventId}` : phone;
        const docRef = doc(db, "guests", logId);
        const existingDoc = await getDoc(docRef);
        const existingData = existingDoc.exists() ? existingDoc.data() : null;
        const isEmail = phone.includes('@');

        await setDoc(docRef, {
            name,
            [isEmail ? 'email' : 'phone']: phone,
            eventId: eventId || null,
            parentEventId: parentEventId || null,
            eventTitle: eventTitle || null,
            parentEventOwnerId: ownerId || null,
            loginAt: serverTimestamp(),
            status: existingData?.status || status
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error logging guest login:", error);
        return false;
    }
}

export function onGuestStatusChange(logId: string, callback: (status: string) => void) {
    const docRef = doc(db, "guests", logId);
    return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) callback(snapshot.data().status || 'pending');
    });
}

export async function getGuestLogs(ownerIds?: string | string[]): Promise<GuestLog[]> {
    try {
        const ids = Array.isArray(ownerIds) ? ownerIds.filter(Boolean) : ownerIds ? [ownerIds] : [];
        const guestsCol = collection(db, "guests");
        const q = ids.length > 0
            ? query(guestsCol, where("parentEventOwnerId", "in", ids))
            : query(guestsCol, orderBy("loginAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as GuestLog))
            .sort((a, b) => (b.loginAt?.seconds || 0) - (a.loginAt?.seconds || 0));
    } catch (error) {
        console.error("Guest log query failed, falling back to client filter:", error);
        try {
            const ids = Array.isArray(ownerIds) ? ownerIds.filter(Boolean) : ownerIds ? [ownerIds] : [];
            const snapshot = await getDocs(collection(db, "guests"));
            let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuestLog));
            if (ids.length > 0) {
                logs = logs.filter(log => !!log.parentEventOwnerId && ids.includes(log.parentEventOwnerId));
            }
            return logs.sort((a, b) => (b.loginAt?.seconds || 0) - (a.loginAt?.seconds || 0));
        } catch (fallbackError) {
            console.error("Error fetching guest logs:", fallbackError);
            return [];
        }
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
        // If approved, set default permissions
        if (status === 'approved') {
            updateData.canUpload = true;
            updateData.canComment = true;
        }
        await updateDoc(doc(db, "guests", logId), updateData);
        return true;
    } catch (error) {
        console.error("Error updating guest status:", error);
        return false;
    }
}

export async function updateGuestPermissions(logId: string, permissions: Partial<{ canAdmin: boolean, canUpload: boolean, canComment: boolean }>) {
    try {
        await updateDoc(doc(db, "guests", logId), permissions);
        return true;
    } catch (error) {
        console.error("Error updating guest permissions:", error);
        return false;
    }
}

export async function removeGuestChatPermission(logId: string) {
    try {
        await updateDoc(doc(db, "guests", logId), { canChat: deleteField() });
        return true;
    } catch (error) {
        console.error("Error removing guest chat permission:", error);
        return false;
    }
}

export async function deleteGuest(logId: string) {
    try {
        await deleteDoc(doc(db, "guests", logId));
        return true;
    } catch (error) {
        console.error("Error deleting guest:", error);
        return false;
    }
}

export async function updateEvent(eventId: string, data: Partial<Event>) {
    try {
        const docRef = doc(db, "events", eventId);
        await updateDoc(docRef, data);
        return true;
    } catch (error) {
        console.error("Error updating event:", error);
        return false;
    }
}

export async function deleteEvent(eventId: string) {
    try {
        const event = await getEventById(eventId);

        const subEvents = await getSubEvents(eventId, event?.legacyId);
        for (const subEvent of subEvents) {
            await deleteEvent(subEvent.id);
        }

        const ids = event?.legacyId && event.legacyId !== eventId ? [eventId, event.legacyId] : [eventId];
        const photosRef = collection(db, "photos");
        const photosQuery = query(photosRef, where("eventId", "in", ids));
        const photosSnapshot = await getDocs(photosQuery);
        await Promise.all(photosSnapshot.docs.map((photoDoc) => deleteDoc(photoDoc.ref)));

        await deleteDoc(doc(db, "events", eventId));
        return true;
    } catch (error) {
        console.error("Error deleting event:", error);
        return false;
    }
}

export async function deletePhoto(photoId: string) {
    try {
        const docRef = doc(db, "photos", photoId);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error deleting photo:", error);
        return false;
    }
}
export async function getUserBusinesses(uid: string): Promise<Business[]> {
    console.log('[Firestore] Fetching businesses for UID:', uid);
    if (!uid) return [];
    try {
        const businessCol = collection(db, "businesses");
        
        // Query 1: Created by user
        const q1 = query(businessCol, where("createdBy", "==", uid));
        
        // Query 2: User is admin
        const q2 = query(businessCol, where("admins", "array-contains", uid));
        
        // Query 3: User is allowed
        const q3 = query(businessCol, where("allowedUsers", "array-contains", uid));
        
        console.log('[Firestore] Running business queries...');
        const [snap1, snap2, snap3] = await Promise.all([
            getDocs(q1),
            getDocs(q2),
            getDocs(q3)
        ]);
        console.log('[Firestore] Business queries completed successfully.');
        
        const allDocs = [
            ...snap1.docs,
            ...snap2.docs,
            ...snap3.docs
        ];
        
        // Deduplicate
        const seen = new Set<string>();
        const uniqueBusinesses: Business[] = [];
        
        for (const docSnap of allDocs) {
            if (!seen.has(docSnap.id)) {
                seen.add(docSnap.id);
                uniqueBusinesses.push({ id: docSnap.id, ...docSnap.data() } as Business);
            }
        }
        
        return uniqueBusinesses.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } catch (error) {
        console.error("Error fetching user businesses:", error);
        return [];
    }
}

export async function addPhoto(data: Omit<Photo, 'id'>) {
    try {
        const photosCol = collection(db, "photos");
        const sanitizedData = { ...data } as Record<string, unknown>;
        Object.keys(sanitizedData).forEach((key) => {
            if (sanitizedData[key] === undefined) delete sanitizedData[key];
        });
        const docRef = await addDoc(photosCol, {
            ...sanitizedData,
            uploadedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding photo:", error);
        return null;
    }
}

export async function getEventByJoinId(joinId: string): Promise<Event | null> {
    try {
        const eventsCol = collection(db, "events");
        const q = query(eventsCol, where("joinId", "==", joinId.toUpperCase().trim()));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return mapDocToEvent(snapshot.docs[0]);
    } catch (error) {
        console.error("Error fetching event by joinId:", error);
        return null;
    }
}

export async function createBusiness(businessData: Omit<Business, 'id' | 'createdAt'>) {
  try {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const vendorCode = businessData.vendorCode || `VEN-${randomCode}`;
    
    const docRef = await addDoc(collection(db, 'businesses'), {
      ...businessData,
      vendorCode,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding business: ", e);
    return null;
  }
}

export async function getBusinessById(id: string): Promise<Business | null> {
  try {
    const docRef = doc(db, 'businesses', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...docSnap.data(), id: docSnap.id } as Business;
    }
    return null;
  } catch (e) {
    console.error("Error fetching business by ID:", e);
    return null;
  }
}

export async function getEventsCountForVendor(vendorId: string): Promise<number> {
  try {
    const eventsCol = collection(db, "events");
    const q = query(eventsCol, where("vendors", "array-contains", vendorId));
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (e) {
    console.error("Error fetching event count for vendor:", e);
    return 0;
  }
}


export async function getBusinessByVendorCode(code: string): Promise<Business | null> {
  try {
    const formattedCode = code.toUpperCase().trim();
    // 1. Try querying by the vendorCode field
    const q = query(collection(db, 'businesses'), where('vendorCode', '==', formattedCode));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Business;
    }

    // 2. Fallback: If it's a deterministic code based on the document ID prefix, search by ID
    if (formattedCode.startsWith('VEN-')) {
      const docIdPrefix = formattedCode.replace('VEN-', '').toLowerCase();
      
      // If the ID matches the prefix exactly or we can find it
      const docRef = doc(db, 'businesses', docIdPrefix);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id } as Business;
      }
      
      // Since prefix is just 6 chars, we can query all businesses and check client-side as a last resort
      const allSnapshot = await getDocs(collection(db, 'businesses'));
      for (const d of allSnapshot.docs) {
        if (d.id.toLowerCase().startsWith(docIdPrefix)) {
          return { ...d.data(), id: d.id } as Business;
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Error fetching business by vendor code:", e);
    return null;
  }
}

export async function updateBusiness(bizId: string, data: Partial<Business>): Promise<boolean> {
  try {
    const bizRef = doc(db, 'businesses', bizId);
    await updateDoc(bizRef, data);
    return true;
  } catch (e) {
    console.error("Error updating business: ", e);
    return false;
  }
}

export async function getUserRatingForBusiness(userId: string, bizId: string): Promise<number | null> {
  try {
    const docRef = doc(db, 'businessRatings', `${userId}_${bizId}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().rating as number;
    }
    return null;
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
    const docRef = doc(db, 'businessRatings', `${userId}_${bizId}`);
    await setDoc(docRef, {
      userId,
      businessId: bizId,
      rating,
      comment: comment || '',
      userName: userName || 'Anonymous User',
      createdAt: serverTimestamp()
    });
    return true;
  } catch (e) {
    console.error("Error saving user rating: ", e);
    return false;
  }
}

export async function getReviewsForBusiness(bizId: string): Promise<any[]> {
  try {
    const q = query(
      collection(db, 'businessRatings'),
      where('businessId', '==', bizId)
    );
    const querySnapshot = await getDocs(q);
    const reviews: any[] = [];
    querySnapshot.forEach((doc) => {
      reviews.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort reviews locally by createdAt descending to avoid index errors on Firebase
    return reviews.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  } catch (e) {
    console.error("Error getting reviews for business: ", e);
    return [];
  }
}

export async function getTopRatedBusinesses(limitCount: number = 10): Promise<Business[]> {
    try {
      const bizCol = collection(db, 'businesses');
      const q = query(
        bizCol, 
        where('status', '==', 'published'),
        orderBy('rating', 'desc'), 
        limit(limitCount)
      );
      const bizSnapshot = await getDocs(q);
      return bizSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Business));
    } catch (e) {
      console.error("Error fetching top rated businesses:", e);
      return [];
    }
}

export function onTopRatedBusinesses(limitCount: number = 10, callback: (businesses: Business[]) => void) {
    const bizCol = collection(db, 'businesses');
    const q = query(
      bizCol, 
      where('status', '==', 'published'),
      orderBy('rating', 'desc'), 
      limit(limitCount)
    );
    return onSnapshot(q, (snapshot) => {
        const businesses = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Business));
        callback(businesses);
    });
}

// --- SOCIAL NETWORK FUNCTIONS ---
/**
 * Updates user profile privacy setting.
 */
export async function updateUserPrivacy(uid: string, isPrivate: boolean) {
    try {
        const docRef = doc(db, "users", uid);
        await updateDoc(docRef, { isPrivate });
        return true;
    } catch (error) {
        console.error("Error updating privacy:", error);
        return false;
    }
}

/**
 * Follows another user. If target user is private, creates a pending request.
 */
export async function followUser(followerId: string, followedId: string) {
    try {
        const targetUser = await getUserById(followedId);
        const isPrivate = targetUser?.isPrivate || false;
        
        const relationshipId = `${followerId}_${followedId}`;
        const docRef = doc(db, "relationships", relationshipId);
        await setDoc(docRef, {
            followerId,
            followedId,
            status: isPrivate ? 'pending' : 'accepted',
            createdAt: serverTimestamp()
        });
        return { success: true, status: isPrivate ? 'pending' : 'accepted' };
    } catch (error) {
        console.error("Error following user:", error);
        return { success: false };
    }
}

/**
 * Fetches pending follow requests for a specific user.
 */
export async function getPendingFollowRequests(userId: string): Promise<any[]> {
    try {
        const relCol = collection(db, "relationships");
        const q = query(relCol, where("followedId", "==", userId), where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching pending requests:", error);
        return [];
    }
}

/**
 * Approves a follow request.
 */
export async function approveFollowRequest(relationshipId: string) {
    try {
        const docRef = doc(db, "relationships", relationshipId);
        await updateDoc(docRef, { status: 'accepted' });
        return true;
    } catch (error) {
        console.error("Error approving request:", error);
        return false;
    }
}

/**
 * Rejects a follow request.
 */
export async function rejectFollowRequest(relationshipId: string) {
    try {
        const docRef = doc(db, "relationships", relationshipId);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error rejecting request:", error);
        return false;
    }
}

/**
 * Unfollows another user.
 */
export async function unfollowUser(followerId: string, followedId: string) {
    try {
        const relationshipId = `${followerId}_${followedId}`;
        const docRef = doc(db, "relationships", relationshipId);
        await deleteDoc(docRef);
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
    try {
        const relCol = collection(db, "relationships");
        const q = query(relCol, where("followerId", "==", userId));
        const snapshot = await getDocs(q);
        // Return IDs where status is 'accepted' OR status is missing (legacy support)
        return snapshot.docs
            .filter(doc => !doc.data().status || doc.data().status === 'accepted')
            .map(doc => doc.data().followedId);
    } catch (error) {
        console.error("Error fetching following list:", error);
        return [];
    }
}

/**
 * Counts how many people are following a specific user.
 */
export async function getFollowersCount(userId: string): Promise<number> {
    try {
        const relCol = collection(db, "relationships");
        const q = query(relCol, where("followedId", "==", userId));
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error("Error fetching followers count:", error);
        return 0;
    }
}

/**
 * Counts how many people a specific user is following.
 */
export async function getFollowingCount(userId: string): Promise<number> {
    try {
        const relCol = collection(db, "relationships");
        const q = query(relCol, where("followerId", "==", userId));
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error("Error fetching following count:", error);
        return 0;
    }
}

/**
 * Fetches the latest activities (likes, comments, events) from users being followed.
 */
export async function getSocialFeed(followingIds: string[]): Promise<any[]> {
    if (!followingIds || followingIds.length === 0) {
        console.log('[SocialFeed] Called with empty followingIds — returning []');
        return [];
    }
    
    console.log('[SocialFeed] Querying for userIds:', followingIds);
    
    try {
        const feedItems: any[] = [];
        
        // Fetch all events and filter client-side to support older events missing 'createdBy'
        const eventsCol = collection(db, "events");
        const eventsSnapshot = await getDocs(eventsCol);
        
        console.log('[SocialFeed] Total events docs fetched:', eventsSnapshot.size);
        
        let skippedOwner = 0, skippedSub = 0, skippedDeleted = 0, skippedGhost = 0;
        
        eventsSnapshot.forEach(doc => {
            const data = doc.data();
            
            // Check if it belongs to self or a followed user
            const ownerId = data.createdBy || data.userId;
            if (!ownerId || !followingIds.includes(ownerId)) {
                skippedOwner++;
                return;
            }

            // Skip sub-events
            if (data.parentId || data.type === 'sub') {
                skippedSub++;
                return;
            }
            
            // Skip deleted events
            if (data.deleted || data.isDeleted) {
                skippedDeleted++;
                return;
            }
            
            // Skip ghost events with no proper title (but keep 1-2 char titles like "DJ")
            const title = (data.title || '').trim();
            if (!title || title.toLowerCase() === 'new event' || title.toLowerCase() === 'untitled') {
                skippedGhost++;
                return;
            }
            
            // IMPORTANT: spread data first, then override type so data.type ('main'/'sub')
            // never overwrites the 'event' marker used by the feed filter in social.tsx
            feedItems.push({ 
                ...data,
                id: doc.id, 
                type: 'event',
            });
        });

        // Sort by date client-side
        return feedItems.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

    } catch (error) {
        console.error("[SocialFeed] Error fetching social feed:", error);
        return [];
    }
}

/**
 * Toggles a like on an event post.
 */
export async function toggleEventPostLike(eventId: string, userId: string) {
    try {
        const likeId = `${userId}_${eventId}`.replace(/[^a-zA-Z0-9]/g, '_');
        const docRef = doc(db, "eventLikes", likeId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            await deleteDoc(docRef);
            return { liked: false };
        } else {
            await setDoc(docRef, {
                eventId,
                userId,
                createdAt: serverTimestamp()
            });
            return { liked: true };
        }
    } catch (error) {
        console.error("Error toggling event like:", error);
        throw error;
    }
}

/**
 * Checks if a user has liked an event post.
 */
export async function isEventPostLikedByUser(eventId: string, userId: string): Promise<boolean> {
    try {
        const likeId = `${userId}_${eventId}`.replace(/[^a-zA-Z0-9]/g, '_');
        const docRef = doc(db, "eventLikes", likeId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking event like:", error);
        return false;
    }
}

/**
 * Fetches the count of likes for an event post.
 */
export async function getEventPostLikes(eventId: string) {
    try {
        const likesCol = collection(db, "eventLikes");
        const q = query(likesCol, where("eventId", "==", eventId));
        const snapshot = await getDocs(q);
        return { count: snapshot.size };
    } catch (error) {
        console.error("Error fetching event likes:", error);
        return { count: 0 };
    }
}

/**
 * Adds a comment to an event post.
 */
export async function addEventPostComment(eventId: string, userId: string, userName: string, text: string) {
    try {
        const commentsCol = collection(db, "eventComments");
        await addDoc(commentsCol, {
            eventId,
            userId,
            userName,
            text,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error adding event comment:", error);
        return false;
    }
}

/**
 * Fetches all comments for an event post.
 */
export async function getEventPostComments(eventId: string) {
    try {
        const commentsCol = collection(db, "eventComments");
        const q = query(commentsCol, where("eventId", "==", eventId), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error fetching event comments:", error);
        return [];
    }
}

/**
 * Toggles shortlist status of a business for a user
 */
export async function toggleShortlistBusiness(userId: string, businessId: string) {
    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return false;
        const userData = userSnap.data();
        const currentShortlist: string[] = userData.shortlisted || [];
        
        let newShortlist: string[];
        if (currentShortlist.includes(businessId)) {
            newShortlist = currentShortlist.filter(id => id !== businessId);
        } else {
            newShortlist = [...currentShortlist, businessId];
        }
        
        await updateDoc(userRef, { shortlisted: newShortlist });
        return true;
    } catch (error) {
        console.error("Error toggling shortlist business:", error);
        return false;
    }
}

/**
 * Logs a new business activity post (e.g. announcement, FAQ, or new portfolio photo).
 */
export async function addBusinessActivity(activity: {
    businessId: string;
    businessName: string;
    businessCover: string;
    businessType: string;
    createdBy: string;
    activityType: 'announcement' | 'faq' | 'portfolio_photo';
    title: string;
    content: string;
    photoUrl?: string;
}): Promise<boolean> {
    try {
        const activitiesCol = collection(db, 'businessActivities');
        await addDoc(activitiesCol, {
            ...activity,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Error logging business activity:", e);
        return false;
    }
}

/**
 * Fetches activities for a list of creator IDs.
 */
export async function getBusinessActivities(creatorIds: string[]): Promise<any[]> {
    try {
        if (!creatorIds || creatorIds.length === 0) return [];
        
        // Firestore IN query limited to chunks of 30.
        const chunks: string[][] = [];
        for (let i = 0; i < creatorIds.length; i += 30) {
            chunks.push(creatorIds.slice(i, i + 30));
        }

        let allDocs: any[] = [];
        for (const chunk of chunks) {
            const activitiesCol = collection(db, 'businessActivities');
            const q = query(activitiesCol, where('createdBy', 'in', chunk), orderBy('createdAt', 'desc'), limit(50));
            const snapshot = await getDocs(q);
            allDocs = [...allDocs, ...snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))];
        }

        // Sort descending by createdAt
        allDocs.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        return allDocs;
    } catch (e) {
        console.error("Error fetching business activities:", e);
        return [];
    }
}

export async function getAnnouncementsForBusiness(bizId: string): Promise<any[]> {
    try {
        const activitiesCol = collection(db, 'businessActivities');
        const q = query(
            activitiesCol,
            where('businessId', '==', bizId)
        );
        const snapshot = await getDocs(q);
        const allActivities = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        
        // Filter only announcement activities
        const announcements = allActivities.filter((act: any) => act.activityType === 'announcement');
        
        // Sort descending by createdAt chronologically
        announcements.sort((a: any, b: any) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });
        
        return announcements;
    } catch (e) {
        console.error("Error fetching announcements for business:", e);
        return [];
    }
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
    userId?: string;
    vendorOwnerId: string;
    vendorOwnerEmail: string;
    createdAt?: any;
}

export async function addEnquiry(enquiry: Omit<Enquiry, 'id' | 'createdAt'>) {
    try {
        const enquiriesCol = collection(db, "enquiries");
        const docRef = await addDoc(enquiriesCol, {
            ...enquiry,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding enquiry:", error);
        return null;
    }
}

export async function getEnquiriesForBusiness(businessId: string, userId: string): Promise<Enquiry[]> {
    try {
        const enquiriesCol = collection(db, "enquiries");
        const q = query(enquiriesCol, where("vendorOwnerId", "==", userId));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Enquiry));
        
        // Filter by specific businessId locally and sort by createdAt descending
        const filtered = list.filter(e => e.businessId === businessId);
        return filtered.sort((a, b) => {
            const timeA = a.createdAt?.seconds || a.createdAt?.getTime?.() / 1000 || 0;
            const timeB = b.createdAt?.seconds || b.createdAt?.getTime?.() / 1000 || 0;
            return timeB - timeA;
        });
    } catch (error) {
        console.error("Error fetching enquiries for business:", error);
        return [];
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
