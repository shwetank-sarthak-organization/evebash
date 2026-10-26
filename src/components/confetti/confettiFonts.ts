import { Bebas_Neue } from "next/font/google";

// Confetti Circle guest page and its navbar only. Kept out of src/app/fonts.ts so other pages don't load it.
export const confettiDisplay = Bebas_Neue({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-confetti-display",
});
