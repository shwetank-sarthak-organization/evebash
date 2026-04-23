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
    Event as FirestoreEvent,
} from "@/lib/firestore";
import { uploadProfileImageToCloudinary } from "@/app/actions/userActions";
import Image from "next/image";

type GalleryTab = "my" | "shared";

export default function ProfilePage() {
    const { user, loading: authLoading, logout } = useAuth();
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

    // Gallery data
    const [myGalleries, setMyGalleries] = useState<FirestoreEvent[]>([]);
    const [sharedGalleries, setSharedGalleries] = useState<any[]>([]);
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

                // Deduplicate shared galleries by eventId
                const seen = new Set<string>();
                const unique = visits.filter((v: any) => {
                    if (seen.has(v.eventId)) return false;
                    seen.add(v.eventId);
                    return true;
                });
                setSharedGalleries(unique);
            } catch (err) {
                console.error("Error fetching galleries:", err);
            } finally {
                setLoadingGalleries(false);
            }
        };

        fetchGalleries();
    }, [user]);

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

    const getPlanLabel = (role?: string) => {
        switch (role) {
            case "admin":    return "Super Admin";
            case "elite":    return "Elite Plan";
            case "premium":  return "Premium Plan";
            case "standard": return "Standard Plan";
            case "basic":    return "Basic Plan";
            default:         return "Free Plan";
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
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Uploading</span>
                                        </div>
                                    )}
                                    {profileImage ? (
                                        <Image src={profileImage} alt={user.name} fill className="object-cover" />
                                    ) : (
                                        <User size={64} className="text-stone-300" />
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
                            <p className="text-slate-400 text-sm font-sans flex items-center justify-center mt-1">
                                {user.email ? <><Mail size={12} className="mr-1.5" />{user.email}</> : <><Phone size={12} className="mr-1.5" />{user.phone}</>}
                            </p>

                            <div className="mt-4">
                                <span className={cn(
                                    "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                                    user.role === "admin"    ? "bg-rose-50 text-rose-600 border-rose-100" :
                                    user.role === "elite"   ? "bg-purple-50 text-purple-600 border-purple-100" :
                                    user.role === "premium" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                    user.role === "standard"? "bg-sky-50 text-sky-600 border-sky-100" :
                                    user.role === "basic"   ? "bg-teal-50 text-teal-600 border-teal-100" :
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

                        {/* Usage Stats – Free/normal users */}
                        {user.role !== "admin" && user.role !== "premium" && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 }}
                                className="bg-white rounded-[2.5rem] p-6 shadow-2xl shadow-slate-200/50 border border-stone-100"
                            >
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Your Usage</h3>

                                <div className="mb-5">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-sans text-slate-500">Storage Used</span>
                                        <span className="text-xs font-bold font-sans text-slate-700">
                                            {(storageUsed / (1024 * 1024)).toFixed(1)} MB / 1 GB
                                        </span>
                                    </div>
                                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${Math.min((storageUsed / (1024 * 1024 * 1024)) * 100, 100)}%`,
                                                background: storageUsed >= 900 * 1024 * 1024 ? "#ef4444" : "#b8860b",
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center p-3 bg-stone-50 rounded-2xl">
                                    <span className="text-xs font-sans text-slate-500">Events Created</span>
                                    <span className="text-xs font-bold font-sans text-slate-700">{eventCount} / 2</span>
                                </div>

                                <button
                                    onClick={() => router.push("/pricing")}
                                    className="mt-4 w-full py-3 bg-royal-gold/10 text-royal-gold rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-royal-gold/20 transition-all text-center"
                                >
                                    Upgrade Plan →
                                </button>
                            </motion.div>
                        )}
                    </div>

                    {/* ── Main Content ── */}
                    <div className="lg:col-span-8 flex flex-col space-y-8">

                        {/* Top tab switcher */}
                        <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-[1.5rem] border border-stone-100 self-start">
                            <button
                                onClick={() => setActiveTab("activity")}
                                className={cn(
                                    "px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                    activeTab === "activity" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                My Galleries
                            </button>
                            <button
                                onClick={() => setActiveTab("settings")}
                                className={cn(
                                    "px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                    activeTab === "settings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
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
                                                "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all border",
                                                galleryTab === "my"
                                                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                                    : "bg-white text-slate-500 border-stone-100 hover:border-slate-300"
                                            )}
                                        >
                                            <Images size={14} />
                                            My Galleries
                                            {!loadingGalleries && (
                                                <span className={cn(
                                                    "ml-1 px-2 py-0.5 rounded-full text-[9px]",
                                                    galleryTab === "my" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                                )}>
                                                    {myGalleries.length}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setGalleryTab("shared")}
                                            className={cn(
                                                "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all border",
                                                galleryTab === "shared"
                                                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                                    : "bg-white text-slate-500 border-stone-100 hover:border-slate-300"
                                            )}
                                        >
                                            <Share2 size={14} />
                                            Shared With Me
                                            {!loadingGalleries && (
                                                <span className={cn(
                                                    "ml-1 px-2 py-0.5 rounded-full text-[9px]",
                                                    galleryTab === "shared" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
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
                                                <p className="text-stone-400 text-[10px] font-bold tracking-widest uppercase">Loading Galleries...</p>
                                            </div>
                                        ) : galleryTab === "my" ? (
                                            /* ── MY GALLERIES ── */
                                            myGalleries.length > 0 ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between mb-6 border-b border-stone-50 pb-4">
                                                        <div>
                                                            <h3 className="text-xl font-bold text-slate-800 font-serif">My Galleries</h3>
                                                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Events you have created</p>
                                                        </div>
                                                        <div className="hidden sm:flex w-10 h-10 bg-slate-50 rounded-full items-center justify-center text-slate-400">
                                                            <Camera size={20} />
                                                        </div>
                                                    </div>
                                                    {myGalleries.map((event) => (
                                                        <motion.div
                                                            key={event.id}
                                                            whileHover={{ x: 5 }}
                                                            className="group p-4 bg-stone-50/50 border border-transparent hover:border-slate-100 rounded-2xl flex items-center justify-between transition-all cursor-pointer"
                                                            onClick={() => router.push(`/dashboard`)}
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
                                                                    <div className="flex items-center text-[10px] text-stone-400 font-sans mt-1">
                                                                        <Calendar size={10} className="mr-1" />
                                                                        {event.date || "No date set"}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <ChevronRight size={16} className="text-stone-300 group-hover:text-slate-600 transition-colors" />
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-16 flex flex-col items-center text-center">
                                                    <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 text-stone-300">
                                                        <Camera size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Galleries Yet</h3>
                                                    <p className="text-slate-400 text-sm max-w-sm mb-8 font-sans">
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
                                                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Galleries you have been approved to view</p>
                                                        </div>
                                                        <div className="hidden sm:flex w-10 h-10 bg-emerald-50 rounded-full items-center justify-center text-emerald-500">
                                                            <Shield size={20} />
                                                        </div>
                                                    </div>
                                                    {sharedGalleries.map((visit) => (
                                                        <motion.div
                                                            key={visit.id}
                                                            whileHover={{ x: 5 }}
                                                            className="group p-4 bg-stone-50/50 border border-transparent hover:border-slate-100 rounded-2xl flex items-center justify-between transition-all cursor-pointer"
                                                            onClick={() => { if (visit.eventId) router.push(`/events/${visit.eventId}`); }}
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
                                                                        <div className="flex items-center text-[10px] text-stone-400 font-sans">
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
                                                            <ChevronRight size={16} className="text-stone-300 group-hover:text-slate-600 transition-colors" />
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-16 flex flex-col items-center text-center">
                                                    <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 text-stone-300">
                                                        <Share2 size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Shared Galleries Yet</h3>
                                                    <p className="text-slate-400 text-sm max-w-sm mb-8 font-sans">
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
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Full Name</label>
                                                <input readOnly value={user.name} className="w-full px-5 py-3.5 bg-stone-50 border border-stone-100 rounded-xl text-slate-700 font-sans focus:outline-none" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">
                                                    {user.email ? "Email Address" : "Phone Number"}
                                                </label>
                                                <input readOnly value={user.email || user.phone || ""} className="w-full px-5 py-3.5 bg-stone-50 border border-stone-100 rounded-xl text-slate-700 font-sans focus:outline-none" />
                                            </div>
                                        </div>
                                        <div className="pt-6 border-t border-stone-50">
                                            <p className="text-stone-400 text-xs font-sans italic">
                                                To change your account details, please contact our support team.
                                            </p>
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
