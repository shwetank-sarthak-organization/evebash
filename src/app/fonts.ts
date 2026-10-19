import { Akaya_Kanadaka, Inter, Playfair_Display } from "next/font/google";

// Self-hosted at build time, replacing the render-blocking Google Fonts @import.
// Both include real italic faces so italic text is no longer synthesised by the browser.
export const inter = Inter({
    subsets: ["latin"],
    style: ["normal", "italic"],
    display: "swap",
    variable: "--font-inter-src",
});

export const playfair = Playfair_Display({
    subsets: ["latin"],
    style: ["normal", "italic"],
    display: "swap",
    variable: "--font-playfair-src",
});

// Brand heading font, matching the "EveBash" heading on the app's login screen.
export const brand = Akaya_Kanadaka({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-brand-src",
});
