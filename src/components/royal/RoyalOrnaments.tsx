import type React from "react";
import { cn } from "@/lib/utils";

// Gold ornaments for the Royal Emerald guest page, drawn as SVG so they stay sharp at any size.
// RoyalOrnamentDefs must be rendered once on the page: every other piece here points at its ids.

type Stop = [offset: number, color: string];

const gradientStops = (stops: Stop[]) =>
    stops.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />);

// Several light/dark bands so flat strokes read as polished metal
const SCREEN_GOLD: Stop[] = [[0, "#fff2c6"], [0.18, "#d9b062"], [0.34, "#8c6220"], [0.5, "#f3d68f"], [0.68, "#b98a3a"], [0.84, "#e9c979"], [1, "#7a5418"]];
const FRAME_GOLD: Stop[] = [[0, "#fff2c6"], [0.25, "#c99a46"], [0.45, "#f3d68f"], [0.65, "#9b6f27"], [0.85, "#e6c574"], [1, "#7a5418"]];
const BAND_GOLD: Stop[] = [[0, "#f6e1a2"], [0.3, "#b8883a"], [0.5, "#fff0bf"], [0.72, "#a87a2a"], [1, "#e2bf72"]];
const CREST_GOLD: Stop[] = [[0, "#fff2c6"], [0.3, "#c99a46"], [0.55, "#f3d68f"], [0.8, "#9b6f27"], [1, "#e6c574"]];

const SCREEN_BEADS = Array.from({ length: 12 }, (_, i) => 44 + i * 9);

// [x, y, rotation, scale] of the leaves along one arm of the screen corner
const SCREEN_LEAVES: [number, number, number, number][] = [
    [56, 37, -28, 1], [104, 31, -8, 0.9], [84, 62, 165, 0.75], [126, 46, 32, 0.7], [158, 41, -35, 0.55],
    [68, 30, -160, 0.7], [112, 52, 70, 0.75], [138, 32, -170, 0.6], [70, 50, 120, 0.6],
];

// The arm is drawn along the top edge; swapping x and y mirrors it down the side
const MIRROR_DIAGONAL = "matrix(0 1 1 0 0 0)";

