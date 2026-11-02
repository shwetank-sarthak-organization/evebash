import Link from "next/link";
import type { ComponentProps } from "react";
import { playfair } from "@/app/fonts";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { cn } from "@/lib/utils";

export const displayFont = playfair;

// Homepage motion: short ease-out entrances, small distances.
export const homeEase = [0.16, 1, 0.3, 1] as const;

export function Reveal(props: ComponentProps<typeof ScrollReveal>) {
    return <ScrollReveal duration={0.3} distance={16} ease={homeEase} {...props} />;
}

const buttonBase =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--site-bg)] [&>svg]:transition-transform [&>svg]:duration-150 hover:[&>svg]:translate-x-1 motion-reduce:[&>svg]:transition-none";

interface ButtonLinkProps {
    href: string;
    children: React.ReactNode;
    className?: string;
}

export function PrimaryButton({ href, children, className }: ButtonLinkProps) {
    return (
        <Link href={href} className={cn(buttonBase, "home-btn-gold", className)}>
            {children}
        </Link>
    );
}

export function SecondaryButton({ href, children, className }: ButtonLinkProps) {
    return (
        <Link
            href={href}
            className={cn(buttonBase, "home-btn-glass", className)}
        >
            {children}
        </Link>
    );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <p className={cn("text-xs font-semibold uppercase tracking-[0.2em] text-[var(--home-accent)]", className)}>
            {children}
        </p>
    );
}

interface SectionHeaderProps {
    eyebrow?: string;
    title: React.ReactNode;
    description?: React.ReactNode;
    align?: "center" | "left";
}

export function SectionHeader({ eyebrow, title, description, align = "center" }: SectionHeaderProps) {
    return (
        <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left")}>
            <span aria-hidden className={cn("mb-5 block h-0.5 w-12 rounded-full bg-[image:var(--home-gold)]", align === "center" && "mx-auto")} />
            {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
            <h2 className={cn(displayFont.className, "home-gold-text pb-1 text-[2rem] font-semibold leading-[1.08] tracking-[-0.015em] md:text-[2.625rem]")}>
                {title}
            </h2>
            {description && (
                <p className="mt-4 text-base leading-relaxed text-[var(--site-subtle)] md:text-lg">{description}</p>
            )}
        </div>
    );
}
