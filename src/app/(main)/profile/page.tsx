"use client";

import React, { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    AlertCircle,
    ArrowRight,
    Calendar,
    Camera,
    Check,
    CheckCircle2,
    Clock,
    Gift,
    HardDrive,
    Layers,
    Loader2,
    LogOut,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Settings,
    Sparkles,
    Upload,
    User,
    Users,
    Video,
    XCircle,
    ChevronRight,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import {
    getApprovedSharedEventsForUser,
    getUserEventCount,
    getUserPhotosCount,
    getUserStorageBreakdown,
    isValidUsername,
    isUsernameUnique,
    updateUserProfile,
    updateUserProfileImage,
} from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { getApiUrl } from "@/lib/apiBase";
import { getPlanDetails, formatStorageSize } from "@/lib/planLimits";
import { defaultPricingPlans } from "@/lib/pricingPlans";
import { getSubscriptionStatus } from "@/lib/subscriptionStatus";
import { cn } from "@/lib/utils";
import { StorageBreakdownCard } from "@/components/StorageBreakdownCard";
import { confirmDialog, ModalHeader, modalStyles } from "@/components/ui/Modal";

const personaOptions = ["Guest", "Host / Organizer", "Vendor / Business"];
const genderOptions = ["Male", "Female", "Other", "Prefer not to say"];

function formatJoinedDate(value: unknown) {
    if (!value) return "Not available";
    const date = typeof (value as { toDate?: () => Date })?.toDate === "function"
        ? (value as { toDate: () => Date }).toDate()
        : typeof value === "object" && value !== null && "seconds" in value
            ? new Date((value as { seconds: number }).seconds * 1000)
            : new Date(value as string | number | Date);

    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatPlanDate(value?: string | null) {
    if (!value) return "Not set";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Not set";

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function getPersonasArray(value: unknown): string[] {
    if (!value) return ["Guest"];
    let raw: unknown[] = [];

    if (Array.isArray(value)) {
        raw = value;
    } else if (typeof value === "string" && value.trim().startsWith("[")) {
        try {
            const parsed = JSON.parse(value);
            raw = Array.isArray(parsed) ? parsed : [value];
        } catch {
            raw = [value];
        }
    } else if (typeof value === "string" && value.includes(",")) {
        raw = value.split(",");
    } else {
        raw = [value];
    }

    const normalized = raw.map((item: unknown) => String(item).trim()).filter(Boolean);
    const mapped = normalized.map((item: string) => {
        const clean = item.toLowerCase();
        if (clean.includes("host") || clean.includes("organizer")) return "Host / Organizer";
        if (clean.includes("vendor") || clean.includes("business")) return "Vendor / Business";
        return "Guest";
    });

    return Array.from(new Set(mapped.length ? mapped : ["Guest"]));
}

function InfoItem({
    icon: Icon,
    label,
    value,
    badge,
}: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    badge?: React.ReactNode;
}) {
    return (
        <div className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition-all duration-200 hover:border-[#CA9C68]/40 hover:bg-slate-900/50">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    <Icon className="h-3.5 w-3.5 text-[#CA9C68]" />
                    {label}
                </span>
                {badge}
            </div>
            <div className="mt-2 text-sm font-bold text-slate-100 truncate">{value}</div>
        </div>
    );
}

function VerificationBadge({ verified, missing, missingText }: { verified: boolean; missing: boolean; missingText: string }) {
    if (missing) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-amber-200">
                <AlertCircle className="h-3 w-3" />
                {missingText}
            </span>
        );
    }

    return (
        <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em]",
            verified
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                : "border-rose-400/25 bg-rose-400/10 text-rose-200"
        )}>
            {verified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {verified ? "Verified" : "Unverified"}
        </span>
    );
}

