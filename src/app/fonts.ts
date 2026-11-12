import { Akaya_Kanadaka, Inter, Playfair_Display } from "next/font/google";

// Self-hosted at build time, replacing the render-blocking Google Fonts @import.
// Both include real italic faces so italic text is no longer synthesised by the browser.
// The italics are separate calls with the same family name and no preload: the homepage doesn't use
// them, and preloading them held back its headline on phones (#29).
export const inter = Inter({
    subsets: ["latin"],
    style: "normal",
    display: "swap",
    variable: "--font-inter-src",
});

export const interItalic = Inter({
    subsets: ["latin"],
    style: "italic",
    display: "swap",
    preload: false,
});

export const playfair = Playfair_Display({
    subsets: ["latin"],
    style: "normal",
    display: "swap",
    variable: "--font-playfair-src",
});

export const playfairItalic = Playfair_Display({
    subsets: ["latin"],
    style: "italic",
    display: "swap",
    preload: false,
});

// Brand heading font, matching the "EveBash" heading on the app's login screen.
export const brand = Akaya_Kanadaka({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-brand-src",
});