export function RoyalOrnamentDefs() {
    return (
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id="re-gold-screen" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="200">{gradientStops(SCREEN_GOLD)}</linearGradient>
                <linearGradient id="re-gold-frame" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">{gradientStops(FRAME_GOLD)}</linearGradient>
                <linearGradient id="re-gold-band" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="30">{gradientStops(BAND_GOLD)}</linearGradient>
                <linearGradient id="re-gold-crest" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="92" y2="46">{gradientStops(CREST_GOLD)}</linearGradient>

                {/* Raised metal: a highlight along each shape's own edges, plus a cast shadow */}
                <filter id="re-emboss" x="-10%" y="-10%" width="125%" height="125%" colorInterpolationFilters="sRGB">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
                    <feSpecularLighting in="blur" surfaceScale={2.6} specularConstant={0.85} specularExponent={24} lightingColor="#fff4d2" result="spec">
                        <feDistantLight azimuth={235} elevation={48} />
                    </feSpecularLighting>
                    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
                    <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1={0} k2={1} k3={0.55} k4={0} result="lit" />
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="shBlur" />
                    <feOffset in="shBlur" dx="1.4" dy="2.4" result="shOff" />
                    <feFlood floodColor="#000" floodOpacity="0.65" />
                    <feComposite in2="shOff" operator="in" result="shadow" />
                    <feMerge>
                        <feMergeNode in="shadow" />
                        <feMergeNode in="lit" />
                    </feMerge>
                </filter>

                {/* Acanthus leaf, pointing right from the origin */}
                <path id="re-leaf" d="M0 0 C5 -7 15 -8 23 -2 C18 -2 14 0 12 2 C9 3 4 3 0 0 Z" />

                {/* Fleur-de-lis, pointing up, centred on the origin */}
                <g id="re-fleur">
                    <path d="M0 -17 C5 -10 5.5 -3 0 4 C-5.5 -3 -5 -10 0 -17 Z" />
                    <path d="M1.5 3 C3 -6 12 -10 15 -3 C17 2 12 5 9.5 2 C12 1.5 12 -3 9 -3 C5.5 -3 3.5 0 3 5 Z" />
                    <path d="M-1.5 3 C-3 -6 -12 -10 -15 -3 C-17 2 -12 5 -9.5 2 C-12 1.5 -12 -3 -9 -3 C-5.5 -3 -3.5 0 -3 5 Z" />
                    <rect x="-7" y="4" width="14" height="3.2" rx="1.2" />
                    <path d="M-4.5 7.5 C-3.5 12 -1.2 14 0 17 C1.2 14 3.5 12 4.5 7.5 Z" />
                </g>

                {/* One arm of the screen corner, along the top edge */}
                <g id="re-screen-arm">
                    <path d="M20 12 H176" fill="none" strokeWidth={5} />
                    <path d="M36 23 H148" fill="none" strokeWidth={1.5} />
                    <g stroke="none">
                        {SCREEN_BEADS.map((x) => <circle key={x} cx={x} cy={17.6} r={1.8} />)}
                    </g>
                    <path d="M176 12 C190 12 197 22 191 29 C185 35 176 29 181 23" fill="none" strokeWidth={4} />
                    <circle cx={183.5} cy={25.5} r={2.2} stroke="none" />
                    <use href="#re-leaf" transform="translate(189 33) rotate(100) scale(.55)" stroke="none" />
                    <path d="M44 44 C58 30 82 27 98 35 C115 43 113 63 98 63 C87 63 85 50 95 49" fill="none" strokeWidth={5} />
                    <path d="M60 41 C64 53 76 58 84 52" fill="none" strokeWidth={2.4} />
                    <circle cx={85} cy={51} r={2} stroke="none" />
                    <circle cx={94.5} cy={52.5} r={2.6} stroke="none" />
                    <path d="M98 35 C117 27 141 29 151 40 C159 49 150 59 142 54 C136 50 140 43 145 45" fill="none" strokeWidth={3.8} />
                    <circle cx={144} cy={48.5} r={1.9} stroke="none" />
                    <path d="M151 40 C158 34 166 32 173 34" fill="none" strokeWidth={2.4} />
                    <circle cx={174} cy={34.5} r={2} stroke="none" />
                    <g stroke="none">
                        {SCREEN_LEAVES.map(([x, y, rotate, scale]) => (
                            <use key={`${x}-${y}`} href="#re-leaf" transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`} />
                        ))}
                    </g>
                </g>
                <g id="re-screen-corner" filter="url(#re-emboss)" fill="url(#re-gold-screen)" stroke="url(#re-gold-screen)" strokeLinecap="round" strokeLinejoin="round">
                    <g fill="none">
                        <use href="#re-screen-arm" fill="url(#re-gold-screen)" />
                        <use href="#re-screen-arm" fill="url(#re-gold-screen)" transform={MIRROR_DIAGONAL} />
                    </g>
                    <path d="M22 22 L36 36" fill="none" strokeWidth={2.2} />
                    <path d="M13 2 L24 13 L13 24 L2 13 Z" stroke="none" />
                    <circle cx={13} cy={13} r={3.4} fill="#3a2709" stroke="none" />
                    <use href="#re-fleur" transform="translate(44 44) rotate(-45) scale(1.45)" stroke="none" />
                </g>

                {/* Photo frame corner: a rosette block with scrolls running along both sides */}
                <g id="re-frame-arm">
                    <path d="M46 20 C60 9 76 10 85 20 C91 27 84 35 78 30 C74 27 77 22 81 24" fill="none" strokeWidth={3} />
                    <circle cx={80} cy={27} r={1.8} stroke="none" />
                    <path d="M46 36 C54 33 60 34 64 38" fill="none" strokeWidth={2} />
                    <circle cx={65} cy={39} r={1.7} stroke="none" />
                    <use href="#re-leaf" transform="translate(52 27) rotate(-8) scale(.62)" stroke="none" />
                </g>
                <g id="re-frame-corner">
                    <use href="#re-frame-arm" />
                    <use href="#re-frame-arm" transform={MIRROR_DIAGONAL} />
                    <rect x="8" y="8" width="38" height="38" rx="4" stroke="none" />
                    <rect x="11.5" y="11.5" width="31" height="31" rx="2.5" fill="#241804" strokeWidth={1.4} />
                    <circle cx={27} cy={27} r={13} fill="none" strokeWidth={1.2} />
                    <g stroke="#4a3410" strokeWidth={0.8}>
                        <ellipse cx={27} cy={18} rx={3.2} ry={6} />
                        <ellipse cx={27} cy={36} rx={3.2} ry={6} />
                        <ellipse cx={18} cy={27} rx={6} ry={3.2} />
                        <ellipse cx={36} cy={27} rx={6} ry={3.2} />
                        <ellipse cx={20.5} cy={20.5} rx={2.6} ry={5} transform="rotate(-45 20.5 20.5)" />
                        <ellipse cx={33.5} cy={33.5} rx={2.6} ry={5} transform="rotate(-45 33.5 33.5)" />
                        <ellipse cx={33.5} cy={20.5} rx={2.6} ry={5} transform="rotate(45 33.5 20.5)" />
                        <ellipse cx={20.5} cy={33.5} rx={2.6} ry={5} transform="rotate(45 20.5 33.5)" />
                        <circle cx={27} cy={27} r={4.6} />
                    </g>
                    <circle cx={27} cy={27} r={2} fill="#3a2709" stroke="none" />
                </g>

                {/* Lace band: a chain of pierced lens shapes with rosettes, tiled along each side of the frame */}
                <g id="re-lace-tile">
                    <path d="M0 2.6 H28 M0 27.4 H28" fill="none" strokeWidth={2.2} />
                    <path d="M0 15 C7 5.5 21 5.5 28 15 C21 24.5 7 24.5 0 15 Z" fill="none" strokeWidth={1.8} />
                    <g stroke="none">
                        <circle cx={14} cy={15} r={2.4} />
                        <ellipse cx={14} cy={10.6} rx={1.2} ry={2} />
                        <ellipse cx={14} cy={19.4} rx={1.2} ry={2} />
                        <ellipse cx={9.6} cy={15} rx={2} ry={1.2} />
                        <ellipse cx={18.4} cy={15} rx={2} ry={1.2} />
                        <circle cx={0} cy={7.4} r={1.7} />
                        <circle cx={28} cy={7.4} r={1.7} />
                        <circle cx={0} cy={22.6} r={1.7} />
                        <circle cx={28} cy={22.6} r={1.7} />
                    </g>
                </g>
                <pattern id="re-lace-h" patternUnits="userSpaceOnUse" width="28" height="30">
                    <use href="#re-lace-tile" fill="url(#re-gold-band)" stroke="url(#re-gold-band)" />
                </pattern>
                <pattern id="re-lace-v" patternUnits="userSpaceOnUse" width="28" height="30" patternTransform="rotate(90)">
                    <use href="#re-lace-tile" fill="url(#re-gold-band)" stroke="url(#re-gold-band)" />
                </pattern>

                {/* Crest in the middle of each side of the frame */}
                <g id="re-crest">
                    <path d="M33 26 C26 16 14 14 8 20 C3 25 8 32 13 29 C16 27 14 23 11 24" fill="none" strokeWidth={2.4} />
                    <path d="M59 26 C66 16 78 14 84 20 C89 25 84 32 79 29 C76 27 78 23 81 24" fill="none" strokeWidth={2.4} />
                    <use href="#re-leaf" transform="translate(30 24) rotate(200) scale(.6)" stroke="none" />
                    <use href="#re-leaf" transform="translate(62 24) rotate(-20) scale(.6) scale(-1 1) rotate(180)" stroke="none" />
                    <ellipse cx={46} cy={22} rx={12} ry={15} stroke="none" />
                    <ellipse cx={46} cy={22} rx={8} ry={10.5} fill="#3a2709" strokeWidth={1.3} />
                    <use href="#re-fleur" transform="translate(46 22.5) scale(.42)" stroke="none" />
                </g>

                {/* Torn handmade-paper edge for the title card (used from CSS) */}
                <filter id="re-deckle" x="-4%" y="-4%" width="108%" height="108%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={4} seed={11} result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale={9} xChannelSelector="R" yChannelSelector="G" />
                </filter>

                {/* Wax seal */}
                <radialGradient id="re-wax-gold" cx="38%" cy="34%" r="75%">{gradientStops([[0, "#fff0bf"], [0.3, "#e2b866"], [0.65, "#b4842f"], [1, "#6e4a14"]])}</radialGradient>
                <radialGradient id="re-wax-gold-inner" cx="40%" cy="36%" r="70%">{gradientStops([[0, "#f7dc98"], [0.55, "#c7963f"], [1, "#8d6421"]])}</radialGradient>
                <filter id="re-wax-blob" x="-15%" y="-15%" width="130%" height="130%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={4} result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale={17} xChannelSelector="R" yChannelSelector="G" />
                </filter>
                <filter id="re-wax-light" x="-20%" y="-20%" width="140%" height="145%" colorInterpolationFilters="sRGB">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="blur" />
                    <feSpecularLighting in="blur" surfaceScale={4} specularConstant={0.75} specularExponent={16} lightingColor="#fff6dc" result="spec">
                        <feDistantLight azimuth={230} elevation={52} />
                    </feSpecularLighting>
                    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
                    <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1={0} k2={1} k3={0.6} k4={0} result="lit" />
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="shBlur" />
                    <feOffset in="shBlur" dx="2" dy="5" result="shOff" />
                    <feFlood floodColor="#000" floodOpacity="0.5" />
                    <feComposite in2="shOff" operator="in" result="shadow" />
                    <feMerge>
                        <feMergeNode in="shadow" />
                        <feMergeNode in="lit" />
                    </feMerge>
                </filter>

                <linearGradient id="re-divider-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="300">
                    <stop offset="0" stopColor="#ca9c69" stopOpacity="0" />
                    <stop offset="0.5" stopColor="#e6c574" />
                    <stop offset="1" stopColor="#ca9c69" stopOpacity="0" />
                </linearGradient>
            </defs>
        </svg>
    );
}

/** Ornate L-shaped corner; flip it with CSS for the other three corners. */
export function RoyalScreenCorner({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
            <use href="#re-screen-corner" />
        </svg>
    );
}

const FRAME_SIDES = ["t", "b", "l", "r"] as const;
const FRAME_CORNERS = ["tl", "tr", "bl", "br"] as const;

/** Rectangular filigree frame. The lace bands tile, so the frame works at any size and shape its box is given. */
export function RoyalFiligreeFrame({
    children,
    className,
    style,
}: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <div className={cn("royal-frame", className)} style={style}>
            <svg className="royal-frame__lace" aria-hidden="true" focusable="false">
                <g filter="url(#re-emboss)">
                    <rect x="0" y="0" width="100%" height="30" fill="url(#re-lace-h)" />
                    <rect x="0" y="100%" width="100%" height="30" fill="url(#re-lace-h)" transform="translate(0 -30)" />
                    <rect x="0" y="0" width="30" height="100%" fill="url(#re-lace-v)" />
                    <rect x="100%" y="0" width="30" height="100%" fill="url(#re-lace-v)" transform="translate(-30 0)" />
                </g>
            </svg>
            <div className="royal-frame__photo">
                <div className="royal-frame__window">{children}</div>
            </div>
            {FRAME_SIDES.map((side) => (
                <svg key={side} className={`royal-frame__crest royal-frame__crest--${side}`} viewBox="0 0 92 46" aria-hidden="true" focusable="false">
                    <g filter="url(#re-emboss)" fill="url(#re-gold-crest)" stroke="url(#re-gold-crest)" strokeLinecap="round">
                        <g fill="none">
                            <use href="#re-crest" fill="url(#re-gold-crest)" />
                        </g>
                    </g>
                </svg>
            ))}
            {FRAME_CORNERS.map((corner) => (
                <svg key={corner} className={`royal-frame__corner royal-frame__corner--${corner}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                    <g filter="url(#re-emboss)" fill="url(#re-gold-frame)" stroke="url(#re-gold-frame)" strokeLinecap="round">
                        <g fill="none">
                            <use href="#re-frame-corner" fill="url(#re-gold-frame)" />
                        </g>
                    </g>
                </svg>
            ))}
        </div>
    );
}

