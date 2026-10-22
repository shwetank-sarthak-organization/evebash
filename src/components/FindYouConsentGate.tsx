"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
    FIND_YOU_CONSENT_ADULT,
    FIND_YOU_CONSENT_AGREE,
    FIND_YOU_CONSENT_POINTS,
    FIND_YOU_CONSENT_TEXT,
    FIND_YOU_CONSENT_TITLE,
    FIND_YOU_CONSENT_VERSION,
} from "../../shared/legal/findYouConsent";

type ConsentState = "checking" | "needed" | "given" | "signed-out" | "error";

// PostgREST's "function not found": the consent migration isn't applied yet
const isMissingRpc = (error: { code?: string } | null) => error?.code === "PGRST202";

// Shows the Find You consent step until the signed-in user has agreed to the current wording.
export function FindYouConsentGate({ children, returnTo }: { children: React.ReactNode; returnTo: string }) {
    const [state, setState] = useState<ConsentState>("checking");
    const [adult, setAdult] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        void (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                if (active) setState("signed-out");
                return;
            }
            const { data, error } = await supabase.rpc("get_find_you_consent");
            if (!active) return;
            if (error) {
                if (isMissingRpc(error)) setState("needed");
                else { setState("error"); setError("We could not check your Find You consent. Please retry."); }
                return;
            }
            if (data?.version !== FIND_YOU_CONSENT_VERSION) {
                setState("error");
                setError("The Find You consent has changed. Please refresh the page.");
                return;
            }
            setState(data.consented === true ? "given" : "needed");
        })();
        return () => { active = false; };
    }, [retry]);

    const giveConsent = async () => {
        if (!adult || !agreed || busy) return;
        setBusy(true);
        setError("");
        const { error } = await supabase.rpc("give_find_you_consent", {
            p_version: FIND_YOU_CONSENT_VERSION,
            p_platform: "web",
            p_adult: true,
            p_text: FIND_YOU_CONSENT_TEXT,
        });
        setBusy(false);
        if (error && !isMissingRpc(error)) {
            setError("Your consent could not be saved. Please try again.");
            return;
        }
        if (error) console.warn("[FindYouConsent] Consent table missing; continuing for this visit only.");
        setState("given");
    };

    if (state === "given") return <>{children}</>;

    return (
        <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-stone-100 text-left text-stone-700">
            <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="h-7 w-7 flex-shrink-0 text-amber-700" aria-hidden />
                <h2 className="font-serif text-xl font-bold text-stone-900">{FIND_YOU_CONSENT_TITLE}</h2>
            </div>

            {state === "checking" && <p role="status" className="animate-pulse">Checking your Find You consent…</p>}

            {state === "signed-out" && (
                <p>
                    Find You needs an EveBash account.{" "}
                    <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-amber-800 underline">
                        Log in or create an account
                    </Link>{" "}
                    to use it.
                </p>
            )}

            {state === "error" && (
                <div className="space-y-4">
                    <p role="alert" className="text-rose-700">{error}</p>
                    <button type="button" onClick={() => { setState("checking"); setError(""); setRetry((n) => n + 1); }} className="rounded-xl border border-stone-300 px-5 py-2 font-semibold">
                        Retry
                    </button>
                </div>
            )}

            {state === "needed" && (
                <div className="space-y-5">
                    <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
                        {FIND_YOU_CONSENT_POINTS.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                    <p className="text-sm">
                        More detail is in the{" "}
                        <Link href="/privacy-policy" target="_blank" className="font-semibold text-amber-800 underline">Privacy Policy</Link>{" "}
                        (section 4, Find You and Facial Processing).
                    </p>
                    <label className="flex items-start gap-3 text-sm">
                        <input type="checkbox" checked={adult} disabled={busy} onChange={(e) => setAdult(e.target.checked)} className="mt-1 h-4 w-4 accent-amber-700" />
                        <span>{FIND_YOU_CONSENT_ADULT}</span>
                    </label>
                    <label className="flex items-start gap-3 text-sm">
                        <input type="checkbox" checked={agreed} disabled={busy} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-amber-700" />
                        <span>{FIND_YOU_CONSENT_AGREE}</span>
                    </label>
                    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
                    <button
                        type="button"
                        onClick={() => void giveConsent()}
                        disabled={!adult || !agreed || busy}
                        className="w-full rounded-xl bg-stone-900 px-6 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {busy ? "Saving…" : "Agree and continue"}
                    </button>
                </div>
            )}
        </div>
    );
}

// Profile/Settings control: stops Find You until the user agrees again.
export async function withdrawFindYouConsent() {
    const { error } = await supabase.rpc("withdraw_find_you_consent");
    if (error && !isMissingRpc(error)) throw error;
}
