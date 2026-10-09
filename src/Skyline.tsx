/**
 * The masthead's picture: Austin at night. The skyline with the Capitol, the Frost Bank Tower's
 * crown and the stacked Independent, the Congress Avenue Bridge over the river, and the bats that
 * leave from under it at dusk, flying towards the moon.
 *
 * Drawn here as SVG, so the page loads no stock photo. The window lights come from a fixed seed:
 * the same picture on every render, on the server and in the browser.
 */

interface Tower {
  readonly x: number;
  readonly width: number;
  readonly top: number;
}

const GROUND = 236;

/** The near skyline, left to right, around the landmarks drawn by hand below. */
const TOWERS: readonly Tower[] = [
  { x: 0, width: 38, top: 192 },
  { x: 42, width: 52, top: 176 },
  { x: 198, width: 30, top: 150 },
  { x: 232, width: 28, top: 174 },
  { x: 330, width: 30, top: 138 },
  { x: 364, width: 30, top: 164 },
  { x: 458, width: 32, top: 150 },
  { x: 494, width: 36, top: 184 },
  { x: 536, width: 38, top: 168 },
  { x: 578, width: 62, top: 196 },
];

/** A distant, paler row behind the near one. */
const FAR_TOWERS: readonly Tower[] = [
  { x: 20, width: 40, top: 168 },
  { x: 92, width: 34, top: 158 },
  { x: 250, width: 40, top: 132 },
  { x: 318, width: 26, top: 120 },
  { x: 376, width: 30, top: 128 },
  { x: 520, width: 44, top: 140 },
  { x: 600, width: 34, top: 160 },
];

const STARS: readonly (readonly [number, number, number])[] = [
  [30, 30, 1.2], [78, 62, 0.8], [120, 22, 1], [168, 74, 0.7], [210, 40, 1.3], [256, 18, 0.8],
  [292, 58, 1], [338, 28, 0.7], [384, 70, 1.1], [420, 20, 0.8], [596, 34, 1.2], [618, 88, 0.8],
  [560, 150, 0.7], [600, 130, 1], [60, 112, 0.9], [140, 128, 0.7], [236, 104, 0.8], [18, 150, 0.7],
];

/** Window lights, picked once from a small seeded generator: deterministic, so every render agrees. */
function windowLights(towers: readonly Tower[]): readonly { x: number; y: number }[] {
  let seed = 7;
  const next = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const lights: { x: number; y: number }[] = [];
  for (const tower of towers) {
    for (let y = tower.top + 6; y < GROUND - 8; y += 9) {
      for (let x = tower.x + 5; x < tower.x + tower.width - 6; x += 8) {
        if (next() < 0.34) lights.push({ x, y });
      }
    }
  }
  return lights;
}

const LIGHTS = windowLights(TOWERS);

const BAT = "M-8 0C-6-3-3-3-2-1C-1-3 1-3 2-1C3-3 6-3 8 0C5-1 3 1 2 2C1 0-1 0-2 2C-3 1-5-1-8 0Z";

/** The bats leaving the bridge, rising towards the moon and getting smaller. */
const BATS: readonly (readonly [number, number, number])[] = [
  [286, 214, 0.9], [302, 198, 0.8], [326, 188, 1], [344, 170, 0.75], [372, 160, 0.9], [392, 144, 0.7],
  [418, 136, 0.8], [436, 118, 0.6], [462, 112, 0.7], [480, 96, 0.55], [446, 92, 0.5], [520, 70, 0.5],
];

const SPAN = 80;

