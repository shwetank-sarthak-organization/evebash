import Link from "next/link";
import { playfair } from "@/app/fonts";
import { cn } from "@/lib/utils";

export const displayFont = playfair;

const buttonBase =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--site-bg)]";

interface ButtonLinkProps {
    href: string;
    children: React.ReactNode;
    className?: string;
}

export function PrimaryButton({ href, children, className }: ButtonLinkProps) {
    return (
        <Link href={href} className={cn(buttonBase, "bg-royal-gold text-[#13191F] hover:bg-[#D9AE7E]", className)}>
            {children}
        </Link>
    );
}

export function SecondaryButton({ href, children, className }: ButtonLinkProps) {
    return (
        <Link
            href={href}
            className={cn(buttonBase, "border border-[var(--site-border)] text-[var(--site-text)] hover:border-royal-gold/60 hover:bg-royal-gold/10", className)}
        >
            {children}
        </Link>
    );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <p className={cn("text-xs font-semibold uppercase tracking-[0.2em] text-royal-gold", className)}>
            {children}
        </p>
    );
}

interface SectionHeaderProps {
    eyebrow: string;
    title: React.ReactNode;
    description?: React.ReactNode;
    align?: "center" | "left";
}

export function SectionHeader({ eyebrow, title, description, align = "center" }: SectionHeaderProps) {
    return (
        <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left")}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className={cn(displayFont.className, "mt-3 text-3xl font-semibold leading-tight text-[var(--site-text)] md:text-4xl")}>
                {title}
            </h2>
            {description && (
                <p className="mt-4 text-base leading-relaxed text-[var(--site-subtle)] md:text-lg">{description}</p>
            )}
        </div>
    );
}
