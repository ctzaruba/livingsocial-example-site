/**
 * A small client for the three LivingSocial agent endpoints this site uses.
 *
 *   GET  /ls_offers/agent_offers/search       the ranked list, one page at a time
 *   GET  /ls_offers/agent_offers/{permalink}  one offer in full (fine print, locations)
 *   POST /ls_journeys/agent_sessions          optional: a token that tracks this app's journey
 *
 * Everything that comes back is untrusted data: it is checked at the edge here, and the UI only
 * ever renders it as text.
 */

import { AGENT_NAME, API_BASE, TRACK_JOURNEY } from "./config";

export interface Price {
  readonly fromMinor: number;
  readonly toMinor: number;
  readonly currency: string;
  /** Divide the minor amounts by 10 to this power: 1998 with exponent 2 is 19.98. */
  readonly currencyExponent: number;
}

export interface OfferSummary {
  readonly id: string;
  readonly permalink: string;
  readonly title: string;
  readonly summary: string | null;
  readonly category: string | null;
  readonly city: string | null;
  readonly price: Price | null;
  /** The offer's main picture at grid size, on Groupon's image host; null when Groupon sent none. */
  readonly primaryImageUrl: string | null;
  /** The offer's page, for a person. */
  readonly offerUrl: string;
  /** Puts the cheapest option in the person's cart; null when it cannot be bought now. */
  readonly buyUrl: string | null;
}

export interface SearchResult {
  /** Every offer that matches, not only this page. */
  readonly total: number;
  /** Send back as `cursor` for the next page; null on the last page. */
  readonly next: string | null;
  /** When the list was ranked. The same for every page of one walk. */
  readonly asOf: string;
  readonly offers: readonly OfferSummary[];
}

export interface OfferLocation {
  readonly name: string | null;
  readonly street: string | null;
  readonly city: string | null;
}

export interface OfferDetail {
  readonly finePrint: readonly string[];
  readonly locations: readonly OfferLocation[];
}

export interface SearchParams {
  readonly city: string;
  readonly q: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface LivingSocialClient {
  search(params: SearchParams, signal?: AbortSignal): Promise<SearchResult>;
  offerDetail(permalink: string): Promise<OfferDetail>;
}

/** The API answered, but not with success. `retryAfterSeconds` is set when it asked us to slow down. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds: number | null
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parsePrice(value: unknown): Price | null {
  if (!isRecord(value)) return null;
  const fromMinor = asNumber(value.fromMinor);
  const toMinor = asNumber(value.toMinor);
  const currencyExponent = asNumber(value.currencyExponent);
  const currency = asString(value.currency);
  if (fromMinor === null || toMinor === null || currencyExponent === null || currency === null) return null;
  return { fromMinor, toMinor, currency, currencyExponent };
}

/** An offer without an id, permalink, title and page link cannot be shown or linked, so it is dropped. */
function parseOffer(value: unknown): OfferSummary | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const permalink = asString(value.permalink);
  const title = asString(value.title);
  const offerUrl = asString(value.offerUrl);
  if (id === null || permalink === null || title === null || offerUrl === null) return null;
  return {
    id,
    permalink,
    title,
    offerUrl,
    summary: asString(value.summary),
    category: asString(value.category),
    city: asString(value.city),
    price: parsePrice(value.price),
    primaryImageUrl: asString(value.primaryImageUrl),
    buyUrl: asString(value.buyUrl),
  };
}

function parseSearchResult(json: unknown): SearchResult {
  if (!isRecord(json) || !Array.isArray(json.offers)) {
    throw new ApiError("The search answered in a shape this site does not know.", 200, null);
  }
  const offers = json.offers.map(parseOffer).filter((offer): offer is OfferSummary => offer !== null);
  return {
    total: asNumber(json.total) ?? offers.length,
    next: asString(json.next),
    asOf: asString(json.asOf) ?? new Date().toISOString(),
    offers,
  };
}

function parseLocation(value: unknown): OfferLocation | null {
  if (!isRecord(value)) return null;
  return { name: asString(value.name), street: asString(value.street), city: asString(value.city) };
}

