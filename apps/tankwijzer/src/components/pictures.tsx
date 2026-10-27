/** Simple schematic pictures for the answer options. Colours come from CSS (currentColor). */

const S = { width: 64, height: 48, viewBox: "0 0 64 48", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;

export const Pictures = {
  aboveGround: (
    <svg {...S} aria-hidden="true">
      <line x1="2" y1="40" x2="62" y2="40" />
      <rect x="14" y="14" width="36" height="24" rx="8" />
      <line x1="22" y1="38" x2="22" y2="40" />
      <line x1="42" y1="38" x2="42" y2="40" />
    </svg>
  ),
  underground: (
    <svg {...S} aria-hidden="true">
      <line x1="2" y1="14" x2="62" y2="14" />
      <rect x="14" y="20" width="36" height="22" rx="8" strokeDasharray="4 3" />
      <line x1="32" y1="14" x2="32" y2="20" />
      <rect x="28" y="8" width="8" height="6" />
    </svg>
  ),
  singleWall: (
    <svg {...S} aria-hidden="true">
      <rect x="14" y="8" width="36" height="32" rx="6" />
    </svg>
  ),
  doubleWall: (
    <svg {...S} aria-hidden="true">
      <rect x="10" y="4" width="44" height="40" rx="8" />
      <rect x="16" y="10" width="32" height="28" rx="5" />
    </svg>
  ),
  bund: (
    <svg {...S} aria-hidden="true">
      <path d="M6 22 V42 H58 V22" />
      <rect x="18" y="8" width="28" height="30" rx="6" />
    </svg>
  ),
  noBund: (
    <svg {...S} aria-hidden="true">
      <line x1="2" y1="42" x2="62" y2="42" />
      <rect x="18" y="10" width="28" height="30" rx="6" />
    </svg>
  ),
  unknown: (
    <svg {...S} aria-hidden="true">
      <circle cx="32" cy="24" r="16" />
      <path d="M26 20 a6 6 0 1 1 8 6 v4" />
      <circle cx="34" cy="35" r="1" fill="currentColor" />
    </svg>
  ),
  steel: (
    <svg {...S} aria-hidden="true">
      <rect x="14" y="8" width="36" height="32" rx="6" />
      <line x1="14" y1="18" x2="50" y2="18" />
      <line x1="14" y1="30" x2="50" y2="30" />
    </svg>
  ),
  plastic: (
    <svg {...S} aria-hidden="true">
      <path d="M16 12 Q32 2 48 12 V36 Q32 46 16 36 Z" />
    </svg>
  ),
  dropTray: (
    <svg {...S} aria-hidden="true">
      <path d="M8 30 V40 H56 V30" />
      <path d="M32 6 C26 16 24 20 24 23 a8 8 0 0 0 16 0 c0 -3 -2 -7 -8 -17Z" />
    </svg>
  ),
  label: (
    <svg {...S} aria-hidden="true">
      <rect x="10" y="8" width="44" height="32" rx="4" />
      <line x1="16" y1="18" x2="40" y2="18" />
      <line x1="16" y1="26" x2="34" y2="26" />
      <path d="M42 28 l5 -9 l5 9 z" />
    </svg>
  ),
  alarm: (
    <svg {...S} aria-hidden="true">
      <path d="M22 34 V24 a10 10 0 0 1 20 0 V34 Z" />
      <line x1="18" y1="34" x2="46" y2="34" />
      <path d="M12 16 l4 3 M52 16 l-4 3 M32 6 v4" />
    </svg>
  ),
  water: (
    <svg {...S} aria-hidden="true">
      <path d="M32 6 C24 18 20 24 20 30 a12 12 0 0 0 24 0 c0 -6 -4 -12 -12 -24Z" />
    </svg>
  ),
};
