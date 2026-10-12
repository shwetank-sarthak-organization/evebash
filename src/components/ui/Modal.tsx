"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// One look for every website modal: dark surface, gold accents, X at the top right.
export const modalStyles = {
    overlay: "fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm",
    panel: "relative w-full max-w-md rounded-[2rem] border border-[var(--site-border)] bg-[var(--site-surface)] p-6 text-[var(--site-text)] shadow-2xl shadow-black/50 sm:p-7",
    // For native <dialog> elements, which centre themselves.
    dialog: "m-auto w-[calc(100%-2rem)] max-w-md rounded-[2rem] border border-[var(--site-border)] bg-[var(--site-surface)] p-6 text-[var(--site-text)] shadow-2xl shadow-black/50 backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:p-7",
    title: "text-2xl font-black tracking-tight text-[var(--site-text)]",
    subtitle: "mt-1 text-sm font-semibold leading-6 text-[var(--site-muted)]",
    eyebrow: "mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#CA9C68]",
    body: "text-sm font-semibold leading-6 text-[var(--site-subtle)]",
    label: "mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-[var(--site-muted)]",
    input: "w-full rounded-2xl border border-[var(--site-border)] bg-[#13191F] px-5 py-4 text-base text-[var(--site-text)] outline-none transition-colors placeholder:text-[var(--site-muted)]/60 focus:border-[#CA9C68] focus:ring-1 focus:ring-[#CA9C68]",
    actions: "mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
    primary: "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CA9C68] px-5 py-3.5 text-sm font-black uppercase tracking-widest text-[#13191F] transition-colors hover:bg-[#D7AE7D] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    secondary: "inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--site-border)] px-5 py-3.5 text-sm font-black uppercase tracking-widest text-[var(--site-subtle)] transition-colors hover:bg-white/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    danger: "inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-5 py-3.5 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-rose-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
    error: "rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-center text-sm font-bold text-rose-200",
    success: "rounded-2xl border border-[#CA9C68]/30 bg-[#CA9C68]/10 p-4 text-center text-sm font-bold text-[#F5E7D4]",
};

export function ModalCloseButton({ onClick, disabled, label = "Close", className }: {
    onClick: () => void;
    disabled?: boolean;
    label?: string;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--site-border)] bg-[#13191F]/70 text-[var(--site-muted)] transition-colors hover:border-[#CA9C68]/60 hover:text-[var(--site-text)] disabled:cursor-not-allowed disabled:opacity-40",
                className
            )}
        >
            <X className="h-5 w-5" aria-hidden />
        </button>
    );
}

export function ModalHeader({ title, subtitle, eyebrow, onClose, closeDisabled, closeLabel, titleId, className }: {
    title: ReactNode;
    subtitle?: ReactNode;
    eyebrow?: ReactNode;
    onClose: () => void;
    closeDisabled?: boolean;
    closeLabel?: string;
    titleId?: string;
    className?: string;
}) {
    return (
        <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
            <div className="min-w-0 flex-1">
                {eyebrow && <p className={modalStyles.eyebrow}>{eyebrow}</p>}
                <h2 id={titleId} className={modalStyles.title}>{title}</h2>
                {subtitle && <p className={modalStyles.subtitle}>{subtitle}</p>}
            </div>
            <ModalCloseButton onClick={onClose} disabled={closeDisabled} label={closeLabel} />
        </div>
    );
}

type MessageDialogOptions = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "default" | "danger";
};

function MessageDialog({ title, message, confirmLabel = "OK", cancelLabel, tone = "default", onDone }: MessageDialogOptions & { onDone: (confirmed: boolean) => void }) {
    const confirmRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        confirmRef.current?.focus();
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onDone(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onDone]);
    return (
        <div className={cn(modalStyles.overlay, "z-[10050]")} onMouseDown={() => onDone(false)}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="message-dialog-title" aria-describedby="message-dialog-body" className={modalStyles.panel} onMouseDown={(event) => event.stopPropagation()}>
                <ModalHeader title={title} titleId="message-dialog-title" onClose={() => onDone(false)} className="mb-3" />
                <p id="message-dialog-body" className={cn(modalStyles.body, "whitespace-pre-line")}>{message}</p>
                <div className={modalStyles.actions}>
                    {cancelLabel && <button type="button" onClick={() => onDone(false)} className={modalStyles.secondary}>{cancelLabel}</button>}
                    <button ref={confirmRef} type="button" onClick={() => onDone(true)} className={tone === "danger" ? modalStyles.danger : modalStyles.primary}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

function openMessageDialog(options: MessageDialogOptions): Promise<boolean> {
    if (typeof document === "undefined") return Promise.resolve(false);
    return new Promise((resolve) => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        const root = createRoot(host);
        let settled = false;
        const onDone = (confirmed: boolean) => {
            if (settled) return;
            settled = true;
            resolve(confirmed);
            // Unmount after the click finishes so React isn't torn down mid-event.
            setTimeout(() => { root.unmount(); host.remove(); }, 0);
        };
        root.render(<MessageDialog {...options} onDone={onDone} />);
    });
}

/** Themed replacement for window.confirm. Resolves true only when the confirm button is pressed. */
export function confirmDialog(options: Omit<MessageDialogOptions, "cancelLabel"> & { cancelLabel?: string }): Promise<boolean> {
    return openMessageDialog({ confirmLabel: "Confirm", ...options, cancelLabel: options.cancelLabel ?? "Cancel" });
}

/** Themed replacement for window.alert. */
export async function alertDialog(options: { title: string; message: string; okLabel?: string }): Promise<void> {
    await openMessageDialog({ title: options.title, message: options.message, confirmLabel: options.okLabel ?? "OK" });
}