/** Gold wax seal stamped with the couple's initials, or a fleur-de-lis when there are none. */
export function RoyalWaxSeal({ initials, className }: { initials?: [string, string] | null; className?: string }) {
    const engraving = (dx: number, dy: number, color: string, opacity: number) =>
        initials ? (
            <text x={70 + dx} y={79 + dy} fontSize={27} fill={color} fillOpacity={opacity}>
                {initials[0]}
                <tspan style={{ fontFamily: "var(--font-royal-serif), Georgia, serif" }} fontStyle="italic" fontSize={17} dx={1} dy={-2}>&amp;</tspan>
                <tspan dx={1} dy={2}>{initials[1]}</tspan>
            </text>
        ) : (
            <use href="#re-fleur" transform={`translate(${70 + dx} ${70 + dy}) scale(1.05)`} fill={color} fillOpacity={opacity} />
        );

    return (
        <svg
            className={className}
            viewBox="0 0 140 140"
            role="img"
            aria-label={initials ? `Seal with the initials ${initials[0]} and ${initials[1]}` : "Wax seal"}
        >
            <g filter="url(#re-wax-light)">
                <circle cx={70} cy={70} r={55} fill="url(#re-wax-gold)" filter="url(#re-wax-blob)" />
                <circle cx={70} cy={70} r={41} fill="url(#re-wax-gold-inner)" />
            </g>
            <circle cx={70} cy={70} r={41} fill="none" stroke="#5e3f0f" strokeOpacity={0.55} strokeWidth={2} />
            <circle cx={70.8} cy={71} r={42.2} fill="none" stroke="#fff3c8" strokeOpacity={0.55} strokeWidth={1} />
            <circle cx={70} cy={70} r={35} fill="none" stroke="#7a5418" strokeOpacity={0.75} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="0.1 5.5" />
            <g style={{ fontFamily: "var(--font-royal-display), Georgia, serif" }} fontWeight={600} textAnchor="middle">
                {engraving(1, 1, "#fff1c4", 0.7)}
                {engraving(0, 0, "#6a4712", 1)}
            </g>
        </svg>
    );
}

/** Thin gold line with a fleur ornament, between the title card and the photo. */
export function RoyalDivider({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 40 300" aria-hidden="true" focusable="false">
            <path d="M20 0 V300" stroke="url(#re-divider-fade)" strokeWidth={1} />
            <g filter="url(#re-emboss)" fill="url(#re-gold-crest)">
                <use href="#re-fleur" transform="translate(20 128) scale(.75)" />
                <use href="#re-fleur" transform="translate(20 172) rotate(180) scale(.75)" />
                <path d="M20 142 L28 150 L20 158 L12 150 Z" />
            </g>
        </svg>
    );
}

/** Small rule with a diamond, under the names on the title card. */
export function RoyalFlourish({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 120 16" aria-hidden="true" focusable="false">
            <path d="M2 8 H50 M70 8 H118" stroke="#c9a46a" strokeWidth={1} />
            <path d="M60 2 L66 8 L60 14 L54 8 Z" fill="#c9a46a" />
            <circle cx={46} cy={8} r={1.6} fill="#c9a46a" />
            <circle cx={74} cy={8} r={1.6} fill="#c9a46a" />
        </svg>
    );
}
