// Paint specks for the Confetti Circle design: fixed positions (% of the box they sit in), so the server and the
// browser draw the same ones. Most fall in two arcs on opposite sides and spill a little past the edge, like the splash
// on a printed save-the-date.

export type ConfettiSpeck = { left: number; top: number; size: number; pink: boolean; opacity: number };

/** `heavyAngle` and `lightAngle` are where the two arcs sit (radians, 0 = right, PI/2 = bottom); 60% of specks go to the heavy one */
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
