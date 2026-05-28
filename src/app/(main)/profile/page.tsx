"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    User,
    Shield,
    LogOut,
    Mail,
    Phone,
    Upload,
    Camera,
    Calendar,
    ChevronRight,
    Loader2,
    Images,
    Share2,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import {
    updateUserProfileImage,
    getUserTotalStorage,
    getUserEventCount,
    getUserEvents,
    getUserVisits,
    getUserById,
    isUsernameUnique,
    updateUserProfile,
    Event as FirestoreEvent,
} from "@/lib/firestore";
import { uploadProfileImageToCloudinary } from "@/app/actions/userActions";
import Image from "next/image";
import { navigateWithModifierClick } from "@/lib/navigation";
import { useTheme } from "@/context/ThemeContext";

type GalleryTab = "my" | "shared";

export default function ProfilePage() {
    const { user, loading: authLoading, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"activity" | "settings">("activity");
    const [galleryTab, setGalleryTab] = useState<GalleryTab>("my");

    // Profile Image Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Usage Stats (Normal Users)
    const [storageUsed, setStorageUsed] = useState(0);
    const [eventCount, setEventCount] = useState(0);

    // Edit Profile State
    const [nameInput, setNameInput] = useState("");
    const [usernameInput, setUsernameInput] = useState("");
    const [phoneInput, setPhoneInput] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

    // Gallery data
    const [myGalleries, setMyGalleries] = useState<FirestoreEvent[]>([]);
    const [sharedGalleries, setSharedGalleries] = useState<any[]>([]);
    const [sharedGalleryOwners, setSharedGalleryOwners] = useState<Record<string, string>>({});
    const [loadingGalleries, setLoadingGalleries] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;

        // Profile image
        if (user.profileImage) setProfileImage(user.profileImage);

        // Usage stats for non-admin/non-premium
        if (user.role !== "admin" && user.role !== "premium") {
            const identifiers = [user.uid];
            if (user.email) identifiers.push(user.email);
            Promise.all([
                getUserTotalStorage(identifiers),
                getUserEventCount(user.uid),
            ]).then(([storage, count]) => {
                setStorageUsed(storage);
                setEventCount(count);
            });
        }

        // Fetch gallery data
        const fetchGalleries = async () => {
            setLoadingGalleries(true);
            try {
                const [myEvents, visits] = await Promise.all([
                    getUserEvents(user.uid, "main"),
                    user.email ? getUserVisits(user.email) : Promise.resolve([]),
                ]);

                setMyGalleries(myEvents);

                // Deduplicate shared galleries and remove events the user created themselves
                const seen = new Set<string>();
                const myEventIds = new Set(myEvents.map(e => e.id));

                const unique = visits.filter((v: any) => {
                    if (seen.has(v.eventId)) return false;
                    if (myEventIds.has(v.eventId)) return false; // Hide own events
                    seen.add(v.eventId);
                    return true;
                });
                setSharedGalleries(unique);

                const ownerIds = Array.from(new Set(
                    unique
                        .map((visit: any) => visit.parentEventOwnerId || visit.ownerId || visit.createdBy)
                        .filter(Boolean)
                ));

                const ownerEntries = await Promise.all(
                    ownerIds.map(async (ownerId: string) => {
                        if (ownerId.includes("@")) return [ownerId, ownerId] as const;

                        const owner = await getUserById(ownerId);
                        return [ownerId, owner?.email || ownerId] as const;
                    })
                );

                setSharedGalleryOwners(Object.fromEntries(ownerEntries));
            } catch (err) {
                console.error("Error fetching galleries:", err);
            } finally {
                setLoadingGalleries(false);
            }
        };

        fetchGalleries();
    }, [user]);

    useEffect(() => {
        if (user) {
            setNameInput(user.name || "");
            setUsernameInput(user.username || "");
            setPhoneInput(user.phone && user.phone !== "No Phone" ? user.phone : "");
            setUsernameStatus("idle");
        }
    }, [user]);

    useEffect(() => {
        if (!user || !usernameInput) {
            setUsernameStatus("idle");
            return;
        }

        // If it's unchanged, it's valid/available (idle)
        if (usernameInput.toLowerCase() === user.username?.toLowerCase()) {
            setUsernameStatus("idle");
            return;
        }

        // Validate format: alphanumeric, underscores, dots, 3-30 chars
        const isValidFormat = /^[a-z0-9_.]+$/.test(usernameInput) && usernameInput.length >= 3 && usernameInput.length <= 30;
        if (!isValidFormat) {
            setUsernameStatus("invalid");
            return;
        }

        setUsernameStatus("checking");
        const debounceTimer = setTimeout(async () => {
            const isUnique = await isUsernameUnique(usernameInput, user.uid);
            if (isUnique) {
                setUsernameStatus("available");
            } else {
                setUsernameStatus("taken");
            }
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [usernameInput, user]);

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaveError("");
        setSaveSuccess(false);

        if (!nameInput.trim()) {
            setSaveError("Full name is required.");
            return;
        }

        const normalizedUsername = usernameInput.trim().toLowerCase();
        if (!normalizedUsername) {
            setSaveError("Username is required.");
            return;
        }

        const isValidFormat = /^[a-z0-9_.]+$/.test(normalizedUsername) && normalizedUsername.length >= 3 && normalizedUsername.length <= 30;
        if (!isValidFormat) {
            setSaveError("Username must be between 3 and 30 characters and contain only lowercase letters, numbers, underscores, or dots.");
            return;
        }

        setIsSaving(true);

        try {
            if (normalizedUsername !== user.username?.toLowerCase()) {
                const isUnique = await isUsernameUnique(normalizedUsername, user.uid);
                if (!isUnique) {
                    setSaveError("This username is already taken.");
                    setIsSaving(false);
                    return;
                }
            }

            const success = await updateUserProfile(user.uid, {
                name: nameInput.trim(),
                username: normalizedUsername,
                phone: phoneInput.trim() || undefined,
            });

            if (success) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                setSaveError("Failed to update profile. Please try again.");
            }
        } catch (err) {
            console.error("Error saving profile changes:", err);
            setSaveError("An error occurred. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid) return;

        if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
        if (file.size > 5 * 1024 * 1024) { alert("Image size should be less than 5MB"); return; }

        try {
            setIsUploading(true);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Image = reader.result as string;
                const result = await uploadProfileImageToCloudinary(base64Image, user.uid);
                if (result.success && result.url) {
                    await updateUserProfileImage(user.uid, result.url);
                    setProfileImage(result.url);
                } else {
                    alert("Failed to upload image. Please try again.");
                }
                setIsUploading(false);
            };
            reader.onerror = () => { alert("Failed to read file."); setIsUploading(false); };
        } catch {
            alert("An error occurred during upload.");
            setIsUploading(false);
        }
    };

    const getSharedGalleryOwnerEmail = (visit: any) => {
        const ownerId = visit.parentEventOwnerId || visit.ownerId || visit.createdBy;
        if (!ownerId) return "Unknown owner";
        if (ownerId.includes("@")) return ownerId;
        return sharedGalleryOwners[ownerId] || ownerId;
    };

    const sharedGalleriesByOwner = sharedGalleries.reduce<Record<string, any[]>>((groups, visit) => {
        const ownerEmail = getSharedGalleryOwnerEmail(visit);
        if (!groups[ownerEmail]) groups[ownerEmail] = [];
        groups[ownerEmail].push(visit);
        return groups;
    }, {});

    const getPlanLabel = (role?: string) => {
        switch (role) {
            case "admin": return "Super Admin";
            case "elite": return "Elite Plan";
            case "premium": return "Premium Plan";
            case "standard": return "Standard Plan";
            case "basic": return "Basic Plan";
            default: return "Free Plan";
        }
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen bg-royal-cream flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-royal-gold/20 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-royal-gold/10 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-royal-cream font-serif selection:bg-royal-gold/30">
            <Navbar />

            {/* Hero Banner */}
            <div className="h-80 bg-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/cream-paper.png')` }}></div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900"></div>
                <div className="absolute top-10 left-10 w-64 h-64 bg-royal-gold/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-royal-gold/5 rounded-full blur-3xl"></div>
            </div>

            <main className="max-w-6xl mx-auto px-6 -mt-40 relative z-10 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* ── Sidebar ── */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Identity Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-stone-100 flex flex-col items-center text-center"
                        >
                            {/* Avatar */}
                            <div className="relative group">
                                <div
                                    className="w-48 h-48 rounded-[2rem] bg-stone-50 border border-stone-100 flex items-center justify-center mb-6 overflow-hidden ring-4 ring-white shadow-inner relative cursor-pointer"
                                    onClick={() => !isUploading && fileInputRef.current?.click()}
                                >
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                            <Loader2 className="w-8 h-8 animate-spin text-royal-gold mb-2" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Uploading</span>
                                        </div>
                                    )}
                                    {profileImage ? (
                                        <Image src={profileImage} alt={user.name} fill className="object-cover" />
                                    ) : (
                                        <User size={64} className="text-stone-600" />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                        <Upload className="text-white mb-1" size={24} />
                                        <span className="text-white text-[10px] uppercase font-bold tracking-widest">Change Photo</span>
                                    </div>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleImageUpload} />
                                </div>
                                {(user.role === "admin" || user.role === "premium") && (
                                    <div className="absolute -top-2 -right-2 bg-royal-gold text-white p-2 rounded-xl shadow-lg ring-4 ring-white z-30">
                                        <Shield size={16} />
                                    </div>
                                )}
                            </div>

                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{user.name}</h1>
                            {user.username ? (
                                <p className="text-royal-gold text-xs font-semibold font-sans mt-0.5 tracking-wider lowercase">
                                    @{user.username}
                                </p>
                            ) : (
                                <button
                                    onClick={() => setActiveTab("settings")}
                                    className="text-stone-400 hover:text-royal-gold text-[11px] font-medium font-sans mt-1 tracking-wider transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                                >
                                    <span>@set_username</span>
                                </button>
                            )}
                            <div className="flex flex-col items-center gap-1 mt-2">
                                {user.email && (
                                    <p className="text-slate-600 text-sm font-sans flex items-center justify-center">
                                        <Mail size={12} className="mr-1.5" />{user.email}
                                    </p>
                                )}
                                {user.phone && user.phone !== "No Phone" && (
                                    <p className="text-slate-600 text-sm font-sans flex items-center justify-center">
                                        <Phone size={12} className="mr-1.5" />{user.phone}
                                    </p>
                                )}
                                {!user.email && !user.phone && (
                                    <p className="text-slate-500 text-xs font-sans flex items-center justify-center">
                                        <Phone size={12} className="mr-1.5" />No contact info
                                    </p>
                                )}
                            </div>

                            <div className="mt-4">
                                <span className={cn(
                                    "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                                    user.role === "admin" ? "bg-rose-50 text-rose-600 border-rose-100" :
                                        user.role === "elite" ? "bg-purple-50 text-purple-600 border-purple-100" :
                                            user.role === "premium" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                user.role === "standard" ? "bg-sky-50 text-sky-600 border-sky-100" :
                                                    user.role === "basic" ? "bg-teal-50 text-teal-600 border-teal-100" :
                                                        "bg-emerald-50 text-emerald-600 border-emerald-100"
                                )}>
                                    {getPlanLabel(user.role)}
                                </span>
                            </div>

                            <div className="w-full mt-8 pt-8 border-t border-stone-50">
                                <button
                                    onClick={logout}
                                    className="w-full py-4 text-rose-500 bg-rose-50/50 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center space-x-2"
                                >
                                    <LogOut size={14} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </motion.div>

                        {/* Usage Stats – Visible for all plans except Super Admin */}
                        {user && user.role !== "admin" && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="bg-white rounded-[2.5rem] p-6 shadow-2xl shadow-slate-200/50 border border-stone-100"
                            >
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4">Your Usage</h3>

                                <div className="mb-5">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-sans text-slate-700">Storage Used</span>
                                        <span className="text-xs font-bold font-sans text-slate-700">
                                            {(() => {
                                                const role = user.role || "free";
                                                const limits: Record<string, { label: string, bytes: number }> = {
                                                    "free": { label: "1 GB", bytes: 1 * 1024 * 1024 * 1024 },
                                                    "basic": { label: "15 GB", bytes: 15 * 1024 * 1024 * 1024 },
                                                    "standard": { label: "60 GB", bytes: 60 * 1024 * 1024 * 1024 },
                                                    "premium": { label: "200 GB", bytes: 200 * 1024 * 1024 * 1024 },
                                                    "elite": { label: "1 TB", bytes: 1024 * 1024 * 1024 * 1024 }
                                                };
                                                const limit = limits[role] || limits["free"];
                                                return `${(storageUsed / (1024 * 1024)).toFixed(1)} MB / ${limit.label}`;
                                            })()}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={(() => {
                                                const role = user.role || "free";
                                                const limits: Record<string, number> = {
                                                    "free": 1 * 1024 * 1024 * 1024,
                                                    "basic": 15 * 1024 * 1024 * 1024,
                                                    "standard": 60 * 1024 * 1024 * 1024,
                                                    "premium": 200 * 1024 * 1024 * 1024,
                                                    "elite": 1024 * 1024 * 1024 * 1024
                                                };
                                                const bytesLimit = limits[role] || (1 * 1024 * 1024 * 1024);
                                                const percentage = (storageUsed / bytesLimit) * 100;
                                                return {
                                                    width: `${Math.min(percentage, 100)}%`,
                                                    background: percentage >= 90 ? "#ef4444" : "#b8860b"
                                                };
                                            })()}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-stone-50 rounded-2xl">
                                    <span className="text-xs font-sans text-slate-700">Events Created</span>
                                    <span className="text-xs font-bold font-sans text-slate-700">
                                        {(() => {
                                            const role = user.role || "free";
                                            if (role === "admin" || role === "premium" || role === "elite") return `${eventCount} / Unlimited`;
                                            const eventLimits: Record<string, number> = { "free": 2, "basic": 5, "standard": 20 };
                                            return `${eventCount} / ${eventLimits[role] || 2}`;
                                        })()}
                                    </span>
                                </div>

                                <button
                                    onClick={() => router.push("/pricing")}
                                    className="mt-4 w-full py-3 bg-royal-gold/10 text-royal-gold rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-royal-gold/20 transition-all text-center"
                                >
                                    Upgrade Plan →
                                </button>
                            </motion.div>
                        )}

                        {/* App Preferences Sidebar Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-[2.5rem] p-6 shadow-2xl shadow-slate-200/50 border border-stone-100"
                        >
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4">App Preferences</h3>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs font-sans text-slate-700 font-medium">Select Theme</span>
                                    <p className="text-[10px] text-stone-500 font-sans mt-0.5 leading-relaxed">
                                        Choose the visual theme for your application layout.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setTheme("royal")}
                                        className={cn(
                                            "flex flex-col items-center p-3 rounded-2xl border transition-all text-center cursor-pointer focus:outline-none",
                                            theme === "royal"
                                                ? "border-royal-gold bg-amber-50/10 shadow-sm"
                                                : "border-stone-100 bg-stone-50/30 hover:border-stone-200"
                                        )}
                                    >
                                        <div className="w-10 h-6 rounded-md bg-[#FFFDD0] border border-stone-200/40 mb-2 relative overflow-hidden flex items-center justify-center">
                                            <div className="w-6 h-1 bg-[#5D001E] rounded-full"></div>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-800">Royal Cream</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTheme("light")}
                                        className={cn(
                                            "flex flex-col items-center p-3 rounded-2xl border transition-all text-center cursor-pointer focus:outline-none",
                                            theme === "light"
                                                ? "border-sky-500 bg-sky-50/10 shadow-sm"
                                                : "border-stone-100 bg-stone-50/30 hover:border-stone-200"
                                        )}
                                    >
                                        <div className="w-10 h-6 rounded-md bg-[#f8fafc] border border-stone-200/40 mb-2 relative overflow-hidden flex items-center justify-center">
                                            <div className="w-6 h-1 bg-sky-500 rounded-full"></div>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-800">Modern Light</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* ── Main Content ── */}
                    <div className="lg:col-span-8 flex flex-col space-y-8">

                        {/* Top tab switcher */}
                        <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-[1.5rem] border border-stone-100 self-start">
                            <button
                                onClick={() => setActiveTab("activity")}
                                className={cn(
                                    "px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                    activeTab === "activity" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-600"
                                )}
                            >
                                My Galleries
                            </button>
                            <button
                                onClick={() => setActiveTab("settings")}
                                className={cn(
                                    "px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                    activeTab === "settings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-600"
                                )}
                            >
                                Account Settings
                            </button>
                        </div>

                        <AnimatePresence mode="wait">
                            {activeTab === "activity" ? (
                                <motion.div
                                    key="activity"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    {/* Gallery sub-tab switcher */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setGalleryTab("my")}
                                            className={cn(
                                                "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all",
                                                galleryTab === "my"
                                                    ? "bg-white text-slate-900 border border-stone-100 shadow-sm"
                                                    : "bg-stone-50 text-slate-700 border border-transparent hover:bg-stone-100"
                                            )}
                                        >
                                            <Images size={14} />
                                            Your Created Galleries
                                            {!loadingGalleries && (
                                                <span className={cn(
                                                    "ml-1 px-2 py-0.5 rounded-full text-[9px]",
                                                    galleryTab === "my" ? "bg-slate-100 text-slate-700" : "bg-stone-200 text-slate-600"
                                                )}>
                                                    {myGalleries.length}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setGalleryTab("shared")}
                                            className={cn(
                                                "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all",
                                                galleryTab === "shared"
                                                    ? "bg-white text-slate-900 border border-stone-100 shadow-sm"
                                                    : "bg-stone-50 text-slate-700 border border-transparent hover:bg-stone-100"
                                            )}
                                        >
                                            <Share2 size={14} />
                                            Shared With Me
                                            {!loadingGalleries && (
                                                <span className={cn(
                                                    "ml-1 px-2 py-0.5 rounded-full text-[9px]",
                                                    galleryTab === "shared" ? "bg-slate-100 text-slate-700" : "bg-stone-200 text-slate-600"
                                                )}>
                                                    {sharedGalleries.length}
                                                </span>
                                            )}
                                        </button>
                                    </div>

                                    {/* Gallery Content */}
                                    <div className="bg-white rounded-[2.5rem] p-4 sm:p-8 border border-stone-100 shadow-sm min-h-[320px]">

                                        {/* Loading */}
                                        {loadingGalleries ? (
                                            <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                                <Loader2 className="w-8 h-8 animate-spin text-royal-gold" />
                                                <p className="text-stone-600 text-[10px] font-bold tracking-widest uppercase">Loading Galleries...</p>
                                            </div>
                                        ) : galleryTab === "my" ? (
                                            /* ── MY GALLERIES ── */
                                            myGalleries.length > 0 ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between mb-6 border-b border-stone-50 pb-4">
                                                        <div>
                                                            <h3 className="text-xl font-bold text-slate-800 font-serif">Your Created Galleries</h3>
                                                            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1">Events you have created</p>
                                                        </div>
                                                        <div className="hidden sm:flex w-10 h-10 bg-slate-50 rounded-full items-center justify-center text-slate-600">
                                                            <Camera size={20} />
                                                        </div>
                                                    </div>
                                                    {myGalleries.map((event) => (
                                                        <motion.div
                                                            key={event.id}
                                                            whileHover={{ x: 5 }}
                                                            className="group p-4 bg-stone-50/50 border border-transparent hover:border-slate-100 rounded-2xl flex items-center justify-between transition-all cursor-pointer"
                                                            onClick={(e) => navigateWithModifierClick(e, `/events/${event.id}`, router.push)}
                                                        >
                                                            <div className="flex items-center space-x-4">
                                                                <div className="w-12 h-12 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-royal-gold shadow-sm overflow-hidden">
                                                                    {event.coverImage ? (
                                                                        <Image src={event.coverImage} alt={event.title} width={48} height={48} className="object-cover w-full h-full" />
                                                                    ) : (
                                                                        <Camera size={22} />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-bold text-slate-800 group-hover:text-royal-gold transition-colors">{event.title}</h4>
                                                                    <div className="flex items-center text-[10px] text-stone-600 font-sans mt-1">
                                                                        <Calendar size={10} className="mr-1" />
                                                                        {event.date || "No date set"}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <ChevronRight size={16} className="text-stone-600 group-hover:text-slate-600 transition-colors" />
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-16 flex flex-col items-center text-center">
                                                    <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 text-stone-600">
                                                        <Camera size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Galleries Yet</h3>
                                                    <p className="text-slate-600 text-sm max-w-sm mb-8 font-sans">
                                                        You haven&apos;t created any galleries. Head to your dashboard to create your first event.
                                                    </p>
                                                    <button
                                                        onClick={() => router.push("/dashboard")}
                                                        className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                                                    >
                                                        Go to Dashboard
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            /* ── SHARED WITH ME ── */
                                            sharedGalleries.length > 0 ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between mb-6 border-b border-stone-50 pb-4">
                                                        <div>
                                                            <h3 className="text-xl font-bold text-slate-800 font-serif">Shared With Me</h3>
                                                            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-1">Galleries you have been approved to view</p>
                                                        </div>
                                                        <div className="hidden sm:flex w-10 h-10 bg-emerald-50 rounded-full items-center justify-center text-emerald-500">
                                                            <Shield size={20} />
                                                        </div>
                                                    </div>
                                                    {Object.entries(sharedGalleriesByOwner).map(([ownerEmail, visits]) => (
                                                        <div key={ownerEmail} className="space-y-3">
                                                            <div className="px-1 pt-2">
                                                                <h4 className="text-sm font-bold text-slate-800 font-sans">{ownerEmail}</h4>
                                                                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest mt-1">
                                                                    {visits.length} shared {visits.length === 1 ? "gallery" : "galleries"}
                                                                </p>
                                                            </div>

                                                            {visits.map((visit) => (
                                                                <motion.div
                                                                    key={visit.id}
                                                                    whileHover={{ x: 5 }}
                                                                    className="group p-4 bg-stone-50/50 border border-transparent hover:border-slate-100 rounded-2xl flex items-center justify-between transition-all cursor-pointer"
                                                                    onClick={(e) => { if (visit.eventId) navigateWithModifierClick(e, `/events/${visit.eventId}`, router.push); }}
                                                                >
                                                                    <div className="flex items-center space-x-4">
                                                                        <div className="w-12 h-12 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-emerald-500 shadow-sm">
                                                                            <Share2 size={20} />
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-sm font-bold text-slate-800 group-hover:text-royal-gold transition-colors">
                                                                                {visit.eventTitle || "Untitled Event"}
                                                                            </h4>
                                                                            <div className="flex items-center gap-3 mt-1">
                                                                                <div className="flex items-center text-[10px] text-stone-600 font-sans">
                                                                                    <Clock size={10} className="mr-1" />
                                                                                    {visit.loginAt?.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                                                                </div>
                                                                                <div className="flex items-center text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">
                                                                                    <Shield size={10} className="mr-1" />
                                                                                    Approved
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <ChevronRight size={16} className="text-stone-600 group-hover:text-slate-600 transition-colors" />
                                                                </motion.div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-16 flex flex-col items-center text-center">
                                                    <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 text-stone-600">
                                                        <Share2 size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Shared Galleries Yet</h3>
                                                    <p className="text-slate-600 text-sm max-w-sm mb-8 font-sans">
                                                        Once a host approves your access to their gallery, it will appear here for you to revisit anytime.
                                                    </p>
                                                    <button
                                                        onClick={() => router.push("/")}
                                                        className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                                                    >
                                                        Explore Galleries
                                                    </button>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </motion.div>
                            ) : (
                                /* ── ACCOUNT SETTINGS ── */
                                <motion.div
                                    key="settings"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="bg-white rounded-[2.5rem] p-12 border border-stone-100 shadow-sm"
                                >
                                    <h3 className="text-xl font-bold text-slate-800 mb-8">Personal Information</h3>
                                    <form onSubmit={handleSaveChanges} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Full Name */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1">Full Name</label>
                                                <input
                                                    type="text"
                                                    value={nameInput}
                                                    onChange={(e) => setNameInput(e.target.value)}
                                                    className="w-full px-5 py-3.5 bg-white border border-stone-200 rounded-xl text-slate-700 font-sans focus:outline-none focus:ring-2 focus:ring-royal-gold/50 focus:border-transparent transition-all shadow-sm"
                                                    placeholder="Your Full Name"
                                                    required
                                                />
                                            </div>

                                            {/* Username */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1">Username</label>
                                                <div className="relative">
                                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-400 font-sans font-medium text-sm">@</span>
                                                    <input
                                                        type="text"
                                                        value={usernameInput}
                                                        onChange={(e) => setUsernameInput(e.target.value)}
                                                        className="w-full pl-9 pr-12 py-3.5 bg-white border border-stone-200 rounded-xl text-slate-700 font-sans focus:outline-none focus:ring-2 focus:ring-royal-gold/50 focus:border-transparent transition-all shadow-sm"
                                                        placeholder="username"
                                                        required
                                                    />
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                                                        {usernameStatus === "checking" && <Loader2 className="w-4 h-4 animate-spin text-royal-gold" />}
                                                        {usernameStatus === "available" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                                        {usernameStatus === "taken" && <XCircle className="w-4 h-4 text-rose-500" />}
                                                        {usernameStatus === "invalid" && <AlertCircle className="w-4 h-4 text-amber-500" />}
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {usernameStatus !== "idle" && (
                                                        <motion.p
                                                            initial={{ opacity: 0, y: -5 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -5 }}
                                                            className={cn(
                                                                "text-[11px] font-sans ml-1 mt-1",
                                                                usernameStatus === "checking" && "text-slate-500",
                                                                usernameStatus === "available" && "text-emerald-600 font-medium",
                                                                usernameStatus === "taken" && "text-rose-600 font-medium",
                                                                usernameStatus === "invalid" && "text-amber-600"
                                                            )}
                                                        >
                                                            {usernameStatus === "checking" && "Checking availability..."}
                                                            {usernameStatus === "available" && "Username is available!"}
                                                            {usernameStatus === "taken" && "This username is already taken."}
                                                            {usernameStatus === "invalid" && "Use 3-30 chars: lowercase, numbers, underscores, or dots."}
                                                        </motion.p>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Email Address (read-only) */}
                                            {user.email && (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1">Email Address</label>
                                                    <input
                                                        readOnly
                                                        value={user.email}
                                                        className="w-full px-5 py-3.5 bg-stone-50 border border-stone-100 rounded-xl text-slate-400 font-sans focus:outline-none cursor-not-allowed"
                                                    />
                                                </div>
                                            )}

                                            {/* Phone Number (editable) */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1">Phone Number</label>
                                                <div className="relative">
                                                    <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                                    <input
                                                        type="tel"
                                                        value={phoneInput}
                                                        onChange={(e) => setPhoneInput(e.target.value)}
                                                        className="w-full pl-10 pr-5 py-3.5 bg-white border border-stone-200 rounded-xl text-slate-700 font-sans focus:outline-none focus:ring-2 focus:ring-royal-gold/50 focus:border-transparent transition-all shadow-sm"
                                                        placeholder="e.g. +91 98765 43210"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-stone-500 font-sans ml-1 mt-0.5">Optional — include country code for best results</p>
                                            </div>
                                        </div>

                                        {/* Error/Success Feedbacks & Button */}
                                        <div className="pt-6 border-t border-stone-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div>
                                                {saveError && (
                                                    <p className="text-xs text-rose-500 font-sans font-semibold flex items-center">
                                                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                                                        {saveError}
                                                    </p>
                                                )}
                                                {saveSuccess && (
                                                    <p className="text-xs text-emerald-600 font-sans font-semibold flex items-center">
                                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                        Changes saved successfully!
                                                    </p>
                                                )}
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isSaving || usernameStatus === "taken" || usernameStatus === "invalid" || usernameStatus === "checking"}
                                                className={cn(
                                                    "px-8 py-3.5 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                                    (usernameStatus === "taken" || usernameStatus === "invalid") && "bg-slate-300 hover:bg-slate-300 cursor-not-allowed"
                                                )}
                                            >
                                                {isSaving ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        <span>Saving...</span>
                                                    </>
                                                ) : (
                                                    <span>Save Changes</span>
                                                )}
                                            </button>
                                        </div>
                                    </form>

                                    {/* App Preferences */}
                                    <div className="mt-12 pt-8 border-t border-stone-100">
                                        <h3 className="text-xl font-bold text-slate-800 mb-6 font-serif">App Preferences</h3>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1">App Theme</label>
                                                <p className="text-xs text-stone-600 font-sans mt-0.5 ml-1 leading-relaxed">
                                                    Choose the visual aesthetic of the application layout. This selection applies only to your app experience and does not affect the styling of guest galleries.
                                                </p>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
                                                {/* Royal Theme Preview */}
                                                <button
                                                    type="button"
                                                    onClick={() => setTheme("royal")}
                                                    className={cn(
                                                        "group relative flex flex-col p-5 rounded-[2rem] border-2 transition-all text-left cursor-pointer overflow-hidden focus:outline-none",
                                                        theme === "royal"
                                                            ? "border-royal-gold bg-amber-50/10 shadow-md"
                                                            : "border-stone-100 bg-stone-50/30 hover:border-stone-200 hover:shadow-sm"
                                                    )}
                                                >
                                                    {/* Visual Preview */}
                                                    <div className="w-full h-24 rounded-2xl bg-[#FFFDD0] border border-stone-200/40 p-3 mb-4 flex flex-col justify-between relative overflow-hidden transition-transform group-hover:scale-[1.02] duration-300">
                                                        {/* Simulated Header */}
                                                        <div className="flex justify-between items-center">
                                                            <div className="w-8 h-2.5 bg-[#5D001E] rounded-md"></div>
                                                            <div className="flex gap-1.5">
                                                                <div className="w-3.5 h-1.5 bg-[#D4AF37] rounded-sm"></div>
                                                                <div className="w-3.5 h-1.5 bg-[#D4AF37] rounded-sm"></div>
                                                            </div>
                                                        </div>
                                                        {/* Simulated Hero */}
                                                        <div className="space-y-1.5">
                                                            <div className="w-16 h-3 bg-[#5D001E] rounded-md"></div>
                                                            <div className="w-24 h-2 bg-[#5D001E]/60 rounded-md"></div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center w-full">
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">Royal Cream</p>
                                                            <p className="text-[10px] text-stone-600 font-sans mt-0.5">Classic warm aesthetics</p>
                                                        </div>
                                                        {theme === "royal" && (
                                                            <CheckCircle2 className="w-5 h-5 text-royal-gold shrink-0" />
                                                        )}
                                                    </div>
                                                </button>

                                                {/* Light Theme Preview */}
                                                <button
                                                    type="button"
                                                    onClick={() => setTheme("light")}
                                                    className={cn(
                                                        "group relative flex flex-col p-5 rounded-[2rem] border-2 transition-all text-left cursor-pointer overflow-hidden focus:outline-none",
                                                        theme === "light"
                                                            ? "border-sky-500 bg-sky-50/10 shadow-md"
                                                            : "border-stone-100 bg-stone-50/30 hover:border-stone-200 hover:shadow-sm"
                                                    )}
                                                >
                                                    {/* Visual Preview */}
                                                    <div className="w-full h-24 rounded-2xl bg-[#f8fafc] border border-stone-200/40 p-3 mb-4 flex flex-col justify-between relative overflow-hidden transition-transform group-hover:scale-[1.02] duration-300">
                                                        {/* Simulated Header */}
                                                        <div className="flex justify-between items-center">
                                                            <div className="w-8 h-2.5 bg-[#0ea5e9] rounded-md"></div>
                                                            <div className="flex gap-1.5">
                                                                <div className="w-3.5 h-1.5 bg-stone-300 rounded-sm"></div>
                                                                <div className="w-3.5 h-1.5 bg-stone-300 rounded-sm"></div>
                                                            </div>
                                                        </div>
                                                        {/* Simulated Hero */}
                                                        <div className="space-y-1.5">
                                                            <div className="w-16 h-3 bg-stone-800 rounded-md"></div>
                                                            <div className="w-24 h-2 bg-stone-500 rounded-md"></div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center w-full">
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">Modern Light</p>
                                                            <p className="text-[10px] text-stone-600 font-sans mt-0.5">Bright clean aesthetics</p>
                                                        </div>
                                                        {theme === "light" && (
                                                            <CheckCircle2 className="w-5 h-5 text-sky-500 shrink-0" />
                                                        )}
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </main>
        </div>
    );
}
