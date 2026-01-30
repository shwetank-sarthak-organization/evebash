"use client";

import React, { useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

function LoginContent() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState<"idle" | "loading">("idle");
    const [isSignUp, setIsSignUp] = useState(false);
    const [loginMethod, setLoginMethod] = useState<"email" | "phone">("phone");
    const [phoneNumber, setPhoneNumber] = useState("");

    const { login, signup, loginWithGoogle, resetPassword, loginWithPhoneSimple } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo");

    // Auto-Name Sync: Fetch name when phone is entered
    const handlePhoneBlur = async () => {
        if (!phoneNumber || name) return; // Only sync if name is empty
        try {
            const { findGuestNameByPhone } = await import("@/lib/firestore");
            const existingName = await findGuestNameByPhone(phoneNumber);
            if (existingName) {
                setName(existingName);
            }
        } catch (err) {
            console.error("Auto-Name Sync Error:", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (loginMethod === "email") {
            if (!email.trim() || !password.trim()) {
                setError("Please enter both email and password ✨");
                return;
            }

            if (password.length < 6) {
                setError("Password should be at least 6 characters.");
                return;
            }

            if (isSignUp) {
                if (!name.trim()) {
                    setError("Please enter your name ✨");
                    return;
                }
                if (password !== confirmPassword) {
                    setError("Passwords do not match!");
                    return;
                }
            }

            setStatus("loading");

            try {
                if (isSignUp) {
                    const success = await signup(email, password, name);
                    if (success) {
                        router.push(returnTo || "/dashboard");
                    } else {
                        setError("Failed to create account. Email might be in use.");
                        setStatus("idle");
                    }
                } else {
                    const success = await login(email, password);
                    if (success) {
                        router.push(returnTo || "/dashboard");
                    } else {
                        setError("Invalid email or password.");
                        setStatus("idle");
                    }
                }
            } catch (err) {
                console.error(err);
                setError("Something went wrong. Please try again.");
                setStatus("idle");
            }
        } else {
            // Simple Phone Login Flow
            if (!name.trim()) {
                setError("Please enter your name ✨");
                return;
            }
            if (!phoneNumber.trim()) {
                setError("Please enter your phone number ✨");
                return;
            }

            setStatus("loading");
            try {
                const success = await loginWithPhoneSimple(name, phoneNumber);
                if (success) {
                    router.push(returnTo || "/dashboard");
                } else {
                    setStatus("idle");
                }
            } catch (err) {
                console.error(err);
                setError("Something went wrong. Please try again.");
                setStatus("idle");
            }
        }
    };

    return (
        <div className="min-h-screen bg-royal-cream text-royal-maroon flex flex-col justify-center py-12 px-6 lg:px-8 font-serif relative overflow-hidden">
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/cream-paper.png')` }}></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="sm:mx-auto sm:w-full sm:max-w-md relative z-10"
            >
                <div className="text-center mb-8">
                    <div className="mx-auto h-12 w-12 text-royal-maroon mb-4">
                        <Lock className="w-12 h-12" />
                    </div>
                    <h1 className="text-3xl font-serif text-slate-800 mb-3 tracking-wide">
                        {isSignUp ? "Join Us" : "Welcome Back"}
                    </h1>
                    <p className="text-slate-600 font-light">
                        {isSignUp ? "Create an account to access the gallery." : "Enter your credentials to access."}
                    </p>
                </div>

                {!isSignUp && (
                    <div className="flex bg-slate-100 rounded-full p-1 mb-8 max-w-[240px] mx-auto shadow-inner border border-slate-200">
                        <button
                            onClick={() => {
                                setLoginMethod("phone");
                                setError("");
                            }}
                            className={`flex-1 py-1.5 px-4 text-xs font-bold uppercase tracking-widest rounded-full transition-all duration-300 ${loginMethod === "phone"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            Phone
                        </button>
                        <button
                            onClick={() => {
                                setLoginMethod("email");
                                setError("");
                            }}
                            className={`flex-1 py-1.5 px-4 text-xs font-bold uppercase tracking-widest rounded-full transition-all duration-300 ${loginMethod === "email"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                                }`}
                        >
                            Email
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {(isSignUp || loginMethod === "email") ? (
                        <div className="space-y-6">
                            {isSignUp && (
                                <div className="space-y-1">
                                    <label className="block text-sm uppercase tracking-widest font-bold text-slate-600 ml-1">Your Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="block w-full px-4 py-3 bg-white/50 border border-stone-300 rounded-lg text-royal-maroon placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all shadow-sm"
                                        placeholder="John Doe"
                                    />
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="block text-sm uppercase tracking-widest font-bold text-slate-600 ml-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="block w-full px-4 py-3 bg-white/50 border border-stone-300 rounded-lg text-royal-maroon placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all shadow-sm"
                                    placeholder="you@example.com"
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="block text-sm uppercase tracking-widest font-bold text-slate-600">Password</label>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="block w-full px-4 py-3 bg-white/50 border border-stone-300 rounded-lg text-royal-maroon placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all shadow-sm"
                                    placeholder="••••••••"
                                />
                            </div>

                            {isSignUp && (
                                <div className="space-y-1">
                                    <label className="block text-sm uppercase tracking-widest font-bold text-slate-600 ml-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="block w-full px-4 py-3 bg-white/50 border border-stone-300 rounded-lg text-royal-maroon placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all shadow-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <label className="block text-sm uppercase tracking-widest font-bold text-slate-600 ml-1">Phone Number</label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    onBlur={handlePhoneBlur}
                                    required
                                    className="block w-full px-4 py-3 bg-white/50 border border-stone-300 rounded-lg text-royal-maroon placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all shadow-sm"
                                    placeholder="Enter number (e.g. 9876543210)"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm uppercase tracking-widest font-bold text-slate-600 ml-1">Your Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="block w-full px-4 py-3 bg-white/50 border border-stone-300 rounded-lg text-royal-maroon placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all shadow-sm"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === "loading"}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-royal-maroon transition-all transform hover:scale-[1.02]"
                    >
                        {status === "loading" ? (
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            isSignUp ? "Sign Up" : (loginMethod === "phone" ? "Enter Gallery Library" : "Login")
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-slate-100">
                    <p className="text-slate-500 text-sm">
                        {isSignUp ? "Already include in the guest list?" : "Don't have access yet?"}
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setLoginMethod(isSignUp ? "phone" : "email");
                                setError("");
                            }}
                            className="ml-2 font-bold text-sky-600 hover:text-sky-800 transition-colors underline decoration-2 underline-offset-4"
                        >
                            {isSignUp ? "Login here" : "Sign Up"}
                        </button>
                    </p>
                </div>

                <p className="text-center text-sm text-slate-500 mt-6 font-light">
                    Protected with ❤️
                </p>

                <div className="mt-4 text-center">
                    <button
                        onClick={async () => {
                            if (status === "loading") return;
                            setStatus("loading");
                            try {
                                const success = await loginWithGoogle();
                                if (success) {
                                    router.push(returnTo || "/admin/dashboard");
                                }
                            } finally {
                                setStatus("idle");
                            }
                        }}
                        disabled={status === "loading"}
                        className="text-xs text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {status === "loading" ? "Connecting..." : "Admin Login"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-royal-cream">
                <div className="h-10 w-10 border-4 border-royal-maroon border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
