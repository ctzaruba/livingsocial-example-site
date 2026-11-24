/**
 * The few values a builder changes first. Everything else in the app reads from here.
 */

/**
 * The site's own functions (the `api/` folder, on Vercel). They hold the storefront's Partner API
 * key and call LivingSocial; the browser never sees the key.
 */
export const API_PATH = "/api";

/** Where the code of this site lives. */
export const SOURCE_URL = "https://github.com/ctzaruba/livingsocial-example-site";

export const CITIES = ["Austin", "Chicago", "San Diego"] as const;
export type City = (typeof CITIES)[number];

/** The search needs words (`q`); this is what an empty search box falls back to. */
export const DEFAULT_QUERY = "date night";

/** Products per page. The Partner API allows 1 to 50. */
export const PAGE_SIZE = 12;
