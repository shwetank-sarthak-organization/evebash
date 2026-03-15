"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    User,
    Heart,
    Clock,
    Shield,
    Camera,
    ArrowRight,
    LogOut,
    Mail,
    Calendar,
    Loader2,
    ChevronRight,
    Phone,
    Upload
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import { getUserVisits, getUserLikes, updateUserProfileImage } from "@/lib/firestore";
import { uploadProfileImageToCloudinary } from "@/app/actions/userActions";
import Image from "next/image";

export default function ProfilePage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"activity" | "settings">("activity");

    // Activity State
    const [visits, setVisits] = useState<any[]>([]);
    const [likesCount, setLikesCount] = useState(0);
    const [loadingActivity, setLoadingActivity] = useState(true);

    // Profile Image Upload State
    const [isUploading, setIsUploading] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const fetchActivity = async () => {
            const identifier = user?.email || user?.phone;
            if (identifier && user?.uid && identifier !== "No Phone") {
                setLoadingActivity(true);
                try {
                    const [userVisits, userLikes] = await Promise.all([
                        getUserVisits(identifier),
                        getUserLikes(user.uid)
                    ]);

                    // Filter unique visits by eventId to avoid duplicates in the history
                    const seen = new Set();
                    const uniqueVisits = userVisits.filter(v => {
                        const duplicate = seen.has(v.eventId);
                        seen.add(v.eventId);
                        return !duplicate;
                    });

                    setVisits(uniqueVisits || []);
                    setLikesCount(userLikes.length);
                } catch (error) {
                    console.error("Error fetching profile activity:", error);
                } finally {
                    setLoadingActivity(false);
                }
            }
        };

        if (user) {
            fetchActivity();
            if (user.profileImage) {
                setProfileImage(user.profileImage);
            }
        }
    }, [user]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('Image size should be less than 5MB');
            return;
        }

        try {
            setIsUploading(true);

            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = async () => {
                const base64Image = reader.result as string;
                
                // 1. Upload to Cloudinary via Server Action
                const result = await uploadProfileImageToCloudinary(base64Image, user.uid);
                
                if (result.success && result.url) {
                    // 2. Update Firestore document
                    await updateUserProfileImage(user.uid, result.url);
                    
                    // 3. Update local state to show new image immediately
                    setProfileImage(result.url);
                    
                    // Optional: You could update the AuthContext user object here if it exposes a method for it
                } else {
                    console.error("Upload failed:", result.error);
                    alert("Failed to upload image. Please try again.");
                }
                setIsUploading(false);
            };

            reader.onerror = () => {
                console.error("Failed to read file");
                alert("Failed to read file.");
                setIsUploading(false);
            };

        } catch (error) {
            console.error("Error handling image upload:", error);
            alert("An error occurred during upload.");
            setIsUploading(false);
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

            {/* Custom Header Background */}
            <div className="h-80 bg-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/cream-paper.png')` }}></div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900"></div>

                {/* Decorative Elements */}
                <div className="absolute top-10 left-10 w-64 h-64 bg-royal-gold/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-royal-gold/5 rounded-full blur-3xl"></div>
            </div>

            <main className="max-w-6xl mx-auto px-6 -mt-40 relative z-10 pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Sidebar / Identity Card */}
                    <div className="lg:col-span-4 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-stone-100 flex flex-col items-center text-center backdrop-blur-sm bg-white/95"
                        >
                            <div className="relative group">
                                <div 
                                    className="w-32 h-32 rounded-[2rem] bg-stone-50 border border-stone-100 flex items-center justify-center mb-6 overflow-hidden ring-4 ring-white shadow-inner relative cursor-pointer"
                                    onClick={() => !isUploading && fileInputRef.current?.click()}
                                >
                                    {isUploading ? (
                                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                            <Loader2 className="w-8 h-8 animate-spin text-royal-gold mb-2" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Uploading</span>
                                        </div>
                                    ) : null}

                                    {profileImage ? (
                                        <Image src={profileImage} alt={user.name} fill className="object-cover" />
                                    ) : (
                                        <User size={64} className="text-stone-300" />
                                    )}

                                    {/* Hover Overlay for Upload */}
                                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                        <Upload className="text-white mb-1" size={24} />
                                        <span className="text-white text-[10px] uppercase font-bold tracking-widest">Change Photo</span>
                                    </div>

                                    {/* Hidden File Input */}
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/jpeg, image/png, image/webp"
                                        onChange={handleImageUpload}
                                    />
                                </div>
                                {(user.role === "admin" || user.role === "premium") && (
                                    <div className="absolute -top-2 -right-2 bg-royal-gold text-white p-2 rounded-xl shadow-lg ring-4 ring-white z-30">
                                        <Shield size={16} />
                                    </div>
                                )}
                            </div>

                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{user.name}</h1>
                            <p className="text-slate-400 text-sm font-sans flex items-center justify-center mt-1">
                                {user.email ? (
                                    <>
                                        <Mail size={12} className="mr-1.5" />
                                        {user.email}
                                    </>
                                ) : (
                                    <>
                                        <Phone size={12} className="mr-1.5" />
                                        {user.phone}
                                    </>
                                )}
                            </p>

                            <div className="mt-6 flex flex-wrap justify-center gap-2">
                                <span className={cn(
                                    "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                                    user.role === "admin"
                                        ? "bg-rose-50 text-rose-600 border-rose-100"
                                        : (user.role === "premium" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")
                                )}>
                                    {user.role === "admin" ? "Global Admin" : (user.role === "premium" ? "Premium Member" : "Registered Guest")}
                                </span>
                            </div>

                            <div className="w-full mt-8 pt-8 border-t border-stone-50 space-y-3">
                                <button
                                    onClick={logout}
                                    className="w-full py-4 text-rose-500 bg-rose-50/50 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center space-x-2"
                                >
                                    <LogOut size={14} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </motion.div>

                        {/* Upgrade CTA for Normal Users */}
                        {user.role === "user" && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-royal-gold/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-royal-gold/20 transition-all duration-700"></div>

                                <div className="relative z-10">
                                    <div className="w-12 h-12 bg-royal-gold/20 rounded-xl flex items-center justify-center mb-6">
                                        <Camera size={24} className="text-royal-gold" />
                                    </div>
                                    <h3 className="text-xl font-bold font-serif mb-2">Build Your Own Album</h3>
                                    <p className="text-slate-400 text-xs font-sans leading-relaxed mb-6">
                                        Upgrade to Premium to create your own events, upload high-res photos, and manage guest lists.
                                    </p>
                                    <button
                                        onClick={() => router.push('/pricing')}
                                        className="w-full py-4 bg-royal-gold hover:bg-yellow-600 text-slate-900 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center group"
                                    >
                                        <span>Unlock Management</span>
                                        <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-8 flex flex-col space-y-8">

                        {/* Tab Switcher */}
                        <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-[1.5rem] border border-stone-100 self-start">
                            <button
                                onClick={() => setActiveTab("activity")}
                                className={cn(
                                    "px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                    activeTab === "activity" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                My Activity
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

                        {/* Activity Content */}
                        <AnimatePresence mode="wait">
                            {activeTab === "activity" ? (
                                <motion.div
                                    key="activity"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-8"
                                >
                                    {/* Stats Header - Visible only for Admin/Premium */}
                                    {(user.role === "admin" || user.role === "premium") && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            {[
                                                { icon: Heart, label: "Likes", value: loadingActivity ? "..." : likesCount.toString(), color: "text-rose-500", bg: "bg-rose-50" },
                                                { icon: Clock, label: "Visits", value: loadingActivity ? "..." : visits.length.toString(), color: "text-sky-500", bg: "bg-sky-50" },
                                                { icon: Shield, label: "Rank", value: user.role === "admin" ? "Global" : "Premium", color: "text-emerald-500", bg: "bg-emerald-50" },
                                            ].map((stat, idx) => (
                                                <div key={idx} className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
                                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-sm", stat.bg, stat.color)}>
                                                        <stat.icon size={20} />
                                                    </div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{stat.label}</p>
                                                    <p className="text-xl font-bold text-slate-800 mt-0.5 tracking-tight">{stat.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Recent Activity List - Always Visible */}
                                    <div className="bg-white rounded-[2.5rem] p-4 sm:p-8 border border-stone-100 shadow-sm">
                                        <div className="flex items-center justify-between mb-8 border-b border-stone-50 pb-6 px-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-800 font-serif">Shared Galleries</h3>
                                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Events you have been approved to view</p>
                                            </div>
                                            <div className="hidden sm:flex w-10 h-10 bg-emerald-50 rounded-full items-center justify-center text-emerald-500">
                                                <Shield size={20} />
                                            </div>
                                        </div>

                                        {loadingActivity ? (
                                            <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                                <Loader2 className="w-8 h-8 animate-spin text-royal-gold" />
                                                <p className="text-stone-400 text-[10px] font-bold tracking-widest uppercase">Fetching Memories...</p>
                                            </div>
                                        ) : visits.length > 0 ? (
                                            <div className="space-y-3">
                                                {visits.map((visit) => (
                                                    <motion.div
                                                        key={visit.id}
                                                        whileHover={{ x: 5, backgroundColor: "rgba(255,255,255,1)" }}
                                                        className="group p-4 bg-stone-50/50 border border-transparent hover:border-slate-100 rounded-2xl flex items-center justify-between transition-all cursor-pointer"
                                                        onClick={() => {
                                                            if (visit.eventId) router.push(`/events/${visit.eventId}`);
                                                        }}
                                                    >
                                                        <div className="flex items-center space-x-4">
                                                            <div className="w-12 h-12 rounded-xl bg-white border border-stone-100 flex items-center justify-center text-amber-500 shadow-sm">
                                                                <Calendar size={22} />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm font-bold text-slate-800 group-hover:text-royal-gold transition-colors">{visit.eventTitle || "Untitled Event"}</h4>
                                                                <div className="flex items-center space-x-3 mt-1">
                                                                    <div className="flex items-center text-[10px] text-stone-400 font-sans">
                                                                        <Clock size={10} className="mr-1" />
                                                                        {visit.loginAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </div>
                                                                    <div className="flex items-center text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">
                                                                        <Shield size={10} className="mr-1" />
                                                                        Full Access
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={16} className="text-stone-300 group-hover:text-slate-600 transition-colors" />
                                                    </motion.div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-20 flex flex-col items-center text-center">
                                                <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 text-stone-300">
                                                    <Heart size={32} />
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-800 mb-2">No Shared Galleries Yet</h3>
                                                <p className="text-slate-400 text-sm max-w-sm mb-8 font-sans">
                                                    Once you follow a shared link and the host approves your access, the gallery will appear here for you to revisit anytime.
                                                </p>
                                                <button
                                                    onClick={() => router.push('/')}
                                                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                                                >
                                                    Explore Galleries
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ) : (
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
                                                To change your account details, please contact our support team or use the Google Account settings.
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
