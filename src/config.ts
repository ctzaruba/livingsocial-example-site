/**
 * The few values a builder changes first. Everything else in the app reads from here.
 */

/** The LivingSocial agent API. Public: no key, no account. */
export const API_BASE = "https://api-core.livingsocial.com";
// To try the same site against staging, switch to the line below (it mirrors production):
// export const API_BASE = "https://api-staging-core.livingsocial.com";

/** Names this app on the journey that the optional session records. */
export const AGENT_NAME = "date-night-austin";

/** Open a shopping session once and send its token as a bearer, so the journey is tracked. Reads work without it. */
export const TRACK_JOURNEY = true;

export const CITIES = ["Austin", "Chicago", "San Diego"] as const;
export type City = (typeof CITIES)[number];

/** The search needs words (`q`); this is what an empty search box falls back to. */
export const DEFAULT_QUERY = "date night";

/** Offers per page. The API allows 1 to 50. */
export const PAGE_SIZE = 12;
