"use client";

import { POLICY_PENDING_KEY, acceptanceIntent } from "../../../../shared/legal/acceptance";

import React, { useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EveBashLogo } from "@/components/EveBashLogo";

function LoginContent() {
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState<"idle" | "loading">("idle");
    const searchParams = useSearchParams();
    const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
    const [policiesAccepted, setPoliciesAccepted] = useState(false);
    const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
    const [showPass, setShowPass] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState("");

    const { login, signup, authWithPhone, loginWithGoogle, user, loading } = useAuth();
    const router = useRouter();
    const returnTo = searchParams.get("returnTo");
    const isPhoneAuth = authMethod === "phone";
    const normalizedEmail = email.trim().toLowerCase();
    const isGmailSignup = isSignUp && !isPhoneAuth && normalizedEmail.endsWith("@gmail.com");

    React.useEffect(() => {
        if (!loading && user) {
            router.push(returnTo || "/dashboard");
        }
    }, [user, loading, returnTo]);

    // Password validation states
    const passLength = password.length >= 8;
    const passUpper = /[A-Z]/.test(password);
    const passLower = /[a-z]/.test(password);
    const passNumber = /[0-9]/.test(password);
    const passSpecial = /[^A-Za-z0-9]/.test(password);
    const isPassValid = passLength && passUpper && passLower && passNumber && passSpecial;

    const generateStrongPassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
        let newPass = '';
        newPass += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
        newPass += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
        newPass += '0123456789'[Math.floor(Math.random() * 10)];
        newPass += '!@#$%^&*()_+'[Math.floor(Math.random() * 12)];
        for (let i = 0; i < 12; i++) {
            newPass += chars[Math.floor(Math.random() * chars.length)];
        }
        newPass = newPass.split('').sort(() => 0.5 - Math.random()).join('');
        
        setPassword(newPass);
        setConfirmPassword(newPass);
        setShowPass(true);
    };

    const toggleMode = () => {
        setIsSignUp((v) => !v);
        setPoliciesAccepted(false);
        setError("");
        setVerificationMessage("");
        setName("");
        setPhone("");
        setPassword("");
        setConfirmPassword("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setVerificationMessage("");

        if (!password.trim()) {
            setError("Please enter your password.");
            return;
        }

        if (isPhoneAuth && !phone.trim()) {
            setError("Please enter your phone number.");
            return;
        }

        if (!isPhoneAuth && !email.trim()) {
            setError("Please enter your email address.");
            return;
        }

        if (password.length < 6) {
            setError("Password should be at least 6 characters.");
            return;
        }

        if (isSignUp) {
            if (!policiesAccepted) { setError("Please accept the Terms and acknowledge the Privacy Policy."); return; }
            if (!isPassValid) {
                setError("Please meet all password requirements.");
                return;
            }
            if (!name.trim()) {
                setError("Please enter your name.");
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
                const identity = isPhoneAuth ? `${phone.replace(/\D/g, "")}@phone-login.local` : email;
                try { sessionStorage.setItem(POLICY_PENDING_KEY, acceptanceIntent(identity)); } catch { /* Confirm after login if storage is unavailable. */ }
                const result = isPhoneAuth
                    ? await authWithPhone(name, phone, password)
                    : await signup(email, password, name);

                if (result.success) {
                    if ("needsEmailVerification" in result && result.needsEmailVerification) {
                        setVerificationMessage(`A confirmation link has been sent to ${email.trim()}. Please check your inbox and confirm your email before signing in.`);
                        setPassword("");
                        setConfirmPassword("");
                        setStatus("idle");
                    } else {
                        router.push(returnTo || "/dashboard");
                    }
                } else {
                    try { sessionStorage.removeItem(POLICY_PENDING_KEY); } catch { /* Best effort. */ }
                    setError(result.error || "Failed to create account. Please check your details.");
                    setStatus("idle");
                }
            } else {
                const loginId = isPhoneAuth
                    ? `${phone.replace(/\D/g, "")}@phone-login.local`
                    : email.trim();
                const result = await login(loginId, password);

                if (result.success) {
                    router.push(returnTo || "/dashboard");
                } else {
                    setError(result.error || (isPhoneAuth ? "Invalid phone number or password." : "Invalid email or password."));
                    setStatus("idle");
                }
            }
        } catch (err) {
            console.error(err);
            setError("Something went wrong. Please try again.");
            setStatus("idle");
        }
    };

    const handleGoogleLogin = async () => {
        if (status === "loading") return;
        setStatus("loading");
        setError("");
        try {
            const success = await loginWithGoogle();
            if (success) {
                router.push(returnTo || "/dashboard");
            } else {
                setError("Google login failed.");
            }
        } catch (err) {
            console.error(err);
            setError("Something went wrong with Google Login.");
        } finally {
            setStatus("idle");
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[var(--site-bg)] relative overflow-hidden font-sans">
            <Link href="/" className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[var(--site-muted)] transition-colors hover:text-[var(--site-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-gold sm:left-6 sm:top-6">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to site
            </Link>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-md mx-auto relative z-10"
            >
                {/* Brand / Logo */}
                <div className="flex flex-col items-center justify-center mb-8">
                    <Link href="/" aria-label="EveBash home" className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#CA9C68]/35 bg-[#CA9C68]/10 shadow-xl transition-colors hover:bg-[#CA9C68]/20">
                        <EveBashLogo className="h-8 w-8 text-[#CA9C68]" aria-hidden="true" />
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight text-[var(--site-text)]">EveBash</h1>
                    <p className="text-[var(--site-muted)] text-sm mt-2 font-medium tracking-wide">Your event memories, beautifully preserved</p>
                </div>

                {/* Main Card */}
                <div className="bg-[var(--site-surface)] rounded-[32px] p-8 shadow-2xl border border-[var(--site-border)]">
                    <h2 className="text-2xl font-bold text-[var(--site-text)] mb-1">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
                    <p className="text-[var(--site-muted)] text-sm mb-6">{isSignUp ? 'Sign up to access your gallery' : 'Sign in to access your gallery'}</p>

                    {/* Segmented Control */}
                    <div className="flex bg-slate-900/50 p-1 rounded-xl mb-6">
                        <button 
                            type="button"
                            onClick={() => { setAuthMethod('email'); setError(''); }}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${!isPhoneAuth ? 'bg-[var(--site-surface-2)] text-[var(--site-text)] shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Email
                        </button>
                        <button 
                            type="button"
                            onClick={() => { setAuthMethod('phone'); setError(''); }}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${isPhoneAuth ? 'bg-[var(--site-surface-2)] text-[var(--site-text)] shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Phone
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <div>
                                <label htmlFor="auth-name" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Full Name</label>
                                <input
                                    id="auth-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CA9C68]/50 focus:border-[#CA9C68] transition-all"
                                    placeholder="John Doe"
                                />
                            </div>
                        )}

                        {isPhoneAuth ? (
                            <div>
                                <label htmlFor="auth-phone" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Phone Number</label>
                                <input
                                    id="auth-phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CA9C68]/50 focus:border-[#CA9C68] transition-all"
                                    placeholder="9876543210"
                                />
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="auth-email" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Email Address</label>
                                <input
                                    id="auth-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CA9C68]/50 focus:border-[#CA9C68] transition-all"
                                    placeholder="you@example.com"
                                />
                            </div>
                        )}

                        {isGmailSignup && (
                            <div className="rounded-xl border border-[#CA9C68]/30 bg-[#CA9C68]/10 p-3">
                                <p className="text-sm font-medium text-[var(--site-subtle)]">
                                    You can continue faster with Google, or create an account with email verification.
                                </p>
                            </div>
                        )}

                        <div>
                            <div className="flex justify-between items-center mb-1 ml-1">
                                <label htmlFor="auth-password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                                {isSignUp && (
                                    <button type="button" onClick={generateStrongPassword} className="text-xs font-bold text-[#CA9C68] hover:text-[#D9AE7E]">
                                        Suggest Strong Password
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    id="auth-password"
                                    type={showPass ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-4 pr-12 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CA9C68]/50 focus:border-[#CA9C68] transition-all"
                                    placeholder="••••••••"
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200">
                                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {isSignUp && (
                            <div className="grid grid-cols-1 gap-1.5 py-2">
                                {[
                                    { met: passLength, text: "At least 8 characters" },
                                    { met: passUpper, text: "One uppercase letter" },
                                    { met: passLower, text: "One lowercase letter" },
                                    { met: passNumber, text: "One number" },
                                    { met: passSpecial, text: "One special character" },
                                ].map((req, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        {req.met ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-500" />}
                                        <span className={req.met ? "text-emerald-400 font-medium" : "text-slate-400"}>{req.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!isSignUp && !isPhoneAuth && (
                            <div className="flex justify-end pt-1">
                                <button type="button" onClick={() => router.push('/forgot-password')} className="text-sm font-semibold text-[#CA9C68] hover:text-[#D9AE7E]">
                                    Forgot Password?
                                </button>
                            </div>
                        )}

                        {isSignUp && (
                            <div>
                                <label htmlFor="auth-confirm-password" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        id="auth-confirm-password"
                                        type={showPass ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-4 pr-12 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#CA9C68]/50 focus:border-[#CA9C68] transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-rose-900/30 border border-rose-500/30 p-3 rounded-lg">
                                <p className="text-sm text-rose-400 text-center font-medium">{error}</p>
                            </div>
                        )}

                        {verificationMessage && (
                            <div className="bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-lg">
                                <p className="text-sm text-emerald-400 text-center font-medium">{verificationMessage}</p>
                            </div>
                        )}

                        {isSignUp && <label className="my-4 flex items-start gap-3 text-sm text-slate-200"><input type="checkbox" checked={policiesAccepted} onChange={e => setPoliciesAccepted(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span>I agree to the <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="underline">Terms &amp; Conditions</a> and acknowledge the <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>.</span></label>}
                        <button
                            type="submit"
                            disabled={status !== "idle" || (isSignUp && (!policiesAccepted || !isPassValid || (password !== confirmPassword)))}
                            className="w-full py-3.5 bg-[#CA9C68] hover:bg-[#D9AE7E] text-[#13191F] rounded-xl font-bold text-[15px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#CA9C68] focus:ring-offset-[#1B211F] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-2"
                        >
                            {status === "loading" ? (
                                <div className="w-5 h-5 border-2 border-[#13191F]/30 border-t-[#13191F] rounded-full animate-spin" />
                            ) : (
                                isGmailSignup ? "Continue with email verification" : isSignUp ? "Create Account" : "Sign In"
                            )}
                        </button>
                    </form>

                    {/* Social Login */}
                    <div className="mt-6 mb-6 relative flex items-center py-2">
                        <div className="flex-grow border-t border-slate-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold uppercase tracking-wider">or continue with</span>
                        <div className="flex-grow border-t border-slate-700"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={status !== "idle"}
                        className="w-full py-3.5 bg-slate-900 border border-slate-700 text-white rounded-xl font-bold text-[15px] hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800 focus:ring-offset-slate-900 transition-all shadow-sm flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>

                    {/* Toggle Mode */}
                    <div className="mt-8 text-center">
                        <p className="text-slate-500 text-sm">
                            {isSignUp ? "Already have an account?" : "Don't have an account?"}
                            <button onClick={toggleMode} className="ml-1.5 font-bold text-[#CA9C68] hover:text-[#D9AE7E] transition-colors">
                                {isSignUp ? "Sign In" : "Sign Up"}
                            </button>
                        </p>
                    </div>
                </div>

                <div className="text-center mt-6">
                    <p className="text-[var(--site-muted)] text-xs font-medium tracking-wide">Protected access to EveBash</p>
                </div>
            </motion.div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[var(--site-bg)]">
                <div className="h-10 w-10 border-4 border-[#CA9C68] border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
