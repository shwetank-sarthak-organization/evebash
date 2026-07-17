"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function ForgotPasswordContent() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading">("idle");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const { resetPassword } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo");

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError("");
        setMessage("");

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError("Please enter your email address.");
            return;
        }

        setStatus("loading");
        const success = await resetPassword(trimmedEmail);
        setStatus("idle");

        if (success) {
            setMessage(`A password reset link has been sent to ${trimmedEmail}. Please check your inbox and junk folder.`);
        } else {
            setError("We could not send the reset link right now. Please try again.");
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 font-sans">
            <div className="w-full max-w-md mx-auto">
                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="w-16 h-16 rounded-full border border-slate-700 bg-slate-800/50 flex items-center justify-center mb-4 shadow-xl">
                        <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-sky-600">EB</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Reset Password</h1>
                    <p className="text-slate-400 text-sm mt-2 font-medium tracking-wide">Recover access to your EveBash account</p>
                </div>

                <div className="bg-slate-800/90 rounded-[32px] p-8 shadow-2xl border border-slate-700 backdrop-blur-sm">
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-300">
                        <Mail className="h-6 w-6" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                                placeholder="you@example.com"
                            />
                        </div>

                        {message && (
                            <div className="bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-lg">
                                <p className="text-sm text-emerald-400 text-center font-medium">{message}</p>
                            </div>
                        )}

                        {error && (
                            <div className="bg-rose-900/30 border border-rose-500/30 p-3 rounded-lg">
                                <p className="text-sm text-rose-400 text-center font-medium">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status !== "idle"}
                            className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white rounded-xl font-bold text-[15px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {status === "loading" ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Send Reset Link"
                            )}
                        </button>
                    </form>

                    <button
                        type="button"
                        onClick={() => router.push(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login")}
                        className="mt-6 w-full text-sm font-semibold text-slate-400 hover:text-sky-300 transition-colors inline-flex items-center justify-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to sign in
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="h-10 w-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <ForgotPasswordContent />
        </Suspense>
    );
}
