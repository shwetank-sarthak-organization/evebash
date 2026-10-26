import { Bonheur_Royale, Fraunces } from "next/font/google";

// Periwinkle Script guest page and its navbar only. Kept out of src/app/fonts.ts so other pages don't load them.
// The couple's names on the cover
export const periwinkleScript = Bonheur_Royale({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-periwinkle-script",
});

// The navbar links and the message card
export const periwinkleSerif = Fraunces({
    subsets: ["latin"],
    style: ["normal", "italic"],
    display: "swap",
    variable: "--font-periwinkle-serif",
});
