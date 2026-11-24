/**
 * GET /api/search?city=Austin&q=date+night&limit=12[&cursor=...]
 *
 * One page of the storefront's products that match the words, shaped for the cards. The search
 * holds no personal data, so Vercel's CDN may keep an answer for a minute.
 */

import { errorResponse, PartnerError, partnerClient, searchProducts } from "./_partner.js";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const city = (params.get("city") ?? "").trim();
  const limit = Math.min(50, Math.max(1, Math.trunc(Number(params.get("limit") ?? "12")) || 12));
  try {
    if (q === "" || q.length > 200 || city === "" || city.length > 60) {
      throw new PartnerError(400, "That search could not be run.", null);
    }
    const answer = await searchProducts(partnerClient(process.env.LS_PARTNER_API_KEY), {
      q,
      city,
      limit,
      cursor: params.get("cursor"),
    });
    return Response.json(answer, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    return errorResponse(error);
  }
}
