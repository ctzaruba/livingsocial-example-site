/**
 * POST /api/buy  (a form: productId, optionId)
 *
 * The Buy button is a form that posts here in a new tab. The function makes a cart with one unit
 * of the option and answers 303 to the cart's buyLink, Groupon's checkout. It runs on a click
 * only, never on a page load, so no cart is made for a product nobody chose.
 */

import { buyLinkFor, PartnerError, partnerClient } from "./_partner.js";

/** The tab the form opened shows this when no checkout link came back. Fixed text only. */
function failurePage(error: unknown): Response {
  const failure = error instanceof PartnerError ? error : new PartnerError(500, "Something went wrong.", null);
  const wait = failure.retryAfterSeconds === null ? "" : ` Try again in ${failure.retryAfterSeconds} seconds.`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Checkout did not open</title></head><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">
<h1>Groupon's checkout did not open</h1><p>${failure.message}${wait}</p><p>Close this tab and press Buy again.</p></body></html>`;
  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (failure.retryAfterSeconds !== null) headers["Retry-After"] = String(failure.retryAfterSeconds);
  return new Response(html, { status: failure.status, headers });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const productId = String(form.get("productId") ?? "");
    const optionId = String(form.get("optionId") ?? "");
    const buyLink = await buyLinkFor(partnerClient(process.env.LS_PARTNER_API_KEY), productId, optionId);
    return new Response(null, { status: 303, headers: { Location: buyLink, "Cache-Control": "no-store" } });
  } catch (error) {
    return failurePage(error);
  }
}
