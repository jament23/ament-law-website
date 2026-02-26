/**
 * Ament Law Group — Allegheny County Millage Proxy
 * Cloudflare Pages Function at /api/millage
 *
 * Fetches the Allegheny County millage table and returns it as JSON.
 * The county page doesn't send CORS headers, so we proxy it here.
 * Cached for 24 hours (rates don't change intra-day).
 */

const MILLAGE_URL = "https://apps.alleghenycounty.us/website/millsd.asp";

export async function onRequestGet(context) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=86400", // 24 hours
  };

  try {
    const resp = await fetch(MILLAGE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36",
      },
    });

    if (!resp.ok) {
      throw new Error(`County site returned ${resp.status}`);
    }

    const html = await resp.text();

    // Parse the HTML table — rows are: School_District | Municipality | Millage | Land_Millage
    const rows = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();

    let trMatch;
    let firstRow = true;
    while ((trMatch = trRegex.exec(html)) !== null) {
      const cells = [];
      let tdMatch;
      const cellRx = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      while ((tdMatch = cellRx.exec(trMatch[1])) !== null) {
        cells.push(stripTags(tdMatch[1]));
      }
      if (cells.length >= 3) {
        if (firstRow) { firstRow = false; continue; } // skip header
        const millage = parseFloat(cells[2]);
        if (!isNaN(millage) && cells[1]) {
          rows.push({
            school_district: cells[0] || "",
            municipality: cells[1],
            millage: millage,
          });
        }
      }
    }

    if (rows.length === 0) {
      throw new Error("No millage rows parsed from county page");
    }

    return new Response(JSON.stringify({ rates: rows, fetched_at: new Date().toISOString() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Return a minimal fallback so the tool still works
    console.error("Millage proxy error:", err.message);
    return new Response(
      JSON.stringify({ rates: [], error: err.message, fallback: true }),
      {
        status: 200, // still 200 — client will use manual input
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
