"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Lock, MapPin, UserRound } from "lucide-react";
import { getUserById, UserProfile } from "@/lib/database";

function formatJoinedDate(value: any) {
  if (!value) return "Not available";
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

function getPersonaLabel(value: any) {
  if (!value) return "Member";
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || "Member";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).join(", ") || "Member";
    } catch {
      return value;
    }
  }
  return String(value);
}

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoading(true);
      const data = await getUserById(params.id);
      if (!cancelled) {
        setProfile(data);
        setLoading(false);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#050505] text-slate-300">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#050505] px-4 text-center text-white">
        <h1 className="text-2xl font-black">Profile not found.</h1>
        <button onClick={() => router.back()} className="mt-5 rounded-full bg-indigo-400 px-5 py-3 text-sm font-black text-[#101010]">
          Go Back
        </button>
      </div>
    );
  }

  const isPrivate = Boolean(profile.isPrivate);
  const username = profile.username ? `@${profile.username}` : "Username not set";

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <button onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-full bg-[#101010] text-slate-200">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <section className="overflow-hidden rounded-[2rem] border border-[#1f2937] bg-[#101010] p-6 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border border-indigo-400/20 bg-indigo-400/10">
            {profile.profileImage ? (
              <img src={profile.profileImage} alt={profile.name || username} className="h-full w-full object-cover" />
            ) : (
              <UserRound className="h-12 w-12 text-indigo-300" />
            )}
          </div>

          <h1 className="mt-5 text-3xl font-black text-white">{profile.name || "Name not set"}</h1>
          <p className="mt-2 text-sm font-black text-indigo-300">{username}</p>

          {isPrivate ? (
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-slate-800 bg-black/30 p-5">
              <Lock className="mx-auto mb-3 h-6 w-6 text-slate-400" />
              <p className="text-sm font-bold text-slate-300">This profile is private.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <InfoTile icon={<Calendar className="h-4 w-4" />} label="Joined" value={formatJoinedDate(profile.createdAt)} />
              <InfoTile icon={<UserRound className="h-4 w-4" />} label="Role" value={getPersonaLabel(profile.persona)} />
              <InfoTile icon={<MapPin className="h-4 w-4" />} label="Location" value={profile.location || "Not set"} />
              <InfoTile icon={<UserRound className="h-4 w-4" />} label="Plan" value={profile.role || "free"} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#1f2937] bg-[#050505] p-4 text-left">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}
