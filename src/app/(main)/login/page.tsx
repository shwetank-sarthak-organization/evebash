"use client";

import { POLICY_PENDING_KEY, acceptanceIntent } from "../../../../shared/legal/acceptance";

import React, { useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Same look as the app's login screen (apps/mobile/app/login.tsx): white card on a dark-to-bronze gradient
const PAGE_GRADIENT = "linear-gradient(to bottom, #1B211F, #2B2F2E, #594C3D)";
const INPUT_CLASS = "w-full px-4 py-3.5 bg-[#FFF7EB] border-[1.5px] border-[#e2e8f0] rounded-[14px] text-[15px] text-[#1B211F] placeholder-[#7C6C58] focus:outline-none focus:border-[#CA9C68] focus:ring-2 focus:ring-[#CA9C68]/40 transition-colors";
const LABEL_CLASS = "block text-xs font-bold text-[#475569] uppercase tracking-[0.8px]";

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
    // Email only for now; phone comes back in a later version (see the commented-out switch below).
    // const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
    const authMethod = "email" as "email" | "phone";
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
        <div className="min-h-screen flex flex-col justify-center py-16 px-6 relative overflow-hidden font-sans" style={{ background: PAGE_GRADIENT }}>
            <Link href="/" className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[#CDB89E] transition-colors hover:text-[#FFF7EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CA9C68] sm:left-6 sm:top-6">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to site
            </Link>
            <motion.div
                // Slide only, no fade: the card must be readable even before (or without) the animation running
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-md mx-auto relative z-10"
            >
                {/* Brand */}
                <div className="flex flex-col items-center justify-center mb-6 text-center">
                    <h1 className="font-brand font-normal text-[44px] leading-[54px] tracking-[0.5px] text-[#CA9C68] mb-1.5">
                        <Link href="/" aria-label="EveBash home" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CA9C68]">EveBash</Link>
                    </h1>
                    <p className="font-brand text-lg leading-6 tracking-[0.3px] text-[#CDB89E]">Celebrate. Capture. Connect.</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-[28px] p-7 shadow-[0_20px_30px_rgba(0,0,0,0.3)]">
                    <h2 className="font-sans text-2xl font-bold text-[#1B211F] mb-1">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
                    <p className="text-[#64748b] text-sm mb-7">{isSignUp ? 'Sign up to access your gallery' : 'Sign in to access your gallery'}</p>

                    {/* Phone login and signup are hidden for now: email only. They come back in a later version (no SMS
                        code yet; the phone becomes <digits>@phone-login.local). To restore, uncomment this switch and the
                        setAuthMethod line above.
                    <div className="flex bg-[#f1f5f9] p-1 rounded-[14px] mb-[22px]">
                        <button
                            type="button"
                            onClick={() => { setAuthMethod('email'); setError(''); }}
                            aria-pressed={!isPhoneAuth}
                            className={`flex-1 py-[11px] rounded-[11px] text-[13px] font-extrabold uppercase tracking-[0.4px] transition-colors ${!isPhoneAuth ? 'bg-[#1B211F] text-[#CA9C68]' : 'text-[#64748b] hover:text-[#1B211F]'}`}
                        >
                            Email
                        </button>
                        <button
                            type="button"
                            onClick={() => { setAuthMethod('phone'); setError(''); }}
                            aria-pressed={isPhoneAuth}
                            className={`flex-1 py-[11px] rounded-[11px] text-[13px] font-extrabold uppercase tracking-[0.4px] transition-colors ${isPhoneAuth ? 'bg-[#1B211F] text-[#CA9C68]' : 'text-[#64748b] hover:text-[#1B211F]'}`}
                        >
                            Phone
                        </button>
                    </div>
                    */}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {isSignUp && (
                            <div>
                                <label htmlFor="auth-name" className={`${LABEL_CLASS} mb-2`}>Full Name</label>
                                <input
                                    id="auth-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={INPUT_CLASS}
                                    placeholder="John Doe"
                                />
                            </div>
                        )}

                        {isPhoneAuth ? (
                            <div>
                                <label htmlFor="auth-phone" className={`${LABEL_CLASS} mb-2`}>Phone Number</label>
                                <input
                                    id="auth-phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={INPUT_CLASS}
                                    placeholder="9876543210"
                                />
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="auth-email" className={`${LABEL_CLASS} mb-2`}>Email Address</label>
                                <input
                                    id="auth-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={INPUT_CLASS}
                                    placeholder="you@example.com"
                                />
                            </div>
                        )}

                        {isGmailSignup && (
                            <div className="rounded-xl border border-[#CA9C68]/40 bg-[#FFF7EB] p-3">
                                <p className="text-sm font-medium text-[#594C3D]">
                                    You can continue faster with Google, or create an account with email verification.
                                </p>
                            </div>
                        )}

                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <label htmlFor="auth-password" className={LABEL_CLASS}>Password</label>
                                {isSignUp && (
                                    <button type="button" onClick={generateStrongPassword} className="text-xs font-bold text-[#8C6434] hover:text-[#6F4E28]">
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
                                    className={`${INPUT_CLASS} pr-12`}
                                    placeholder="••••••••"
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7C6C58] hover:text-[#1B211F]">
                                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {isSignUp && (
                            <div className="grid grid-cols-1 gap-1 px-1 -mt-2.5">
                                {[
                                    { met: passLength, text: "At least 8 characters" },
                                    { met: passUpper, text: "One uppercase letter" },
                                    { met: passLower, text: "One lowercase letter" },
                                    { met: passNumber, text: "One number" },
                                    { met: passSpecial, text: "One special character" },
                                ].map((req, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        {req.met ? <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" /> : <Circle className="w-3.5 h-3.5 text-[#7C6C58]" />}
                                        <span className={req.met ? "text-[#059669]" : "text-[#7C6C58]"}>{req.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!isSignUp && !isPhoneAuth && (
                            <div className="flex justify-end -mt-2">
                                <button type="button" onClick={() => router.push('/forgot-password')} className="text-[13px] font-semibold text-[#8C6434] hover:text-[#6F4E28]">
                                    Forgot Password?
                                </button>
                            </div>
                        )}

                        {isSignUp && (
                            <div>
                                <label htmlFor="auth-confirm-password" className={`${LABEL_CLASS} mb-2`}>Confirm Password</label>
                                <input
                                    id="auth-confirm-password"
                                    type={showPass ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={INPUT_CLASS}
                                    placeholder="••••••••"
                                />
                            </div>
                        )}

                        {error && (
                            <div className="bg-[#fef2f2] border border-[#fecaca] px-3.5 py-2.5 rounded-[10px]">
                                <p className="text-sm text-[#dc2626] text-center font-medium">{error}</p>
                            </div>
                        )}

                        {verificationMessage && (
                            <div className="bg-[#d1fae5] border border-[#34d399] p-3 rounded-xl">
                                <p className="text-sm text-[#059669] text-center font-medium">{verificationMessage}</p>
                            </div>
                        )}

                        {isSignUp && (
                            <div className="flex flex-col gap-3 py-1">
                                <label className="flex items-start gap-2.5 text-[15px] leading-[22px] text-[#334155] cursor-pointer">
                                    <input type="checkbox" checked={policiesAccepted} onChange={e => setPoliciesAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#8C6434] cursor-pointer" />
                                    <span>I agree to the Terms &amp; Conditions and acknowledge the Privacy Policy.</span>
                                </label>
                                <div className="flex gap-5 text-[15px]">
                                    <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-[#8C6434] underline hover:text-[#6F4E28]">Terms &amp; Conditions</a>
                                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#8C6434] underline hover:text-[#6F4E28]">Privacy Policy</a>
                                </div>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={status !== "idle" || (isSignUp && (!policiesAccepted || !isPassValid || (password !== confirmPassword)))}
                            className="w-full py-4 bg-[#1B211F] hover:bg-[#2B2F2E] text-[#CA9C68] rounded-[14px] font-bold text-base tracking-[0.3px] shadow-[0_6px_10px_rgba(27,33,31,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#CA9C68] transition-colors disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-[#1B211F] flex justify-center items-center gap-2"
                        >
                            {status === "loading" ? (
                                <div className="w-5 h-5 border-2 border-[#CA9C68]/30 border-t-[#CA9C68] rounded-full animate-spin" />
                            ) : (
                                isGmailSignup ? "Continue with email verification" : isSignUp ? "Create Account" : "Sign In"
                            )}
                        </button>
                    </form>

                    {/* Social Login */}
                    <div className="mt-7 mb-5 flex items-center">
                        <div className="flex-grow h-px bg-[#e2e8f0]"></div>
                        <span className="flex-shrink-0 px-3 text-[#7C6C58] text-xs font-bold tracking-[0.5px]">OR</span>
                        <div className="flex-grow h-px bg-[#e2e8f0]"></div>
                    </div>

                    {/* Google's light-theme button, as in the app */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={status !== "idle"}
                        className="w-full min-h-[50px] px-4 bg-white border border-[#747775] text-[#1F1F1F] rounded-[14px] font-semibold text-[15px] hover:bg-[#F2F2F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#CA9C68] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white flex items-center justify-center gap-3"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>

                    {/* Toggle Mode */}
                    <div className="mt-5 text-center">
                        <p className="text-[#64748b] text-sm">
                            {isSignUp ? "Already have an account?" : "Don't have an account?"}
                            <button type="button" onClick={toggleMode} className="ml-1 font-bold text-[#8C6434] hover:text-[#6F4E28] transition-colors">
                                {isSignUp ? "Sign In" : "Sign Up"}
                            </button>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center mt-7 px-3 text-[13px] leading-5 text-[#E6D8C3]">
                    Review our{" "}
                    <Link href="/terms-and-conditions" className="font-bold text-[#FFF7EB] underline">Terms</Link>
                    {" "}and{" "}
                    <Link href="/privacy-policy" className="font-bold text-[#FFF7EB] underline">Privacy Policy</Link>.
                </p>
            </motion.div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center" style={{ background: PAGE_GRADIENT }}>
                <div className="h-10 w-10 border-4 border-[#CA9C68] border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
