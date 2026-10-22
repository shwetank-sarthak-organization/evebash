"use client";

import React, { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    Circle,
    FileText,
    Home,
    Loader2,
    Lock,
    Mail,
    MessageSquare,
    ScanFace,
    Settings,
    Shield,
    Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { getApiUrl } from "@/lib/apiBase";
import { cn } from "@/lib/utils";
import { confirmDialog, ModalHeader, modalStyles } from "@/components/ui/Modal";
import { withdrawFindYouConsent } from "@/components/FindYouConsentGate";

const SUPPORT_EMAIL = "support@evebash.com";

const CARD = "overflow-hidden rounded-[2rem] border border-[#273034] bg-[#121820]";
const SECTION_LABEL = "mb-3 px-1 font-sans text-[11px] font-black uppercase tracking-[0.16em] text-slate-500";
const ROW = "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors sm:px-6";
const ICON_BOX = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl";

type SignInMethod = { label: string; identifier: string };

function RowContent({ icon: Icon, title, subtitle, tone = "default", trailing = true }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle?: string;
    tone?: "default" | "danger";
    trailing?: boolean;
}) {
    const danger = tone === "danger";
    return (
        <>
            <span className={cn(ICON_BOX, danger ? "bg-rose-500/10 text-rose-300" : "bg-[#CA9C68]/10 text-[#CA9C68]")}>
                <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-black", danger ? "text-rose-300" : "text-white")}>{title}</span>
                {subtitle && <span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-400">{subtitle}</span>}
            </span>
            {trailing && <ChevronRight className={cn("h-4 w-4 shrink-0", danger ? "text-rose-300" : "text-slate-500")} />}
        </>
    );
}

export default function SettingsPage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();

    const [signInMethod, setSignInMethod] = useState<SignInMethod | null>(null);

    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState("");

    const [showDeleteAccount, setShowDeleteAccount] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const [toast, setToast] = useState("");

    // Same password rules as sign-up and reset-password on the website.
    const passLength = password.length >= 8;
    const passUpper = /[A-Z]/.test(password);
    const passLower = /[a-z]/.test(password);
    const passNumber = /[0-9]/.test(password);
    const passSpecial = /[^A-Za-z0-9]/.test(password);
    const isPassValid = passLength && passUpper && passLower && passNumber && passSpecial;

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, router, user]);

    // The sign-in identity comes from the auth account, not the profile (a phone account can add an email to its profile).
    useEffect(() => {
        if (!user) return;
        let cancelled = false;

        const loadSignInMethod = async () => {
            const { data } = await supabase.auth.getUser();
            if (cancelled) return;
            const authUser = data.user;
            const authEmail = authUser?.email || "";
            const profilePhone = user.phone && user.phone !== "No Phone" ? user.phone : "";

            if (authEmail.endsWith("@phone-login.local")) {
                setSignInMethod({ label: "Phone number", identifier: profilePhone || authEmail.split("@")[0] });
            } else if (authUser?.app_metadata?.provider === "google") {
                setSignInMethod({ label: "Google", identifier: authEmail || user.email || "" });
            } else {
                setSignInMethod({ label: "Email", identifier: authEmail || user.email || "" });
            }
        };

        void loadSignInMethod();
        return () => {
            cancelled = true;
        };
    }, [user]);

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(""), 2500);
    };

    // Find You asks for consent again before the next search
    const handleWithdrawFindYou = async () => {
        const confirmed = await confirmDialog({
            title: "Withdraw Find You consent?",
            message: "Find You will stop using your selfie until you agree again.",
            confirmLabel: "Withdraw",
        });
        if (!confirmed) return;
        try {
            await withdrawFindYouConsent();
            showToast("Find You consent withdrawn.");
        } catch {
            showToast("Could not withdraw Find You consent. Please try again.");
        }
    };

    const closePasswordModal = () => {
        if (updatingPassword) return;
        setShowPassword(false);
        setPassword("");
        setConfirmPassword("");
        setPasswordError("");
    };

    const handlePasswordChange = async (event: FormEvent) => {
        event.preventDefault();
        if (!isPassValid) {
            setPasswordError("Please meet all password requirements.");
            return;
        }
        if (password !== confirmPassword) {
            setPasswordError("Passwords do not match.");
            return;
        }

        setUpdatingPassword(true);
        setPasswordError("");
        const { error } = await supabase.auth.updateUser({ password });
        setUpdatingPassword(false);

        if (error) {
            setPasswordError(error.message || "Failed to update password.");
            return;
        }

        setShowPassword(false);
        setPassword("");
        setConfirmPassword("");
        showToast("Your password has been updated.");
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== "DELETE" || deletingAccount) return;

        setDeletingAccount(true);
        setDeleteError("");
        try {
            const { data } = await supabase.auth.getSession();
            const accessToken = data.session?.access_token;
            if (!accessToken) throw new Error("Please sign in again before deleting your account.");

            const response = await fetch(getApiUrl("/api/v1/account"), {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ confirmation: deleteConfirmation }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || "Failed to delete your account.");

            await logout();
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : "Failed to delete your account.");
            setDeletingAccount(false);
        }
    };

    if (authLoading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0E141A] text-slate-300">
                <Loader2 className="h-8 w-8 animate-spin text-[#CA9C68]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0E141A] font-sans text-white">
            <main className="mx-auto max-w-3xl space-y-8 px-4 pt-12 pb-24 sm:px-6 lg:px-8">
                <section className="rounded-[2rem] border border-[#273034] bg-[#121820] p-5 shadow-2xl shadow-black/25 sm:p-8">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[#CA9C68]">
                                <Settings className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate font-brand font-normal tracking-wide text-[#F5EFE6]" style={{ fontSize: 28, lineHeight: "30px" }}>
                                    Settings
                                </h1>
                                <p className="truncate font-sans text-slate-400" style={{ fontSize: 12, lineHeight: "18px" }}>Account, support and legal</p>
                            </div>
                        </div>
                        <Link
                            href="/profile"
                            className="flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-200 transition-colors hover:border-[#CA9C68]/60 hover:text-white sm:px-5"
                            aria-label="Back to profile"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Profile</span>
                        </Link>
                    </div>
                </section>

                <section>
                    <h2 className={SECTION_LABEL}>Account &amp; Security</h2>
                    <div className={CARD}>
                        <div className="grid gap-3 px-5 py-4 text-sm sm:px-6">
                            <div className="flex items-center justify-between gap-4">
                                <span className="font-semibold text-slate-400">Signed in via</span>
                                <span className="font-black text-white">{signInMethod?.label || "..."}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="shrink-0 font-semibold text-slate-400">Identifier</span>
                                <span className="min-w-0 truncate font-black text-white">{signInMethod?.identifier || "..."}</span>
                            </div>
                        </div>
                        <div className="border-t border-white/5" />
                        <button type="button" onClick={() => setShowPassword(true)} className={cn(ROW, "hover:bg-white/[0.03]")}>
                            <RowContent icon={Lock} title="Change Password" subtitle="Set a new password for signing in" />
                        </button>
                        <div className="border-t border-white/5" />
                        <button type="button" onClick={() => void handleWithdrawFindYou()} className={cn(ROW, "hover:bg-white/[0.03]")}>
                            <RowContent icon={ScanFace} title="Withdraw Find You Consent" subtitle="Stop Find You using your selfie" />
                        </button>
                        <div className="border-t border-white/5" />
                        <button type="button" onClick={() => setShowDeleteAccount(true)} className={cn(ROW, "hover:bg-rose-500/5")}>
                            <RowContent icon={Trash2} title="Delete Account" subtitle="Permanently removes your profile, hosted events, and uploaded media" tone="danger" />
                        </button>
                    </div>
                </section>

                <section>
                    <h2 className={SECTION_LABEL}>Feedback &amp; Support</h2>
                    <div className={CARD}>
                        <Link href="/contact-us" className={cn(ROW, "hover:bg-white/[0.03]")}>
                            <RowContent icon={MessageSquare} title="Report a Bug / Send Feedback" subtitle="Write to the EveBash team" />
                        </Link>
                        <div className="border-t border-white/5" />
                        <a href={`mailto:${SUPPORT_EMAIL}`} className={cn(ROW, "hover:bg-white/[0.03]")}>
                            <RowContent icon={Mail} title="Contact Customer Support" subtitle={SUPPORT_EMAIL} />
                        </a>
                    </div>
                </section>

                <section>
                    <h2 className={SECTION_LABEL}>About &amp; Legal</h2>
                    <div className={CARD}>
                        <Link href="/" className={cn(ROW, "hover:bg-white/[0.03]")}>
                            <RowContent icon={Home} title="About EveBash" />
                        </Link>
                        <div className="border-t border-white/5" />
                        <Link href="/terms-and-conditions" className={cn(ROW, "hover:bg-white/[0.03]")}>
                            <RowContent icon={FileText} title="Terms of Service" />
                        </Link>
                        <div className="border-t border-white/5" />
                        <Link href="/privacy-policy" className={cn(ROW, "hover:bg-white/[0.03]")}>
                            <RowContent icon={Shield} title="Privacy Policy" />
                        </Link>
                    </div>
                </section>
            </main>

            {toast && (
                <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-bold text-emerald-300 shadow-2xl">
                    {toast}
                </div>
            )}

            {showPassword && (
                <div className={modalStyles.overlay} onMouseDown={closePasswordModal}>
                    <form onSubmit={handlePasswordChange} className={modalStyles.panel} onMouseDown={(event) => event.stopPropagation()}>
                        <ModalHeader title="Change Password" subtitle="Choose a secure password for EveBash" onClose={closePasswordModal} closeDisabled={updatingPassword} />
                        <label className={modalStyles.label}>
                            New Password
                            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={updatingPassword} autoComplete="new-password" placeholder="••••••••" className={cn(modalStyles.input, "mt-2 normal-case tracking-normal")} />
                        </label>
                        <div className="mb-4 grid gap-1.5">
                            {[
                                { met: passLength, text: "At least 8 characters" },
                                { met: passUpper, text: "One uppercase letter" },
                                { met: passLower, text: "One lowercase letter" },
                                { met: passNumber, text: "One number" },
                                { met: passSpecial, text: "One special character" },
                            ].map((req) => (
                                <div key={req.text} className="flex items-center gap-2 text-xs">
                                    {req.met ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-slate-500" />}
                                    <span className={req.met ? "font-semibold text-emerald-300" : "text-slate-400"}>{req.text}</span>
                                </div>
                            ))}
                        </div>
                        <label className={modalStyles.label}>
                            Confirm Password
                            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={updatingPassword} autoComplete="new-password" placeholder="••••••••" className={cn(modalStyles.input, "mt-2 normal-case tracking-normal")} />
                        </label>
                        {passwordError && <p className={cn(modalStyles.error, "mt-4")}>{passwordError}</p>}
                        <div className={modalStyles.actions}>
                            <button type="button" onClick={closePasswordModal} disabled={updatingPassword} className={modalStyles.secondary}>Cancel</button>
                            <button type="submit" disabled={updatingPassword || !isPassValid || password !== confirmPassword} className={modalStyles.primary}>
                                {updatingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                                Update Password
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showDeleteAccount && (
                <div className={modalStyles.overlay} onMouseDown={() => !deletingAccount && setShowDeleteAccount(false)}>
                    <div className={cn(modalStyles.panel, "border-rose-500/30")} onMouseDown={(event) => event.stopPropagation()}>
                        <ModalHeader
                            eyebrow={<span className="text-rose-300">Permanent action</span>}
                            title="Delete your account?"
                            onClose={() => setShowDeleteAccount(false)}
                            closeDisabled={deletingAccount}
                            className="mb-0"
                        />
                        <p className={cn(modalStyles.body, "mt-4")}>This permanently removes your profile, hosted events, uploaded photos and videos, comments, and likes. This cannot be undone.</p>
                        <label className={cn(modalStyles.label, "mt-5")}>
                            Type DELETE to confirm
                            <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} disabled={deletingAccount} autoComplete="off" className={cn(modalStyles.input, "mt-2 font-black normal-case tracking-normal focus:border-rose-400 focus:ring-rose-400")} />
                        </label>
                        {deleteError && <p className="mt-3 text-sm font-bold text-rose-300">{deleteError}</p>}
                        <div className="mt-6 flex gap-3">
                            <button type="button" disabled={deletingAccount} onClick={() => setShowDeleteAccount(false)} className={cn(modalStyles.secondary, "flex-1")}>Cancel</button>
                            <button type="button" disabled={deleteConfirmation !== "DELETE" || deletingAccount} onClick={handleDeleteAccount} className={cn(modalStyles.danger, "flex-1")}>
                                {deletingAccount && <Loader2 className="h-4 w-4 animate-spin" />}
                                Delete permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