/** A missing list is read as "not listed", never as a promise either way. */
function parseOfferDetail(json: unknown): OfferDetail {
  const offer = isRecord(json) && isRecord(json.offer) ? json.offer : null;
  if (offer === null) throw new ApiError("The offer answered in a shape this site does not know.", 200, null);
  const finePrint = Array.isArray(offer.finePrint)
    ? offer.finePrint.filter((line): line is string => typeof line === "string")
    : [];
  const locations = Array.isArray(offer.locations)
    ? offer.locations.map(parseLocation).filter((location): location is OfferLocation => location !== null)
    : [];
  return { finePrint, locations };
}

/**
 * Seconds to wait after a 429. The JSON body carries it as `details.retryAfterSeconds`; the
 * `Retry-After` header says the same, but a browser on another origin cannot read it (the API
 * does not list it in `Access-Control-Expose-Headers`), so the body comes first.
 */
function retryAfterOf(response: Response, body: unknown): number | null {
  const details = isRecord(body) && isRecord(body.details) ? body.details : null;
  const fromBody = details === null ? null : asNumber(details.retryAfterSeconds);
  if (fromBody !== null) return fromBody;
  const fromHeader = Number(response.headers.get("Retry-After"));
  return Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function failureOf(response: Response): Promise<ApiError> {
  const body = await readJson(response);
  const message = isRecord(body) ? (asString(body.message) ?? response.statusText) : response.statusText;
  const retryAfterSeconds = response.status === 429 ? (retryAfterOf(response, body) ?? 10) : null;
  return new ApiError(message, response.status, retryAfterSeconds);
}

async function fetchJson(url: string, token: string | null, signal?: AbortSignal): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers, signal });
  if (!response.ok) throw await failureOf(response);
  return response.json();
}

/** One call, once per page load: the token is kept in memory and never stored. */
async function openSession(baseUrl: string, agent: string): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/ls_journeys/agent_sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ agent }),
    });
    if (!response.ok) return null;
    const body = await readJson(response);
    return isRecord(body) ? asString(body.token) : null;
  } catch {
    return null;
  }
}

interface ClientOptions {
  readonly baseUrl: string;
  readonly agent: string;
  readonly trackJourney: boolean;
}

export function createClient({ baseUrl, agent, trackJourney }: ClientOptions): LivingSocialClient {
  // The session is optional: a session that fails to open, or a bearer read the browser blocks, leaves
  // `null` here and every read goes on untracked.
  let session: Promise<string | null> | null = null;
  const details = new Map<string, Promise<OfferDetail>>();

  function currentToken(): Promise<string | null> {
    if (!trackJourney) return Promise.resolve(null);
    session ??= openSession(baseUrl, agent);
    return session;
  }

  async function get(path: string, signal?: AbortSignal): Promise<unknown> {
    const url = `${baseUrl}${path}`;
    const token = await currentToken();
    try {
      return await fetchJson(url, token, signal);
    } catch (error) {
      // A browser refuses to send a bearer token from an origin the API does not list (CORS) and
      // reports it as a bare TypeError. Give up tracking and read the same page untracked.
      if (token !== null && error instanceof TypeError && signal?.aborted !== true) {
        session = Promise.resolve(null);
        return fetchJson(url, null, signal);
      }
      throw error;
    }
  }

  return {
    async search({ city, q, limit, cursor }, signal) {
      const query = new URLSearchParams({ city, q, limit: String(limit) });
      if (cursor !== undefined) query.set("cursor", cursor);
      return parseSearchResult(await get(`/ls_offers/agent_offers/search?${query.toString()}`, signal));
    },

    offerDetail(permalink) {
      const cached = details.get(permalink);
      if (cached !== undefined) return cached;
      const request = get(`/ls_offers/agent_offers/${encodeURIComponent(permalink)}`).then(parseOfferDetail);
      details.set(permalink, request);
      // A failed read must not stay cached, or "try again" would replay the failure.
      request.catch(() => details.delete(permalink));
      return request;
    },
  };
}

export const livingSocial = createClient({ baseUrl: API_BASE, agent: AGENT_NAME, trackJourney: TRACK_JOURNEY });
