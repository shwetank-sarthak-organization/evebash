import { Gloock } from "next/font/google";

// Sunlit Portrait guest page and its navbar only. Kept out of src/app/fonts.ts so other pages don't load it.
export const portraitDisplay = Gloock({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-portrait-display",
});
