/**
 * The server side of the site: the LivingSocial Partner API, called with the storefront's key.
 *
 * The key lives in the Vercel environment variable LS_PARTNER_API_KEY and never leaves this
 * folder: the browser calls /api/search and /api/buy, and every answer is shaped here into the few
 * fields the page shows. Files whose name starts with "_" are not functions on Vercel.
 *
 *   GET  /partner_storefront/products/search      the ranked list, one page at a time
 *   GET  /partner_storefront/products/{productId}  one product, to cart it at its live price
 *   POST /partner_storefront/carts                 a cart whose buyLink opens Groupon's checkout
 */

export const PARTNER_API_BASE = "https://api-core.livingsocial.com";

/** Ties the carts this site makes to it in the storefront's order list. Names the site, never a person. */
export const CLIENT_REFERENCE = "livingsocial-example-site";

// ---------------------------------------------------------------------------------------------
// What the browser receives

export interface Price {
  readonly fromMinor: number;
  readonly toMinor: number;
  readonly currency: string;
  /** Divide the minor amounts by 10 to this power: 1998 with exponent 2 is 19.98. */
  readonly currencyExponent: number;
}

export interface Place {
  readonly name: string | null;
  readonly street: string | null;
  readonly city: string | null;
}

export interface BookingOption {
  readonly id: string;
  readonly title: string;
  readonly bookingUrl: string;
}

export interface ProductCard {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly category: string | null;
  /** The product's main picture on Groupon's image host; null when Groupon sent none. */
  readonly imageUrl: string | null;
  readonly price: Price | null;
  readonly locations: readonly Place[];
  /** Null when Groupon lists none: shown as "not listed", never as "none apply". */
  readonly finePrint: readonly string[] | null;
  /** The option the Buy button carts (the cheapest one on sale); null when the product cannot be carted. */
  readonly buyOptionId: string | null;
  /** Where a product a cart cannot take is bought or booked on groupon.com. */
  readonly bookingUrl: string | null;
  readonly bookingOptions: readonly BookingOption[];
}

export interface SearchAnswer {
  readonly total: number;
  /** Send back as `cursor` for the next page; null on the last page. */
  readonly next: string | null;
  readonly asOf: string;
  readonly products: readonly ProductCard[];
}

/** Every failure the browser sees: a sentence and, after a 429, the seconds to wait. */
export interface ErrorAnswer {
  readonly message: string;
  readonly retryAfterSeconds: number | null;
}

// ---------------------------------------------------------------------------------------------
// Reading the Partner API's answers. They are untrusted data: checked field by field.

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

interface SellableOption {
  readonly id: string;
  readonly retailMinor: number;
  readonly currency: string;
  readonly currencyExponent: number;
}

/** Options a cart takes: on sale (`active` not false), with a price, and no booking page of their own. */
function sellableOptions(product: JsonRecord): SellableOption[] {
  return records(product.options).flatMap((option): SellableOption[] => {
    const id = asString(option.id);
    const price = isRecord(option.price) ? option.price : null;
    const retailMinor = asNumber(price?.retail);
    const currency = asString(price?.currency);
    const currencyExponent = asNumber(price?.currencyPrecision);
    if (option.active === false || asString(option.bookingUrl) !== null) return [];
    if (id === null || retailMinor === null || currency === null || currencyExponent === null) return [];
    return [{ id, retailMinor, currency, currencyExponent }];
  });
}

/** A product the cart takes: on sale, not booked by a date, not a hotel stay. */
function isCartable(product: JsonRecord): boolean {
  return product.status === "active" && product.availabilityRequired !== true && product.hotelStay !== true;
}

/** The option a cart line names for this product: the cheapest one on sale, or null. */
export function cheapestOption(product: JsonRecord): SellableOption | null {
  if (!isCartable(product)) return null;
  return sellableOptions(product).reduce<SellableOption | null>(
    (best, option) => (best === null || option.retailMinor < best.retailMinor ? option : best),
    null
  );
}