export function Skyline() {
  return (
    <svg
      className="skyline"
      viewBox="0 0 640 360"
      role="img"
      aria-label="Austin at night: the skyline, the Congress Avenue Bridge and its bats under a full moon"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f0a26" />
          <stop offset="0.32" stopColor="#24124a" />
          <stop offset="0.5" stopColor="#5a2268" />
          <stop offset="0.66" stopColor="#c2467a" />
        </linearGradient>
        <radialGradient id="moon-glow">
          <stop offset="0" stopColor="#ffe3a3" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffe3a3" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1650" />
          <stop offset="1" stopColor="#0b0720" />
        </linearGradient>
      </defs>

      <rect width="640" height="360" fill="url(#sky)" />
      {STARS.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff6e0" opacity="0.85" />
      ))}

      <circle cx="500" cy="92" r="96" fill="url(#moon-glow)" />
      <circle cx="500" cy="92" r="46" fill="#ffeac0" />
      <circle cx="486" cy="80" r="7" fill="#f5d99a" opacity="0.6" />
      <circle cx="512" cy="104" r="10" fill="#f5d99a" opacity="0.5" />

      {FAR_TOWERS.map((tower) => (
        <rect key={`far-${tower.x}`} x={tower.x} y={tower.top} width={tower.width} height={GROUND - tower.top} fill="#3a2366" />
      ))}

      <g fill="#140c30">
        {TOWERS.map((tower) => (
          <rect key={tower.x} x={tower.x} y={tower.top} width={tower.width} height={GROUND - tower.top} />
        ))}
        {/* The Capitol: base, drum, dome, lantern and the statue's spire */}
        <rect x="104" y="206" width="92" height="30" />
        <rect x="132" y="186" width="36" height="20" />
        <path d="M130 188A20 20 0 0 1 170 188Z" />
        <rect x="146" y="160" width="8" height="12" />
        <rect x="149" y="150" width="2" height="10" />
        {/* The Frost Bank Tower and its pointed crown */}
        <rect x="282" y="112" width="34" height="124" />
        <path d="M282 112L299 74L316 112Z" />
        {/* The Independent: blocks stacked a little off true */}
        <rect x="404" y="204" width="36" height="32" />
        <rect x="410" y="176" width="36" height="28" />
        <rect x="402" y="148" width="36" height="28" />
        <rect x="408" y="120" width="36" height="28" />
        <rect x="404" y="98" width="32" height="22" />
        {/* An antenna */}
        <rect x="344" y="118" width="2" height="20" />
      </g>
      <path d="M299 80L299 112M292 96L306 96" stroke="#ffb547" strokeWidth="1" opacity="0.7" />

      <g fill="#ffb547">
        {LIGHTS.map((light) => (
          <rect key={`${light.x}-${light.y}`} x={light.x} y={light.y} width="3" height="4" opacity="0.8" />
        ))}
      </g>

      <rect y={GROUND} width="640" height={360 - GROUND} fill="url(#river)" />
      {/* The moon on the water */}
      {[262, 276, 292, 310, 330].map((y, index) => (
        <rect key={y} x={482 - index * 4} y={y} width={36 + index * 8} height="3" rx="1.5" fill="#ffe3a3" opacity={0.5 - index * 0.08} />
      ))}

      {/* The Congress Avenue Bridge: the deck, then piers and arches down to the water */}
      <rect y={GROUND - 2} width="640" height="10" fill="#0b0720" />
      <g fill="#0b0720">
        {Array.from({ length: 8 }, (_, index) => {
          const x = index * SPAN;
          return <path key={x} d={`M${x} 244H${x + SPAN}V270H${x + SPAN - 6}Q${x + SPAN / 2} 246 ${x + 6} 270H${x}Z`} />;
        })}
      </g>
      <g fill="#ffcf7a">
        {Array.from({ length: 16 }, (_, index) => (
          <circle key={index} cx={20 + index * 40} cy={GROUND - 4} r="1.6" />
        ))}
      </g>

      <g fill="#0b0720">
        {BATS.map(([x, y, scale]) => (
          <path key={`${x}-${y}`} d={BAT} transform={`translate(${x} ${y}) scale(${scale})`} />
        ))}
      </g>
    </svg>
  );
}
