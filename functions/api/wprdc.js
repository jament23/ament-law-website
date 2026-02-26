/**
 * Ament Law Group — WPRDC Datastore Proxy
 * Cloudflare Pages Function at /api/wprdc
 *
 * Proxies requests to the Western Pennsylvania Regional Data Center
 * (data.wprdc.org) datastore_search API. WPRDC returns 403 to direct
 * browser requests; this function runs server-side where it is allowed.
 *
 * Accepts GET with query params forwarded to WPRDC:
 *   resource_id, filters, limit, offset, fields, sort, q
 *
 * No auth required — WPRDC is a public open data portal.
 * Cached 5 minutes for municipality-level queries (large, slow),
 * no cache for single-parcel lookups.
 */

const WPRDC_BASE = "https://data.wprdc.org/api/3/action/datastore_search";
const UA = "Mozilla/5.0 (compatible; AmentLaw/1.0; +https://www.ament.law)";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  // Forward only known WPRDC params (prevent open proxy abuse)
  const allowed = ["resource_id", "filters", "limit", "offset", "fields", "sort", "q"];
  const params = new URLSearchParams();
  for (const key of allowed) {
    const val = url.searchParams.get(key);
    if (val != null) params.set(key, val);
  }

  if (!params.has("resource_id")) {
    return new Response(JSON.stringify({ success: false, error: "resource_id required" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Use a longer cache for large municipality queries, no cache for single parcel
  const filters = params.get("filters") || "{}";
  const limit = parseInt(params.get("limit") || "1");
  const isMuniQuery = limit > 100;
  const cacheSeconds = isMuniQuery ? 300 : 0; // 5 min for muni, none for parcel

  try {
    const resp = await fetch(`${WPRDC_BASE}?${params.toString()}`, {
      headers: { "User-Agent": UA },
      cf: isMuniQuery ? { cacheTtl: cacheSeconds, cacheEverything: true } : {},
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error("WPRDC error:", resp.status, body.substring(0, 200));
      return new Response(JSON.stringify({ success: false, error: `WPRDC returned ${resp.status}` }), {
        status: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
        "Cache-Control": isMuniQuery ? `public, max-age=${cacheSeconds}` : "no-store",
      },
    });
  } catch (err) {
    console.error("WPRDC proxy error:", err.message);
    return new Response(JSON.stringify({ success: false, error: "Proxy error: " + err.message }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
