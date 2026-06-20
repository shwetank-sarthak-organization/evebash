"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Share2,
  Star,
  Store,
} from "lucide-react";
import { Business, getBusinessById, getBusinessTypeColor } from "@/lib/database";

const DEFAULT_BUSINESS_COVER = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200";

function getVendorLocation(business: Business) {
  return business.location?.address || "Local";
}

function getExperienceLabel(experience?: number) {
  return experience ? `${experience}+ Yrs Exp` : "Established";
}

export default function MarketplaceBusinessDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("About");

  useEffect(() => {
    let cancelled = false;
    async function loadBusiness() {
      setLoading(true);
      const data = await getBusinessById(params.id);
      if (!cancelled) {
        setBusiness(data);
        setLoading(false);
      }
    }

    loadBusiness();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleShare = async () => {
    if (!business) return;
    const text = `Check out ${business.name} on EB Network`;
    if (navigator.share) {
      await navigator.share({ title: business.name, text, url: window.location.href });
      return;
    }
    await navigator.clipboard?.writeText(window.location.href);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center text-white">
        <h1 className="text-2xl font-black">Business not found.</h1>
        <button onClick={() => router.push("/marketplace")} className="mt-5 rounded-full bg-indigo-400 px-5 py-3 text-sm font-black text-[#101010]">
          Back to EB Network
        </button>
      </div>
    );
  }

  const typeColors = getBusinessTypeColor(business.type);
  const galleryImages = business.coverImages && business.coverImages.length > 0
    ? business.coverImages
    : [business.coverImage || DEFAULT_BUSINESS_COVER];

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <button onClick={() => router.push("/marketplace")} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#101010] text-slate-200">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-2xl font-black text-white">{business.name}</h1>
            <p className="mt-1 text-sm font-bold text-slate-400">EB Network Business</p>
          </div>
          <button onClick={handleShare} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#101010] text-slate-200">
            <Share2 className="h-5 w-5" />
          </button>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-[#1f2937] bg-[#101010]">
          <div className="relative h-[24rem] bg-[#050505]">
            <img src={galleryImages[0]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 blur-xl" />
            <img src={galleryImages[0]} alt={business.name} className="relative h-full w-full object-contain" />
            <div className="absolute bottom-0 left-0 right-0 bg-black p-6">
              <h2 className="text-3xl font-black text-white">{business.name}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border px-3 py-1 text-xs font-black uppercase" style={{ backgroundColor: typeColors.bg, borderColor: typeColors.border, color: typeColors.text }}>
                  {business.type}
                </span>
                {business.vendorCode && (
                  <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-300">
                    Code: {business.vendorCode}
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-amber-300">
                  <Star className="h-3.5 w-3.5 fill-amber-300" />
                  {business.rating || 0}
                </span>
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-400">
                <MapPin className="h-4 w-4" />
                {getVendorLocation(business)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <Highlight title="Experience" value={getExperienceLabel(business.experience)} />
          <Highlight title="Events" value={`${business.eventsHosted || 0}`} />
          <Highlight title="Shortlists" value={`${business.shortlistCount || 0}`} />
        </div>

        <div className="flex overflow-x-auto rounded-2xl border border-[#1f2937] bg-[#101010] p-1">
          {["About", "Portfolio", "Announcements", "Reviews"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`min-w-0 flex-1 rounded-xl px-4 py-3 text-sm font-black ${activeTab === tab ? "bg-indigo-400 text-slate-950" : "text-slate-400"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <main className="rounded-[2rem] border border-[#1f2937] bg-[#101010] p-6">
          {activeTab === "About" && (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-xl font-black text-white">About</h3>
                <p className="leading-7 text-slate-300">
                  {business.description || `Experience the exceptional services of ${business.name}. With a focus on quality and client satisfaction, they bring your vision to life with professional expertise in ${business.type.toLowerCase()}.`}
                </p>
              </section>
              {business.services && business.services.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xl font-black text-white">Services Offered</h3>
                  <div className="flex flex-wrap gap-2">
                    {business.services.map((service) => (
                      <span key={service} className="rounded-full bg-indigo-400/10 px-3 py-1 text-sm font-bold text-indigo-200">{service}</span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "Portfolio" && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">Portfolio</h3>
                <span className="text-sm font-black text-indigo-300">{business.portfolioEvents?.length || 0} Events</span>
              </div>
              {business.portfolioEvents && business.portfolioEvents.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {business.portfolioEvents.map((portfolio) => (
                    <button
                      key={portfolio.id}
                      type="button"
                      onClick={() => router.push(`/marketplace/${business.id}/portfolio/${portfolio.id}?returnTo=${encodeURIComponent(`/marketplace/${business.id}`)}`)}
                      className="block w-full overflow-hidden rounded-[1.5rem] border border-[#1f2937] bg-[#050505] text-left"
                    >
                      <div className="relative h-56 bg-black">
                        <img src={portfolio.coverImage || DEFAULT_BUSINESS_COVER} alt={portfolio.name} className="h-full w-full object-cover" />
                        <div className="absolute left-4 top-4 rounded-lg border border-amber-300/30 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                          {portfolio.type}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black p-4">
                          <h4 className="truncate text-lg font-bold text-white">{portfolio.name}</h4>
                          <p className="mt-2 flex items-center gap-2 text-xs font-bold text-[#94a3b8]">
                            <Calendar className="h-3.5 w-3.5 text-[#facc15]" />
                            {new Date(portfolio.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-400">
                        <span>{portfolio.media?.length || 0} images</span>
                        <span className="inline-flex items-center gap-1 text-indigo-300">
                          Open gallery <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyDetail title="No portfolio events yet" />
              )}
            </section>
          )}

          {activeTab === "Announcements" && (
            <section>
              <h3 className="mb-4 text-xl font-black text-white">Announcements ({business.announcements?.length || 0})</h3>
              {business.announcements && business.announcements.length > 0 ? (
                <div className="space-y-3">
                  {business.announcements.map((announcement, index) => (
                    <div key={`${announcement}-${index}`} className="rounded-2xl border border-[#1f2937] bg-[#050505] p-4">
                      <p className="text-sm font-bold text-slate-300">{announcement}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyDetail title="No announcements yet" />
              )}
            </section>
          )}

          {activeTab === "Reviews" && (
            <section>
              <h3 className="mb-4 text-xl font-black text-white">What Clients Say</h3>
              <EmptyDetail title="Reviews are not available on web yet" />
            </section>
          )}
        </main>

        <div className="sticky bottom-4 grid gap-3 rounded-[1.5rem] border border-[#1f2937] bg-[#101010]/95 p-3 backdrop-blur sm:grid-cols-2">
          {business.ownerPhone && (
            <a href={`tel:${business.ownerPhone}`} className="flex items-center justify-center gap-2 rounded-2xl border border-[#1f2937] px-5 py-4 font-black text-white">
              <Phone className="h-5 w-5" />
              <span>Call Directly</span>
            </a>
          )}
          {business.ownerEmail && (
            <a href={`mailto:${business.ownerEmail}`} className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-4 font-black text-slate-950">
              <Mail className="h-5 w-5" />
              <span>Contact Now</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Highlight({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#1f2937] bg-[#101010] p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function EmptyDetail({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#1f2937] p-8 text-center text-slate-400">
      <Store className="mx-auto mb-3 h-8 w-8 text-slate-600" />
      <p className="font-black text-white">{title}</p>
    </div>
  );
}
