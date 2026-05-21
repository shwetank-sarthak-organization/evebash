"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import {
    LayoutDashboard,
    Eye,
    Settings,
    ShieldCheck,
    LogOut,
    ArrowRight,
    Camera,
    Plus,
    Upload,
    ChevronLeft,
    Image as ImageIcon,
    Loader2,
    MoreVertical,
    Pencil,
    Check,
    Trash2,
    X,
    Star,
    LayoutGrid,
    List,
    Users,
    Share2,
    Phone,
    Globe,
    Crown,
    Calendar,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    UserCog,
    UserMinus,
    Info,
    Sparkles,
    QrCode,
    UserPlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    createEvent,
    getUserEvents,
    savePhoto,
    Event,
    Photo,
    deleteEvent,
    updateEvent,
    getEventPhotos,
    deletePhoto,
    getUsers,
    updateUserRole,
    deleteUser,
    getUserTotalStorage,
    getUserEventCount,
    getDelegatedAdminsCount,
    getGuestLogs,
    getEventLogs,
    getSubEvents,
    getEventById,
    getUserById,
    getEventByJoinId,
    logGuestLogin
} from "@/lib/firestore";
import { uploadEventImage } from "@/lib/storage";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Tooltip } from "@/components/Tooltip";
import { navigateWithModifierClick } from "@/lib/navigation";
import { v4 as uuidv4 } from "uuid";
import { Timestamp } from "firebase/firestore";
import { syncCloudinaryToFirestore } from "@/app/actions/sync";
import { deleteGuestAction, updateGuestStatusAction } from "@/app/actions/permissions";
import * as faceapi from "face-api.js";
import { saveFaceToIndex } from "@/lib/firestore";

import { Lightbox } from "@/components/ui/Lightbox";

const PLACEHOLDER_IMAGES = [
    "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1465495910483-34a170a7bb00?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1549413187-0521e7cebcba?q=80&w=2070&auto=format&fit=crop"
];

export const TEMPLATE_THEMES = [
    { id: "hero", label: "Hero (Default)", desc: "Big impact cover image" },
    { id: "classic", label: "Classic", desc: "Timeless and elegant" },
    { id: "royal", label: "Royal", desc: "Luxurious serif typography" },
    { id: "editorial", label: "Editorial", desc: "Magazine-style layout" },
    { id: "bohemian", label: "Bohemian", desc: "Earthy and organic colors" },
    { id: "polaroid", label: "Polaroid", desc: "Vintage photo frames" },
    { id: "cinematic", label: "Cinematic", desc: "Immersive fullscreen video" },
    { id: "museum", label: "Museum", desc: "Minimalist art gallery" },
    { id: "scrapbook", label: "Scrapbook", desc: "Playful cut-out aesthetic" },
    { id: "brutalist", label: "Brutalist", desc: "Raw, highly structured design" },
    { id: "pop", label: "Pop Art", desc: "Comic poster birthday album" }
];

