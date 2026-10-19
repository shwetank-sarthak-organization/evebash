"use client";

import React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";
import { useAuth } from "@/context/AuthContext";

/**
 * Find You and Event partners are for signed-in guests. Logged-out visitors of a public gallery get a log-in prompt
 * instead, and nothing of the page loads.
 */
export function RequireLogin({ heading, body, returnTo, children }: {
    heading: string;
    body: string;
    returnTo: string;
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();

    if (loading) return <LoadingScreen message="Loading your gallery" />;
    if (user) return <>{children}</>;

    const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4 text-center">
            <div className="w-16 h-16 mb-6 rounded-full bg-stone-200/70 text-stone-700 flex items-center justify-center">
                <Lock className="w-7 h-7" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold mb-3 text-slate-900">{heading}</h1>
            <p className="text-stone-700 mb-8 max-w-md">{body}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href={loginHref} className="px-8 py-3 bg-slate-900 text-white rounded-full font-bold shadow-lg hover:bg-slate-800 transition-all">
                    Log in
                </Link>
                <Link href={`${loginHref}&mode=signup`} className="px-8 py-3 bg-white border border-stone-300 text-slate-900 rounded-full font-bold hover:bg-stone-100 transition-all">
                    Create account
                </Link>
            </div>
        </main>
    );
}
