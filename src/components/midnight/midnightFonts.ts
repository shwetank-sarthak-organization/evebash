import { Bodoni_Moda, Parisienne } from "next/font/google";

// Midnight Hero guest page and its navbar only. Kept out of src/app/fonts.ts so other pages don't load them.
export const midnightScript = Parisienne({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-midnight-script",
});

export const midnightDisplay = Bodoni_Moda({
    subsets: ["latin"],
    weight: ["400", "500"],
    style: ["normal", "italic"],
    display: "swap",
    variable: "--font-midnight-display",
});
