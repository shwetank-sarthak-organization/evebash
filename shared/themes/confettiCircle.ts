// Website and app (one copy): the plain logic of the Confetti Circle theme. Website: src/components/TemplateConfetti.tsx
// and src/components/confetti/; app: apps/mobile/components/confetti/.

/** The theme's colours (website: src/app/confetti-circle.css) */
export const CONFETTI_COLORS = {
    pink: "#e8175d",
    orange: "#ff7a1a",
    ink: "#2a2727",
    /** The heart on the cover's dark tag */
    red: "#e4202e",
    /** Paper below the cover (Classic White's) */
    paper: "#FCFCFA",
    specksPink: "#f28aa9",
    specksOrange: "#ffa25e",
} as const;

/** The dark tag's line when the gallery has no message, by the main event's category */
export function confettiTagLine(category?: string): string {
    if (category === "Wedding") return "Happily married";
    if (category === "Anniversary") return "Still choosing each other";
    return "Our moments";
}

/** The heading above the couple section, by the main event's category */
export function confettiCoupleHeading(category?: string): string {
    if (category === "Wedding") return "We're getting married!";
    if (category === "Anniversary") return "Still choosing each other";
    return "Our story";
}

/** The gallery's message for guests: a new main gallery gets "Main Event: <title>" as its description, which isn't one */
export function confettiMessage(description?: string): string {
    const message = (description || "").trim();
    return message.startsWith("Main Event: ") ? "" : message;
}

/** Messages longer than this get the cover tag's smallest size and may be cut there; the gallery header then shows
 *  the whole message. Messages are at most 200 characters (host page and app). */
export const CONFETTI_TAG_LONG_MESSAGE = 90;

/** The cover tag's size for its text: wider with smaller text as the message gets longer */
export function confettiTagSize(text: string): "" | "long" | "xlong" {
    return text.length > CONFETTI_TAG_LONG_MESSAGE ? "xlong" : text.length > 26 ? "long" : "";
}

/** The circle's name size for the longest name: smaller for longer names, so each stays on one line */
export function confettiNameSize(longestName: number): "" | "long" | "xlong" {
    return longestName > 16 ? "xlong" : longestName > 9 ? "long" : "";
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "28 March 2025" or "March 28, 2025" -> ["March", "28", "2025"]; anything else -> null (shown as written) */
export function splitConfettiDate(date: string): [string, string, string] | null {
    const match = date.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/) || date.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (!match) return null;
    const [day, month] = /^\d/.test(match[1]) ? [match[1], match[2]] : [match[2], match[1]];
    if (!MONTHS.some((name) => name.startsWith(month.toLowerCase()) && month.length >= 3)) return null;
    return [month, day, match[3]];
}

// Paint specks: fixed positions (% of the box they sit in), so the server and the browser draw the same ones. Most fall
// in two arcs on opposite sides and spill a little past the edge, like the splash on a printed save-the-date.

export type ConfettiSpeck = { left: number; top: number; size: number; pink: boolean; opacity: number };

/** `heavyAngle` and `lightAngle` are where the two arcs sit (radians, 0 = right, PI/2 = bottom); 60% of specks go to
 *  the heavy one. `size` is a share of the box's width (%). */
export function makeSpecks({ seed, count, heavyAngle, lightAngle }: { seed: number; count: number; heavyAngle: number; lightAngle: number }): ConfettiSpeck[] {
    let state = seed;
    const next = () => (state = (state * 16807) % 2147483647) / 2147483647;
    // Rounded so the server's and the browser's numbers print the same (no hydration mismatch)
    const round = (value: number) => Math.round(value * 100) / 100;
    return Array.from({ length: count }, () => {
        const arc = (next() < 0.6 ? heavyAngle : lightAngle) + (next() - 0.5) * 1.9;
        const radius = 30 + next() ** 0.7 * 26;
        return {
            left: round(50 + Math.cos(arc) * radius),
            top: round(50 + Math.sin(arc) * radius),
            size: round(0.5 + next() ** 2.6 * 4.2),
            pink: next() < 0.6,
            opacity: round(0.25 + next() * 0.6),
        };
    });
}

/** Round the cover's circle: heavier on the lower left, lighter on the right */
export const CONFETTI_COVER_SPECKS = makeSpecks({ seed: 7, count: 90, heavyAngle: Math.PI * 0.85, lightAngle: -0.1 });
/** Round the couple section's video frame: heavier at the top left, lighter at the bottom right */
export const CONFETTI_FRAME_SPECKS = makeSpecks({ seed: 11, count: 60, heavyAngle: -Math.PI * 0.72, lightAngle: Math.PI * 0.25 });

/** The torn-paper edge (an SVG path in a 1440 x 48 box, filled with the paper colour under the jagged line) */
export const CONFETTI_TEAR_PATH = "M0 20 L40 26 L72 18 L118 27 L160 21 L205 30 L248 22 L290 28 L336 19 L380 27 L426 23 L470 31 L512 22 L560 28 L604 20 L650 29 L694 23 L740 30 L786 21 L830 27 L876 19 L920 28 L966 22 L1010 30 L1056 21 L1100 27 L1146 20 L1190 29 L1236 22 L1280 28 L1326 19 L1372 27 L1410 21 L1440 25 L1440 48 L0 48 Z";

/** The footer's torn edge (a 1440 x 60 box, drawn upside down at the footer's top): a grey shadow, then the page's paper
 *  over it */
export const CONFETTI_FOOTER_TEAR_SHADOW_PATH = "M0 18 L60 14 L110 22 L170 16 L230 24 L290 18 L350 27 L410 20 L470 26 L540 17 L600 25 L660 19 L720 28 L790 21 L850 26 L910 18 L980 25 L1040 20 L1110 27 L1170 19 L1230 24 L1300 17 L1360 23 L1440 18 L1440 60 L0 60 Z";
export const CONFETTI_FOOTER_TEAR_PAPER_PATH = "M0 26 L50 22 L100 30 L160 24 L220 32 L280 26 L340 34 L400 28 L460 33 L530 25 L590 32 L650 27 L710 35 L780 29 L840 33 L900 26 L970 32 L1030 28 L1100 34 L1160 27 L1220 31 L1290 25 L1350 30 L1440 26 L1440 60 L0 60 Z";