export default function ProfilePage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState<"profile" | "plan">("profile");
    const [storageUsage, setStorageUsage] = useState({ events: 0, vault: 0, total: 0 });
    const [photosCount, setPhotosCount] = useState(0);
    const [eventCount, setEventCount] = useState(0);
    const [joinedCount, setJoinedCount] = useState(0);
    // Each stat shows as soon as its own query returns
    const [loadingStorage, setLoadingStorage] = useState(true);
    const [photosCountLoaded, setPhotosCountLoaded] = useState(false);
    const [eventCountLoaded, setEventCountLoaded] = useState(false);
    const [joinedCountLoaded, setJoinedCountLoaded] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [removingImage, setRemovingImage] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");
    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
    const [verification, setVerification] = useState({ email: false, phone: false });
    const [form, setForm] = useState({
        name: "",
        email: "",
        username: "",
        phone: "",
        location: "",
        gender: "",
        birthday: "",
        persona: ["Guest"],
    });

    const subscriptionStatus = user
        ? getSubscriptionStatus({
            role: user.role,
            planStartDate: user.planStartDate,
            planEndDate: user.planEndDate,
        })
        : null;
    const activePlan = getPlanDetails(user?.role);
    const pendingPlan = getPlanDetails(user?.pendingPlanRole);
    const hasPendingPlanChange = Boolean(user?.pendingPlanRole && user?.pendingPlanStartDate);

    // Read initial tab from URL if present
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const tabParam = params.get("tab");
            if (tabParam === "plan" || tabParam === "pricing") {
                setActiveTab("plan");
            }
        }
    }, []);

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, router, user]);

    useEffect(() => {
        if (!user) return;
        setProfileImage(user.profileImage || null);
        setForm({
            name: user.name || "",
            email: user.email || "",
            username: user.username || "",
            phone: user.phone && user.phone !== "No Phone" ? user.phone : "",
            location: user.location || "",
            gender: user.gender || "",
            birthday: user.birthday || "",
            persona: getPersonasArray(user.persona),
        });
    }, [user]);

    // Keyed on the id/email/phone values, not the user object: the auth context replaces the object when the
    // full profile arrives, which used to restart every query and leave the stats on "..." twice as long.
    const userUid = user?.uid;
    const userEmail = user?.email;
    const userPhone = user?.phone;

    useEffect(() => {
        if (!userUid) return;

        const loadVerificationStatus = async () => {
            const { data } = await supabase.auth.getUser();
            const authUser = data.user;
            const authUserRecord = authUser as Record<string, unknown> | null;
            const authEmail = authUser?.email?.toLowerCase();
            const profileEmail = userEmail?.toLowerCase();
            setVerification({
                email: Boolean(authUser?.email_confirmed_at && authEmail && authEmail === profileEmail),
                phone: Boolean(authUserRecord?.phone_confirmed_at && authUserRecord?.phone && authUserRecord.phone === userPhone),
            });
        };

        void loadVerificationStatus();
    }, [userUid, userEmail, userPhone]);

    useEffect(() => {
        if (!userUid) return;
        const identifiers = [userUid, userEmail, userPhone].filter(Boolean) as string[];
        let cancelled = false;

        setLoadingStorage(true);
        setJoinedCountLoaded(false);
        getUserStorageBreakdown(identifiers)
            .then((storage) => { if (!cancelled) setStorageUsage(storage); })
            .catch((error) => console.error("Profile storage load failed:", error))
            .finally(() => { if (!cancelled) setLoadingStorage(false); });
        getApprovedSharedEventsForUser(identifiers)
            .then((joined) => { if (!cancelled) setJoinedCount(joined.length); })
            .finally(() => { if (!cancelled) setJoinedCountLoaded(true); });

        return () => { cancelled = true; };
    }, [userUid, userEmail, userPhone]);

    useEffect(() => {
        if (!userUid) return;
        let cancelled = false;

        setPhotosCountLoaded(false);
        setEventCountLoaded(false);
        getUserPhotosCount(userUid)
            .then((count) => { if (!cancelled) setPhotosCount(count); })
            .finally(() => { if (!cancelled) setPhotosCountLoaded(true); });
        getUserEventCount(userUid)
            .then((count) => { if (!cancelled) setEventCount(count); })
            .finally(() => { if (!cancelled) setEventCountLoaded(true); });

        return () => { cancelled = true; };
    }, [userUid]);

    useEffect(() => {
        if (!isEditing || !user) return;
        const normalized = form.username.trim().toLowerCase();

        if (normalized === (user.username || "").toLowerCase()) {
            setUsernameStatus("idle");
            return;
        }

        if (!isValidUsername(normalized)) {
            setUsernameStatus(normalized ? "invalid" : "idle");
            return;
        }

        setUsernameStatus("checking");
        const timer = window.setTimeout(async () => {
            const unique = await isUsernameUnique(normalized, user.uid);
            setUsernameStatus(unique ? "available" : "taken");
        }, 500);

        return () => window.clearTimeout(timer);
    }, [form.username, isEditing, user]);

    const updateForm = (field: keyof typeof form, value: string | string[]) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user?.uid) return;
        if (!file.type.startsWith("image/")) {
            setSaveError("Please select an image file.");
            return;
        }

        setUploading(true);
        setSaveError("");
        try {
            const presignedUrlEndpoint = getApiUrl("/api/v1/media/get-upload-url");
            const presignedRes = await fetch(presignedUrlEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: `profiles/${user.uid}/profile_pic.jpg`, resourceType: "image" }),
            });
            const presignedData = await presignedRes.json().catch(() => ({}));

            if (!presignedRes.ok || !presignedData.uploadUrl) {
                throw new Error(presignedData.error || "Failed to get upload URL");
            }

            const uploadRes = await fetch(presignedData.uploadUrl, {
                method: "POST",
                headers: {
                    Authorization: presignedData.authorizationToken,
                    "Content-Type": file.type || "image/jpeg",
                    "X-Bz-File-Name": encodeURIComponent(`profiles/${user.uid}/profile_pic.jpg`),
                    "X-Bz-Content-Sha1": "do_not_verify",
                },
                body: file,
            });

            if (!uploadRes.ok) {
                throw new Error("Failed to upload image bytes to storage.");
            }

            const mediaDomain = (process.env.NEXT_PUBLIC_MEDIA_DOMAIN || "media.evebash.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");
            const publicUrl = `https://${mediaDomain}/profiles/${user.uid}/profile_pic.jpg`;

            await updateUserProfileImage(user.uid, publicUrl);
            setProfileImage(publicUrl);
            setSaveMessage("Profile photo updated.");
            window.setTimeout(() => setSaveMessage(""), 2500);
            setUploading(false);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to upload profile photo.";
            console.error("Profile image upload failed:", err);
            setSaveError(errorMessage);
            setUploading(false);
        } finally {
            event.target.value = "";
        }
    };

    const handleRemoveProfileImage = async () => {
        if (!user?.uid || !profileImage || removingImage) return;
        if (!(await confirmDialog({ title: "Remove profile photo?", message: "Your profile photo will be removed from your account.", confirmLabel: "Remove", tone: "danger" }))) return;

        setRemovingImage(true);
        setSaveError("");
        setSaveMessage("");

        try {
            const { data } = await supabase.auth.getSession();
            const accessToken = data.session?.access_token;
            if (!accessToken) {
                setSaveError("Please sign in again before removing your profile photo.");
                return;
            }

            const response = await fetch(getApiUrl("/api/media/profile-image"), {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                setSaveError(result.error || "Failed to remove profile photo.");
                return;
            }

            setProfileImage(null);
            setSaveMessage("Profile photo removed.");
            window.setTimeout(() => setSaveMessage(""), 2500);
        } catch {
            setSaveError("Failed to remove profile photo.");
        } finally {
            setRemovingImage(false);
        }
    };

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!user) return;

        const username = form.username.trim().toLowerCase();
        const email = form.email.trim().toLowerCase();
        if (!form.name.trim()) {
            setSaveError("Full name cannot be empty.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setSaveError("Please enter a valid email address.");
            return;
        }
        if (!isValidUsername(username) || usernameStatus === "taken" || usernameStatus === "checking") {
            setSaveError("Please choose a valid and available username.");
            return;
        }

        setSaving(true);
        setSaveError("");
        setSaveMessage("");
        const ok = await updateUserProfile(user.uid, {
            name: form.name.trim(),
            email,
            username,
            phone: form.phone.trim(),
            location: form.location.trim(),
            gender: form.gender,
            birthday: form.birthday.trim(),
            persona: form.persona,
        });
        setSaving(false);

        if (ok) {
            setIsEditing(false);
            setSaveMessage("Profile updated successfully.");
            window.setTimeout(() => setSaveMessage(""), 2500);
        } else {
            setSaveError("Failed to update profile. Please try again.");
        }
    };

    const togglePersona = (persona: string) => {
        const selected = form.persona.includes(persona);
        if (selected && form.persona.length === 1) return;
        updateForm("persona", selected ? form.persona.filter((item) => item !== persona) : [...form.persona, persona]);
    };

    if (authLoading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
                <Loader2 className="h-8 w-8 animate-spin text-[#E2B77F]" />
            </div>
        );
    }

    const currentRoleKey = user.role ? user.role.toLowerCase() : "free";

    return (
        <div className="min-h-screen bg-[#13191F] text-slate-100 selection:bg-[#CA9C68]/30 selection:text-[#FFF7EB]">
            <Navbar />

            <main className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
                
                {/* ========================================================
                    BENTO HEADER: User Identity & Global Sub-Navigation
                    ======================================================== */}
                <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900/50 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
                    {/* Background Subtle Gradient Blobs */}
                    <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[#CA9C68]/10 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-[#CA9C68]/5 blur-3xl" />

                    <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        {/* User Identity Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                            {/* Avatar with gold ring & upload trigger */}
                            <div className="group relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] border-2 border-[#CA9C68]/50 bg-slate-950 shadow-xl shadow-black/30 ring-4 ring-[#13191F]">
                                {profileImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={profileImage} alt={user.name || "Profile"} className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-10 w-10 text-slate-500" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    title="Change profile photo"
                                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover:opacity-100 disabled:cursor-not-allowed"
                                >
                                    {uploading ? (
                                        <Loader2 className="h-6 w-6 animate-spin text-[#E2B77F]" />
                                    ) : (
                                        <Camera className="h-6 w-6 text-[#E2B77F]" />
                                    )}
                                </button>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleImageUpload}
                            />

                            <div>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                                        {user.name || "EveBash User"}
                                    </h1>
                                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">
                                        {activePlan.name}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-sm font-bold text-[#CA9C68]">
                                    @{user.username || "set_username"}
                                </p>
                                
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {getPersonasArray(user.persona).map((persona) => (
                                        <span
                                            key={persona}
                                            className="rounded-xl border border-slate-700 bg-slate-800/50 px-2.5 py-1 text-[11px] font-bold text-slate-300"
                                        >
                                            {persona}
                                        </span>
                                    ))}
                                    <span className="rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                                        Member since {formatJoinedDate(user.createdAt)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Top Action CTAs */}
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CA9C68] px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-[#D7AE7D] shadow-lg shadow-[#CA9C68]/20"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit Profile
                            </button>
                            <Link
                                href="/settings"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-black text-slate-200 transition hover:border-[#CA9C68]/60 hover:text-white"
                            >
                                <Settings className="h-3.5 w-3.5" />
                                Settings
                            </Link>
                        </div>
                    </div>

                    {/* Sub-Page Tab Switcher Pills */}
                    <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-6">
                        <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-950/80 p-1.5 shadow-inner">
                            <button
                                type="button"
                                onClick={() => setActiveTab("profile")}
                                className={cn(
                                    "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all duration-200",
                                    activeTab === "profile"
                                        ? "bg-[#CA9C68] text-slate-950 shadow-md shadow-[#CA9C68]/20"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <User className="h-3.5 w-3.5" />
                                Profile Overview
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("plan")}
                                className={cn(
                                    "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all duration-200",
                                    activeTab === "plan"
                                        ? "bg-[#CA9C68] text-slate-950 shadow-md shadow-[#CA9C68]/20"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Layers className="h-3.5 w-3.5" />
                                Plan & Tiers (Tabular)
                            </button>
                        </div>

                        {/* Quick Storage Status Indicator */}
                        <div className="hidden sm:flex items-center gap-3 text-xs">
                            <span className="text-slate-400 font-semibold">Active Quota:</span>
                            <span className="font-bold text-[#E2B77F]">
                                {loadingStorage ? "..." : formatStorageSize(storageUsage.total)} / {activePlan.storageLabel}
                            </span>
                        </div>
                    </div>
                </section>

                {/* ========================================================
                    SUB-VIEW 1: PROFILE OVERVIEW (BENTO GRID)
                    ======================================================== */}
                {activeTab === "profile" && (
                    <div className="mt-8 space-y-8 animate-fade-in-up">
                        
                        {/* 1. Activity Telemetry Bento Row (3 Cards) */}
                        <section>
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#CA9C68]">
                                    Activity & Engagement
                                </h2>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {[
                                    {
                                        label: "Photos Added",
                                        value: photosCountLoaded ? photosCount : "...",
                                        icon: Upload,
                                        subtext: "Preserved securely in cloud",
                                    },
                                    {
                                        label: "Events Hosted",
                                        value: eventCountLoaded ? eventCount : "...",
                                        icon: Camera,
                                        subtext: `${activePlan.eventLimit === Infinity ? "Unlimited" : activePlan.eventLimit} event quota on plan`,
                                    },
                                    {
                                        label: "Events Joined",
                                        value: joinedCountLoaded ? joinedCount : "...",
                                        icon: Users,
                                        subtext: "Active attendee access",
                                    },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        title={item.subtext}
                                        className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3 transition-colors duration-200 hover:border-[#CA9C68]/40"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#CA9C68]/10 text-[#E2B77F] ring-1 ring-[#CA9C68]/20">
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xl font-black leading-tight text-white">{item.value}</p>
                                            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                {item.label}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* 2. Main Asymmetric Bento Grid: Account Info + Live Telemetry */}
                        <div className="grid gap-8 lg:grid-cols-12">
                            
                            {/* Left Bento Column (8 Cols): Personal Credentials Dossier */}
                            <div className="space-y-6 lg:col-span-8">
                                <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 shadow-xl">
                                    <div className="mb-6 flex items-center justify-between">
                                        <div>
                                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#CA9C68]">
                                                Personal Dossier
                                            </h2>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                Private account specifications and verified credentials.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(true)}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-[#CA9C68]/30 bg-[#CA9C68]/10 px-3.5 py-1.5 text-xs font-black text-[#E2B77F] transition hover:bg-[#CA9C68]/20"
                                        >
                                            <Pencil className="h-3 w-3" />
                                            Edit
                                        </button>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <InfoItem
                                            icon={User}
                                            label="Full Name"
                                            value={user.name || "Not set"}
                                        />
                                        <InfoItem
                                            icon={User}
                                            label="Username"
                                            value={`@${user.username || "set_username"}`}
                                        />
                                        <InfoItem
                                            icon={Mail}
                                            label="Email Address"
                                            value={user.email || "Not provided"}
                                            badge={
                                                <VerificationBadge
                                                    verified={verification.email}
                                                    missing={!user.email}
                                                    missingText="Needs Entry"
                                                />
                                            }
                                        />
                                        <InfoItem
                                            icon={Phone}
                                            label="Phone Number"
                                            value={user.phone && user.phone !== "No Phone" ? user.phone : "Not provided"}
                                            badge={
                                                <VerificationBadge
                                                    verified={verification.phone}
                                                    missing={!user.phone || user.phone === "No Phone"}
                                                    missingText="Needs Entry"
                                                />
                                            }
                                        />
                                        <InfoItem
                                            icon={MapPin}
                                            label="Location"
                                            value={user.location || "Not set"}
                                        />
                                        <InfoItem
                                            icon={User}
                                            label="Gender"
                                            value={user.gender || "Not specified"}
                                        />
                                        <InfoItem
                                            icon={Gift}
                                            label="Birthday"
                                            value={user.birthday || "Not specified"}
                                        />
                                        <InfoItem
                                            icon={Calendar}
                                            label="Joined EveBash"
                                            value={formatJoinedDate(user.createdAt)}
                                        />
                                    </div>
                                </section>
                            </div>

                            {/* Right Bento Column (4 Cols): Plan Snapshot & Quick Actions */}
                            <div className="space-y-6 lg:col-span-4">
                                
                                {/* Live Storage Card with direct tab switch */}
                                <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#CA9C68]/10 text-[#E2B77F]">
                                                <HardDrive className="h-4 w-4" />
                                            </div>
                                            <h3 className="font-black text-white text-sm">Storage Usage</h3>
                                        </div>
                                        <span className="text-xs font-bold text-slate-400">
                                            {activePlan.storageLabel} limit
                                        </span>
                                    </div>

                                    <StorageBreakdownCard
                                        usage={storageUsage}
                                        planBytes={activePlan.storageBytes}
                                        planLabel={activePlan.storageLabel}
                                        loading={loadingStorage}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("plan")}
                                        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-black text-[#E2B77F] transition hover:border-[#CA9C68]/60 hover:bg-slate-800"
                                    >
                                        View Plan Matrix & Quotas
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </button>
                                </section>

                                {/* EB Vault Card */}
                                <Link
                                    href="/vault"
                                    className="group flex w-full items-center gap-3.5 rounded-3xl border border-[#7FA38C]/30 bg-[#7FA38C]/10 p-5 transition-all duration-200 hover:border-[#7FA38C]/60 hover:bg-[#7FA38C]/15 shadow-lg"
                                >
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7FA38C]/20 text-[#7FA38C] transition group-hover:scale-105">
                                        <HardDrive className="h-6 w-6" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block font-black text-white text-sm">EB Vault</span>
                                        <span className="block text-xs font-semibold text-slate-400">
                                            Private client & personal storage locker
                                        </span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
                                </Link>

                                {/* Active Plan & Sign Out */}
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={() => router.push("/pricing")}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#CA9C68]/40 bg-[#CA9C68]/10 px-5 py-3.5 text-xs font-black text-[#E2B77F] transition hover:bg-[#CA9C68]/20 shadow-md shadow-black/30"
                                    >
                                        <Sparkles className="h-4 w-4 text-[#CA9C68]" />
                                        Extend / Upgrade Plan
                                    </button>

                                    <button
                                        type="button"
                                        onClick={logout}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-xs font-black text-rose-300 transition hover:bg-rose-500/20"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Sign Out
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================
                    SUB-VIEW 2: PLAN & USAGE (TABULAR FORM)
                    ======================================================== */}
                {activeTab === "plan" && (
                    <div className="mt-8 space-y-8 animate-fade-in-up">
                        
                        {/* 1. Active Plan Hero Banner with EXTEND PLAN button */}
                        <section className="relative overflow-hidden rounded-[2.5rem] border border-[#CA9C68]/40 bg-gradient-to-r from-[#CA9C68]/15 via-[#1B211F]/90 to-[#13191F] p-6 sm:p-8 shadow-2xl">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-[#CA9C68] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                                            Active Subscription
                                        </span>
                                        <span className="text-xs font-bold text-[#E2B77F]">
                                            Tier: {activePlan.name}
                                        </span>
                                    </div>
                                    <h2 className="mt-3 text-2xl sm:text-3xl font-black text-white">
                                        {activePlan.name} · {activePlan.storageLabel} Cloud Allocation
                                    </h2>
                                    <p className="mt-1.5 text-xs text-slate-300 max-w-2xl leading-relaxed">
                                        Your subscription enables {activePlan.storageLabel} shared storage for hosted event galleries and private EB Vault files with {activePlan.eventLimit === Infinity ? "unlimited" : activePlan.eventLimit} event hosting capacity.
                                    </p>

                                    {/* Plan Validity Date Notice */}
                                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold">
                                        <span className="flex items-center gap-1.5 text-slate-300">
                                            <Clock className="h-4 w-4 text-[#CA9C68]" />
                                            Valid until: <strong className="text-[#E2B77F]">{formatPlanDate(user?.planEndDate)}</strong>
                                        </span>
                                        {subscriptionStatus?.message && (
                                            <span className={cn(
                                                "rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                                                subscriptionStatus.tone === "danger"
                                                    ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                                                    : "border-amber-400/30 bg-amber-400/10 text-amber-200"
                                            )}>
                                                {subscriptionStatus.message}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Plan Action Buttons: Extend Plan connects to pricing page */}
                                <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => router.push("/pricing")}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CA9C68] px-6 py-3.5 text-xs font-black text-slate-950 transition hover:bg-[#D7AE7D] shadow-xl shadow-[#CA9C68]/20 whitespace-nowrap"
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        Extend Plan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push("/pricing")}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 px-5 py-3.5 text-xs font-black text-slate-200 transition hover:border-[#CA9C68]/60 hover:text-white whitespace-nowrap"
                                    >
                                        Change Plan
                                    </button>
                                </div>
                            </div>

                            {/* Scheduled Pending Plan Notification */}
                            {hasPendingPlanChange && (
                                <div className="mt-6 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4 text-sky-200">
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-400">Scheduled Tier Upgrade</p>
                                    <p className="mt-1 text-sm font-bold text-white">
                                        {pendingPlan.name} ({pendingPlan.storageLabel}) starts {formatPlanDate(user?.pendingPlanStartDate)}.
                                    </p>
                                </div>
                            )}
                        </section>

                        {/* 2. Real-time Storage Breakdown Telemetry */}
                        <section className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 shadow-xl">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#CA9C68] mb-4">
                                Live Storage Meter
                            </h3>
                            <StorageBreakdownCard
                                usage={storageUsage}
                                planBytes={activePlan.storageBytes}
                                planLabel={activePlan.storageLabel}
                                loading={loadingStorage}
                            />
                        </section>

                        {/* 3. Comprehensive Plan Comparison Matrix (Tabular Form) */}
                        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 shadow-2xl">
                            <div className="border-b border-slate-800 bg-slate-950/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                                        All Membership Plans & Quotas (Tabular Comparison)
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Compare storage capacity, event caps, video uploads, and monthly/annual pricing schedules.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => router.push("/pricing")}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#CA9C68] hover:text-[#E2B77F] transition"
                                >
                                    Full Pricing Breakdown
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider font-extrabold text-[11px]">
                                        <tr>
                                            <th className="py-4 px-5">Plan Tier</th>
                                            <th className="py-4 px-4">Cloud Storage</th>
                                            <th className="py-4 px-4">Event Limit</th>
                                            <th className="py-4 px-4">Video Uploads</th>
                                            <th className="py-4 px-4">Monthly Rate</th>
                                            <th className="py-4 px-4">Annual Rate (Save ~30%)</th>
                                            <th className="py-4 px-5 text-right">Status / Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#CA9C68]/10 font-semibold">
                                        {defaultPricingPlans.map((plan) => {
                                            const isActive = plan.id.toLowerCase() === currentRoleKey;
                                            return (
                                                <tr
                                                    key={plan.id}
                                                    className={cn(
                                                        "transition-colors",
                                                        isActive
                                                            ? "bg-[#CA9C68]/15 border-y-2 border-[#CA9C68]/60"
                                                            : "hover:bg-slate-800/30"
                                                    )}
                                                >
                                                    {/* Plan Name */}
                                                    <td className="py-4 px-5">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("font-black text-sm", isActive ? "text-[#E2B77F]" : "text-white")}>
                                                                {plan.name}
                                                            </span>
                                                            {isActive && (
                                                                <span className="rounded-full bg-[#CA9C68] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-950">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Storage */}
                                                    <td className="py-4 px-4 font-bold text-slate-200">
                                                        {plan.storageLabel}
                                                    </td>

                                                    {/* Events */}
                                                    <td className="py-4 px-4 text-slate-300">
                                                        {plan.events} {plan.events === 1 ? "Event" : "Events"}
                                                    </td>

                                                    {/* Video */}
                                                    <td className="py-4 px-4">
                                                        {plan.videoUpload ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                                                <Video className="h-3.5 w-3.5" />
                                                                {plan.videoLimitMb ? `Up to ${plan.videoLimitMb} MB` : "Included"}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500 font-medium">None</span>
                                                        )}
                                                    </td>

                                                    {/* Monthly */}
                                                    <td className="py-4 px-4 text-slate-200">
                                                        {plan.monthlyPrice === 0 ? "Free" : `₹${plan.monthlyPrice.toLocaleString("en-IN")} / mo`}
                                                    </td>

                                                    {/* Yearly */}
                                                    <td className="py-4 px-4">
                                                        {plan.discountedYearlyPrice === 0 ? (
                                                            <span className="text-slate-500">Free</span>
                                                        ) : (
                                                            <span className="font-bold text-[#E2B77F]">
                                                                ₹{plan.discountedYearlyPrice.toLocaleString("en-IN")} / yr
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Status / Action */}
                                                    <td className="py-4 px-5 text-right">
                                                        {isActive ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-black text-emerald-300">
                                                                <Check className="h-3 w-3" />
                                                                Current Plan
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => router.push("/pricing")}
                                                                className={cn(
                                                                    "rounded-xl px-3.5 py-1.5 text-[11px] font-black transition",
                                                                    plan.storageGb > (activePlan.storageBytes / (1024 * 1024 * 1024))
                                                                        ? "bg-[#CA9C68] text-slate-950 hover:bg-[#D7AE7D] shadow-md shadow-[#CA9C68]/10"
                                                                        : "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                                                                )}
                                                            >
                                                                {plan.storageGb > (activePlan.storageBytes / (1024 * 1024 * 1024))
                                                                    ? "Upgrade"
                                                                    : "Select Tier"}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                    </div>
                )}

                {/* Toast Feedback */}
                {(saveMessage || saveError) && (
                    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900/95 px-5 py-3 text-sm font-bold shadow-2xl backdrop-blur-md">
                        <span className={saveError ? "text-rose-300" : "text-emerald-300"}>
                            {saveError || saveMessage}
                        </span>
                    </div>
                )}
            </main>

            {/* ========================================================
                EDIT PROFILE MODAL
                ======================================================== */}
            {isEditing && (
                <div className={modalStyles.overlay} onMouseDown={() => !saving && setIsEditing(false)}>
                    <form
                        onSubmit={handleSave}
                        onMouseDown={(event) => event.stopPropagation()}
                        className={cn(modalStyles.panel, "max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto sm:p-8")}
                    >
                        <ModalHeader title="Edit Profile" onClose={() => !saving && !removingImage && setIsEditing(false)} />

                        {/* Photo edit header */}
                        <div className="mb-8 flex flex-col items-center rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
                            <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-[#CA9C68]/60 bg-slate-950 text-slate-500 shadow-xl">
                                {profileImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={profileImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-10 w-10" />
                                )}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                    disabled={uploading || removingImage || saving}
                                    className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-black text-sky-300 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                                    Change Profile Photo
                                </button>
                                {profileImage ? (
                                    <button
                                        type="button"
                                        onClick={handleRemoveProfileImage}
                                        disabled={removingImage || uploading || saving}
                                        className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-black text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {removingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                        Remove Profile Photo
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {/* Form Fields Grid */}
                        <div className="grid gap-5 sm:grid-cols-2">
                            {[
                                { field: "name", label: "Full Name", placeholder: "Enter full name", required: true },
                                { field: "email", label: "Email Address", placeholder: "name@example.com", required: true },
                                { field: "username", label: "Username", placeholder: "username", required: true },
                                { field: "phone", label: "Phone Number", placeholder: "e.g. +91 98765 43210" },
                                { field: "location", label: "Location", placeholder: "e.g. Mumbai, Maharashtra" },
                                { field: "birthday", label: "Birthday", placeholder: "e.g. October 24" },
                            ].map(({ field, label, placeholder, required }) => (
                                <label key={field} className="block">
                                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                                        {label}
                                        {required && <span className="ml-1 text-[#CA9C68]">*</span>}
                                    </span>
                                    <input
                                        value={form[field as keyof typeof form] as string}
                                        onChange={(event) =>
                                            updateForm(
                                                field as keyof typeof form,
                                                field === "username"
                                                    ? event.target.value.replace(/\s+/g, "").toLowerCase()
                                                    : field === "email"
                                                        ? event.target.value.trim().toLowerCase()
                                                        : event.target.value
                                            )
                                        }
                                        placeholder={placeholder}
                                        type={field === "email" ? "email" : "text"}
                                        required={Boolean(required)}
                                        maxLength={field === "username" ? 12 : undefined}
                                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-[#CA9C68]"
                                    />
                                    {field === "username" && usernameStatus !== "idle" && (
                                        <span className={cn(
                                            "mt-2 flex items-center gap-1 text-xs font-bold",
                                            usernameStatus === "available" ? "text-emerald-300" : usernameStatus === "checking" ? "text-slate-400" : "text-rose-300"
                                        )}>
                                            {usernameStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin" />}
                                            {usernameStatus === "available" && <CheckCircle2 className="h-3 w-3" />}
                                            {(usernameStatus === "taken" || usernameStatus === "invalid") && <XCircle className="h-3 w-3" />}
                                            {usernameStatus === "checking" && "Checking availability..."}
                                            {usernameStatus === "available" && "Username is available"}
                                            {usernameStatus === "taken" && "Username is already taken"}
                                            {usernameStatus === "invalid" && "Use 3-12 lowercase letters/numbers. Dots/underscores allowed only inside, not repeated."}
                                        </span>
                                    )}
                                </label>
                            ))}
                        </div>

                        {/* Gender Selector */}
                        <div className="mt-6">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Gender</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {genderOptions.map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => updateForm("gender", item)}
                                        className={cn(
                                            "rounded-full border px-3 py-2 text-xs font-black transition",
                                            form.gender === item
                                                ? "border-[#CA9C68] bg-[#CA9C68] text-slate-950"
                                                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
                                        )}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Persona Selector */}
                        <div className="mt-6">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">I am a...</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {personaOptions.map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => togglePersona(item)}
                                        className={cn(
                                            "rounded-full border px-3 py-2 text-xs font-black transition",
                                            form.persona.includes(item)
                                                ? "border-[#CA9C68] bg-[#CA9C68] text-slate-950"
                                                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
                                        )}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {saveError && (
                            <p className="mt-5 flex items-center gap-2 text-sm font-bold text-rose-300">
                                <AlertCircle className="h-4 w-4" />
                                {saveError}
                            </p>
                        )}

                        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => !saving && setIsEditing(false)}
                                className={modalStyles.secondary}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving || usernameStatus === "checking" || usernameStatus === "taken" || usernameStatus === "invalid"}
                                className={modalStyles.primary}
                            >
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
