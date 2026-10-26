import { useId } from "react";

// Midnight Hero monogram: the couple's initials (or the title's first letter) in a gold laurel wreath under a small crown.
// Drawn on a 100 x 100 grid; leaves sit on a circle around (50, 54).
const WREATH_RADIUS = 37;
const LEAF_ANGLES = [104, 122, 140, 158, 176, 194, 212, 230];

function leafAt(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const x = 50 + WREATH_RADIUS * Math.cos(rad);
  const y = 54 + WREATH_RADIUS * Math.sin(rad);
  // Each leaf points along the branch (tangent) and tilts outwards
  return { x, y, rotate: angle + 90 + 28 };
}

function arcPoint(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return `${(50 + WREATH_RADIUS * Math.cos(rad)).toFixed(2)} ${(54 + WREATH_RADIUS * Math.sin(rad)).toFixed(2)}`;
}

export function MidnightCrest({ letters, className }: { letters: string[]; className?: string }) {
  const gradientId = useId();
  const gold = `url(#${gradientId})`;
  const leaves = LEAF_ANGLES.map(leafAt);
  const branch = (
    <g>
      <path d={`M ${arcPoint(96)} A ${WREATH_RADIUS} ${WREATH_RADIUS} 0 0 1 ${arcPoint(236)}`} fill="none" stroke={gold} strokeWidth="1.2" strokeLinecap="round" />
      {leaves.map((leaf) => (
        <ellipse key={leaf.rotate} cx={leaf.x} cy={leaf.y} rx="6.4" ry="2.5" fill={gold} transform={`rotate(${leaf.rotate} ${leaf.x} ${leaf.y})`} />
      ))}
    </g>
  );

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={`Monogram ${letters.join(" & ")}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6e4ad" />
          <stop offset="50%" stopColor="#ca9c69" />
          <stop offset="100%" stopColor="#a87b45" />
        </linearGradient>
      </defs>
      {branch}
      <g transform="translate(100 0) scale(-1 1)">{branch}</g>
      {/* Crown */}
      <path d="M39 22 L40.5 12 L45.5 17 L50 9 L54.5 17 L59.5 12 L61 22 Z" fill="none" stroke={gold} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="50" cy="7.4" r="1.5" fill={gold} />
      <circle cx="40.4" cy="10.6" r="1.1" fill={gold} />
      <circle cx="59.6" cy="10.6" r="1.1" fill={gold} />
      <circle cx="50" cy="56" r="25" fill="none" stroke={gold} strokeWidth=".8" opacity=".65" />
      {letters.length === 2 ? (
        <text x="50" y="64" textAnchor="middle" fill={gold} className="midnight-crest__letters">
          <tspan fontSize="23">{letters[0]}</tspan>
          <tspan fontSize="13" dx="1" dy="-7" fontStyle="italic">&amp;</tspan>
          <tspan fontSize="23" dx="1" dy="7">{letters[1]}</tspan>
        </text>
      ) : (
        <text x="50" y="66" textAnchor="middle" fontSize="30" fill={gold} className="midnight-crest__letters">
          {letters[0]}
        </text>
      )}
    </svg>
  );
}
