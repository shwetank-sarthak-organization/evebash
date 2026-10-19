"use client";

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { cn } from "@/lib/utils";
import { ModalHeader, modalStyles } from "@/components/ui/Modal";

const MESSAGE = "Log in or create a free account to like, comment on and download photos from this gallery.";

function LoginPromptDialog({ returnTo, onClose }: { returnTo: string; onClose: () => void }) {
    const loginRef = useRef<HTMLAnchorElement>(null);
    useEffect(() => {
        loginRef.current?.focus();
        const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    return (
        <div className={cn(modalStyles.overlay, "z-[10050]")} onMouseDown={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="login-prompt-title" aria-describedby="login-prompt-body" className={modalStyles.panel} onMouseDown={(event) => event.stopPropagation()}>
                <ModalHeader title="Log in to continue" titleId="login-prompt-title" onClose={onClose} className="mb-3" />
                <p id="login-prompt-body" className={modalStyles.body}>{MESSAGE}</p>
                <div className={modalStyles.actions}>
                    <a href={`${loginHref}&mode=signup`} className={modalStyles.secondary}>Create account</a>
                    <a ref={loginRef} href={loginHref} className={modalStyles.primary}>Log in</a>
                </div>
            </div>
        </div>
    );
}

/**
 * For logged-out visitors of a public gallery who press like, comment or download: asks them to log in or sign up,
 * and brings them back to this page afterwards (where a public gallery joins them automatically).
 */
export function promptLogin() {
    if (typeof document === "undefined") return;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const onClose = () => setTimeout(() => { root.unmount(); host.remove(); }, 0);
    root.render(<LoginPromptDialog returnTo={`${window.location.pathname}${window.location.search}`} onClose={onClose} />);
}