function priceOf(product: JsonRecord): Price | null {
  const options = records(product.options).flatMap((option) => {
    const price = isRecord(option.price) ? option.price : null;
    const retail = asNumber(price?.retail);
    const currency = asString(price?.currency);
    const exponent = asNumber(price?.currencyPrecision);
    return option.active === false || retail === null || currency === null || exponent === null
      ? []
      : [{ retail, currency, exponent }];
  });
  const first = options[0];
  if (first === undefined) return null;
  const sameCurrency = options.filter((option) => option.currency === first.currency);
  return {
    fromMinor: Math.min(...sameCurrency.map((option) => option.retail)),
    toMinor: Math.max(...sameCurrency.map((option) => option.retail)),
    currency: first.currency,
    currencyExponent: first.exponent,
  };
}

/** The main picture (index 0) at card size; Groupon sends each picture once per size. */
function imageOf(product: JsonRecord): string | null {
  const main = records(product.media).filter((media) => (asNumber(media.index) ?? 0) === 0);
  for (const role of ["large", "medium", "wide_crop", "extra_large", "small"]) {
    const url = asString(main.find((media) => media.role === role)?.url);
    if (url !== null) return url;
  }
  return asString(main[0]?.url);
}

/** A product without an id and a title cannot be shown or bought, so it is dropped. */
export function toProductCard(value: unknown): ProductCard | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const title = asString(value.title);
  if (id === null || title === null) return null;
  const labels = Array.isArray(value.categoryLabels) ? value.categoryLabels : [];
  const bookingOptions = records(value.options).flatMap((option): BookingOption[] => {
    const optionId = asString(option.id);
    const optionTitle = asString(option.title);
    const bookingUrl = asString(option.bookingUrl);
    return optionId !== null && optionTitle !== null && bookingUrl !== null && option.active !== false
      ? [{ id: optionId, title: optionTitle, bookingUrl }]
      : [];
  });
  return {
    id,
    title,
    summary: asString(value.shortDescription),
    category: asString(labels[0]),
    imageUrl: imageOf(value),
    price: priceOf(value),
    locations: records(value.locations).map((location) => ({
      name: asString(location.name),
      street: asString(location.street),
      city: asString(location.city),
    })),
    finePrint: Array.isArray(value.finePrint)
      ? value.finePrint.filter((line): line is string => typeof line === "string")
      : null,
    buyOptionId: cheapestOption(value)?.id ?? null,
    bookingUrl: value.status === "active" ? asString(value.bookingUrl) : null,
    bookingOptions: value.status === "active" ? bookingOptions : [],
  };
}

export function toSearchAnswer(json: unknown): SearchAnswer {
  if (!isRecord(json) || !Array.isArray(json.data)) {
    throw new PartnerError(502, "The search answered in a shape this site does not know.", null);
  }
  const products = json.data
    .filter((product) => isRecord(product) && product.status === "active")
    .map(toProductCard)
    .filter((product): product is ProductCard => product !== null);
  return {
    total: asNumber(json.total) ?? products.length,
    next: json.hasMore === true ? asString(json.nextCursor) : null,
    asOf: asString(json.asOf) ?? new Date().toISOString(),
    products,
  };
}

// ---------------------------------------------------------------------------------------------
// Calling the Partner API

/** A failure to pass on to the browser: its status, one plain sentence, and the wait after a 429. */
export class PartnerError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds: number | null
  ) {
    super(message);
    this.name = "PartnerError";
  }
}

/** Seconds to wait after a 429: `details.retryAfterSeconds` in the body, else the `Retry-After` header. */
function retryAfterOf(response: Response, body: unknown): number {
  const details = isRecord(body) && isRecord(body.details) ? body.details : null;
  const fromBody = asNumber(details?.retryAfterSeconds);
  if (fromBody !== null && fromBody > 0) return Math.ceil(fromBody);
  const fromHeader = Number(response.headers.get("Retry-After"));
  return Number.isFinite(fromHeader) && fromHeader > 0 ? Math.ceil(fromHeader) : 10;
}

