import { Cinzel, Cormorant_Garamond, Great_Vibes } from "next/font/google";

// Royal Emerald guest page only. Kept out of src/app/fonts.ts so other pages don't load them.
export const royalScript = Great_Vibes({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-royal-script",
});

export const royalDisplay = Cinzel({
    subsets: ["latin"],
    weight: ["400", "600"],
    display: "swap",
    variable: "--font-royal-display",
});

export const royalSerif = Cormorant_Garamond({
    subsets: ["latin"],
    weight: "500",
    style: ["normal", "italic"],
    display: "swap",
    variable: "--font-royal-serif",
});
