/**
 * Ament Law Group — Newsletter Subscribers List
 * Cloudflare Pages Function at /api/newsletter-subscribers
 *
 * Returns all subscribers. Protected by admin token.
 *
 * Required KV binding: NEWSLETTER
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const headers = { "Content-Type": "application/json" };

  // Auth check
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  try {
    const ghResp = await fetch("https://api.github.com/repos/jament23/ament-law-website", {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "User-Agent": "ament-newsletter" },
    });
    if (!ghResp.ok) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 403, headers });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Auth check failed" }), { status: 500, headers });
  }

  const kv = env.NEWSLETTER;
  if (!kv) {
    return new Response(JSON.stringify({ error: "Newsletter storage not configured" }), { status: 503, headers });
  }

  // Get all subscribers
  const subscribers = [];
  let cursor = null;
  do {
    const list = await kv.list({ prefix: "sub:", cursor, limit: 500 });
    for (const key of list.keys) {
      const data = await kv.get(key.name);
      if (data) {
        try {
          const sub = JSON.parse(data);
          subscribers.push({
            email: sub.email,
            subscribed: sub.subscribed || null,
            active: sub.active !== false,
          });
        } catch {}
      }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);

  // Sort by date, newest first
  subscribers.sort((a, b) => (b.subscribed || "").localeCompare(a.subscribed || ""));

  return new Response(JSON.stringify({ ok: true, subscribers, total: subscribers.length }), { status: 200, headers });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