async function failureOf(response: Response, path: string): Promise<PartnerError> {
  const body: unknown = await response.json().catch(() => null);
  const code = isRecord(body) ? asString(body.code) : null;
  // The log names the call and Groupon's code: never the key, the query or the shopper.
  console.error(`Partner API ${path.split("?")[0]} answered ${response.status} ${code ?? ""}`.trim());
  if (response.status === 429) {
    return new PartnerError(429, "LivingSocial asks for a short pause.", retryAfterOf(response, body));
  }
  if (response.status === 400) return new PartnerError(400, "That search could not be run.", null);
  if (response.status === 404) return new PartnerError(404, "That product is no longer offered.", null);
  return new PartnerError(502, "LivingSocial could not answer just now.", null);
}

export type Fetch = typeof fetch;

export interface PartnerClient {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

export function partnerClient(apiKey: string | undefined, fetchImpl: Fetch = fetch): PartnerClient {
  async function call(path: string, init: RequestInit): Promise<unknown> {
    if (apiKey === undefined || apiKey === "") {
      console.error("LS_PARTNER_API_KEY is not set");
      throw new PartnerError(503, "This site is not connected to LivingSocial yet.", null);
    }
    const response = await fetchImpl(`${PARTNER_API_BASE}${path}`, {
      ...init,
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}`, ...init.headers },
    });
    if (!response.ok) throw await failureOf(response, path);
    return response.json();
  }
  return {
    get: (path) => call(path, { method: "GET" }),
    post: (path, body) =>
      call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  };
}

// ---------------------------------------------------------------------------------------------
// The two things the page asks for

export interface SearchParams {
  readonly city: string;
  readonly q: string;
  readonly limit: number;
  readonly cursor: string | null;
}

/**
 * One page of the site, from one Partner page. A Partner page holds only the hits inside the
 * storefront's scope, so it can be short, or empty, while `hasMore` is true.
 */
export async function searchProducts(client: PartnerClient, params: SearchParams): Promise<SearchAnswer> {
  const query = new URLSearchParams({ q: params.q, city: params.city, country: "US", limit: String(params.limit) });
  if (params.cursor !== null) query.set("cursor", params.cursor);
  return toSearchAnswer(await client.get(`/partner_storefront/products/search?${query.toString()}`));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A cart with one unit of the product's option, and its buyLink: Groupon's checkout, cobranded with
 * the storefront's logo once Groupon trusts the storefront. The product is read first, so the cart
 * line carries the live price (`expectedPrice`), never one the browser sent.
 */
export async function buyLinkFor(client: PartnerClient, productId: string, optionId: string): Promise<string> {
  if (!UUID.test(productId) || !UUID.test(optionId)) throw new PartnerError(400, "That product cannot be bought.", null);
  const product = await client.get(`/partner_storefront/products/${productId}`);
  const option = isRecord(product) && isCartable(product)
    ? sellableOptions(product).find((candidate) => candidate.id === optionId)
    : undefined;
  if (option === undefined) throw new PartnerError(409, "That option is not for sale right now.", null);
  const cart = await client.post("/partner_storefront/carts", {
    country: "US",
    clientReference: CLIENT_REFERENCE,
    items: [{ productId, optionId, quantity: 1, expectedPrice: option.retailMinor }],
  });
  const buyLink = isRecord(cart) ? asString(cart.buyLink) : null;
  if (buyLink === null || !buyLink.startsWith("https://")) {
    throw new PartnerError(502, "LivingSocial did not hand back a checkout link.", null);
  }
  return buyLink;
}

// ---------------------------------------------------------------------------------------------
// Answers

export function errorResponse(error: unknown): Response {
  const failure = error instanceof PartnerError ? error : new PartnerError(500, "Something went wrong.", null);
  if (!(error instanceof PartnerError)) console.error("Unexpected failure", error instanceof Error ? error.name : "");
  const body: ErrorAnswer = { message: failure.message, retryAfterSeconds: failure.retryAfterSeconds };
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (failure.retryAfterSeconds !== null) headers["Retry-After"] = String(failure.retryAfterSeconds);
  return Response.json(body, { status: failure.status, headers });
}
