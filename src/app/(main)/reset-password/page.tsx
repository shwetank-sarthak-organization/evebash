"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState<"idle" | "loading">("idle");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const passLength = password.length >= 8;
    const passUpper = /[A-Z]/.test(password);
    const passLower = /[a-z]/.test(password);
    const passNumber = /[0-9]/.test(password);
    const passSpecial = /[^A-Za-z0-9]/.test(password);
    const isPassValid = passLength && passUpper && passLower && passNumber && passSpecial;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError("");
        setMessage("");

        if (!isPassValid) {
            setError("Please meet all password requirements.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setStatus("loading");
        const { error: updateError } = await supabase.auth.updateUser({ password });
        setStatus("idle");

        if (updateError) {
            setError("This reset link is invalid or expired. Please request a new password reset link.");
            return;
        }

        setMessage("Your password has been updated. You can sign in with your new password.");
        setPassword("");
        setConfirmPassword("");
    };

    return (
        <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 font-sans">
            <div className="w-full max-w-md mx-auto">
                <div className="flex flex-col items-center justify-center mb-8">
                    <div className="w-16 h-16 rounded-full border border-slate-700 bg-slate-800/50 flex items-center justify-center mb-4 shadow-xl">
                        <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-sky-600">EB</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Set New Password</h1>
                    <p className="text-slate-400 text-sm mt-2 font-medium tracking-wide">Choose a secure password for EveBash</p>
                </div>

                <div className="bg-slate-800/90 rounded-[32px] p-8 shadow-2xl border border-slate-700 backdrop-blur-sm">
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-500/30 bg-sky-500/10 text-sky-300">
                        <ShieldCheck className="h-6 w-6" />
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">New Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 py-2">
                            {[
                                { met: passLength, text: "At least 8 characters" },
                                { met: passUpper, text: "One uppercase letter" },
                                { met: passLower, text: "One lowercase letter" },
                                { met: passNumber, text: "One number" },
                                { met: passSpecial, text: "One special character" },
                            ].map((req, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                    {req.met ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
                                    <span className={req.met ? "text-emerald-400 font-medium" : "text-slate-500"}>{req.text}</span>
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                                placeholder="••••••••"
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
                            disabled={status !== "idle" || !isPassValid || password !== confirmPassword}
                            className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white rounded-xl font-bold text-[15px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {status === "loading" ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "Update Password"
                            )}
                        </button>
                    </form>

                    <button
                        type="button"
                        onClick={() => router.push("/login")}
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
