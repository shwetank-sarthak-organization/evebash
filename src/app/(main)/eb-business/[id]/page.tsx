"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  Gift,
  Heart,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Save,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Business, BusinessPortfolioMedia, getBusinessById, updateBusiness } from "@/lib/database";
import { uploadEventImage } from "@/lib/storage";
import { useAuth } from "@/context/AuthContext";

const BUSINESS_TYPES = [
  "Anchors", "Apparel", "Catering", "Decor", "Event Planner",
  "Food Stalls", "Gifts", "Invitations", "Lighting", "Makeup",
  "Music & DJ", "Photography", "Security", "Staff", "Travel",
  "Trophies", "Venue", "Videography",
];

const PORTFOLIO_EVENT_TYPE_OPTIONS = [
  { name: "Wedding", icon: Heart },
  { name: "Birthday", icon: Gift },
  { name: "Corporate", icon: Briefcase },
  { name: "Sports", icon: Play },
  { name: "Other", icon: MoreHorizontal },
];
const PORTFOLIO_SORT_OPTIONS = [
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "date-desc", label: "Newest Date" },
  { value: "date-asc", label: "Oldest Date" },
  { value: "type-asc", label: "Type A-Z" },
] as const;
type PortfolioSortValue = typeof PORTFOLIO_SORT_OPTIONS[number]["value"];
const DEFAULT_PORTFOLIO_COVER_IMAGE = "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop";
const DATE_PICKER_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_PICKER_ITEM_HEIGHT = 56;
const TABS = ["Profile", "Portfolio", "Interactions", "Analytics"] as const;
type TabName = typeof TABS[number];

function toDateInput(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function yearsSince(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25)));
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function clampDatePickerValue(value: { month: number; day: number; year: number }) {
  return {
    ...value,
    day: Math.min(value.day, getDaysInMonth(value.month, value.year)),
  };
}

function getDatePartsFromInputValue(value?: string) {
  const normalized = toDateInput(value);
  if (!normalized) {
    const today = new Date();
    return { month: today.getMonth(), day: today.getDate(), year: today.getFullYear() };
  }

  const [year, month, day] = normalized.split("-").map(Number);
  return { month: month - 1, day, year };
}

