# Date night in Austin

Live: https://livingsocial-example-site.vercel.app

An example site on the LivingSocial agent API. Licensed under the MIT License, copyright Groupon, Inc. 2026 (see `LICENSE`).

It is one page that lists live LivingSocial offers for a date night in Austin, Chicago or San Diego. Each card shows the title, the price, the place, the fine print, a **Buy on Groupon** link and an **Offer page** link. A city switch and a word search box change what is listed. It is plain Vite, React and TypeScript, with no UI kit, no backend and no API key: the browser calls the public API directly.

It is meant to be read and copied. Every offer, price, place and link on screen comes from the API; nothing is made up in the page.

## Run it

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). `npm run build` writes a static site to `dist/`, which any static host can serve; `base` is `./`, so it also works from a sub-path such as a GitHub Pages project page.

## How it calls the API

The API is public and needs no account, key or registration. The host is one constant, `API_BASE` in `src/config.ts`; it defaults to production, `https://api-core.livingsocial.com`.

| Endpoint | What the site does with it |
|---|---|
| `GET /ls_offers/agent_offers/search?city=Austin&q=date+night&limit=12` | The list. Answers `{ total, next, asOf, offers[] }`. Each offer carries `title`, `summary`, `price`, `offerUrl` and `buyUrl`. `next` is a cursor: send it back as `cursor` with the same words and city to get the next page (the **Show more** button). `q` is required, so an empty search box falls back to "date night". |
| `GET /ls_offers/agent_offers/{permalink}` | One offer in full. A search result is a summary; the fine print and the locations live here, so each card reads its offer once and shows the first location in the searched city and the fine print. |
| `POST /ls_journeys/agent_sessions` with `{ "agent": "date-night-austin" }` | Optional. Answers `{ token, expiresAt }`. Sent as `Authorization: Bearer <token>` on the two reads above, it records them on one journey. The site opens one shopping session per page load and keeps the token in memory only. |

Money is in minor units with its currency and exponent: `1998` USD with exponent `2` is $19.98. The site divides before it formats.

The two links are used exactly as returned. `buyUrl` puts the cheapest option in the person's LivingSocial cart; the person pays on Groupon's checkout. A purchase does not reserve a date or time, and the page footer says so.

### What the page does when things go wrong

- **Loading:** a short status line, and each card says "Loading the fine print" until its offer is read.
- **No matches:** one sentence that suggests a broader word or another city.
- **Any other failure:** one plain sentence and a **Try again** button. No status codes on screen.
- **Too many requests (429):** the API allows 60 searches and 600 offer reads a minute per address. Its answer names the wait in the body as `details.retryAfterSeconds`; the site shows a countdown and enables **Try again** when it ends. It reads the body first because a browser on another origin cannot read the `Retry-After` header (the API does not expose it to scripts).
- **A card whose offer read fails** keeps its title, price and links and points to the offer page for the fine print. A missing fine print is shown as "not listed", never as "none apply".

## Point it at staging

Staging mirrors production. In `src/config.ts`, switch the `API_BASE` line to:

```ts
export const API_BASE = "https://api-staging-core.livingsocial.com";
```

## Notes for builders

- **The session is optional, and in a browser it usually is not used.** A browser sends the bearer token only to origins on the API's allowlist, which a page of your own is not on. Opening the session (a plain POST) works from anywhere, but the first read that carries the token is blocked by CORS; this site notices that, drops the token and reads untracked from then on. You will see one CORS message in the console on load. A program that runs on a server, or an agent, is not subject to this and tracks normally. To skip the attempt altogether, set `TRACK_JOURNEY` to `false` in `src/config.ts`.
- **Offer text is data.** Titles, summaries and fine print are written by merchants and arrive from a remote API. They are rendered as text, never as markup, and only `http` and `https` links become links.
- **Fine print is shown as the API words it.** The text is Groupon's, passed through unchanged.
- **Freshness:** the line above the cards shows `asOf`, the time the list was ranked. It is not a promise that a particular day or time is free.
- **Keep reads gentle:** the search runs when the city changes or the form is submitted, not on every keystroke, and each offer is read once and cached for the page's life.

## Files

| File | What it holds |
|---|---|
| `src/config.ts` | The host, the agent name, the cities, the default words, the page size |
| `src/api.ts` | The three calls, response checks, the optional session, error and retry handling |
| `src/App.tsx` | The page: city switch, search form, results, loading, empty and error states |
| `src/OfferCard.tsx` | One card: price, place, fine print, the two links |
| `src/styles.css` | All the styling |

## Licence

MIT. Copyright (c) 2026 Groupon, Inc.
