/**
 * The band at the top of each card: a colour and a small drawing picked from the offer's category.
 *
 * The API sends no pictures, so this is the site's own art for a kind of evening (dinner, drinks,
 * a class, a massage, the water, a tour, a game), never a photo that pretends to show the offer.
 */

import type { ReactElement } from "react";

type Theme = "dinner" | "drinks" | "class" | "relax" | "water" | "sights" | "play" | "night";

/** First match wins: the order puts the narrower words before the broader ones. */
const THEME_WORDS: readonly (readonly [Theme, RegExp])[] = [
  ["drinks", /brewer|winer|distill|cocktail|\bbar\b|wine|beer|tasting/i],
  ["relax", /massage|spa|facial|wellness|beauty|medicine|sauna/i],
  ["class", /class|hobb|skill|art|paint|pottery|craft|dance/i],
  ["dinner", /restaurant|pizza|steak|food|dining|bbq|sushi|bistro|brunch/i],
  ["water", /boat|water|kayak|cruise|paddle|lake|sail/i],
  ["sights", /tour|landmark|flight|sightseeing|things to do|museum/i],
  ["play", /escape|game|fun|leisure|family|sport|bowling|fitness|comedy|movie|theat/i],
];

function themeOf(category: string | null): Theme {
  if (category === null) return "night";
  for (const [theme, words] of THEME_WORDS) {
    if (words.test(category)) return theme;
  }
  return "night";
}

/** One line drawing per theme, on a 48 by 48 grid, stroked in the card's ink. */
const DRAWINGS: Readonly<Record<Theme, ReactElement>> = {
  dinner: (
    <>
      <path d="M14 8v12a6 6 0 0 0 12 0V8M20 26v14M14 40h12" />
      <path d="M30 8c0 6 2 9 5 10v22M35 8v10" />
    </>
  ),
  drinks: (
    <>
      <path d="M8 8h18L17 22v14M11 40h12M11 13h12" />
      <path d="M30 14h10l-2 12a3 3 0 0 1-6 0zM35 29v11M31 40h8" />
    </>
  ),
  class: (
    <>
      <path d="M24 8c-9 0-16 6-16 14 0 7 5 10 9 10 3 0 3 3 5 5 4 4 18-1 18-15 0-8-7-14-16-14z" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="25" cy="15" r="2" />
      <circle cx="32" cy="20" r="2" />
    </>
  ),
  relax: (
    <>
      <path d="M24 36c-6-4-8-10-8-16 4 1 7 4 8 8 1-4 4-7 8-8 0 6-2 12-8 16z" />
      <path d="M24 28c-2-5-2-11 0-16 2 5 2 11 0 16zM8 40h32" />
    </>
  ),
  water: (
    <>
      <path d="M12 26h24l-4 7H16zM24 12v14M24 12l9 10H24" />
      <path d="M6 38c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2 3 2 6 2" />
    </>
  ),
  sights: (
    <>
      <path d="M24 40s-12-11-12-20a12 12 0 0 1 24 0c0 9-12 20-12 20z" />
      <circle cx="24" cy="20" r="4" />
    </>
  ),
  play: (
    <>
      <path d="M8 16h32v5a3 3 0 0 0 0 6v5H8v-5a3 3 0 0 0 0-6z" />
      <path d="M30 16v16" strokeDasharray="2 3" />
    </>
  ),
  night: (
    <>
      <path d="M30 10a14 14 0 1 0 8 22 11 11 0 0 1-8-22z" />
      <path d="M17 26c-2-1.5-3.5-2.8-3.5-4.5a2 2 0 0 1 3.5-1.2 2 2 0 0 1 3.5 1.2c0 1.7-1.5 3-3.5 4.5z" />
    </>
  ),
};

export function CardArt({ category }: { readonly category: string | null }) {
  const theme = themeOf(category);
  return (
    <div className={`card-art card-art-${theme}`} aria-hidden="true">
      <svg className="card-art-city" viewBox="0 0 160 40" preserveAspectRatio="xMinYMax slice" focusable="false">
        <path d="M0 40V28h8v-6h6v10h6V16h5v16h7v-9h6v9h5V18l4-8 4 8v22h5V25h8v15h6v-8h7v8h5V21h6v19h5v-6h8v6h6V24h7v16h5V30h6v10h7V22h5v18z" />
      </svg>
      <svg className="card-art-icon" viewBox="0 0 48 48" width="52" height="52" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {DRAWINGS[theme]}
        </g>
      </svg>
    </div>
  );
}
