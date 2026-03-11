/**
 * Ament Law Group — Newsletter Unsubscribe
 * Cloudflare Pages Function at /api/newsletter-unsubscribe
 *
 * Marks subscriber as inactive in KV.
 * Required KV binding: NEWSLETTER
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ error: "Email required" }), { status: 400, headers });
  }

  const kv = env.NEWSLETTER;
  if (kv) {
    const existing = await kv.get(`sub:${email}`);
    if (existing) {
      const data = JSON.parse(existing);
      data.active = false;
      data.unsubscribed = new Date().toISOString();
      await kv.put(`sub:${email}`, JSON.stringify(data));
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
