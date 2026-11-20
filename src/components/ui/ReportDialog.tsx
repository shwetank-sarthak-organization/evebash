"use client";

import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { ModalHeader, modalStyles } from "@/components/ui/Modal";
import {
    REPORT_DUPLICATE,
    REPORT_NOTE_MAX,
    REPORT_REASONS,
    REPORT_TARGET_LABELS,
    REPORT_THANKS,
    reportErrorMessage,
    type ReportReason,
    type ReportTargetType,
} from "../../../shared/legal/contentReports";

export type ReportTarget = { targetType: ReportTargetType; targetId: string };

type Stage = "checking" | "signed-out" | "form" | "done";

function ReportDialog({ targetType, targetId, onDone }: ReportTarget & { onDone: () => void }) {
    const [stage, setStage] = useState<Stage>("checking");
    const [reason, setReason] = useState<ReportReason | "">("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [doneMessage, setDoneMessage] = useState(REPORT_THANKS);

    useEffect(() => {
        void supabase.auth.getSession().then(({ data }) => setStage(data.session ? "form" : "signed-out"));
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onDone(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onDone]);

    const submit = async () => {
        if (!reason || busy) return;
        setBusy(true);
        setError("");
        const { data, error: rpcError } = await supabase.rpc("file_content_report", {
            p_target_type: targetType,
            p_target_id: targetId,
            p_reason: reason,
            p_note: note.trim() || null,
            p_platform: "web",
        });
        setBusy(false);
        if (rpcError) {
            setError(reportErrorMessage(rpcError));
            return;
        }
        setDoneMessage((data as { duplicate?: boolean } | null)?.duplicate ? REPORT_DUPLICATE : REPORT_THANKS);
        setStage("done");
    };

    const label = REPORT_TARGET_LABELS[targetType];
    const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";

    return (
        <div className={cn(modalStyles.overlay, "z-[10050]")} onMouseDown={onDone}>
            <div role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" className={cn(modalStyles.panel, "max-h-[90vh] overflow-y-auto")} onMouseDown={(event) => event.stopPropagation()}>
                <ModalHeader
                    title={stage === "done" ? "Report sent" : `Report ${label}`}
                    subtitle={stage === "form" ? "Reports are private. The person you report isn't told who reported them." : undefined}
                    titleId="report-dialog-title"
                    onClose={onDone}
                    className="mb-4"
                />
                {stage === "checking" && (
                    <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#CA9C68]" /></div>
                )}
                {stage === "signed-out" && (
                    <>
                        <p className={modalStyles.body}>Please log in to report this {label}. You can also email support@evebash.com.</p>
                        <div className={modalStyles.actions}>
                            <button type="button" onClick={onDone} className={modalStyles.secondary}>Cancel</button>
                            <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className={modalStyles.primary}>Log in</a>
                        </div>
                    </>
                )}
                {stage === "form" && (
                    <>
                        <fieldset className="space-y-2">
                            <legend className={modalStyles.label}>Why are you reporting this?</legend>
                            {REPORT_REASONS.map((option) => (
                                <label
                                    key={option.value}
                                    className={cn(
                                        "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors",
                                        reason === option.value
                                            ? "border-[#CA9C68] bg-[#CA9C68]/10 text-[var(--site-text)]"
                                            : "border-[var(--site-border)] bg-[#13191F]/60 text-[var(--site-subtle)] hover:border-[#CA9C68]/60"
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="report-reason"
                                        value={option.value}
                                        checked={reason === option.value}
                                        onChange={() => setReason(option.value)}
                                        className="accent-[#CA9C68]"
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </fieldset>
                        <label className={cn(modalStyles.label, "mt-5")} htmlFor="report-note">Anything else we should know? (optional)</label>
                        <textarea
                            id="report-note"
                            value={note}
                            maxLength={REPORT_NOTE_MAX}
                            onChange={(event) => setNote(event.target.value)}
                            rows={3}
                            className={cn(modalStyles.input, "resize-none py-3 text-sm")}
                        />
                        {error && <p className={cn(modalStyles.error, "mt-4")}>{error}</p>}
                        <div className={modalStyles.actions}>
                            <button type="button" onClick={onDone} className={modalStyles.secondary}>Cancel</button>
                            <button type="button" onClick={submit} disabled={!reason || busy} className={modalStyles.danger}>
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                                Send report
                            </button>
                        </div>
                    </>
                )}
                {stage === "done" && (
                    <>
                        <p className={modalStyles.success}>{doneMessage}</p>
                        <div className={modalStyles.actions}>
                            <button type="button" onClick={onDone} className={modalStyles.primary}>Done</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/** Opens the report dialog for a photo, video, comment, business or user. */
export function reportContent(target: ReportTarget): Promise<void> {
    if (typeof document === "undefined") return Promise.resolve();
    return new Promise((resolve) => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        const root = createRoot(host);
        let settled = false;
        const onDone = () => {
            if (settled) return;
            settled = true;
            resolve();
            setTimeout(() => { root.unmount(); host.remove(); }, 0);
        };
        root.render(<ReportDialog {...target} onDone={onDone} />);
    });
}
