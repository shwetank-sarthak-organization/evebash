import React from "react";
import { Facebook, Instagram } from "lucide-react";
import type { SocialNetwork } from "../../../shared/themes/themeContent";

/** The X (Twitter) logo; lucide only has the old bird */
export function XLogo(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
    );
}

/** The icon of each social network a theme links to (shared/themes/themeContent.ts) */
export const SOCIAL_ICONS: Readonly<Record<SocialNetwork, React.ComponentType<React.SVGProps<SVGSVGElement>>>> = {
    instagram: Instagram,
    facebook: Facebook,
    x: XLogo,
};