function formatDatePickerValue(value: { month: number; day: number; year: number }) {
  return `${value.year}-${String(value.month + 1).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function formatFriendlyDatePickerValue(value: { month: number; day: number; year: number }) {
  return new Date(value.year, value.month, value.day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DatePickerColumn({
  options,
  selectedValue,
  onSelect,
}: {
  options: Array<{ label: string; value: number }>;
  selectedValue: number;
  onSelect: (value: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleTimerRef = useRef<number | null>(null);
  const initialSelectedIndexRef = useRef(Math.max(0, options.findIndex(option => option.value === selectedValue)));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: initialSelectedIndexRef.current * DATE_PICKER_ITEM_HEIGHT,
        behavior: "auto",
      });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => () => {
    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
    }
  }, []);

  return (
    <div className="relative min-w-0 flex-1">
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-14 -translate-y-1/2 border-y border-slate-400" />
      <div
        ref={scrollRef}
        className="max-h-56 touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth px-1 py-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          if (settleTimerRef.current) {
            window.clearTimeout(settleTimerRef.current);
          }

          const scrollTop = event.currentTarget.scrollTop;
          settleTimerRef.current = window.setTimeout(() => {
            const index = Math.max(0, Math.min(options.length - 1, Math.round(scrollTop / DATE_PICKER_ITEM_HEIGHT)));
            const option = options[index];
            if (option && option.value !== selectedValue) {
              onSelect(option.value);
            }
          }, 90);
        }}
      >
        {options.map((option) => {
          const isSelected = option.value === selectedValue;

          return (
            <button
              key={`${option.label}-${option.value}`}
              type="button"
              onClick={(event) => {
                onSelect(option.value);
                event.currentTarget.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
              }}
              className={`flex h-14 w-full snap-center items-center justify-center rounded-xl text-center text-xl font-medium transition-colors ${
                isSelected ? "text-slate-950" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ManageBusinessPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const portfolioCoverInputRef = useRef<HTMLInputElement | null>(null);
  const portfolioMediaInputRef = useRef<HTMLInputElement | null>(null);

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>("Profile");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [startedDate, setStartedDate] = useState(toDateInput(undefined));
  const [eventsHosted, setEventsHosted] = useState("");
  const [about, setAbout] = useState("");
  const [coverImages, setCoverImages] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [newService, setNewService] = useState("");
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([]);
  const [portfolioEvents, setPortfolioEvents] = useState<Business["portfolioEvents"]>([]);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioType, setPortfolioType] = useState(PORTFOLIO_EVENT_TYPE_OPTIONS[0].name);
  const [portfolioDate, setPortfolioDate] = useState(new Date().toISOString().slice(0, 10));
  const [portfolioCoverImage, setPortfolioCoverImage] = useState("");
  const [portfolioMedia, setPortfolioMedia] = useState<BusinessPortfolioMedia[]>([]);
  const [showPortfolioDatePicker, setShowPortfolioDatePicker] = useState(false);
  const [portfolioDatePickerValue, setPortfolioDatePickerValue] = useState(() => getDatePartsFromInputValue(new Date().toISOString().slice(0, 10)));
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [portfolioSort, setPortfolioSort] = useState<PortfolioSortValue>("date-desc");
  const [showPortfolioSortMenu, setShowPortfolioSortMenu] = useState(false);

  const bizId = Array.isArray(params.id) ? params.id[0] : params.id;

  const canManage = useMemo(() => {
    if (!user || !business) return false;
    return business.createdBy === user.uid
      || business.admins?.includes(user.uid)
      || business.allowedUsers?.includes(user.uid);
  }, [business, user]);

  const sortedPortfolioEvents = useMemo(() => {
    const parseDate = (value?: string) => {
      const time = value ? new Date(value).getTime() : 0;
      return Number.isNaN(time) ? 0 : time;
    };

    return [...(portfolioEvents || [])].sort((a, b) => {
      if (portfolioSort === "name-asc") return (a.name || "").localeCompare(b.name || "");
      if (portfolioSort === "name-desc") return (b.name || "").localeCompare(a.name || "");
      if (portfolioSort === "date-asc") return parseDate(a.date) - parseDate(b.date);
      if (portfolioSort === "type-asc") {
        const typeSort = (a.type || "").localeCompare(b.type || "");
        return typeSort || (a.name || "").localeCompare(b.name || "");
      }
      return parseDate(b.date) - parseDate(a.date);
    });
  }, [portfolioEvents, portfolioSort]);

  const selectTab = (tab: TabName) => {
    setActiveTab(tab);
    router.replace(`/eb-business/${bizId}?tab=${encodeURIComponent(tab)}`, { scroll: false });
  };

  const hydrateForm = (biz: Business) => {
    setBusinessName(biz.name || "");
    setCategory(biz.type || "");
    setStartedDate(toDateInput(biz.startedDate));
    setEventsHosted(String(biz.eventsHosted || 0));
    setAbout(biz.description || "");
    setCoverImages((biz.coverImages && biz.coverImages.length > 0 ? biz.coverImages : (biz.coverImage ? [biz.coverImage] : [])).slice(0, 1));
    setServices(biz.services || []);
    setAnnouncements(biz.announcements || []);
    setFaqs(biz.faqs || []);
    setPortfolioEvents(biz.portfolioEvents || []);
    setNewService("");
    setNewAnnouncement("");
    setPortfolioName("");
    setPortfolioType(PORTFOLIO_EVENT_TYPE_OPTIONS[0].name);
    setPortfolioDate(new Date().toISOString().slice(0, 10));
    setPortfolioCoverImage("");
    setPortfolioMedia([]);
    setPortfolioDatePickerValue(getDatePartsFromInputValue(new Date().toISOString().slice(0, 10)));
    setShowPortfolioDatePicker(false);
    setEditingPortfolioId(null);
    setMessage("");
  };

  useEffect(() => {
    if (authLoading || !bizId) return;

    let cancelled = false;
    const loadBusiness = async () => {
      setLoading(true);
      const data = await getBusinessById(bizId);
      if (cancelled) return;
      setBusiness(data);
      if (data) hydrateForm(data);
      setLoading(false);
    };

    loadBusiness();
    return () => {
      cancelled = true;
    };
  }, [authLoading, bizId]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    const matchedTab = TABS.find((tab) => tab.toLowerCase() === requestedTab?.toLowerCase());
    if (matchedTab) setActiveTab(matchedTab);
  }, [searchParams]);

  const handleCancel = () => {
    if (business) hydrateForm(business);
    setIsEditing(false);
  };

  const addService = () => {
    const value = newService.trim();
    if (!value || services.includes(value) || services.length >= 10) return;
    setServices([...services, value]);
    setNewService("");
  };

  const addAnnouncement = () => {
    const value = newAnnouncement.trim();
    if (!value || announcements.includes(value) || announcements.length >= 10) return;
    setAnnouncements([value, ...announcements]);
    setNewAnnouncement("");
  };

  const addFaq = () => {
    if (faqs.length >= 5) return;
    setFaqs([...faqs, { q: "", a: "" }]);
  };

  const updateFaq = (index: number, field: "q" | "a", value: string) => {
    setFaqs(faqs.map((faq, faqIndex) => faqIndex === index ? { ...faq, [field]: value } : faq));
  };

  const resetPortfolioForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    setPortfolioName("");
    setPortfolioType(PORTFOLIO_EVENT_TYPE_OPTIONS[0].name);
    setPortfolioDate(today);
    setPortfolioCoverImage("");
    setPortfolioMedia([]);
    setPortfolioDatePickerValue(getDatePartsFromInputValue(today));
    setShowPortfolioDatePicker(false);
    setEditingPortfolioId(null);
  };

  const openCreatePortfolioModal = () => {
    resetPortfolioForm();
    setShowPortfolioModal(true);
  };

  const openEditPortfolioModal = (portfolio: NonNullable<Business["portfolioEvents"]>[number]) => {
    const normalizedDate = toDateInput(portfolio.date) || new Date().toISOString().slice(0, 10);
    setEditingPortfolioId(portfolio.id);
    setPortfolioName(portfolio.name || "");
    setPortfolioType(portfolio.type || PORTFOLIO_EVENT_TYPE_OPTIONS[0].name);
    setPortfolioDate(normalizedDate);
    setPortfolioCoverImage(portfolio.coverImage || "");
    setPortfolioMedia(portfolio.media || []);
    setPortfolioDatePickerValue(getDatePartsFromInputValue(normalizedDate));
    setShowPortfolioDatePicker(false);
    setShowPortfolioModal(true);
  };

  const closePortfolioModal = () => {
    setShowPortfolioModal(false);
    resetPortfolioForm();
  };

  const savePortfolio = async () => {
    if (!business) return;
    const name = portfolioName.trim();
    if (!name || !portfolioType || !portfolioDate) {
      setMessageType("error");
      setMessage("Please enter portfolio event name, type, and date.");
      return;
    }

    const portfolioPayload = editingPortfolioId
      ? {
          ...(portfolioEvents || []).find((portfolio) => portfolio.id === editingPortfolioId),
          id: editingPortfolioId,
          name,
          type: portfolioType,
          date: portfolioDate,
          coverImage: portfolioCoverImage || DEFAULT_PORTFOLIO_COVER_IMAGE,
          media: portfolioMedia,
          updatedAt: new Date().toISOString(),
        }
      : {
        id: `portfolio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        type: portfolioType,
        date: portfolioDate,
        coverImage: portfolioCoverImage || DEFAULT_PORTFOLIO_COVER_IMAGE,
        media: portfolioMedia,
        templateId: "hero",
        createdAt: new Date().toISOString(),
      };

    const nextPortfolioEvents = editingPortfolioId
      ? (portfolioEvents || []).map((portfolio) => portfolio.id === editingPortfolioId ? portfolioPayload : portfolio)
      : [...(portfolioEvents || []), portfolioPayload];

    setSaving(true);
    setMessage("");
    const success = await updateBusiness(business.id, { portfolioEvents: nextPortfolioEvents });
    if (!success) {
      setMessageType("error");
      setMessage(`Could not ${editingPortfolioId ? "update" : "create"} portfolio. Please try again.`);
      setSaving(false);
      return;
    }

    setPortfolioEvents(nextPortfolioEvents);
    setBusiness({ ...business, portfolioEvents: nextPortfolioEvents });
    const wasEditing = Boolean(editingPortfolioId);
    closePortfolioModal();
    setMessageType("success");
    setMessage(wasEditing ? "Portfolio updated successfully." : "Portfolio created successfully.");
    setSaving(false);
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !business || !user) return;

    setUploading(true);
    setMessage("");
    try {
      const upload = await uploadEventImage(file, `business-${business.id}`, user.uid);
      setCoverImages([upload.url]);
      setMessageType("success");
      setMessage("Photo uploaded. Save changes to update the business profile.");
      setIsEditing(true);
    } catch (error) {
      console.error("Business cover upload failed:", error);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const handlePortfolioCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !business || !user) return;

    setUploading(true);
    setMessage("");
    try {
      const upload = await uploadEventImage(file, `business-${business.id}`, user.uid);
      setPortfolioCoverImage(upload.url);
      setMessageType("success");
      setMessage("Portfolio cover uploaded. Save the portfolio to keep this image.");
    } catch (error) {
      console.error("Portfolio cover upload failed:", error);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not upload portfolio cover.");
    } finally {
      setUploading(false);
    }
  };

  const handlePortfolioMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !business || !user) return;

    setUploading(true);
    setMessage("");
    try {
      const uploads = await Promise.all(files.map(async (file, index) => {
        const upload = await uploadEventImage(file, `business-${business.id}`, user.uid);
        return {
          id: `media_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          url: upload.url,
          type: file.type.startsWith("video/") ? "video" as const : "image" as const,
          createdAt: new Date().toISOString(),
        };
      }));
      setPortfolioMedia(prev => [...prev, ...uploads]);
      setMessageType("success");
      setMessage("Portfolio media uploaded. Save the portfolio to publish these images.");
    } catch (error) {
      console.error("Portfolio media upload failed:", error);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not upload portfolio media.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!business) return;
    if (!businessName.trim() || !category) {
      setMessageType("error");
      setMessage("Business name and category are required.");
      return;
    }

    setSaving(true);
    setMessage("");
    const cleanFaqs = faqs
      .map((faq) => ({ q: faq.q.trim(), a: faq.a.trim() }))
      .filter((faq) => faq.q || faq.a);
    const cleanAnnouncements = announcements.map((item) => item.trim()).filter(Boolean).slice(0, 10);
    const cleanServices = services.map((item) => item.trim()).filter(Boolean).slice(0, 10);
    const cleanCovers = coverImages.filter(Boolean).slice(0, 1);

    const updates: Partial<Business> = {
      name: businessName.trim(),
      type: category,
      startedDate: new Date(startedDate),
      experience: yearsSince(startedDate),
      eventsHosted: Number.parseInt(eventsHosted, 10) || 0,
      description: about.trim(),
      coverImages: cleanCovers,
      coverImage: cleanCovers[0] || "",
      services: cleanServices,
      announcements: cleanAnnouncements,
      faqs: cleanFaqs,
    };

    const success = await updateBusiness(business.id, updates);
    if (!success) {
      setMessageType("error");
      setMessage("Could not save business changes.");
      setSaving(false);
      return;
    }

    const refreshed = await getBusinessById(business.id);
    if (refreshed) {
      setBusiness(refreshed);
      hydrateForm(refreshed);
    }
    setMessageType("success");
    setMessage("Business updated successfully.");
    setIsEditing(false);
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-[#050505] text-[#818cf8]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center bg-[#050505] px-4 text-center text-white">
        <h1 className="text-2xl font-black">Business not found</h1>
        <button type="button" onClick={() => router.replace("/eb-business")} className="mt-5 rounded-full bg-indigo-400 px-5 py-3 text-sm font-black text-[#101010]">
          Back to EB Business
        </button>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center bg-[#050505] px-4 text-center text-white">
        <h1 className="text-2xl font-black">You do not have access to manage this business.</h1>
        <button type="button" onClick={() => router.replace("/eb-business")} className="mt-5 rounded-full bg-indigo-400 px-5 py-3 text-sm font-black text-[#101010]">
          Back to EB Business
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="grid grid-cols-[3rem_1fr_3rem] items-center gap-4 py-2">
          <div>
            {isEditing ? (
              <button type="button" onClick={handleCancel} className="text-sm font-black text-[#cbd5e1]">
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/eb-business")}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-400/20 bg-indigo-400/10 text-[#818cf8]"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="min-w-0 text-center">
            <h1 className="font-playfair text-3xl font-black tracking-tight text-white sm:text-4xl">Manage Business</h1>
            <p className="mt-1 truncate text-sm font-bold text-[#94a3b8]">{business.name || "Manage Empire"}</p>
          </div>

          <div />
        </header>

        <nav className="flex gap-3 overflow-x-auto border-b border-white/10 pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => selectTab(tab)}
              className={`relative shrink-0 px-1 pb-4 text-sm font-black transition-colors ${
                activeTab === tab ? "text-[#818cf8]" : "text-[#94a3b8] hover:text-[#cbd5e1]"
              }`}
            >
              {tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 h-1 w-full rounded-full bg-indigo-300" />}
            </button>
          ))}
        </nav>

        {message && (
          <div className={`rounded-2xl border p-4 text-sm font-bold ${
            messageType === "error" ? "border-rose-500/30 bg-rose-950/40 text-rose-300" : "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
          }`}>
            {message}
          </div>
        )}

        {activeTab === "Profile" && (
          <section className="space-y-5">
            <Panel title="Manage Business Profile">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              <div className="grid gap-3 sm:grid-cols-3">
                {coverImages.slice(0, 1).map((image, index) => (
                  <div key={`${image}-${index}`} className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                    <div className="relative aspect-[4/3]">
                      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-xl" />
                      <img src={image} alt="" className="relative h-full w-full object-contain" />
                    </div>
                    <div className="absolute right-3 top-3 flex items-center gap-2">
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => setCoverImages(coverImages.filter((_, imageIndex) => imageIndex !== index))}
                          className="rounded-full bg-slate-950/85 p-2 text-rose-300"
                          aria-label="Remove photo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(true);
                          fileInputRef.current?.click();
                        }}
                        disabled={uploading}
                        className="rounded-full bg-indigo-400 p-2 text-[#101010] shadow-lg shadow-indigo-950/30 disabled:opacity-60"
                        aria-label="Edit cover photo"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                {coverImages.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading}
                    className="relative flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950 text-[#475569] disabled:opacity-60"
                  >
                    <Camera className="h-10 w-10" />
                    <span className="absolute right-3 top-3 rounded-full bg-indigo-400 p-2 text-[#101010]">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                    </span>
                  </button>
                )}
              </div>
              {isEditing && (
                <button type="button" onClick={handleSave} disabled={saving || uploading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-4 text-sm font-black text-[#101010] disabled:opacity-60 sm:w-auto">
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  Save Changes
                </button>
              )}
            </Panel>

            <Panel title="Business Details">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business Name">
                  {isEditing ? <Input value={businessName} onChange={setBusinessName} /> : <Display value={businessName} strong />}
                </Field>
                <Field label="Category">
                  {isEditing ? (
                    <div className="relative">
                      <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full appearance-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400">
                        {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a5b4fc]" />
                    </div>
                  ) : <Display value={category} />}
                </Field>
                <Field label="Business Started">
                  {isEditing ? <input type="date" value={startedDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setStartedDate(event.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" /> : (
                    <div>
                      <Display value={`${yearsSince(startedDate)} Years`} />
                      <p className="mt-1 text-xs font-semibold text-[#94a3b8]">Started {new Date(startedDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</p>
                    </div>
                  )}
                </Field>
                <Field label="Events Hosted">
                  {isEditing ? <Input value={eventsHosted} onChange={setEventsHosted} type="number" /> : <Display value={`${eventsHosted || 0}+ Events`} />}
                </Field>
              </div>
              <Field label="About Business" className="mt-4">
                {isEditing ? (
                  <textarea value={about} onChange={(event) => setAbout(event.target.value)} placeholder="Tell us about your services..." className="min-h-32 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400 placeholder:text-[#475569]" />
                ) : <p className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm font-semibold leading-6 text-[#94a3b8]">{about || "No description provided."}</p>}
              </Field>
            </Panel>

            <Panel title={`Services & Tags (${services.length}/10)`}>
              {isEditing && (
                <div className="mb-4 flex gap-2">
                  <Input value={newService} onChange={setNewService} placeholder="Add a service" onEnter={addService} />
                  <button type="button" onClick={addService} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-400 text-[#101010]">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              )}
              <TagCloud items={services} editable={isEditing} onRemove={(item) => setServices(services.filter((service) => service !== item))} />
            </Panel>

            {isEditing && (
              <button type="button" onClick={handleSave} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-4 text-sm font-black text-[#101010] disabled:opacity-60">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Save All Changes
              </button>
            )}
          </section>
        )}

        {activeTab === "Portfolio" && (
          <Panel
            title="Portfolio"
            action={(
              <div className="flex flex-wrap justify-end gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPortfolioSortMenu(prev => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-2 text-xs font-black text-[#cbd5e1]"
                  >
                    <Tag className="h-4 w-4" />
                    {PORTFOLIO_SORT_OPTIONS.find(option => option.value === portfolioSort)?.label || "Sort"}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {showPortfolioSortMenu && (
                    <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-1 shadow-2xl">
                      {PORTFOLIO_SORT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setPortfolioSort(option.value);
                            setShowPortfolioSortMenu(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-black transition-colors ${
                            portfolioSort === option.value ? "bg-indigo-400 text-[#101010]" : "text-slate-300 hover:bg-slate-900"
                          }`}
                        >
                          {option.label}
                          {portfolioSort === option.value && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openCreatePortfolioModal}
                  className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 px-3 py-2 text-xs font-black text-[#a5b4fc]"
                >
                  <Plus className="h-4 w-4" />
                  Create Portfolio
                </button>
              </div>
            )}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-6">
              {sortedPortfolioEvents.map((portfolio) => (
                <button
                  key={portfolio.id}
                  type="button"
                  onClick={() => router.push(`/eb-business/${business.id}/portfolio/${portfolio.id}?returnTo=${encodeURIComponent(`/eb-business/${business.id}?tab=Portfolio`)}`)}
                  className="group relative h-64 cursor-pointer overflow-hidden rounded-[1.5rem] bg-black text-left"
                >
                  <div className="relative h-full overflow-hidden">
                    <img
                      src={portfolio.coverImage || DEFAULT_PORTFOLIO_COVER_IMAGE}
                      alt={portfolio.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                    {portfolio.type && (
                      <div className="absolute left-4 top-4 rounded-lg border border-amber-300/30 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300 backdrop-blur-sm">
                        {portfolio.type}
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-black p-5">
                    <h3 className="mb-1 truncate text-lg font-bold leading-tight" style={{ color: "#ffffff" }}>{portfolio.name}</h3>
                    <div className="mt-2 flex items-center text-xs font-bold text-[#94a3b8]">
                      <Calendar className="mr-1.5 h-3 w-3 text-[#facc15]" />
                      <span>{new Date(portfolio.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </div>
                </button>
              ))}
              {sortedPortfolioEvents.length === 0 && (
                <p className="text-sm font-semibold text-[#94a3b8]">No portfolio events created yet.</p>
              )}
            </div>
          </Panel>
        )}

        {activeTab === "Interactions" && (
          <section className="space-y-5">
            <Panel title={`News & Updates (${announcements.length}/10)`} icon={<Megaphone className="h-5 w-5" />}>
              {isEditing && (
                <div className="mb-4 flex gap-2">
                  <Input value={newAnnouncement} onChange={setNewAnnouncement} placeholder="Add latest news or offer..." onEnter={addAnnouncement} />
                  <button type="button" onClick={addAnnouncement} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-400 text-[#101010]">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {announcements.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-300" />
                      <p className="text-sm font-semibold leading-6 text-[#cbd5e1]">{item}</p>
                    </div>
                    {isEditing && <button type="button" onClick={() => setAnnouncements(announcements.filter((_, itemIndex) => itemIndex !== index))} className="text-rose-300"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                ))}
                {announcements.length === 0 && <p className="text-sm font-semibold text-[#94a3b8]">No active news or updates.</p>}
              </div>
            </Panel>

            <Panel title={`Manage FAQ (${faqs.length}/5)`}>
              {isEditing && (
                <button type="button" onClick={addFaq} disabled={faqs.length >= 5} className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 px-3 py-2 text-xs font-black text-[#a5b4fc] disabled:opacity-50">
                  <Plus className="h-4 w-4" />
                  Add FAQ
                </button>
              )}
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <div key={index} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">FAQ #{index + 1}</p>
                      {isEditing && <button type="button" onClick={() => setFaqs(faqs.filter((_, faqIndex) => faqIndex !== index))} className="text-rose-300"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input value={faq.q} onChange={(value) => updateFaq(index, "q", value)} placeholder="Question" />
                        <textarea value={faq.a} onChange={(event) => updateFaq(index, "a", event.target.value)} placeholder="Answer" className="min-h-24 w-full resize-none rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-400 placeholder:text-[#475569]" />
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-black text-white">{faq.q || "Untitled question"}</h3>
                        <p className="mt-2 text-sm font-semibold leading-6 text-[#94a3b8]">{faq.a || "No answer added."}</p>
                      </div>
                    )}
                  </div>
                ))}
                {faqs.length === 0 && <p className="text-sm font-semibold text-[#94a3b8]">No FAQs added.</p>}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === "Analytics" && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Profile Views" value={business.profileViews || 0} icon={<BarChart3 className="h-5 w-5" />} />
            <Metric label="Events Hosted" value={eventsHosted || 0} icon={<Camera className="h-5 w-5" />} />
            <Metric label="Rating" value={business.rating || 0} icon={<Check className="h-5 w-5" />} />
            <Metric label="Shortlists" value={business.shortlistCount || 0} icon={<Tag className="h-5 w-5" />} />
          </section>
        )}
      </div>

      {showPortfolioModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">{editingPortfolioId ? "Edit Portfolio" : "Create Portfolio"}</h2>
                <p className="mt-1 text-sm font-semibold text-[#94a3b8]">
                  {editingPortfolioId ? "Update this portfolio event." : "Add an event to your business portfolio."}
                </p>
              </div>
              <button
                type="button"
                onClick={closePortfolioModal}
                className="rounded-full bg-slate-800 p-2 text-[#94a3b8]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Cover Image">
                <input ref={portfolioCoverInputRef} type="file" accept="image/*" className="hidden" onChange={handlePortfolioCoverUpload} />
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                  <div className="relative aspect-[16/9]">
                    {portfolioCoverImage ? (
                      <>
                        <img src={portfolioCoverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-xl" />
                        <img src={portfolioCoverImage} alt="" className="relative h-full w-full object-cover" />
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-600">
                        <Camera className="h-10 w-10" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => portfolioCoverInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-indigo-400 px-3 py-2 text-xs font-black text-[#101010] disabled:opacity-60"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                      {portfolioCoverImage ? "Change Cover" : "Set Cover"}
                    </button>
                  </div>
                </div>
              </Field>
              <Field label={`Portfolio Images (${portfolioMedia.length})`}>
                <input ref={portfolioMediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handlePortfolioMediaUpload} />
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => portfolioMediaInputRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-400/30 bg-indigo-400/10 px-4 py-4 text-sm font-black text-indigo-200 disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                    Upload Images
                  </button>
                  {portfolioMedia.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {portfolioMedia.map((item) => (
                        <div key={item.id} className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                          <div className="relative aspect-square">
                            {item.type === "video" ? (
                              <video src={item.url} className="h-full w-full object-cover" muted playsInline />
                            ) : (
                              <img src={item.url} alt="" className="h-full w-full object-cover" />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPortfolioMedia(prev => prev.filter(media => media.id !== item.id))}
                            className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-rose-300"
                            aria-label="Remove media"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Event Name">
                <Input value={portfolioName} onChange={setPortfolioName} placeholder="e.g. Royal Wedding Shoot" />
              </Field>
              <Field label="Event Type">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PORTFOLIO_EVENT_TYPE_OPTIONS.map(({ name, icon: Icon }) => {
                    const isSelected = portfolioType === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setPortfolioType(name)}
                        className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition-colors ${
                          isSelected
                            ? "border-amber-400 bg-amber-400 text-slate-950"
                            : "border-slate-800 bg-slate-950 text-slate-300 hover:border-amber-400/50 hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{name}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Event Date">
                <button
                  type="button"
                  onClick={() => {
                    setPortfolioDatePickerValue(getDatePartsFromInputValue(portfolioDate));
                    setShowPortfolioDatePicker(true);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-left text-white outline-none transition-colors hover:border-amber-400/50"
                >
                  <span className="font-semibold">{formatFriendlyDatePickerValue(getDatePartsFromInputValue(portfolioDate))}</span>
                  <Calendar className="h-5 w-5 text-amber-300" />
                </button>
              </Field>
            </div>

            <button type="button" onClick={savePortfolio} disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-4 text-sm font-black text-[#101010] disabled:opacity-60">
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : editingPortfolioId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editingPortfolioId ? "Update Portfolio" : "Create Portfolio"}
            </button>
          </div>
        </div>
      )}

      {showPortfolioDatePicker && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-sm rounded bg-white p-6 text-slate-950 shadow-2xl">
            <div className="grid grid-cols-3 gap-6">
              <DatePickerColumn
                options={DATE_PICKER_MONTHS.map((label, value) => ({ label, value }))}
                selectedValue={portfolioDatePickerValue.month}
                onSelect={(month) => setPortfolioDatePickerValue(prev => clampDatePickerValue({ ...prev, month }))}
              />
              <DatePickerColumn
                key={`${portfolioDatePickerValue.month}-${portfolioDatePickerValue.year}`}
                options={Array.from({ length: getDaysInMonth(portfolioDatePickerValue.month, portfolioDatePickerValue.year) }, (_, index) => ({
                  label: String(index + 1).padStart(2, "0"),
                  value: index + 1,
                }))}
                selectedValue={portfolioDatePickerValue.day}
                onSelect={(day) => setPortfolioDatePickerValue(prev => ({ ...prev, day }))}
              />
              <DatePickerColumn
                options={Array.from({ length: 201 }, (_, index) => {
                  const value = 1950 + index;
                  return { label: String(value), value };
                })}
                selectedValue={portfolioDatePickerValue.year}
                onSelect={(year) => setPortfolioDatePickerValue(prev => clampDatePickerValue({ ...prev, year }))}
              />
            </div>

            <div className="mt-10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPortfolioDatePicker(false)}
                className="rounded-full px-5 py-3 text-sm font-black uppercase tracking-widest text-slate-800 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setPortfolioDate(formatDatePickerValue(portfolioDatePickerValue));
                  setShowPortfolioDatePicker(false);
                }}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children, action, icon }: { title: string; children: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-[#a5b4fc]">{icon}</span>}
          <h2 className="text-lg font-black text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#94a3b8]">{label}</span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = "text", onEnter }: { value: string; onChange: (value: string) => void; placeholder?: string; type?: string; onEnter?: () => void }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && onEnter) {
          event.preventDefault();
          onEnter();
        }
      }}
      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400 placeholder:text-[#475569]"
    />
  );
}

function Display({ value, strong }: { value: string; strong?: boolean }) {
  return <p className={`rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-[#f1f5f9] ${strong ? "text-lg font-black text-white" : "text-sm font-semibold"}`}>{value || "Not set"}</p>;
}

function TagCloud({ items, editable, onRemove }: { items: string[]; editable: boolean; onRemove: (item: string) => void }) {
  if (items.length === 0) {
    return <p className="text-sm font-semibold text-[#94a3b8]">No services listed.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-2 text-xs font-black text-[#a5b4fc]">
          {item}
          {editable && (
            <button type="button" onClick={() => onRemove(item)} className="text-[#94a3b8] hover:text-rose-300" aria-label={`Remove ${item}`}>
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <article className="rounded-[1.5rem] border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-400/10 text-[#a5b4fc]">
        {icon}
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </article>
  );
}
