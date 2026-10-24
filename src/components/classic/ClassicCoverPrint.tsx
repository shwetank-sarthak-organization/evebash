import Image from "next/image";
import type { CSSProperties } from "react";

// Classic White cover (styles in src/app/classic-white.css): the cover photo as a print in a thick white mount,
// with a short line of the theme's own text on a pale card overlapping its top edge. The card sits in the page flow,
// so a taller card pushes the print down and the print shrinks to fit the screen instead of covering the photo.

/** Small sage sprig for the card corners; the right one is mirrored in CSS */
function Sprig({ className }: { className: string }) {
    return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
            <path d="M5 35 C 13 27, 21 19, 35 5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            {[[11, 29, -60], [16, 24, 30], [19, 21, -55], [24, 16, 35], [27, 13, -50], [31, 9, 40]].map(([x, y, r]) => (
                <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4.2" ry="1.9" transform={`rotate(${r} ${x} ${y})`} fill="currentColor" opacity="0.75" />
            ))}
        </svg>
    );
}

interface ClassicCoverPrintProps {
    coverImage?: string;
    alt: string;
    /** Short line of the theme's own text (not the host's message) */
    cardText?: string;
    imageStyle: CSSProperties;
}

export function ClassicCoverPrint({ coverImage, alt, cardText: message, imageStyle }: ClassicCoverPrintProps) {
    // Longer text gets a smaller line so the card stays a strip across the top, not a block
    const length = message?.length || 0;
    const sizeClass = length > 220 ? " classic-print__card--long" : length > 90 ? " classic-print__card--medium" : "";

    return (
        <div className={coverImage ? "classic-print" : "classic-print classic-print--no-cover"}>
            {message && (
                <div className={`classic-print__card${sizeClass}`}>
                    <Sprig className="classic-print__sprig" />
                    <p className="classic-print__message">{message}</p>
                    <Sprig className="classic-print__sprig classic-print__sprig--right" />
                </div>
            )}
            {coverImage && (
                <div className="classic-print__space">
                    <div className="classic-print__mount">
                        <div className="classic-print__photo">
                            <Image src={coverImage} alt={alt} fill sizes="(min-width: 1200px) 1000px, 90vw" style={imageStyle} priority />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
