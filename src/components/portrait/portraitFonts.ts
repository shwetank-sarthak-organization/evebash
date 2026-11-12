import { Instrument_Serif } from "next/font/google";

// Instrument Serif: the closest free match to the reference design's tall, narrow serif.
// Sunlit Portrait guest page and its navbar only. Kept out of src/app/fonts.ts so other pages don't load it.
export const portraitDisplay = Instrument_Serif({
    subsets: ["latin"],
    weight: "400",
    display: "swap",
    variable: "--font-portrait-display",
});
