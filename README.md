# Date night in Austin

Live: https://livingsocial-example-site.vercel.app

An example site on the LivingSocial Partner API, buying under a registered storefront. Licensed under the MIT License, copyright Groupon, Inc. 2026 (see `LICENSE`).

It is one page that lists live LivingSocial offers for a date night in Austin, Chicago or San Diego. Each card shows the photo, the title, the price, the place, the fine print and a **Buy on Groupon** button. A city switch and a word search box change what is listed. **Buy on Groupon** opens Groupon's cobranded checkout: it shows the storefront's logo, and the shopper pays on Groupon.

It is plain Vite, React and TypeScript, with no UI kit, plus two small Vercel functions in `api/` that hold the storefront's API key. It is meant to be read and copied. Every offer, price, place and link on screen comes from the API; nothing is made up in the page. The look is the site's own: Austin after dark, a moon-and-heart mark, and drawings (the skyline with the Congress Avenue Bridge and its bats, one small picture per kind of evening on each card). Each card shows the offer's own photo; an offer without one gets the drawing for its kind of evening, never a stock photo that pretends to be the offer.

## The storefront and the key

The site buys under the storefront **Tomas Private shopping Test** (`fa69dfd0-08da-4d89-924f-e37fe51a19a3`), registered on the [LivingSocial developer portal](https://agent.livingsocial.com). Its Partner API key is a secret: it lives only in the Vercel environment variable `LS_PARTNER_API_KEY` and is read only by the functions in `api/`. It never reaches the browser, the bundle or a log.

Set it once per environment; `vercel env add` reads the value from standard input, so it never appears on the command line:

```bash
printf '%s' "$LS_PARTNER_API_KEY" | vercel env add LS_PARTNER_API_KEY production --sensitive
printf '%s' "$LS_PARTNER_API_KEY" | vercel env add LS_PARTNER_API_KEY preview --sensitive
```

To check which storefront a key belongs to, read `GET https://api-core.livingsocial.com/partner_storefront/me` with it (`Authorization: Bearer <key>`).

### What the cobranded checkout needs

A cart's `buyLink` opens Groupon's **cobranded** checkout, with the storefront's logo and a **Continue shopping** link, only for a storefront Groupon has marked Trusted and that has a logo. Any other storefront's `buyLink` opens Groupon's own checkout, without a logo. On the storefront's page in the developer portal:

- **Logo:** uploaded and accepted by Groupon (this storefront's is).
- **Redirect URL:** where the checkout sends the shopper after paying, with `grouponOrderUuid` added. Point it at this site (`https://livingsocial-example-site.vercel.app/`) to bring the shopper back here; without one the shopper stays on Groupon's receipt page.
- **Continue shopping URL:** where the checkout's logo and **Continue shopping** link lead. Point it at this site too.

With a confirmed CJ publisher id on the storefront, every `buyLink` is CJ's click link that forwards to the same checkout, so CJ credits the sale.

## Run it

```bash
npm install
vercel link                  # once: the Vercel project that holds LS_PARTNER_API_KEY
vercel dev
```

`vercel dev` serves the page and the functions together on http://localhost:3000. A key set as `--sensitive` cannot be pulled, so for a local run put your own key in `.env.local` (ignored by git) as `LS_PARTNER_API_KEY=...`. `npm run dev` alone serves the page without the functions, so the list stays empty.

`npm test` runs the tests of the functions' answer shaping; `npm run build` type-checks and writes the page to `dist/`. Deploy with `vercel --prod`.

## How it calls the API

The browser calls only the site's own functions. The functions call the Partner API at `https://api-core.livingsocial.com` with `Authorization: Bearer <key>` (the [Partner OpenAPI](https://agent.livingsocial.com/partner-openapi.json) describes every endpoint).

| The browser calls | The function calls | What comes back |
|---|---|---|
| `GET /api/search?city=Austin&q=date+night&limit=12` | `GET /partner_storefront/products/search?q=...&city=...&country=US&limit=12` | `{ total, next, asOf, products[] }`. Each product is complete: `title`, `summary`, `category`, `imageUrl`, `price`, `locations`, `finePrint`, `buyOptionId` (the cheapest option on sale, or null), `bookingUrl` and `bookingOptions`. Only active products are listed. `next` is a cursor: send it back as `cursor` with the same words and city for the next page (the **Show more** button); it works for 15 minutes. A Partner page holds only the hits inside the storefront's scope (this one sells `things-to-do`), so a page can be short, or empty, while more remain. |
| `POST /api/buy` (a form: `productId`, `optionId`) | `GET /partner_storefront/products/{productId}`, then `POST /partner_storefront/carts` | `303` to the cart's `buyLink`, Groupon's checkout. The function reads the product first, so the cart line carries the live price as `expectedPrice`, never a price the browser sent. |

The search holds no personal data, so its answer may be kept by Vercel's CDN for a minute. The Buy button is a form that posts in a new tab, not a link: each press makes one cart, and a link could be prefetched. Carts carry `clientReference: "livingsocial-example-site"`, which names the site in the storefront's order list and never a person.

Money is in minor units with its currency and exponent: `1998` USD with exponent `2` is $19.98. The site divides before it formats.

A product a cart cannot take (booked by a date and time, a hotel stay) has no **Buy on Groupon** button: the card offers **Choose dates & book** (its `bookingUrl`) or lists the options' booking links, where Groupon takes the date and the payment. A voucher purchase does not reserve a date or time, and this site makes no holds.

### What the page does when things go wrong

- **Loading:** a short status line.
- **No matches:** one sentence that suggests a broader word or another city.
- **Any other failure:** one plain sentence and a **Try again** button. No status codes on screen.
- **Too many requests (429):** the Partner API names the wait as `details.retryAfterSeconds`; the function answers 429 with `{ message, retryAfterSeconds }` and a `Retry-After` header, and the page shows a countdown and enables **Try again** when it ends.
- **Buy fails:** the new tab shows one sentence (the option is no longer for sale, or LivingSocial asks for a pause) and asks to press Buy again.
- **No key set:** the functions answer 503 and call nothing.

## Notes for builders

- **The key stays on the server.** A Partner API key in a browser bundle is anyone's key. Keep it in the host's secrets and put a small function between the page and the API, as `api/` does.
- **Offer text is data.** Titles, summaries and fine print are written by merchants and arrive from a remote API. They are rendered as text, never as markup, and only `http` and `https` links become links.
- **Fine print is shown as the API words it.** The text is Groupon's, passed through unchanged. Missing fine print is shown as "not listed", never as "none apply".
- **Freshness:** the line above the cards shows `asOf`, the time the list was ranked. It is not a promise that a particular day or time is free.
- **Keep calls gentle:** the search runs when the city changes or the form is submitted, not on every keystroke, and a cart is made only when someone presses Buy.

## Files

| File | What it holds |
|---|---|
| `api/_partner.ts` | The Partner API client, the answer shaping and the error handling (a `_` file is not a function) |
| `api/search.ts`, `api/buy.ts` | The two functions the browser calls |
| `test/partner.test.ts` | Tests of the shaping, the 429 and the cart (`npm test`) |
| `src/config.ts` | The functions' path, the cities, the default words, the page size |
| `src/api.ts` | The browser's call to `/api/search` and the Buy form's address |
| `src/App.tsx` | The page: city switch, search form, results, loading, empty and error states |
| `src/OfferCard.tsx` | One card: the photo (or the drawing), price, place, fine print, the Buy form and booking links |
| `src/Logo.tsx`, `src/Skyline.tsx`, `src/CardArt.tsx` | The mark, the masthead's picture of Austin at night, and each card's band, all drawn as SVG |
| `src/styles.css` | All the styling: the night palette, the neon pink and the amber |

## Licence

MIT. Copyright (c) 2026 Groupon, Inc.
