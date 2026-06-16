"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Business,
  createBusiness,
  generateShortId,
  getBusinessTypeColor,
  getUserBusinesses,
  getUserTotalStorage,
  updateBusiness,
} from "@/lib/database";
import { formatStorageSize } from "@/lib/planLimits";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  LocateFixed,
  Plus,
  Server,
  Store,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

const BUSINESS_TYPES = [
  "Anchors", "Apparel", "Catering", "Decor", "Event Planner",
  "Food Stalls", "Gifts", "Invitations", "Lighting", "Makeup",
  "Music & DJ", "Photography", "Security", "Staff", "Travel",
  "Trophies", "Venue", "Videography",
];

const BENEFITS = [
  { title: "Reach Event Organizers", desc: "Connect with people planning sports tournaments, corporate meets, weddings, and celebrations.", icon: Users },
  { title: "Smart Analytics", desc: "Track your profile views, enquiries, shortlists, rating, and growth from one place.", icon: BarChart3 },
  { title: "Premium Portfolio", desc: "Showcase your work to a diverse audience with high-resolution business galleries.", icon: ImageIcon },
];

const DEFAULT_BUSINESS_COVER = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800";

function getBusinessLimit(role?: string | null) {
  if (role === "premium" || role === "elite" || role === "admin") return Infinity;
  if (role === "standard") return 5;
  return 1;
}

function formatStartedDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function BizHubPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [fetching, setFetching] = useState(true);
  const [storageUsed, setStorageUsed] = useState(0);
  const [showListingForm, setShowListingForm] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [locating, setLocating] = useState(false);

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [description, setDescription] = useState("");
  const [startedDate, setStartedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventsHosted, setEventsHosted] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setOwnerName(user.name || "");
    setOwnerEmail(user.email || "");
    setOwnerPhone(user.phone || "");
  }, [user]);

  const fetchBusinesses = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const identifiers = [user.uid];
      if (user.email) identifiers.push(user.email);
      if (user.phone) identifiers.push(user.phone);
      const [userBusinesses, storage] = await Promise.all([
        getUserBusinesses(user.uid),
        getUserTotalStorage(identifiers),
      ]);
      setBusinesses(userBusinesses);
      setStorageUsed(storage);
    } catch (error) {
      console.error("Error fetching businesses:", error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading && user) {
      fetchBusinesses();
    }
  }, [loading, user]);

  const resetForm = () => {
    setName("");
    setOwnerName(user?.name || "");
    setOwnerEmail(user?.email || "");
    setOwnerPhone(user?.phone || "");
    setBusinessType("");
    setDescription("");
    setStartedDate(new Date().toISOString().slice(0, 10));
    setEventsHosted("");
    setLocation(null);
    setMessage("");
  };

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      setMessageType("error");
      setMessage("Location is not available in this browser.");
      return;
    }

    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: `${position.coords.latitude.toFixed(4)}°, ${position.coords.longitude.toFixed(4)}°`,
        };
        setLocation(coords);
        setLocating(false);
      },
      (error) => {
        setMessageType("error");
        setMessage(error.message || "Could not fetch your location. Please check location permission.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000 }
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (!name.trim() || !ownerName.trim() || !ownerEmail.trim() || !ownerPhone.trim() || !businessType) {
      setMessageType("error");
      setMessage("Please fill in all basic fields.");
      return;
    }

    const maxBusinesses = getBusinessLimit(user.role);
    if (businesses.length >= maxBusinesses) {
      setMessageType("error");
      setMessage("You have reached your business listing limit for this plan.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const start = new Date(startedDate);
      const experience = Number.isNaN(start.getTime())
        ? 0
        : Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)));

      const result = await createBusiness({
        name: name.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerPhone: ownerPhone.trim(),
        type: businessType,
        tags: [],
        location: location || { latitude: 0, longitude: 0 },
        description: description.trim(),
        startedDate: start,
        experience,
        eventsHosted: Number.parseInt(eventsHosted, 10) || 0,
        rating: 0,
        coverImage: DEFAULT_BUSINESS_COVER,
        createdBy: user.uid,
        status: "created",
        shortId: generateShortId(),
      });

      if (!result) throw new Error("Failed to create business.");

      setMessageType("success");
      setMessage("Your business has been created.");
      await fetchBusinesses();
      setTimeout(() => {
        setShowListingForm(false);
        resetForm();
      }, 1000);
    } catch (error) {
      console.error("Error creating business:", error);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Failed to create business.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (business: Business) => {
    const nextStatus = business.status === "published" ? "created" : "published";
    setBusinesses(prev => prev.map(item => item.id === business.id ? { ...item, status: nextStatus } : item));
    const success = await updateBusiness(business.id, { status: nextStatus });
    if (!success) {
      setBusinesses(prev => prev.map(item => item.id === business.id ? { ...item, status: business.status } : item));
    }
  };

  const maxBusinesses = getBusinessLimit(user?.role);
  const businessPercent = maxBusinesses === Infinity ? 0 : Math.min(100, Math.round((businesses.length / maxBusinesses) * 100));
  const activePlanName = useMemo(() => {
    const role = user?.role || "free";
    if (role === "free" || role === "freemium") return "Freemium";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }, [user?.role]);

  if (loading || fetching) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-400/10 text-indigo-300">
              <Briefcase className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black">Biz Hub</h1>
              <p className="mt-1 text-sm font-semibold text-slate-400">Connect with clients and manage your business profile.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowQuotaModal(true)}
              className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-left"
            >
              <Server className="h-5 w-5 text-indigo-300" />
              <span>
                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Storage & Quota</span>
                <span className="text-sm font-black">{formatStorageSize(storageUsed)}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowListingForm(true)}
              className="flex items-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-black text-slate-950"
            >
              <Plus className="h-4 w-4" />
              <span>List New Business</span>
            </button>
          </div>
        </header>

        {businesses.length > 0 ? (
          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/60 p-6">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-300">Partner Hub</p>
                <h2 className="mt-1 text-2xl font-black">Your Businesses</h2>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {businesses.map((business) => {
                const typeColors = getBusinessTypeColor(business.type);
                return (
                  <article key={business.id} className="flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-950 sm:flex-row">
                    <div className="relative h-48 bg-slate-900 sm:h-auto sm:w-48">
                      <img src={business.coverImage || DEFAULT_BUSINESS_COVER} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 blur-xl" />
                      <img src={business.coverImage || DEFAULT_BUSINESS_COVER} alt={business.name} className="relative h-full w-full object-contain" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full border px-3 py-1 text-xs font-black"
                            style={{ backgroundColor: typeColors.bg, borderColor: typeColors.border, color: typeColors.text }}
                          >
                            {business.type}
                          </span>
                          <span className="flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs font-black uppercase text-slate-300">
                            <span className={`h-2 w-2 rounded-full ${business.status === "published" ? "bg-emerald-400" : "bg-amber-400"}`} />
                            {business.status}
                          </span>
                        </div>
                        <h3 className="truncate text-xl font-black">{business.name}</h3>
                        <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-400">
                          {business.description || "Add business details, portfolio, services, and announcements to attract clients."}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-2xl bg-slate-900 p-3">
                          <p className="text-xs font-black text-slate-500">Views</p>
                          <p className="mt-1 font-black">{business.profileViews || 0}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-900 p-3">
                          <p className="text-xs font-black text-slate-500">Events</p>
                          <p className="mt-1 font-black">{business.eventsHosted || 0}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-900 p-3">
                          <p className="text-xs font-black text-slate-500">Rating</p>
                          <p className="mt-1 font-black">{business.rating || 0}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => togglePublish(business)}
                          className="rounded-full bg-indigo-400 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950"
                        >
                          {business.status === "published" ? "Unpublish Listing" : "Publish to Marketplace"}
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/marketplace`)}
                          className="rounded-full border border-slate-700 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-300"
                        >
                          View Marketplace
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-black/20">
            <div className="absolute right-0 top-0 h-72 w-72 -translate-y-1/2 translate-x-1/4 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="relative z-10 max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-indigo-200">
                <Store className="h-4 w-4" />
                Partner Hub
              </div>
              <h2 className="text-4xl font-black">Grow Your Business</h2>
              <p className="mt-3 text-base font-semibold leading-7 text-slate-300">
                Connect with event organizers, showcase your premium portfolio, and track your growth with elite analytics.
              </p>
              <button
                type="button"
                onClick={() => setShowListingForm(true)}
                className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-black text-slate-950"
              >
                <span>List New Business</span>
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-2xl font-black">Why Partner With Us?</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {BENEFITS.map(({ title, desc, icon: Icon }) => (
              <div key={title} className="rounded-[1.5rem] border border-slate-800 bg-slate-950 p-5">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-400/10 text-indigo-300">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-black">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showQuotaModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="w-full max-w-lg rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-400/10 text-indigo-300">
                    <Server className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Storage & Quota</h3>
                    <p className="text-sm font-semibold text-slate-400">Your current plan usage</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowQuotaModal(false)} className="rounded-full bg-slate-800 p-2 text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-5 text-sm font-bold text-slate-300">
                Active plan: <span className="text-indigo-300">{activePlanName}</span>
              </p>
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex justify-between text-sm font-black">
                    <span>Storage</span>
                    <span>{formatStorageSize(storageUsed)} / 5 GB</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.min((storageUsed / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-sm font-black">
                    <span>Businesses</span>
                    <span>{businesses.length} / {maxBusinesses === Infinity ? "∞" : maxBusinesses}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${businessPercent}%` }} />
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => router.push("/profile")} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-black text-slate-950">
                <span>Manage Plan</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showListingForm && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-5 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-black">Business Details</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-400">Create your partner profile.</p>
                  </div>
                  <button type="button" onClick={() => { setShowListingForm(false); resetForm(); }} className="rounded-full bg-slate-800 p-2 text-slate-400">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Business Name *</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Royal Photography" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Business Type *</span>
                    <button type="button" onClick={() => setShowCategoryPicker(true)} className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-left text-white">
                      <span className={businessType ? "" : "text-slate-500"}>{businessType || "Select Category"}</span>
                      <ChevronDown className="h-4 w-4 text-indigo-300" />
                    </button>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Owner Name *</span>
                    <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Email *</span>
                    <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Phone *</span>
                    <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Started</span>
                      <input type="date" value={startedDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setStartedDate(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Events Done</span>
                      <input type="number" min="0" value={eventsHosted} onChange={(e) => setEventsHosted(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                    </label>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">About Business</span>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description of your services..." className="min-h-28 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                </label>

                <div>
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Pinpoint Location</span>
                  <button type="button" onClick={handleGetLocation} disabled={locating} className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black ${location ? "border-indigo-400 bg-indigo-400 text-slate-950" : "border-slate-800 bg-slate-950 text-indigo-300"}`}>
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : location ? <Check className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}
                    <span>{location ? `Captured: ${location.address}` : "Use Current GPS"}</span>
                  </button>
                </div>

                {message && (
                  <div className={`rounded-2xl border p-4 text-center text-sm font-bold ${messageType === "error" ? "border-rose-500/30 bg-rose-950/40 text-rose-300" : "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"}`}>
                    {message}
                  </div>
                )}

                <button type="submit" disabled={saving} className="flex w-full items-center justify-center rounded-2xl bg-indigo-400 px-5 py-4 text-sm font-black text-slate-950 disabled:opacity-70">
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Business"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCategoryPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black">Select Category</h3>
                <button type="button" onClick={() => setShowCategoryPicker(false)} className="rounded-full bg-slate-800 p-2 text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {BUSINESS_TYPES.map((item) => (
                  <button key={item} type="button" onClick={() => { setBusinessType(item); setShowCategoryPicker(false); }} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-black ${businessType === item ? "border-indigo-400 bg-indigo-400/10 text-indigo-200" : "border-slate-800 bg-slate-950 text-slate-300"}`}>
                    <span>{item}</span>
                    {businessType === item && <Check className="h-4 w-4 text-indigo-300" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
