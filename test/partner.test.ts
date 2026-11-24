import { describe, expect, it, vi } from "vitest";
import {
  buyLinkFor,
  CLIENT_REFERENCE,
  errorResponse,
  type Fetch,
  PartnerError,
  partnerClient,
  searchProducts,
  toProductCard,
} from "../api/_partner.js";

const PRODUCT_ID = "66c2590b-e6ad-4488-8ffb-afabc61a9520";
const CHEAP = "3573684b-cf6b-4221-a842-1de7cee6bbab";
const DEAR = "16baecb5-c497-4b63-98a6-e56b9fe9bd2e";
const BUY_LINK = `https://www.groupon.com/partner/checkout/cart/120e9e18-3b2c-42da-9066-528d18f6ce70`;

function option(id: string, retail: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: `Option ${retail}`,
    active: true,
    bookingUrl: null,
    price: { retail, original: retail * 2, currency: "USD", currencyPrecision: 2 },
    ...extra,
  };
}

const product = {
  id: PRODUCT_ID,
  title: "Pottery date night",
  shortDescription: "Clay for two",
  description: "A long description the card does not need",
  status: "active",
  availabilityRequired: false,
  hotelStay: false,
  bookingUrl: null,
  categoryLabels: ["Pottery", "Things To Do"],
  media: [
    { index: 1, role: "large", url: "https://img.grouponcdn.com/second.jpg" },
    { index: 0, role: "small", url: "https://img.grouponcdn.com/small.jpg" },
    { index: 0, role: "large", url: "https://img.grouponcdn.com/large.jpg" },
  ],
  locations: [{ id: "x", name: "Studio", street: "1 Main St,", city: "Austin", phone: "555", latitude: 1 }],
  options: [option(DEAR, 9500), option(CHEAP, 6500), option("c0ffee00-0000-4000-8000-000000000000", 100, { active: false })],
  merchantId: "m",
  finePrint: ["Valid Saturdays"],
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

describe("toProductCard", () => {
  it("keeps only what the card shows, and picks the cheapest option on sale to buy", () => {
    expect(toProductCard(product)).toEqual({
      id: PRODUCT_ID,
      title: "Pottery date night",
      summary: "Clay for two",
      category: "Pottery",
      imageUrl: "https://img.grouponcdn.com/large.jpg",
      price: { fromMinor: 6500, toMinor: 9500, currency: "USD", currencyExponent: 2 },
      locations: [{ name: "Studio", street: "1 Main St,", city: "Austin" }],
      finePrint: ["Valid Saturdays"],
      buyOptionId: CHEAP,
      bookingUrl: null,
      bookingOptions: [],
    });
  });

  it("offers no cart for a product booked by date, and hands on its booking links", () => {
    const booked = {
      ...product,
      availabilityRequired: true,
      options: [option(CHEAP, 6500, { bookingUrl: "https://www.groupon.com/book/1" })],
    };
    const card = toProductCard(booked);
    expect(card?.buyOptionId).toBeNull();
    expect(card?.bookingOptions).toEqual([{ id: CHEAP, title: "Option 6500", bookingUrl: "https://www.groupon.com/book/1" }]);
  });

  it("drops a product without an id or title, and reads missing fine print as not listed", () => {
    expect(toProductCard({ title: "No id" })).toBeNull();
    expect(toProductCard({ ...product, finePrint: null })?.finePrint).toBeNull();
  });
});

describe("searchProducts", () => {
  it("sends the key only to the Partner API and answers the page's shape", async () => {
    const fetchImpl = vi.fn<Fetch>(async () =>
      json({ data: [product, { ...product, id: "sold", status: "sold_out" }], total: 2, hasMore: false, nextCursor: null, asOf: "2026-11-24T00:00:00Z" })
    );
    const answer = await searchProducts(partnerClient("grpn_test", fetchImpl), { city: "Austin", q: "date night", limit: 12, cursor: null });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api-core.livingsocial.com/partner_storefront/products/search?q=date+night&city=Austin&country=US&limit=12");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer grpn_test");
    expect(answer).toMatchObject({ total: 2, next: null, asOf: "2026-11-24T00:00:00Z" });
    expect(answer.products.map((card) => card.id)).toEqual([PRODUCT_ID]);
    expect(JSON.stringify(answer)).not.toContain("grpn_test");
  });

  it("passes a 429 on with the seconds the Partner API asked for", async () => {
    const fetchImpl: Fetch = async () => json({ code: "resource_exhausted", message: "slow", details: { retryAfterSeconds: 7 } }, 429);
    const failure = await searchProducts(partnerClient("grpn_test", fetchImpl), { city: "Austin", q: "x", limit: 1, cursor: null }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PartnerError);
    const response = errorResponse(failure);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7");
    expect(await response.json()).toEqual({ message: "LivingSocial asks for a short pause.", retryAfterSeconds: 7 });
  });

  it("answers 503 without calling out when no key is set", async () => {
    const fetchImpl = vi.fn<Fetch>();
    const failure = await searchProducts(partnerClient(undefined, fetchImpl), { city: "Austin", q: "x", limit: 1, cursor: null }).catch((error: unknown) => error);
    expect(errorResponse(failure).status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("buyLinkFor", () => {
  it("reads the live price, makes a cart with it and answers the cart's buyLink", async () => {
    const fetchImpl = vi.fn<Fetch>(async (url) =>
      String(url).endsWith("/carts") ? json({ id: "cart", status: "ACTIVE", buyLink: BUY_LINK }) : json(product)
    );
    await expect(buyLinkFor(partnerClient("grpn_test", fetchImpl), PRODUCT_ID, DEAR)).resolves.toBe(BUY_LINK);
    const [, cartInit] = fetchImpl.mock.calls[1]!;
    expect(JSON.parse(String(cartInit?.body))).toEqual({
      country: "US",
      clientReference: CLIENT_REFERENCE,
      items: [{ productId: PRODUCT_ID, optionId: DEAR, quantity: 1, expectedPrice: 9500 }],
    });
  });

  it("refuses an option that is not on sale, and ids that are not uuids, before any cart", async () => {
    const fetchImpl = vi.fn<Fetch>(async () => json(product));
    const client = partnerClient("grpn_test", fetchImpl);
    await expect(buyLinkFor(client, PRODUCT_ID, "c0ffee00-0000-4000-8000-000000000000")).rejects.toMatchObject({ status: 409 });
    await expect(buyLinkFor(client, "../carts", CHEAP)).rejects.toMatchObject({ status: 400 });
    expect(fetchImpl.mock.calls.every(([url]) => !String(url).endsWith("/carts"))).toBe(true);
  });
});