function DashboardContent() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [view, setView] = useState<"main" | "manage" | "permissions">("main");
    const [manageMode, setManageMode] = useState<"list" | "add-event" | "add-image">("list");
    const [manageLevel, setManageLevel] = useState<"events" | "galleries" | "photos" | "event-details">("events");
    const [selectedMainEvent, setSelectedMainEvent] = useState<Event | null>(null);
    const [viewingPhoto, setViewingPhoto] = useState<any | null>(null);
    const [galleryViewMode, setGalleryViewMode] = useState<"grid" | "list">("grid");

    // Data State
    const [userEvents, setUserEvents] = useState<Event[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [currentEventPhotos, setCurrentEventPhotos] = useState<Photo[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [totalStorage, setTotalStorage] = useState<number>(0);
    const [workspaceOwner, setWorkspaceOwner] = useState<any | null>(null);
    const [eventOwners, setEventOwners] = useState<Record<string, { email?: string; name?: string }>>({});

    // Permissions State
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [delegatedCount, setDelegatedCount] = useState(0);
    const [activePermissionTab, setActivePermissionTab] = useState<"admin_details" | "guest_user">("admin_details");
    const [expandedMainEvents, setExpandedMainEvents] = useState<Set<string>>(new Set());
    const [expandedEventAdmins, setExpandedEventAdmins] = useState<Set<string>>(new Set());
    const [expandedEventGuests, setExpandedEventGuests] = useState<Set<string>>(new Set());
    const [trafficLogs, setTrafficLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedLogEventId, setSelectedLogEventId] = useState<string>("all");
    const [selectedUserToAssign, setSelectedUserToAssign] = useState<string>("");
    const [assignedEventsForSelect, setAssignedEventsForSelect] = useState<string[]>([]);

    // Form State
    const [eventName, setEventName] = useState("");
    const [eventDate, setEventDate] = useState("");
    const [selectedEventId, setSelectedEventId] = useState("");
    const [selectedEventName, setSelectedEventName] = useState("");
    const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [isJoining, setIsJoining] = useState(false);

    const toggleMainEvent = (eventId: string) => {
        setExpandedMainEvents(prev => {
            const next = new Set(prev);
            if (next.has(eventId)) next.delete(eventId);
            else next.add(eventId);
            return next;
        });
    };

    const toggleEventAdmins = (eventId: string) => {
        setExpandedEventAdmins(prev => {
            const next = new Set(prev);
            if (next.has(eventId)) next.delete(eventId);
            else next.add(eventId);
            return next;
        });
    };

    const toggleEventGuests = (eventId: string) => {
        setExpandedEventGuests(prev => {
            const next = new Set(prev);
            if (next.has(eventId)) next.delete(eventId);
            else next.add(eventId);
            return next;
        });
    };

    const handleJoinEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;

        setIsJoining(true);
        try {
            const event = await getEventByJoinId(joinCode);
            if (!event) {
                alert("Invalid join code. Please check and try again.");
                return;
            }

            // Log the join request
            await logGuestLogin(
                user?.name || "Guest",
                user?.phone || user?.email || user?.uid || "Anonymous",
                event.id,
                event.parentId || undefined,
                event.title,
                event.createdBy,
                "pending"
            );

            alert("Request sent! You'll be able to access the event once the admin approves your request.");
            setIsJoinModalOpen(false);
            setJoinCode("");
        } catch (error) {
            console.error("Error joining event:", error);
            alert("An error occurred. Please try again.");
        } finally {
            setIsJoining(false);
        }
    };

    // Event Management State
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [renamingEvent, setRenamingEvent] = useState<Event | null>(null);
    const [newTitle, setNewTitle] = useState("");
    const [newDate, setNewDate] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Template Selection State
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateTargetEvent, setTemplateTargetEvent] = useState<Event | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState("hero");

    useEffect(() => {
        // Allow all logged in users to access the dashboard
        // Plan roles: free (default), basic, standard, premium, elite, admin
        const isAuthorized = !!user;
        
        if (!loading && user && !isAuthorized) {
            router.push("/profile");
        }
    }, [user, loading, router]);

    // URL State Synchronization
    useEffect(() => {
        const viewParam = searchParams.get("view");
        const levelParam = searchParams.get("level");
        const modeParam = searchParams.get("mode");
        const eventIdParam = searchParams.get("eventId");

        // 1. View State
        if (viewParam === "manage" || viewParam === "permissions") {
            setView(viewParam as any);
        } else {
            setView("main");
        }

        // 2. Manage Level
        if (levelParam === "galleries" || levelParam === "photos" || levelParam === "event-details") {
            setManageLevel(levelParam as any);
        } else {
            setManageLevel("events");
        }

        // 3. Manage Mode
        if (modeParam === "add-event" || modeParam === "add-image") {
            setManageMode(modeParam as any);
        } else {
            setManageMode("list");
        }

        // 4. Selected Event (for generic ID lookups)
        if (eventIdParam && userEvents.length > 0) {
            // Find in loaded events (may need to be robust if events aren't loaded yet)
            // We'll trust fetchUserEvents to handle data loading, this just sets the ID.
            const targetEvent = userEvents.find(e => e.id === eventIdParam);
            if (targetEvent) {
                // Always set the selected event ID if we're in add-image mode or specifically on photos level
                if (levelParam === "photos" || modeParam === "add-image") {
                    setSelectedEventId(targetEvent.id);
                    setSelectedEventName(targetEvent.title);
                }

                if (levelParam === "galleries") {
                    setSelectedMainEvent(targetEvent);
                } else if (levelParam === "photos") {
                    // If it's a sub-event, we also need to set the Main Event parent
                    if (targetEvent.parentId) {
                        const parent = userEvents.find(e => e.id === targetEvent.parentId);
                        if (parent) setSelectedMainEvent(parent);
                    }
                }
            } else {
                // If event events aren't loaded yet, we might need to rely on the ID alone 
                // and let the fetch logic handle it, but for now we set the generic IDs
                if (levelParam === "galleries") {
                    // We need the object for some UI, but ID is enough for fetching
                    // We'll optimistically set what we can
                }
                setSelectedEventId(eventIdParam);
            }
        } else if (!eventIdParam) {
            setSelectedEventId("");
            setSelectedMainEvent(null);
        }
    }, [searchParams, userEvents]);


    useEffect(() => {
        if (user && user.uid && view === "manage") {
            fetchUserEvents();
            fetchStorageStats();
        } else if (user && user.uid && view === "permissions") {
            fetchUserEvents();
            fetchUsersList();
            fetchDelegatedCount();
            fetchTrafficLogs();
        }
    }, [user, view, activePermissionTab, selectedLogEventId, manageLevel, selectedMainEvent]);

    useEffect(() => {
        if (selectedEventId && (manageMode === "add-image" || manageLevel === "photos")) {
            fetchEventPhotos();
        }
    }, [selectedEventId, manageMode, manageLevel]);

    const compressImage = async (file: File): Promise<File> => {
        // Only compress if larger than 5MB
        if (file.size < 5 * 1024 * 1024) return file;

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // Max dimension 2500px for web display
                const MAX_DIM = 2500;
                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name, { type: "image/jpeg" }));
                        } else {
                            resolve(file);
                        }
                    },
                    "image/jpeg",
                    0.85 // High quality but significantly smaller filesize
                );
                URL.revokeObjectURL(img.src);
            };
            img.onerror = (err) => reject(err);
        });
    };

    const fetchUserEvents = async () => {
        if (!user || !user.uid) return;
        setLoadingEvents(true);
        const type = (view === "permissions" || manageLevel === "events") ? "main" : "sub";
        const parentId = (view === "manage" && (manageLevel === "galleries" || manageLevel === "photos")) ? selectedMainEvent?.id : undefined;

        // Own events are always visible. Delegated owner events are scoped by roleType below.
        const ownIdentifiers = [user.uid];
        if (user.email) ownIdentifiers.push(user.email);

        const ownerIdentifiers: string[] = [];
        if (user.delegatedBy) ownerIdentifiers.push(user.delegatedBy);
        if (workspaceOwner?.email) ownerIdentifiers.push(workspaceOwner.email);

        const identifiers = user.delegatedBy
            ? [...ownIdentifiers, ...ownerIdentifiers]
            : ownIdentifiers;

        if (type === "sub" && parentId) {
            // ... existing complex sub-event logic ...
            const byRelationship = await getSubEvents(parentId, selectedMainEvent?.legacyId);
            const byIdentity = await getUserEvents(identifiers, type, parentId, selectedMainEvent?.legacyId);
            const combined = [...byRelationship];
            byIdentity.forEach(evt => {
                if (!combined.some(e => e.id === evt.id)) {
                    combined.push(evt);
                }
            });

            const sorted = combined.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

            // Event managers only see events explicitly assigned to them.
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                setUserEvents(sorted.filter(e =>
                    (e.createdBy && ownIdentifiers.includes(e.createdBy)) ||
                    assignedEvents.includes(e.id) ||
                    e.parentId === parentId
                ));
            } else {
                setUserEvents(sorted);
            }
        } else {
            // Root level: Fetch by identity pool
            const events = await getUserEvents(identifiers, type, parentId, selectedMainEvent?.legacyId);
            const combinedEvents = [...events];

            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                const assignedEventDocs = await Promise.all(
                    assignedEvents.map(eventId => getEventById(eventId))
                );

                assignedEventDocs.forEach(eventDoc => {
                    if (eventDoc && !combinedEvents.some(existing => existing.id === eventDoc.id)) {
                        combinedEvents.push(eventDoc);
                    }
                });
            }

            // Event managers only see events explicitly assigned to them.
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                setUserEvents(combinedEvents.filter(e =>
                    (e.createdBy && ownIdentifiers.includes(e.createdBy)) ||
                    assignedEvents.includes(e.id)
                ));
            } else {
                setUserEvents(combinedEvents);
            }
        }
        setLoadingEvents(false);
    };

    const fetchEventPhotos = async () => {
        if (!selectedEventId) return;
        
        let currentEvent = userEvents.find(e => e.id === selectedEventId);
        
        // Robust fetch: Ensure we have the full event object (especially legacyId and createdBy)
        // If we don't have it or it's missing the legacyId (common for migrated events in the list pool)
        // we fetch it deeply from Firestore.
        if (!currentEvent || (!currentEvent.legacyId && selectedEventId.includes("-"))) {
            try {
                const fetched = await getEventById(selectedEventId);
                if (fetched) currentEvent = fetched;
            } catch (err) {
                console.error("[Dashboard] Error fetching event details for photos:", err);
            }
        }

        setLoadingPhotos(true);
        try {
            // 1. Fetch from Firestore CLIENT-SIDE (Respects permissions)
            // Use legacyId if available, fallback to selectedEventId
            const legacyId = currentEvent?.legacyId;
            let photos = await getEventPhotos(selectedEventId, legacyId);

            // 2. If Empty, trigger SERVER-SIDE Sync
            if (photos.length === 0) {
                setStatus("uploading");
                setMessage("Syncing from Cloudinary...");

                const syncResult = await syncCloudinaryToFirestore(
                    selectedEventId,
                    currentEvent?.createdBy,
                    currentEvent?.legacyId
                );

                if (syncResult.success && (syncResult.count || 0) > 0) {
                    // Re-fetch on client after successful sync
                    photos = await getEventPhotos(selectedEventId, legacyId);
                    setMessage(`Sync success! ${syncResult.count || 0} photos restored. ✨`);
                    setStatus("success");
                    setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
                } else if (!syncResult.success) {
                    setStatus("idle");
                    setMessage("");
                } else {
                    setStatus("idle");
                    setMessage("");
                }
            }

            setCurrentEventPhotos(photos as Photo[]);
        } catch (error) {
            console.error("[Dashboard] fetchEventPhotos Error:", error);
            setStatus("error");
            setMessage("Failed to load photos.");
        } finally {
            setLoadingPhotos(false);
        }
    };

    const fetchStorageStats = async () => {
        if (!user) return;

        // Identity Pool for storage calculation (accounts for both UID and Email tags)
        const identifiers = [user.uid];
        if (user.email) identifiers.push(user.email);

        const total = await getUserTotalStorage(identifiers);
        setTotalStorage(total);
    };

    const fetchUsersList = async () => {
        setLoadingUsers(true);
        try {
            const users = await getUsers();
            // Sort all users alphabetically by name
            const sortedUsers = users.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            setAllUsers(sortedUsers);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchDelegatedCount = async () => {
        if (!user) return;
        const count = await getDelegatedAdminsCount(user.uid);
        setDelegatedCount(count);
    };

    const fetchTrafficLogs = async () => {
        if (!user) return;
        setLoadingLogs(true);
        try {
            // Enforce strict identity scoping for everyone (Primary, Event, and Web Admins)
            // This ensures guest activity is only visible on the relevant dashboard.
            const identifiers = [user.uid];
            if (user.email) identifiers.push(user.email);
            if (user.delegatedBy) identifiers.push(user.delegatedBy);

            const logs = await (selectedLogEventId === "all"
                ? getGuestLogs(identifiers)
                : getEventLogs(selectedLogEventId));

            // Event managers only see traffic for events explicitly assigned to them.
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                setTrafficLogs(logs.filter(log => (log.parentEventId && assignedEvents.includes(log.parentEventId)) || (log.eventId && assignedEvents.includes(log.eventId))));
            } else {
                setTrafficLogs(logs);
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleUpdateUserRole = async (targetUid: string, currentRole: string, roleType: 'primary' | 'event' = 'primary', assignedEvents: string[] = []) => {
        if (!user) return;

        const targetUser = allUsers.find(u => u.id === targetUid);
        const isRevoking = currentRole === "revoke";
        const isNewDelegation = targetUser?.delegatedBy !== user.uid;
        const isPromoting = !isRevoking;

        if (isPromoting && isNewDelegation && delegatedCount >= 2) {
            setMessage("You can only have a maximum of 2 delegated managers.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
            return;
        }

        // When promoting: Set delegation fields, but DO NOT flip global role to 'admin'
        // When revoking: Remove delegation fields. Signature: (uid, newRole, delegatedBy, roleType, assignedEvents)
        const success = await updateUserRole(
            targetUid,
            null, // Do not change global role
            isPromoting ? user.uid : undefined,
            isPromoting ? roleType : undefined,
            isPromoting ? assignedEvents : undefined
        );

        if (success) {
            setMessage(`User successfully ${isPromoting ? "authorized as Manager" : "access revoked"}.`);
            setStatus("success");
            fetchUsersList();
            fetchDelegatedCount();
            fetchUserEvents();
            fetchTrafficLogs();
        } else {
            setMessage("Failed to update user authorizations.");
            setStatus("error");
        }
        setTimeout(() => setStatus("idle"), 3000);
    };

    const handleDeleteUserAccount = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

        const success = await deleteUser(id);
        if (success) {
            setMessage("User deleted successfully!");
            setStatus("success");
            fetchUsersList();
        } else {
            setMessage("Failed to delete user.");
            setStatus("error");
        }
        setTimeout(() => setStatus("idle"), 3000);
    };

    const handleGuestStatusUpdate = async (logId: string, nextStatus: "approved" | "rejected") => {
        const result = await updateGuestStatusAction(logId, nextStatus, {
            uid: user?.uid,
            email: user?.email,
        });

        if (result.success) {
            setMessage(`Guest ${nextStatus === "approved" ? "approved" : "rejected"} successfully.`);
            setStatus("success");
            fetchTrafficLogs();
        } else {
            setMessage(result.error || "Failed to update guest.");
            setStatus("error");
        }
        setTimeout(() => setStatus("idle"), 3000);
    };

    const handleGuestDelete = async (logId: string) => {
        if (!window.confirm("Are you sure you want to remove this user from the guest list?")) return;

        const result = await deleteGuestAction(logId, {
            uid: user?.uid,
            email: user?.email,
        });

        if (result.success) {
            setMessage("Guest removed successfully.");
            setStatus("success");
            fetchTrafficLogs();
        } else {
            setMessage(result.error || "Failed to remove guest.");
            setStatus("error");
        }
        setTimeout(() => setStatus("idle"), 3000);
    };

    // Fetch workspace owner if current user is delegated
    useEffect(() => {
        const fetchWorkspaceOwner = async () => {
            if (user?.delegatedBy) {
                try {
                    const ownerData = await getUserById(user.delegatedBy);
                    if (ownerData) {
                        setWorkspaceOwner(ownerData);
                    }
                } catch (error) {
                    console.error("Error fetching workspace owner:", error);
                }
            } else {
                setWorkspaceOwner(null);
            }
        };

        if (user) {
            fetchWorkspaceOwner();
        }
    }, [user?.delegatedBy, user?.uid]);

    // Re-fetch events once workspace owner email is available
    useEffect(() => {
        if (workspaceOwner?.email) {
            console.log("[Dashboard] Workspace owner loaded, re-fetching events for attribution...");
            fetchUserEvents();
        }
    }, [workspaceOwner?.email]);

    useEffect(() => {
        const fetchEventOwners = async () => {
            const ownerIds = Array.from(new Set(
                userEvents
                    .map(evt => evt.createdBy)
                    .filter((ownerId): ownerId is string => !!ownerId && !ownerId.includes("@"))
            ));

            if (ownerIds.length === 0) {
                setEventOwners({});
                return;
            }

            const ownerEntries = await Promise.all(
                ownerIds.map(async (ownerId) => {
                    const owner = await getUserById(ownerId);
                    return [ownerId, { email: owner?.email, name: owner?.name }] as const;
                })
            );

            setEventOwners(Object.fromEntries(ownerEntries));
        };

        fetchEventOwners();
    }, [userEvents]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-royal-cream text-slate-800">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-royal-gold/20 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-royal-gold/10 rounded"></div>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const handleCreateEventOnly = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventName.trim()) {
            setMessage("Please enter an event name.");
            return;
        }

        // --- ROLE-BASED LIMITS ---
        const isCreatingMainEvent = manageLevel !== "galleries";
        if (isCreatingMainEvent && user.role !== "admin" && user.role !== "premium" && user.role !== "elite" && !user.delegatedBy) {
            const eventCount = await getUserEventCount(user.uid);
            const role = user.role || "free";
            
            const limits: Record<string, number> = {
                "free": 2,
                "basic": 5,
                "standard": 20
            };
            
            const maxEvents = limits[role] || 2;
            
            if (eventCount >= maxEvents) {
                setMessage(`You've reached your ${maxEvents}-event limit for the ${role.toUpperCase()} plan. Upgrade your plan to create more events.`);
                setStatus("error");
                setTimeout(() => setStatus("idle"), 5000);
                return;
            }
        }

        setStatus("uploading");
        setMessage("Creating event...");

        try {
            const eventId = eventName.toLowerCase().replace(/\s+/g, '-') + '-' + uuidv4().slice(0, 4);

            // Assign a random placeholder
            const randomPlaceholder = PLACEHOLDER_IMAGES[Math.floor(Math.random() * PLACEHOLDER_IMAGES.length)];

            const isSubEvent = manageLevel === "galleries" && selectedMainEvent;

            const newEvent: Event = {
                id: eventId,
                title: eventName,
                date: eventDate.trim() || new Date().toLocaleDateString(),
                coverImage: randomPlaceholder,
                description: isSubEvent ? `Gallery of ${selectedMainEvent.title}` : `Main Event: ${eventName}`,
                createdBy: user.uid, // Using secure UID for new events
                type: isSubEvent ? "sub" : "main",
                ...(isSubEvent && { parentId: selectedMainEvent.id }),
                templateId: isSubEvent ? (selectedMainEvent.templateId || "hero") : selectedTemplate
            };

            await createEvent(newEvent);

            setStatus("success");
            setMessage("Event created! Click it to add images. ✨");
            setEventName("");
            setEventDate("");
            setSelectedTemplate("hero"); // Reset to default
            fetchUserEvents();

            // Navigate to the list view of the current level
            setTimeout(() => {
                const params = new URLSearchParams(searchParams);
                params.set("mode", "list");
                router.push(`/dashboard?${params.toString()}`);
            }, 1500);
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage("Failed to create event.");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0 || !selectedEventId) return;

        // --- ROLE-BASED LIMITS: Storage Cap ---
        if (user.role !== "admin" && !user.delegatedBy) {
            const role = user.role || "free";
            const storageLimits: Record<string, number> = {
                "free": 1 * 1024 * 1024 * 1024,      // 1GB
                "basic": 15 * 1024 * 1024 * 1024,    // 15GB
                "standard": 60 * 1024 * 1024 * 1024,  // 60GB
                "premium": 200 * 1024 * 1024 * 1024, // 200GB
                "elite": 1024 * 1024 * 1024 * 1024   // 1TB
            };
            
            const limit = storageLimits[role] || (1 * 1024 * 1024 * 1024);
            const identifiers = [user.uid];
            if (user.email) identifiers.push(user.email);
            const currentUsage = await getUserTotalStorage(identifiers);
            
            if (currentUsage >= limit) {
                const limitLabel = role === "free" ? "1GB" : role === "basic" ? "15GB" : role === "standard" ? "60GB" : role === "premium" ? "200GB" : "1TB";
                setMessage(`You've reached your ${limitLabel} storage limit. Upgrade your plan for more storage.`);
                setStatus("error");
                setTimeout(() => setStatus("idle"), 5000);
                return;
            }
        }

        setStatus("uploading");
        setMessage(`Uploading ${selectedFiles.length} images...`);
        console.log(`[Dashboard] Starting auto-upload for ${selectedFiles.length} files to event ${selectedEventId}`);

        try {
            let firstUploadedUrl = "";
            const uploadResults: { file: File, photo: Photo }[] = [];

            const photoPromises = Array.from(selectedFiles).map(async (file, index) => {
                console.log(`[Dashboard] Processing file ${index + 1}/${selectedFiles.length}: ${file.name}`);

                // Compress if needed before sending to storage layer
                const optimizedFile = await compressImage(file);
                if (optimizedFile.size !== file.size) {
                    console.log(`[Dashboard] Optimized ${file.name}: ${Math.round(file.size / 1024 / 1024 * 10) / 10}MB -> ${Math.round(optimizedFile.size / 1024 / 1024 * 10) / 10}MB`);
                }

                const uploadResult = await uploadEventImage(optimizedFile, selectedEventId, user.uid || "anonymous");

                if (index === 0) firstUploadedUrl = uploadResult.url;

                const uniqueId = uploadResult.publicId.replace(/\//g, '_');
                const photo: Photo = {
                    id: uniqueId,
                    eventId: selectedEventId,
                    cloudinaryPublicId: uploadResult.publicId,
                    url: uploadResult.url,
                    uploadedAt: Timestamp.now(),
                    userId: user.uid || "anonymous",
                    width: uploadResult.width,
                    height: uploadResult.height,
                    size: (uploadResult as any).bytes,
                    format: (uploadResult as any).format
                };

                await savePhoto(photo);
                uploadResults.push({ file: optimizedFile, photo }); // Store for background indexing
            });

            await Promise.all(photoPromises);

            // --- Auto Face Indexing (Background) ---
            // After successful upload to cloud & firestore, we process the images locally in the background.
            // We use setTimeout to defer this so the UI can quickly show "Upload Success" and update standard galleries.
            setTimeout(async () => {
                try {
                    console.log(`[Dashboard] Starting background face indexing for ${uploadResults.length} new uploads...`);

                    // 1. Load models if needed (we load them here to save memory up until an upload actually happens)
                    const MODEL_URL = "/models";
                    await Promise.all([
                        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    ]);
                    console.log("[Dashboard] Face-API Models loaded.");

                    // 2. Scan each uploaded file using the exact matched DB record
                    for (const { file, photo } of uploadResults) {
                        try {
                            // Create a temporary object URL for face-api to read
                            const imageUrl = URL.createObjectURL(file);
                            const img = await faceapi.fetchImage(imageUrl);

                            // Detect all faces
                            const detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                                .withFaceLandmarks()
                                .withFaceDescriptors();

                            if (detections.length > 0) {
                                console.log(`[Dashboard] Found ${detections.length} faces in ${file.name}. Saving to index...`);

                                for (const detection of detections) {
                                    await saveFaceToIndex({
                                        imageId: photo.id,
                                        descriptor: Array.from(detection.descriptor),
                                        eventId: photo.eventId,
                                        imageUrl: photo.url,
                                        width: photo.width || 0,
                                        height: photo.height || 0
                                    });
                                }
                            }
                            URL.revokeObjectURL(imageUrl); // clean up memory
                        } catch (e) {
                            console.error("[Dashboard] Error indexing face in file", file.name, e);
                        }
                    }
                    console.log("[Dashboard] Background face indexing complete.");
                } catch (e) {
                    console.error("[Dashboard] Background indexing failed:", e);
                }
            }, 100);

            await fetchStorageStats();

            // Auto-update cover if it's currently a placeholder or if it's the first upload
            const currentEvent = userEvents.find(ev => ev.id === selectedEventId);
            const isPlaceholder = !currentEvent?.coverImage || PLACEHOLDER_IMAGES.includes(currentEvent.coverImage);

            if (isPlaceholder && firstUploadedUrl) {
                console.log("[Dashboard] Replacing placeholder with first uploaded image as cover");
                await updateEvent(selectedEventId, { coverImage: firstUploadedUrl });
            }

            setStatus("success");
            setMessage("Gallery updated! ✨");
            fetchUserEvents();
            fetchEventPhotos();
            setTimeout(() => setStatus("idle"), 2000);
        } catch (err: any) {
            console.error("[Dashboard] Auto-upload error:", err);
            setStatus("error");
            setMessage(`Upload failed: ${err.message || 'Unknown error'}`);
        }
    };

    const handleSetAsCover = async (photoUrl: string, targetEventId?: string, isMainEvent: boolean = false) => {
        const idToUpdate = targetEventId || selectedEventId;
        if (!idToUpdate) return;

        setStatus("uploading");
        setMessage(`Setting as ${isMainEvent ? 'event' : 'gallery'} cover...`);

        try {
            const success = await updateEvent(idToUpdate, { coverImage: photoUrl });
            if (success) {
                setStatus("success");
                setMessage(`${isMainEvent ? 'Event' : 'Gallery'} thumbnail updated! ✨`);
                fetchUserEvents();
                setTimeout(() => setStatus("idle"), 2000);
            } else {
                setStatus("error");
                setMessage("Failed to update thumbnail.");
            }
        } catch (error) {
            console.error("Error setting cover:", error);
            setStatus("error");
            setMessage("Error updating thumbnail.");
        }
    };

    const handleSubEventCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedEventId || !user) return;

        setStatus("uploading");
        setMessage("Optimizing and uploading cover picture...");

        try {
            const optimizedFile = await compressImage(file);
            if (optimizedFile.size !== file.size) {
                console.log(`[Dashboard] Optimized sub-event cover: ${Math.round(file.size / 1024 / 1024 * 10) / 10}MB -> ${Math.round(optimizedFile.size / 1024 / 1024 * 10) / 10}MB`);
            }

            const uploadResult = await uploadEventImage(optimizedFile, selectedEventId, user.uid || "anonymous");
            await updateEvent(selectedEventId, { coverImage: uploadResult.url });

            setStatus("success");
            setMessage("Cover picture updated! ✨");

            await fetchUserEvents();

            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
        } catch (err: any) {
            console.error("Error uploading sub-event cover:", err);
            setStatus("error");
            setMessage("Failed to update cover picture.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 3000);
        }
    };

    const openUploadForEvent = (eventId: string, title: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("view", "manage");
        // Maintain current level if valid, otherwise assume photos for this specific action context? 
        // Actually, adding images usually implies looking at photos.
        params.set("level", "photos");
        params.set("mode", "add-image");
        params.set("eventId", eventId);

        router.push(`/dashboard?${params.toString()}`);

        // Reset UI transients
        setStatus("idle");
        setMessage("");
    };

    const handleRenameClick = (e: React.MouseEvent, evt: Event) => {
        e.stopPropagation();
        setRenamingEvent(evt);
        setNewTitle(evt.title);
        setNewDate(evt.date || "");
        setActiveMenu(null);
    };

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingEvent || !newTitle.trim()) return;

        // Optimistic Update
        const updatedEvents = userEvents.map(evt =>
            evt.id === renamingEvent.id ? { ...evt, title: newTitle, date: newDate } : evt
        );
        setUserEvents(updatedEvents);

        const currentRenamingEvent = renamingEvent;
        setRenamingEvent(null);
        setNewTitle("");
        setNewDate("");
        setMessage(currentRenamingEvent.type === "sub" ? "Gallery updated! ✍️" : "Event updated! ✍️");
        setStatus("success");
        setTimeout(() => setStatus("idle"), 2000);

        try {
            await updateEvent(currentRenamingEvent.id, { title: newTitle, date: newDate });
            if (currentRenamingEvent.id === selectedEventId) {
                setSelectedEventName(newTitle);
            }
            if (selectedMainEvent && currentRenamingEvent.id === selectedMainEvent.id) {
                setSelectedMainEvent(prev => prev ? { ...prev, title: newTitle, date: newDate } : null);
            }
        } catch (error) {
            console.error("Failed to rename event:", error);
            setMessage("Failed to save changes.");
            setStatus("error");
            // Revert
            setUserEvents(userEvents);
        }
    };

    const handleUpdateTemplate = async (templateId: string) => {
        if (!templateTargetEvent) return;

        setStatus("uploading");
        setMessage("Applying new theme...");

        // Optimistic Update for current list
        const updatedEvents = userEvents.map(evt =>
            evt.id === templateTargetEvent.id ? { ...evt, templateId } : evt
        );
        setUserEvents(updatedEvents);

        try {
            // Update main event
            await updateEvent(templateTargetEvent.id, { templateId });

            // If it's a main event, cascade the update to all its sub-events
            if (templateTargetEvent.type === 'main') {
                setMessage("Updating all galleries matching new theme...");
                const subEvents = await getSubEvents(templateTargetEvent.id);

                // Update all sub-events concurrently
                const updatePromises = subEvents.map(subEvent =>
                    updateEvent(subEvent.id, { templateId })
                );

                await Promise.all(updatePromises);
                console.log(`[Dashboard] Cascaded template change '${templateId}' to ${subEvents.length} sub-events.`);
            }

            setShowTemplateModal(false);
            setTemplateTargetEvent(null);
            setMessage("Theme updated successfully! ✨");
            setStatus("success");
            setTimeout(() => setStatus("idle"), 2000);

            // Refresh to ensure everything is synced
            fetchUserEvents();
        } catch (error) {
            console.error("Failed to update template:", error);
            setMessage("Failed to save changes.");
            setStatus("error");
            // Revert
            fetchUserEvents(); // Re-fetch from server to guarantee correct state
        }
    };



    const handleDeleteEvent = async (eventId: string) => {
        setStatus("uploading");
        setMessage("Deleting event...");

        try {
            const success = await deleteEvent(eventId);
            if (success) {
                setStatus("success");
                setMessage("Event deleted.");
                setShowDeleteConfirm(null);
                setActiveMenu(null);
                fetchUserEvents();
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            } else {
                setStatus("error");
                setMessage("Failed to delete event.");
            }
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage("Error deleting event.");
        }
    };

    const handleDeletePhoto = async (photoId: string) => {
        try {
            const success = await deletePhoto(photoId);
            if (success) {
                setCurrentEventPhotos(prev => prev.filter(p => p.id !== photoId));
                setStatus("success");
                setMessage("Photo removed.");
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            } else {
                setStatus("error");
                setMessage("Failed to delete photo.");
            }
            await fetchStorageStats();
        } catch (error) {
            console.error("Error deleting photo:", error);
            setStatus("error");
            setMessage("Error removing photo.");
        }
    };

    const ownEventIdentifiers = new Set([user.uid, user.email].filter(Boolean) as string[]);
    const activeSubEvent = userEvents.find(e => e.id === selectedEventId);
    const coverUrl = activeSubEvent?.coverImage || "/placeholder-event.jpg";
    const createdEvents = userEvents.filter(evt => evt.createdBy && ownEventIdentifiers.has(evt.createdBy));
    const sharedEvents = userEvents.filter(evt => !evt.createdBy || !ownEventIdentifiers.has(evt.createdBy));
    const permissionMainEvents = userEvents.filter(e => e.type === 'main' || (!e.type && !e.parentId));
    const permissionCreatedEvents = permissionMainEvents.filter(evt => evt.createdBy && ownEventIdentifiers.has(evt.createdBy));
    const permissionOtherEvents = permissionMainEvents.filter(evt => !evt.createdBy || !ownEventIdentifiers.has(evt.createdBy));

    const getEventOwnerEmail = (evt: Event) => {
        if (!evt.createdBy) return "Unknown owner";
        if (evt.createdBy.includes("@")) return evt.createdBy;
        return eventOwners[evt.createdBy]?.email || workspaceOwner?.email || evt.createdBy;
    };

    const getSharedAccessLabel = (evt: Event) => {
        const ownerId = evt.createdBy;
        const isFullManager = !!ownerId && user.roleType === "primary" && (
            user.delegatedBy === ownerId ||
            user.delegatedBy === eventOwners[ownerId]?.email ||
            user.delegatedBy === workspaceOwner?.id
        );

        return isFullManager ? "Full Manager" : "Event Manager";
    };

    const renderEventCard = (evt: Event) => {
        const isSharedEvent = !evt.createdBy || !ownEventIdentifiers.has(evt.createdBy);

        return (
        <motion.div
            key={evt.id}
            whileHover={{ y: -5 }}
            onClick={(e) => {
                if (manageLevel === "events") {
                    navigateWithModifierClick(e, `/dashboard?view=manage&level=event-details&eventId=${evt.id}`, router.push);
                } else {
                    navigateWithModifierClick(e, `/dashboard?view=manage&level=photos&mode=add-image&eventId=${evt.id}`, router.push);
                }
            }}
            className="group relative bg-white aspect-[4/5] rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 border border-stone-100 cursor-pointer"
        >
            <div className="absolute inset-0 overflow-hidden rounded-[2.5rem]">
                <img
                    src={evt.coverImage || '/placeholder-event.jpg'}
                    alt={evt.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:via-black/40 transition-all" />
            </div>

            <div className="absolute top-6 right-6 z-20">
                <Tooltip text="Options">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === evt.id ? null : evt.id);
                        }}
                        className="p-2.5 bg-white/90 backdrop-blur-md shadow-lg hover:bg-white rounded-2xl text-slate-900 transition-all active:scale-95 border border-white/50"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </Tooltip>

                <AnimatePresence>
                    {activeMenu === evt.id && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            className="absolute right-0 mt-3 w-44 bg-white rounded-2xl shadow-2xl border border-stone-100 py-2 z-30 overflow-hidden"
                        >
                            <button
                                onClick={(e) => handleRenameClick(e, evt)}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-stone-50 transition-colors"
                                title="Rename this event"
                            >
                                <Pencil className="w-4 h-4 text-blue-500" />
                                <span>Rename</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openUploadForEvent(evt.id, evt.title);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-stone-50 transition-colors border-t border-stone-50"
                                title="Manage photos for this event"
                            >
                                <Camera className="w-4 h-4 text-purple-500" />
                                <span>Edit Photos</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setTemplateTargetEvent(evt);
                                    setShowTemplateModal(true);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-stone-50 transition-colors border-t border-stone-50 text-royal-gold"
                                title="Change design template"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                <span>Change Template</span>
                            </button>
                            {manageLevel === "events" && (
                                <a
                                    href={`/events/${evt.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenu(null);
                                    }}
                                    className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-stone-50 transition-colors border-t border-stone-50 text-blue-600"
                                    title="Visit public website"
                                >
                                    <Globe className="w-4 h-4" />
                                    <span>Visit Website</span>
                                </a>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const url = `${window.location.origin}/events/${evt.id}?shared=true`;
                                    navigator.clipboard.writeText(url);
                                    setMessage("Share link copied! 🔗");
                                    setStatus("success");
                                    setTimeout(() => setStatus("idle"), 2000);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-stone-50 transition-colors border-t border-stone-50"
                                title="Copy shareable magic link"
                            >
                                <Share2 className="w-4 h-4 text-emerald-500" />
                                <span>Share Link</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteConfirm(evt.id);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-red-50 text-red-600 transition-colors border-t border-stone-50"
                                title="Permanently delete this event"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="absolute bottom-0 left-0 p-8 text-white w-full text-left">
                {isSharedEvent && (
                    <div className="mb-3 space-y-1">
                        <div className="inline-flex max-w-full items-center px-2 py-1 bg-white/20 backdrop-blur-md rounded text-[9px] font-bold uppercase tracking-widest border border-white/20">
                            <span className="truncate">Owner: {getEventOwnerEmail(evt)}</span>
                        </div>
                        <div className="w-fit px-2 py-1 bg-black/30 backdrop-blur-md rounded text-[9px] font-bold uppercase tracking-widest border border-white/10 text-white/90">
                            {getSharedAccessLabel(evt)}
                        </div>
                    </div>
                )}
                {user?.delegatedBy && workspaceOwner && (
                    <div className="mb-2 inline-flex items-center px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-[9px] font-bold uppercase tracking-widest border border-white/20">
                        Managed for: {workspaceOwner.email}
                    </div>
                )}
                <p className="text-xs font-sans font-bold uppercase tracking-[0.2em] text-royal-gold mb-3">{evt.date}</p>
                <h3 className="text-2xl font-bold italic tracking-tight mb-4">{evt.title}</h3>
                <div className="flex items-center text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-y-3 group-hover:translate-y-0 duration-300">
                    {manageLevel === "events" ? (
                        <>
                            <Settings className="w-4 h-4 mr-2" />
                            Manage Event
                        </>
                    ) : (
                        <>
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Manage Photos
                        </>
                    )}
                    <ArrowRight className="w-4 h-4 ml-2" />
                </div>
            </div>
        </motion.div>
        );
    };

    const renderManagedWorkspaceBanner = () => {
        if (!user?.delegatedBy || !workspaceOwner) return null;

        return (
            <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 font-serif">Managed Workspace</h3>
                        <p className="text-sm text-stone-700 font-sans">
                            You are managing the account for <span className="text-amber-700 font-bold">{workspaceOwner.email}</span>
                        </p>
                    </div>
                </div>
                <div className="hidden sm:block">
                    <span className="px-4 py-1.5 bg-white text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200 shadow-sm">
                        {user.roleType === 'primary' ? 'Full Manager' : 'Event Admin'}
                    </span>
                </div>
            </div>
        );
    };

    const renderEventSection = (title: string, items: Event[], showWorkspaceBanner = false) => {
        if (items.length === 0) return null;

        return (
            <section className="space-y-5">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 font-serif">{title}</h3>
                    <p className="text-sm text-stone-600 font-sans">{items.length} {items.length === 1 ? "item" : "items"}</p>
                </div>
                {showWorkspaceBanner && renderManagedWorkspaceBanner()}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {items.map(renderEventCard)}
                </div>
            </section>
        );
    };



    return (
        <div className="min-h-screen bg-royal-cream font-serif text-slate-800">
            <DashboardHeader
                user={user}
                breadcrumbs={[
                    { label: "Dashboard", onClick: view !== "main" ? () => router.push("/dashboard") : undefined },
                    ...(view === "manage" ? [
                        {
                            label: "Manage Events",
                            onClick: manageLevel !== "events" || manageMode !== "list"
                                ? () => router.push("/dashboard?view=manage&level=events")
                                : undefined
                        },
                        ...(manageLevel === "event-details" || manageLevel === "galleries" || (manageLevel === "photos" && selectedMainEvent) ? [
                            {
                                label: selectedMainEvent?.title || "Event Details",
                                onClick: manageLevel !== "event-details"
                                    ? () => router.push(`/dashboard?view=manage&level=event-details&eventId=${selectedMainEvent?.id}`)
                                    : undefined
                            }
                        ] : []),
                        ...(manageLevel === "galleries" ? [
                            { label: "Galleries" }
                        ] : []),
                        ...(manageLevel === "photos" ? [
                            { label: selectedEventName || "Gallery" }
                        ] : []),
                        ...(manageMode === "add-event" ? [
                            { label: manageLevel === "events" ? "New Event" : "New Gallery" }
                        ] : [])
                    ] : []),
                    ...(view === "permissions" ? [
                        { label: "Permissions" }
                    ] : [])
                ]}
                onBack={() => {
                    if (manageMode !== "list") {
                        // Go back to the list view of the current level
                        const params = new URLSearchParams(searchParams);
                        params.delete("mode"); // Remove 'add-event' or 'add-image'
                        router.push(`/dashboard?${params.toString()}`);
                    } else if (view === "manage") {
                        if (manageLevel === "photos") {
                            // Back to Galleries list
                            router.push(`/dashboard?view=manage&level=galleries&eventId=${selectedMainEvent?.id}`);
                        } else if (manageLevel === "galleries") {
                            // Back to Event Hub
                            router.push(`/dashboard?view=manage&level=event-details&eventId=${selectedMainEvent?.id}`);
                        } else if (manageLevel === "event-details") {
                            // Back to Main Event List
                            router.push("/dashboard?view=manage&level=events");
                        } else {
                            // Back to Main Dashboard
                            router.push("/dashboard");
                        }
                    } else if (view === "permissions") {
                        router.push("/dashboard");
                    } else {
                        router.push("/");
                    }
                }}
                onShare={(manageLevel === "photos" && selectedEventId) ? () => {
                    const url = `${window.location.origin}/events/${selectedEventId}?shared=true`;
                    navigator.clipboard.writeText(url);
                    setMessage("Share link copied! 🔗");
                    setStatus("success");
                    setTimeout(() => setStatus("idle"), 2000);
                } : undefined}
                logout={logout}
                showChevron={view !== "main"}
            />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <AnimatePresence mode="wait">
                    {view === "main" ? (
                        <motion.div
                            key="main-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="mb-12">
                                <h2 className="text-3xl font-bold mb-2">Welcome back, {user.name.split(' ')[0]}!</h2>
                                <p className="text-slate-700 font-sans">Everything you need to manage your personal memories.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-slate-800">
                                <OptionCard
                                    title="View Gallery"
                                    description="Browse through your captured memories and event albums."
                                    icon={Eye}
                                    href="/gallery"
                                    color="bg-blue-50 text-blue-600"
                                    hoverBorder="hover:border-blue-200"
                                    actionTitle="Open your public gallery"
                                />
                                <OptionCard
                                    title="Manage Gallery"
                                    description="Create events and upload photos to your galleries."
                                    icon={Settings}
                                    href="/dashboard?view=manage&level=events"
                                    color="bg-purple-50 text-purple-600"
                                    hoverBorder="hover:border-purple-200"
                                    actionTitle="Manage your events and photos"
                                />
                                <OptionCard
                                    title="Permissions"
                                    description="Control who can access and view your private galleries."
                                    icon={ShieldCheck}
                                    href="/dashboard?view=permissions"
                                    color="bg-emerald-50 text-emerald-600"
                                    hoverBorder="hover:border-emerald-200"
                                    actionTitle="Manage user access and roles"
                                />
                                <OptionCard
                                    title="Join Event"
                                    description="Got a secret code? Enter it here to join a private event album."
                                    icon={UserPlus}
                                    onClick={() => setIsJoinModalOpen(true)}
                                    color="bg-blue-50 text-blue-600"
                                    hoverBorder="hover:border-blue-200"
                                    actionTitle="Enter a join code"
                                />
                                <OptionCard
                                    title="About Us"
                                    description="Learn more about our platform and our mission."
                                    icon={Info}
                                    href="/"
                                    color="bg-amber-50 text-amber-600"
                                    hoverBorder="hover:border-amber-200"
                                    actionTitle="Learn about Lens & Frame"
                                />
                            </div>
                        </motion.div>
                    ) : view === "manage" ? (
                        <motion.div
                            key="manage-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2 uppercase tracking-wide">
                                        {manageLevel === "events" ? "Your Events" : "Galleries"}
                                    </h2>
                                    <p className="text-slate-700 font-sans">
                                        {manageLevel === "events"
                                            ? "Organize your wedding into high-level events."
                                            : `Galleries within ${selectedMainEvent?.title}`
                                        }
                                    </p>
                                </div>

                                {/* Storage Stat */}
                                <div className="hidden md:flex bg-white/50 backdrop-blur-sm px-6 py-4 rounded-[2rem] border border-stone-100 shadow-sm items-center space-x-4">
                                    <div className="w-10 h-10 bg-royal-gold/10 rounded-xl flex items-center justify-center">
                                        <ImageIcon className="w-5 h-5 text-royal-gold" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-600 leading-none mb-1">Total Storage</p>
                                        <p className="text-lg font-bold text-slate-900 leading-none">
                                            {(() => {
                                                const k = 1024;
                                                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                                if (totalStorage === 0) return '0 MB';
                                                const i = Math.floor(Math.log(totalStorage) / Math.log(k));
                                                return parseFloat((totalStorage / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                            })()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex space-x-3">
                                    <Tooltip text={`Create new ${manageLevel === "events" ? "event" : "gallery"}`}>
                                        <button
                                            onClick={() => {
                                                // Preserve existing params but add mode=add-event
                                                const params = new URLSearchParams(searchParams);
                                                params.set("mode", "add-event");
                                                router.push(`/dashboard?${params.toString()}`);

                                                // Reset generic UI state
                                                setStatus("idle");
                                                setMessage("");
                                                setSelectedTemplate("hero");
                                            }}
                                            className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Create {manageLevel === "events" ? "Event" : "Gallery"}</span>
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>

                            {manageMode === "list" && (
                                <div className="space-y-8">
                                    {loadingEvents ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {Array.from({ length: 3 }).map((_, i) => (
                                                <div key={i} className="animate-pulse bg-white aspect-[4/5] rounded-3xl" />
                                            ))}
                                        </div>
                                    ) : userEvents.length === 0 ? (
                                        <div className="py-20 bg-white rounded-3xl border border-dashed border-stone-300 flex flex-col items-center justify-center text-center">
                                            <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6">
                                                <Camera className="w-10 h-10 text-stone-600" />
                                            </div>
                                            <h3 className="text-xl font-bold mb-2">No galleries found</h3>
                                            <p className="text-stone-700 max-w-xs mx-auto mb-8 font-sans">Create your first event by clicking the button above.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-12">
                                            {renderEventSection(manageLevel === "events" ? "Your Created Events" : "Your Created Galleries", createdEvents)}
                                            {renderEventSection(manageLevel === "events" ? "Shared Events" : "Shared Galleries", sharedEvents, true)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {manageMode === "add-event" && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="max-w-lg mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-stone-100"
                                >
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-2xl font-bold italic tracking-tight">New Event</h3>
                                        <Tooltip text="Back to list">
                                            <button
                                                onClick={() => {
                                                    const params = new URLSearchParams(searchParams);
                                                    params.set("mode", "list");
                                                    router.push(`/dashboard?${params.toString()}`);
                                                }}
                                                className="text-stone-600 hover:text-stone-600 transition-colors"
                                            >
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                        </Tooltip>
                                    </div>

                                    <form onSubmit={handleCreateEventOnly} className="space-y-8">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">What is the occasion?</label>
                                            <input
                                                type="text"
                                                value={eventName}
                                                onChange={(e) => setEventName(e.target.value)}
                                                placeholder="e.g. Dream Wedding 2024"
                                                className="w-full px-6 py-5 bg-stone-50 border border-stone-200 rounded-3xl focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all outline-none text-xl font-medium"
                                                required
                                                autoFocus
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">Date</label>
                                            <input
                                                type="text"
                                                value={eventDate}
                                                onChange={(e) => setEventDate(e.target.value)}
                                                placeholder="e.g. 12 May 2026"
                                                className="w-full px-6 py-5 bg-stone-50 border border-stone-200 rounded-3xl focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all outline-none text-xl font-medium"
                                            />
                                        </div>

                                        {manageLevel === "events" && (
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">Choose Style</label>
                                                <div className="grid grid-cols-3 gap-4">
                                                    {TEMPLATE_THEMES.map((theme) => (
                                                        <div
                                                            key={theme.id}
                                                            onClick={() => setSelectedTemplate(theme.id)}
                                                            className={`cursor-pointer border-2 rounded-xl p-3 text-center transition-all ${selectedTemplate === theme.id ? 'border-royal-gold bg-royal-gold/5 ring-2 ring-royal-gold/20' : 'border-stone-100 hover:border-stone-300'}`}
                                                        >
                                                            <div className={`w-full aspect-square rounded-lg mb-2 shadow-sm ${theme.id === 'pop' ? 'bg-[#ffe84a] border-2 border-black' : (theme.id === 'hero' ? 'bg-slate-900 border-2 border-slate-900' : 'bg-black border-2 border-black')}`}>
                                                                {/* Mini preview text */}
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <span className={`text-[10px] ${theme.id === 'pop' ? 'text-black font-black font-sans uppercase' : (theme.id === 'hero' ? 'text-white font-serif' : 'text-white font-serif')}`}>
                                                                        {theme.id === 'pop' ? 'POP!' : 'Aa'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-bold capitalize text-slate-700">{theme.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={status === "uploading"}
                                            className={cn(
                                                "w-full py-5 rounded-[1.5rem] font-bold text-lg shadow-lg transition-all flex items-center justify-center space-x-3 active:scale-95",
                                                status === "uploading" ? "bg-stone-300 text-stone-700 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
                                            )}
                                        >
                                            {status === "uploading" ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Creating...</span>
                                                </>
                                            ) : (
                                                <span>Create {manageLevel === "events" ? "Event" : "Gallery"}</span>
                                            )}
                                        </button>

                                        {message && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={cn(
                                                    "p-4 rounded-2xl text-sm font-bold text-center",
                                                    status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                                                )}
                                            >
                                                {message}
                                            </motion.div>
                                        )}
                                    </form>
                                </motion.div>
                            )}

                            {manageMode === "add-image" && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="max-w-7xl mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-stone-100"
                                >
                                    {/* Sub-event Cover Banner */}
                                    <div className="relative w-full h-64 md:h-80 rounded-[2rem] overflow-hidden mb-8 group/cover shadow-md border border-stone-100">
                                        <img
                                            src={coverUrl}
                                            alt={`${selectedEventName} Cover`}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-105"
                                        />
                                        {/* Elegant dark overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40 transition-opacity duration-300" />
                                        
                                        {/* Floating Glassmorphic "Change Cover" Button */}
                                        <div className="absolute top-6 right-6 z-10">
                                            <label className="flex items-center space-x-2 px-5 py-3 bg-white/20 hover:bg-white/30 active:bg-white/40 backdrop-blur-md text-white rounded-full text-sm font-bold cursor-pointer transition-all border border-white/30 shadow-lg active:scale-95">
                                                <Camera className="w-4 h-4" />
                                                <span>Change Cover</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleSubEventCoverUpload}
                                                    className="hidden"
                                                    disabled={status === "uploading"}
                                                />
                                            </label>
                                        </div>

                                        {/* Information overlay */}
                                        <div className="absolute bottom-6 left-8 right-8 flex items-end justify-between">
                                            <div className="text-white">
                                                <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-royal-gold">Sub-Event Cover</span>
                                                <div className="flex items-center space-x-3 mt-1">
                                                    <h4 className="text-2xl md:text-3xl font-bold font-serif tracking-tight">{selectedEventName}</h4>
                                                    <button
                                                        onClick={(e) => {
                                                            if (activeSubEvent) {
                                                                handleRenameClick(e, activeSubEvent);
                                                            }
                                                        }}
                                                        className="p-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-white transition-all active:scale-95 border border-white/20"
                                                        title="Rename sub-event"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                {activeSubEvent?.date && (
                                                    <p className="text-xs text-stone-200 mt-1.5 font-sans flex items-center gap-1.5">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-royal-gold" />
                                                        {activeSubEvent.date}
                                                     </p>
                                                 )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
                                        <div>
                                            <h3 className="text-3xl font-bold tracking-tight">Gallery Editor</h3>
                                            <p className="text-slate-700 font-sans mt-1">Managing memories for <span className="text-slate-900 font-bold underline decoration-royal-gold decoration-2 underline-offset-4">{selectedEventName}</span></p>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            {/* View Toggle */}
                                            <div className="bg-stone-50 p-1 rounded-2xl flex items-center">
                                                <Tooltip text="Grid View">
                                                    <button
                                                        onClick={() => setGalleryViewMode("grid")}
                                                        className={cn(
                                                            "p-2 rounded-xl transition-all",
                                                            galleryViewMode === "grid" ? "bg-white shadow-sm text-slate-900" : "text-stone-600 hover:text-stone-600"
                                                        )}
                                                    >
                                                        <LayoutGrid className="w-5 h-5" />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip text="List View">
                                                    <button
                                                        onClick={() => setGalleryViewMode("list")}
                                                        className={cn(
                                                            "p-2 rounded-xl transition-all",
                                                            galleryViewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-stone-600 hover:text-stone-600"
                                                        )}
                                                    >
                                                        <List className="w-5 h-5" />
                                                    </button>
                                                </Tooltip>
                                            </div>

                                            <Tooltip text="Back to galleries">
                                                <button
                                                    onClick={() => {
                                                        const params = new URLSearchParams(searchParams);
                                                        params.set("mode", "list");
                                                        router.push(`/dashboard?${params.toString()}`);
                                                    }}
                                                    className="p-3 bg-stone-50 hover:bg-stone-100 text-stone-600 hover:text-stone-600 rounded-2xl transition-all active:scale-95"
                                                >
                                                    <ChevronLeft className="w-6 h-6" />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </div>

                                    {message && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "mb-8 p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center space-x-2",
                                                status === "success" ? "bg-green-50 text-green-700" :
                                                    status === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                                            )}
                                        >
                                            {status === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
                                            <span>{message}</span>
                                        </motion.div>
                                    )}

                                    {galleryViewMode === "grid" ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {/* Existing Photos Grid */}
                                            {currentEventPhotos.map((photo) => {
                                                const isCover = userEvents.find(ev => ev.id === selectedEventId)?.coverImage === photo.url;
                                                return (
                                                    <motion.div
                                                        key={photo.id}
                                                        layout
                                                        className="group relative aspect-square bg-stone-100 shadow-sm border border-stone-100 cursor-zoom-in"
                                                        onClick={() => setViewingPhoto({
                                                            id: photo.id,
                                                            src: photo.url,
                                                            cloudinaryPublicId: photo.cloudinaryPublicId,
                                                            width: photo.width,
                                                            height: photo.height,
                                                            filename: photo.cloudinaryPublicId?.split('/').pop() || "photo"
                                                        })}
                                                    >
                                                        {/* Inner Clipping Container for Photo */}
                                                        <div className="absolute inset-0 overflow-hidden">
                                                            <img
                                                                src={photo.url}
                                                                alt="Gallery item"
                                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                            />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>

                                                        {/* Set as Gallery Cover Button */}
                                                        <div className="absolute top-3 left-3 z-10">
                                                            <Tooltip text={isCover ? "Current Gallery Thumbnail" : "Make it Gallery thumbnail"}>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleSetAsCover(photo.url); }}
                                                                    className={cn(
                                                                        "p-2.5 backdrop-blur-md rounded-xl shadow-lg transition-all active:scale-90",
                                                                        isCover
                                                                            ? "bg-royal-gold text-white opacity-100"
                                                                            : "bg-white/90 text-royal-gold opacity-0 group-hover:opacity-100 hover:bg-royal-gold/10"
                                                                    )}
                                                                >
                                                                    <ImageIcon className="w-4 h-4" />
                                                                </button>
                                                            </Tooltip>
                                                        </div>

                                                        {/* Set as Main Event Cover Button */}
                                                        {selectedMainEvent && (
                                                            <div className="absolute top-3 left-14 z-10">
                                                                <Tooltip text={selectedMainEvent.coverImage === photo.url ? "Current Main Event Thumbnail" : "Make it Main Event thumbnail"}>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleSetAsCover(photo.url, selectedMainEvent.id, true); }}
                                                                        className={cn(
                                                                            "p-2.5 backdrop-blur-md rounded-xl shadow-lg transition-all active:scale-90",
                                                                            selectedMainEvent.coverImage === photo.url
                                                                                ? "bg-royal-gold text-white opacity-100"
                                                                                : "bg-white/90 text-royal-gold opacity-0 group-hover:opacity-100 hover:bg-royal-gold/10"
                                                                        )}
                                                                    >
                                                                        <Star className="w-4 h-4" />
                                                                    </button>
                                                                </Tooltip>
                                                            </div>
                                                        )}

                                                        {/* Delete Button */}
                                                        <div className="absolute top-3 right-3 z-10">
                                                            <Tooltip text="Delete Image">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                                                                    className="p-2.5 bg-white/90 backdrop-blur-md rounded-xl text-red-500 shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-95 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </Tooltip>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}

                                            {/* Loading Skeletons for current fetching */}
                                            {loadingPhotos && currentEventPhotos.length === 0 && (
                                                Array.from({ length: 4 }).map((_, i) => (
                                                    <div key={i} className="aspect-square bg-stone-50 rounded-[2rem] animate-pulse border border-stone-100" />
                                                ))
                                            )}

                                            {/* Add Image Button */}
                                            <motion.label
                                                layout
                                                className={cn(
                                                    "relative aspect-square rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-stone-50 group",
                                                    status === "uploading" ? "border-royal-gold/50 bg-royal-gold/5" : "border-stone-200"
                                                )}
                                                title="Click to select photos to upload"
                                            >
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    disabled={status === "uploading"}
                                                />
                                                {status === "uploading" ? (
                                                    <div className="flex flex-col items-center text-royal-gold">
                                                        <Loader2 className="w-10 h-10 animate-spin mb-3" />
                                                        <span className="text-xs font-bold uppercase tracking-widest">Adding...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center text-stone-600 group-hover:text-slate-900 transition-colors">
                                                        <div className="p-4 bg-stone-50 rounded-2xl mb-3 group-hover:bg-white group-hover:shadow-md transition-all">
                                                            <Plus className="w-8 h-8" />
                                                        </div>
                                                        <span className="text-xs font-bold uppercase tracking-widest">Add Photos</span>
                                                    </div>
                                                )}
                                            </motion.label>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Add Image Option as List Item */}
                                            <motion.label
                                                className={cn(
                                                    "flex items-center p-6 border-2 border-dashed rounded-3xl cursor-pointer transition-all hover:bg-stone-50 group",
                                                    status === "uploading" ? "border-royal-gold/50 bg-royal-gold/5" : "border-stone-200"
                                                )}
                                            >
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    disabled={status === "uploading"}
                                                />
                                                <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-white transition-all">
                                                    {status === "uploading" ? (
                                                        <Loader2 className="w-6 h-6 text-royal-gold animate-spin" />
                                                    ) : (
                                                        <Plus className="w-6 h-6 text-stone-600 group-hover:text-slate-900" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">Add New Photos</p>
                                                    <p className="text-sm text-stone-600">Click to upload memories to this gallery</p>
                                                </div>
                                            </motion.label>

                                            <div className="bg-white rounded-[2.5rem] border border-stone-100 overflow-hidden shadow-sm">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-stone-50/50 border-b border-stone-100">
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-stone-600">Preview</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-stone-600">Technical Details</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-stone-600">Metadata</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-stone-600 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-stone-50">
                                                            {currentEventPhotos.map((photo) => {
                                                                const isCover = userEvents.find(ev => ev.id === selectedEventId)?.coverImage === photo.url;
                                                                const dateAdded = (
                                                                    photo.uploadedAt && typeof photo.uploadedAt === 'number'
                                                                        ? new Date(photo.uploadedAt)
                                                                        : photo.uploadedAt?.toDate?.() || new Date()
                                                                ).toLocaleDateString('en-GB', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                });

                                                                // Fallback for format if missing (for legacy photos)
                                                                let displayFormat = photo.format;
                                                                if (!displayFormat && photo.url) {
                                                                    const ext = photo.url.split('.').pop()?.split('?')[0].toLowerCase();
                                                                    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
                                                                        displayFormat = ext === 'jpeg' ? 'jpg' : ext;
                                                                    }
                                                                }

                                                                const formatSize = (bytes?: number) => {
                                                                    if (!bytes) return 'Legacy Photo';
                                                                    const k = 1024;
                                                                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                                                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                                                                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                                                };

                                                                return (
                                                                    <tr key={photo.id} className="hover:bg-stone-50/50 transition-colors group">
                                                                        <td className="px-8 py-6">
                                                                            <div
                                                                                className="w-32 h-32 rounded-[1.5rem] overflow-hidden cursor-zoom-in shadow-md border border-stone-100 group-hover:scale-105 transition-transform"
                                                                                onClick={() => setViewingPhoto({
                                                                                    id: photo.id,
                                                                                    src: photo.url,
                                                                                    cloudinaryPublicId: photo.cloudinaryPublicId,
                                                                                    width: photo.width,
                                                                                    height: photo.height,
                                                                                    filename: photo.cloudinaryPublicId?.split('/').pop() || "photo"
                                                                                })}
                                                                            >
                                                                                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-stone-600 w-20">Resolution:</span>
                                                                                    <span className="font-bold text-slate-700">{photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'N/A'}</span>
                                                                                </div>
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-stone-600 w-20">File Size:</span>
                                                                                    <span className={cn("font-bold text-slate-700", !photo.size && "text-stone-600 font-normal italic")}>
                                                                                        {formatSize(photo.size)}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-stone-600 w-20">Format:</span>
                                                                                    <span className="font-bold text-slate-700 uppercase">{displayFormat || 'N/A'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-stone-600 w-20">Added On:</span>
                                                                                    <span className="font-bold text-slate-700">{dateAdded}</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2 pt-1">
                                                                                    {isCover && (
                                                                                        <span className="px-2 py-0.5 bg-royal-gold/10 text-royal-gold text-[9px] font-bold uppercase rounded-md border border-royal-gold/20">
                                                                                            Gallery Thumb
                                                                                        </span>
                                                                                    )}
                                                                                    {selectedMainEvent?.coverImage === photo.url && (
                                                                                        <span className="px-2 py-0.5 bg-slate-900/10 text-slate-900 text-[9px] font-bold uppercase rounded-md border border-slate-900/20">
                                                                                            Event Thumb
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6 text-right">
                                                                            <div className="flex items-center justify-end space-x-2">
                                                                                <Tooltip text={isCover ? "Current Gallery Thumbnail" : "Make it Gallery thumbnail"}>
                                                                                    <button
                                                                                        onClick={() => handleSetAsCover(photo.url)}
                                                                                        className={cn(
                                                                                            "p-2.5 rounded-xl transition-all active:scale-95",
                                                                                            isCover ? "bg-royal-gold text-white shadow-lg" : "bg-white text-stone-600 hover:text-royal-gold hover:bg-royal-gold/5 border border-stone-200"
                                                                                        )}
                                                                                    >
                                                                                        <ImageIcon className="w-4 h-4" />
                                                                                    </button>
                                                                                </Tooltip>
                                                                                {selectedMainEvent && (
                                                                                    <Tooltip text={selectedMainEvent.coverImage === photo.url ? "Current Main Event Thumbnail" : "Make it Main Event thumbnail"}>
                                                                                        <button
                                                                                            onClick={() => handleSetAsCover(photo.url, selectedMainEvent.id, true)}
                                                                                            className={cn(
                                                                                                "p-2.5 rounded-xl transition-all active:scale-95",
                                                                                                selectedMainEvent.coverImage === photo.url ? "bg-royal-gold text-white shadow-lg" : "bg-white text-stone-600 hover:text-royal-gold hover:bg-royal-gold/5 border border-stone-200"
                                                                                            )}
                                                                                        >
                                                                                            <Star className="w-4 h-4" />
                                                                                        </button>
                                                                                    </Tooltip>
                                                                                )}
                                                                                <Tooltip text="Delete Image">
                                                                                    <button
                                                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                                                        className="p-2.5 bg-white text-stone-600 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95 border border-stone-200"
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    </button>
                                                                                </Tooltip>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {currentEventPhotos.length === 0 && !loadingPhotos && (
                                                    <div className="p-12 text-center">
                                                        <p className="text-stone-600 italic">No photos in this gallery yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="permissions-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {view === "permissions" && (
                                <div className="space-y-12">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-slate-900 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl shadow-slate-200">
                                                <ShieldCheck size={24} />
                                            </div>
                                            <div>
                                                <h2 className="text-3xl font-bold mb-1 font-serif text-slate-800">Permissions & Traffic</h2>
                                                <p className="text-slate-700 font-sans text-sm">Manage your team and monitor guest access.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {/* Primary Admins Section */}
                                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100">
                                            <div className="flex items-center justify-between mb-8">
                                                <div>
                                                    <h3 className="text-2xl font-bold text-slate-800 font-serif">Premium Users (Primary)</h3>
                                                    <p className="text-stone-600 text-sm font-sans uppercase tracking-widest mt-1">Full account management access</p>
                                                </div>
                                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                                                    <Crown size={24} />
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                {allUsers.filter(u => (u.delegatedBy === user?.uid || u.id === user?.uid) && (u.roleType === 'primary' || u.id === user?.uid)).length > 0 ? (
                                                    allUsers.filter(u => (u.delegatedBy === user?.uid || u.id === user?.uid) && (u.roleType === 'primary' || u.id === user?.uid)).map((u) => (
                                                        <div key={u.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 group hover:bg-white hover:shadow-md transition-all duration-300">
                                                            <div className="flex items-center space-x-4">
                                                                <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base">
                                                                    {u.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="text-slate-800 font-bold text-base">{u.name} {u.id === user?.uid && "(You)"}</p>
                                                                    <p className="text-stone-600 text-xs font-sans">{u.email}</p>
                                                                </div>
                                                            </div>
                                                            {u.id !== user?.uid && (
                                                                <button
                                                                    onClick={() => handleUpdateUserRole(u.id, "revoke")}
                                                                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                                                                >
                                                                    Revoke
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-10 text-center border-2 border-dashed border-stone-100 rounded-3xl">
                                                        <p className="text-stone-600 text-base font-sans italic">No premium users assigned yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Events Hierarchy Section */}
                                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100">
                                            <div className="flex items-center justify-between mb-8">
                                                <div>
                                                    <h3 className="text-2xl font-bold text-slate-800 font-serif">Event Administrators & Guests</h3>
                                                    <p className="text-stone-600 text-sm font-sans uppercase tracking-widest mt-1">Management per event</p>
                                                </div>
                                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                                                    <Calendar size={24} />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {loadingEvents ? (
                                                    <div className="flex items-center justify-center py-12">
                                                        <RefreshCw className="w-8 h-8 animate-spin text-stone-300" />
                                                    </div>
                                                ) : permissionMainEvents.length > 0 ? (
                                                    [
                                                        { title: "Events Created by You", events: permissionCreatedEvents, groupByOwner: false },
                                                        { title: "Events Created by Others", events: permissionOtherEvents, groupByOwner: true }
                                                    ].filter(section => section.events.length > 0).map(section => (
                                                        <div key={section.title} className="space-y-3">
                                                            <div className="px-1">
                                                                <h4 className="text-lg font-bold text-slate-800 font-serif">{section.title}</h4>
                                                                <p className="text-xs text-stone-600 font-sans uppercase tracking-widest mt-1">
                                                                    {section.events.length} {section.events.length === 1 ? "event" : "events"}
                                                                </p>
                                                            </div>
                                                            {(section.groupByOwner
                                                                ? Object.entries(section.events.reduce<Record<string, Event[]>>((groups, event) => {
                                                                    const ownerEmail = getEventOwnerEmail(event);
                                                                    if (!groups[ownerEmail]) groups[ownerEmail] = [];
                                                                    groups[ownerEmail].push(event);
                                                                    return groups;
                                                                }, {}))
                                                                : [["", section.events] as [string, Event[]]]
                                                            ).map(([ownerEmail, events]) => (
                                                                <div key={ownerEmail || section.title} className="space-y-3">
                                                                    {section.groupByOwner && (
                                                                        <div className="px-1 pt-2">
                                                                            <h5 className="text-sm font-bold text-slate-800 font-sans">{ownerEmail}</h5>
                                                                            <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mt-1">
                                                                                {events.length} shared {events.length === 1 ? "event" : "events"}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {events.map(event => {
                                                        const isMainExpanded = expandedMainEvents.has(event.id);
                                                        const isOtherUserEvent = !event.createdBy || !ownEventIdentifiers.has(event.createdBy);
                                                        const eventAdmins = allUsers.filter(u =>
                                                            u.delegatedBy === user?.uid &&
                                                            u.roleType === 'event' &&
                                                            u.assignedEvents?.includes(event.id)
                                                        );
                                                        const eventLogs = trafficLogs.filter(log => (log.parentEventId === event.id || log.eventId === event.id));
                                                        const pendingCount = eventLogs.filter(l => l.status === 'pending').length;

                                                        return (
                                                            <div key={event.id} className="relative">
                                                                {isMainExpanded && (eventAdmins.length > 0 || eventLogs.length > 0) && (
                                                                    <div className="absolute left-7 top-14 bottom-6 w-px bg-stone-100"></div>
                                                                )}
                                                                
                                                                <div className="flex items-center justify-between p-4 sm:p-5 bg-stone-50/50 hover:bg-slate-50/50 rounded-[1.5rem] transition-all border border-stone-100/50 group/event">
                                                                    <div className="flex items-center flex-1">
                                                                        <button
                                                                            onClick={() => toggleMainEvent(event.id)}
                                                                            className={cn(
                                                                                "mr-3 w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                                                                                isMainExpanded ? "bg-slate-200 text-slate-700" : "bg-white text-stone-500 hover:text-slate-600 border border-stone-200"
                                                                            )}
                                                                        >
                                                                            {isMainExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                        </button>
                                                                        <div className="w-10 h-10 rounded-xl bg-white border border-stone-100 flex items-center justify-center mr-3 shadow-sm">
                                                                            <Calendar className="w-5 h-5 text-stone-500" />
                                                                        </div>
                                                                        <div>
                                                                            {isOtherUserEvent && !section.groupByOwner && (
                                                                                <p className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mb-1">
                                                                                    Shared by {getEventOwnerEmail(event)}
                                                                                </p>
                                                                            )}
                                                                            <span className="text-base font-bold text-slate-800">{event.title}</span>
                                                                            <div className="flex items-center space-x-2 mt-1">
                                                                                {eventAdmins.length > 0 && (
                                                                                    <span className="text-xs text-teal-600 font-bold">• {eventAdmins.length} Admin{eventAdmins.length > 1 ? "s" : ""}</span>
                                                                                )}
                                                                                {eventLogs.length > 0 && (
                                                                                    <span className="text-xs text-amber-600 font-bold">• {eventLogs.length} Visit{eventLogs.length > 1 ? "s" : ""}</span>
                                                                                )}
                                                                                {pendingCount > 0 && (
                                                                                    <span className="text-xs text-rose-500 font-bold">• {pendingCount} Pending</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {isMainExpanded && (
                                                                    <div className="pl-12 pr-4 py-3 space-y-5">
                                                                        {/* Event Admins */}
                                                                        <div className="mb-2">
                                                                            <div 
                                                                                className="flex items-center space-x-1 text-xs font-bold text-teal-600 uppercase tracking-widest mb-2 px-1 cursor-pointer hover:text-teal-700 transition-colors w-fit"
                                                                                onClick={() => toggleEventAdmins(event.id)}
                                                                            >
                                                                                {expandedEventAdmins.has(event.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                                <UserCog className="w-3.5 h-3.5" />
                                                                                <span>Event Admins ({eventAdmins.length})</span>
                                                                            </div>
                                                                            {expandedEventAdmins.has(event.id) && (
                                                                                <div className="mt-2 space-y-2 pl-4 border-l border-teal-100 ml-2">
                                                                                    {eventAdmins.length > 0 ? (
                                                                                        eventAdmins.map(ea => (
                                                                                            <div key={ea.id} className="flex items-center p-3 bg-white border border-stone-100 rounded-xl group/ea hover:border-stone-200 transition-all">
                                                                                                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center mr-3">
                                                                                                    <UserCog className="w-4 h-4 text-teal-600" />
                                                                                                </div>
                                                                                                <div>
                                                                                                    <span className="text-sm font-bold text-slate-800">{ea.name || "Unnamed"}</span>
                                                                                                    <p className="text-xs text-stone-600">{ea.email}</p>
                                                                                                </div>
                                                                                                <div className="ml-auto flex items-center gap-2">
                                                                                                    <button
                                                                                                        onClick={() => handleUpdateUserRole(ea.id, "user", "primary", [])}
                                                                                                        className="px-3 py-2 bg-royal-gold/10 text-royal-gold text-[10px] font-bold uppercase rounded-lg hover:bg-royal-gold/20 transition-colors"
                                                                                                    >
                                                                                                        Make Primary Admin
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() => handleUpdateUserRole(ea.id, "revoke")}
                                                                                                        className="px-3 py-2 bg-rose-50 text-rose-600 text-[10px] font-bold uppercase rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1"
                                                                                                        title="Revoke Admin"
                                                                                                    >
                                                                                                        <UserMinus size={14} />
                                                                                                        <span>Make Guest</span>
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))
                                                                                    ) : (
                                                                                        <p className="text-xs text-stone-500 italic px-2">No admins assigned.</p>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Event Guests */}
                                                                        <div className="mb-2">
                                                                            <div 
                                                                                className="flex items-center space-x-1 text-xs font-bold text-amber-600 uppercase tracking-widest mb-2 px-1 cursor-pointer hover:text-amber-700 transition-colors w-fit"
                                                                                onClick={() => toggleEventGuests(event.id)}
                                                                            >
                                                                                {expandedEventGuests.has(event.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                                <Users className="w-3.5 h-3.5" />
                                                                                <span>Guest Users ({eventLogs.length})</span>
                                                                            </div>
                                                                            {expandedEventGuests.has(event.id) && (
                                                                                <div className="mt-2 space-y-2 pl-4 border-l border-amber-100 ml-2">
                                                                                    {eventLogs.length > 0 ? (
                                                                                        [...eventLogs].sort((a, b) => b.loginAt?.seconds - a.loginAt?.seconds).map(log => {
                                                                                            const loginDate = log.loginAt ? new Date(log.loginAt.seconds * 1000).toLocaleString('en-IN', {
                                                                                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                                                            }) : 'Unknown';

                                                                                            const isEmailMethod = log.phone?.includes('@');
                                                                                            const displayMethod = isEmailMethod ? "Email" : "Mobile";
                                                                                            
                                                                                            // Find matching registered user to allow admin promotion
                                                                                            const matchingUser = allUsers.find(u => 
                                                                                                (isEmailMethod && u.email === log.phone) || 
                                                                                                (!isEmailMethod && u.phone === log.phone)
                                                                                            );

                                                                                            const isPrimaryAdmin = matchingUser?.roleType === 'primary' && matchingUser?.delegatedBy === user?.uid;
                                                                                            const isEventAdmin = matchingUser?.roleType === 'event' && matchingUser?.delegatedBy === user?.uid && matchingUser?.assignedEvents?.includes(event.id);
                                                                                            const isAdmin = isPrimaryAdmin || isEventAdmin;

                                                                                            return (
                                                                                                <div key={log.id} className="flex items-center p-3 bg-white border border-stone-100 rounded-xl group/g hover:border-stone-200 transition-all">
                                                                                                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mr-3">
                                                                                                        <span className="text-xs font-bold text-amber-700">{(log.name || 'G').charAt(0)}</span>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <p className="font-bold text-slate-800 text-sm">{log.name || 'Anonymous'}</p>
                                                                                                        <div className="flex items-center space-x-2 text-xs text-stone-600 font-sans mt-0.5">
                                                                                                            <span className="truncate max-w-[150px]">{log.phone || 'N/A'}</span>
                                                                                                            <span>•</span>
                                                                                                            <span className="font-bold uppercase tracking-widest text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md text-[10px]">{displayMethod}</span>
                                                                                                            <span>•</span>
                                                                                                            <span>{loginDate}</span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div className="ml-auto flex items-center space-x-2">
                                                                                                        {log.status === 'pending' ? (
                                                                                                            <>
                                                                                                                <button onClick={() => handleGuestStatusUpdate(log.id, 'approved')} className="px-4 py-2 bg-emerald-50 text-emerald-600 text-xs font-bold uppercase rounded-lg hover:bg-emerald-100 transition-all">Approve View</button>
                                                                                                                <button onClick={() => handleGuestStatusUpdate(log.id, 'rejected')} className="px-4 py-2 bg-rose-50 text-rose-600 text-xs font-bold uppercase rounded-lg hover:bg-rose-100 transition-all">Deny</button>
                                                                                                            </>
                                                                                                        ) : (
                                                                                                            <span className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest", log.status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                                                                                                                {log.status === 'approved' ? 'View Access' : log.status}
                                                                                                            </span>
                                                                                                        )}

                                                                                                        {matchingUser && (
                                                                                                            <>
                                                                                                                <div className="h-4 w-px bg-stone-200 mx-1"></div>
                                                                                                                {isAdmin ? (
                                                                                                                    <>
                                                                                                                        <span className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-slate-100 text-slate-600">
                                                                                                                            {isPrimaryAdmin ? "Primary Admin" : "Event Admin"}
                                                                                                                        </span>
                                                                                                                        {isPrimaryAdmin ? (
                                                                                                                            <button
                                                                                                                                onClick={() => handleUpdateUserRole(matchingUser.id, "user", "event", [event.id])}
                                                                                                                                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase rounded-lg hover:bg-slate-800 transition-all"
                                                                                                                            >
                                                                                                                                Make Event Admin
                                                                                                                            </button>
                                                                                                                        ) : (
                                                                                                                            <button
                                                                                                                                onClick={() => handleUpdateUserRole(matchingUser.id, "user", "primary", [])}
                                                                                                                                className="px-4 py-2 bg-royal-gold/10 text-royal-gold text-xs font-bold uppercase rounded-lg hover:bg-royal-gold/20 transition-all"
                                                                                                                            >
                                                                                                                                Make Primary Admin
                                                                                                                            </button>
                                                                                                                        )}
                                                                                                                        <button 
                                                                                                                            onClick={() => handleUpdateUserRole(matchingUser.id, "revoke")}
                                                                                                                            className="px-4 py-2 bg-rose-50 text-rose-600 text-xs font-bold uppercase rounded-lg hover:bg-rose-100 transition-all"
                                                                                                                        >
                                                                                                                            Revoke
                                                                                                                        </button>
                                                                                                                    </>
                                                                                                                ) : (
                                                                                                                    <>
                                                                                                                        <button 
                                                                                                                            onClick={() => handleUpdateUserRole(matchingUser.id, "user", "event", [event.id])}
                                                                                                                            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase rounded-lg hover:bg-slate-800 transition-all"
                                                                                                                        >
                                                                                                                            Make Event Admin
                                                                                                                        </button>
                                                                                                                        <button 
                                                                                                                            onClick={() => handleUpdateUserRole(matchingUser.id, "user", "primary", [])}
                                                                                                                            className="px-4 py-2 bg-royal-gold/10 text-royal-gold text-xs font-bold uppercase rounded-lg hover:bg-royal-gold/20 transition-all"
                                                                                                                        >
                                                                                                                            Make Primary Admin
                                                                                                                        </button>
                                                                                                                    </>
                                                                                                                )}
                                                                                                            </>
                                                                                                        )}

                                                                                                        <div className="h-4 w-px bg-stone-200 mx-1"></div>
                                                                                                        <button 
                                                                                                            onClick={() => handleGuestDelete(log.id)}
                                                                                                            className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                                                            title="Remove Guest"
                                                                                                        >
                                                                                                            <Trash2 className="w-4 h-4" />
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })
                                                                                    ) : (
                                                                                        <p className="text-xs text-stone-500 italic px-2">No guests recorded.</p>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                            })}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-8 text-center border-2 border-dashed border-stone-100 rounded-[2rem]">
                                                        <p className="text-stone-600 text-sm font-sans italic">No events created yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>


                {/* Template Selection Modal */}
                <AnimatePresence>
                    {showTemplateModal && templateTargetEvent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
                            onClick={() => setShowTemplateModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-royal-gold to-rose-400" />

                                <h2 className="text-3xl font-serif text-slate-900 mb-2">Choose Style</h2>
                                <p className="text-slate-700 mb-8 font-sans">Select a design template for this event.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-2">
                                    {TEMPLATE_THEMES.map((theme, i) => {
                                        const template = {
                                            id: theme.id,
                                            label: `TEMPLATE ${i + 1}`,
                                            title: theme.label,
                                            desc: theme.desc,
                                            bgClass: i % 2 === 0 ? 'bg-slate-900' : 'bg-white',
                                            textClass: i % 2 === 0 ? 'text-royal-gold' : 'text-black',
                                            borderClass: i % 2 === 0 ? 'border-royal-gold' : 'border-black',
                                            titleColor: i % 2 === 0 ? 'text-white' : 'text-black',
                                            overlay: i % 2 === 0
                                        };
                                        return (
                                            <div
                                                key={template.id}
                                                onClick={() => handleUpdateTemplate(template.id)}
                                                className={`group cursor-pointer rounded-3xl overflow-hidden border-2 transition-all relative 
                                                ${templateTargetEvent.templateId === template.id
                                                        ? `${template.borderClass} ring-4 ring-offset-2 scale-[1.02]`
                                                        : 'border-stone-100 hover:border-slate-300'}
                                            `}
                                            >
                                                <div className={`aspect-[4/3] ${template.bgClass} relative p-6 flex flex-col ${template.overlay ? 'justify-end' : 'justify-center'} text-center`}>
                                                    {template.overlay && <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent"></div>}
                                                    <div className="relative z-10">
                                                        <p className={`${template.textClass} text-[10px] font-bold uppercase tracking-widest mb-1`}>{template.label}</p>
                                                        <h3 className={`text-xl font-serif ${template.titleColor || 'text-white'}`}>{template.title}</h3>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-white text-center">
                                                    <p className="text-xs text-slate-700 font-bold uppercase tracking-wide">{template.desc}</p>
                                                </div>
                                                {templateTargetEvent.templateId === template.id && (
                                                    <div className={`absolute top-4 right-4 ${template.textClass.replace('text-', 'bg-')} text-white p-1.5 rounded-full shadow-lg`}>
                                                        <Check className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                <button
                                    onClick={() => {
                                        setShowTemplateModal(false);
                                        setTemplateTargetEvent(null);
                                    }}
                                    className="mt-8 w-full py-4 text-slate-600 font-bold hover:text-slate-900 transition-colors uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Rename Modal */}
                <AnimatePresence>
                    {renamingEvent && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white rounded-[2.5rem] p-8 md:p-12 w-full max-w-md shadow-2xl"
                            >
                                <h3 className="text-2xl font-bold mb-6 italic tracking-tight">
                                    {renamingEvent.type === "sub" ? "Edit Gallery Details" : "Edit Event Details"}
                                </h3>
                                <form onSubmit={handleRenameSubmit} className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">New Name</label>
                                        <input
                                            type="text"
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all outline-none text-lg font-medium"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">Date</label>
                                        <input
                                            type="text"
                                            value={newDate}
                                            onChange={(e) => setNewDate(e.target.value)}
                                            placeholder="e.g. 12 May 2026"
                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all outline-none text-lg font-medium"
                                        />
                                    </div>
                                    <div className="flex space-x-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRenamingEvent(null);
                                                setNewTitle("");
                                                setNewDate("");
                                            }}
                                            className="flex-1 py-4 px-6 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-all active:scale-95"
                                            title="Discard changes"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={status === "uploading"}
                                            className="flex-1 py-4 px-6 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:bg-stone-300"
                                            title="Save changes"
                                        >
                                            {status === "uploading" ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {showDeleteConfirm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white rounded-[2.5rem] p-8 md:p-12 w-full max-w-md shadow-2xl"
                            >
                                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                                    <Trash2 className="w-8 h-8 text-red-500" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 tracking-tight text-slate-900">Delete Event?</h3>
                                <p className="text-slate-700 mb-8 font-sans leading-relaxed">
                                    Are you sure you want to delete this event? This will remove all photo records from the database. This action cannot be undone.
                                </p>
                                <div className="flex space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(null)}
                                        className="flex-1 py-4 px-6 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-all active:scale-95"
                                    >
                                        Keep Event
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteEvent(showDeleteConfirm)}
                                        disabled={status === "uploading"}
                                        className="flex-1 py-4 px-6 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95 disabled:bg-red-300"
                                    >
                                        {status === "uploading" ? "Deleting..." : "Delete now"}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                {/* Image Preview Lightbox */}
                <Lightbox
                    isOpen={!!viewingPhoto}
                    photo={viewingPhoto}
                    onClose={() => setViewingPhoto(null)}
                    onNext={() => {
                        const currentIndex = currentEventPhotos.findIndex(p => p.id === viewingPhoto?.id);
                        if (currentIndex !== -1) {
                            const nextIndex = (currentIndex + 1) % currentEventPhotos.length;
                            const nextPhoto = currentEventPhotos[nextIndex];
                            setViewingPhoto({
                                id: nextPhoto.id,
                                src: nextPhoto.url,
                                cloudinaryPublicId: nextPhoto.cloudinaryPublicId,
                                width: nextPhoto.width,
                                height: nextPhoto.height,
                                filename: nextPhoto.cloudinaryPublicId?.split('/').pop() || "photo"
                            });
                        }
                    }}
                    onPrev={() => {
                        const currentIndex = currentEventPhotos.findIndex(p => p.id === viewingPhoto?.id);
                        if (currentIndex !== -1) {
                            const prevIndex = (currentIndex - 1 + currentEventPhotos.length) % currentEventPhotos.length;
                            const prevPhoto = currentEventPhotos[prevIndex];
                            setViewingPhoto({
                                id: prevPhoto.id,
                                src: prevPhoto.url,
                                cloudinaryPublicId: prevPhoto.cloudinaryPublicId,
                                width: prevPhoto.width,
                                height: prevPhoto.height,
                                filename: prevPhoto.cloudinaryPublicId?.split('/').pop() || "photo"
                            });
                        }
                    }}
                />

                {/* Join Event Modal */}
                <AnimatePresence>
                    {isJoinModalOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-white rounded-[2.5rem] p-8 md:p-12 w-full max-w-md shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-stone-400 via-stone-200 to-stone-400"></div>
                                
                                <div className="flex justify-between items-center mb-8">
                                    <div className="w-14 h-14 bg-stone-50 rounded-2xl flex items-center justify-center">
                                        <QrCode className="w-7 h-7 text-stone-700" />
                                    </div>
                                    <button 
                                        onClick={() => { setIsJoinModalOpen(false); setJoinCode(""); }}
                                        className="p-2 hover:bg-stone-50 rounded-full transition-colors"
                                    >
                                        <X className="w-6 h-6 text-stone-400" />
                                    </button>
                                </div>

                                <h3 className="text-3xl font-bold mb-3 tracking-tight text-slate-900">Join Event</h3>
                                <p className="text-slate-600 mb-8 font-sans leading-relaxed text-sm">
                                    Enter the 6-digit unique join code provided by the event host to request access.
                                </p>

                                <form onSubmit={handleJoinEvent} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500 mb-3 ml-1">Join Code</label>
                                        <input
                                            type="text"
                                            value={joinCode}
                                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                            placeholder="E.G. WED123"
                                            className="w-full px-6 py-5 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all outline-none text-2xl font-bold tracking-[0.3em] text-center placeholder:text-stone-300 placeholder:tracking-normal"
                                            required
                                            autoFocus
                                            maxLength={10}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isJoining || !joinCode.trim()}
                                        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-[0.98] disabled:bg-stone-200 disabled:shadow-none flex items-center justify-center gap-3 text-lg"
                                    >
                                        {isJoining ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span>Joining...</span>
                                            </>
                                        ) : (
                                            <>
                                                <ArrowRight className="w-6 h-6" />
                                                <span>Request Access</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </main >
        </div >
    );
}

export default function UserDashboard() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-stone-50">
                <Loader2 className="w-10 h-10 animate-spin text-royal-gold" />
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}

function OptionCard({ title, description, icon: Icon, onClick, href, color, hoverBorder, badge, actionTitle }: any) {
    const router = useRouter();

    return (
        <Tooltip text={actionTitle}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(event) => {
                    if (href) {
                        navigateWithModifierClick(event, href, router.push);
                        return;
                    }

                    onClick?.(event);
                }}
                className={cn(
                    "group cursor-pointer bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden h-full flex flex-col",
                    hoverBorder
                )}
            >
                {badge && (
                    <div className="absolute top-8 right-8 px-3 py-1 bg-stone-100 text-[10px] font-bold uppercase tracking-widest text-stone-700 rounded-full">
                        {badge}
                    </div>
                )}
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110", color)}>
                    <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold mb-4 group-hover:text-slate-900 transition-colors">
                    {title}
                </h3>
                <p className="text-slate-700 font-sans leading-relaxed mb-6 text-sm">
                    {description}
                </p>
                <div className="flex items-center text-xs font-bold uppercase tracking-widest text-slate-900 mt-auto">
                    Explore
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </div>
            </motion.div>
        </Tooltip>
    );
}
