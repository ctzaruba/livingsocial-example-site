/**
 * The browser's side of the site's two functions:
 *
 *   GET  /api/search  the ranked list, one page at a time, each product already in full
 *   POST /api/buy     a form the Buy button posts (see OfferCard); it opens Groupon's checkout
 *
 * The functions call the LivingSocial Partner API with the storefront's key (see `api/`). What
 * comes back is still data from merchants: the UI only ever renders it as text.
 */

import type { ErrorAnswer, SearchAnswer } from "../api/_partner.js";
import { API_PATH } from "./config";

export type { BookingOption, Place, Price, ProductCard, SearchAnswer } from "../api/_partner.js";

/** The function answered, but not with success. `retryAfterSeconds` is set when it asked us to slow down. */
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

export interface SearchParams {
  readonly city: string;
  readonly q: string;
  readonly limit: number;
  readonly cursor?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function search({ city, q, limit, cursor }: SearchParams, signal?: AbortSignal): Promise<SearchAnswer> {
  const query = new URLSearchParams({ city, q, limit: String(limit) });
  if (cursor !== undefined) query.set("cursor", cursor);
  const response = await fetch(`${API_PATH}/search?${query.toString()}`, { headers: { Accept: "application/json" }, signal });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = (isRecord(body) ? body : {}) as Partial<ErrorAnswer>;
    const retryAfterSeconds = typeof failure.retryAfterSeconds === "number" ? failure.retryAfterSeconds : null;
    throw new ApiError(failure.message ?? response.statusText, response.status, response.status === 429 ? (retryAfterSeconds ?? 10) : null);
  }
  if (!isRecord(body) || !Array.isArray(body.products)) {
    throw new ApiError("The search answered in a shape this site does not know.", 200, null);
  }
  return body as unknown as SearchAnswer;
}

/** Where the Buy button's form posts. */
export const BUY_ACTION = `${API_PATH}/buy`;
