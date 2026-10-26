import { Italiana, Manrope } from "next/font/google";

// Midnight Hero guest page and its navbar only. Kept out of src/app/fonts.ts so other pages don't load them.
// Italiana: thin, tall display capitals for names and titles. Manrope: labels, buttons, dates and messages.
export const midnightDisplay = Italiana({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-midnight-display",
});

export const midnightSans = Manrope({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    display: "swap",
    variable: "--font-midnight-sans",
});
