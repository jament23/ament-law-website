/**
 * Ament Law Group — Newsletter Send
 * Cloudflare Pages Function at /api/newsletter-send
 *
 * Sends a newsletter to all active subscribers via Resend.
 * Protected by admin token (same GitHub token used in admin CMS).
 *
 * Required env: RESEND_API_KEY
 * Required KV binding: NEWSLETTER
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = { "Content-Type": "application/json" };

  // Auth check — require token in Authorization header
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  // Verify token against GitHub (same as admin CMS login)
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

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const { subject, html } = body;
  if (!subject || !html) {
    return new Response(JSON.stringify({ error: "Subject and html required" }), { status: 400, headers });
  }

  const kv = env.NEWSLETTER;
  const apiKey = env.RESEND_API_KEY;

  if (!kv) {
    return new Response(JSON.stringify({ error: "Newsletter storage not configured" }), { status: 503, headers });
  }
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 503, headers });
  }

  // Get all active subscribers
  const subscribers = [];
  let cursor = null;
  do {
    const list = await kv.list({ prefix: "sub:", cursor, limit: 500 });
    for (const key of list.keys) {
      const data = await kv.get(key.name);
      if (data) {
        try {
          const sub = JSON.parse(data);
          if (sub.active !== false) {
            subscribers.push(sub.email);
          }
        } catch {}
      }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);

  if (subscribers.length === 0) {
    return new Response(JSON.stringify({ error: "No active subscribers", count: 0 }), { status: 200, headers });
  }

  // Send in batches of 50 (Resend supports batch)
  const fromAddr = env.EMAIL_FROM || "Ament Law Group <hello@ament.law>";
  let sent = 0;
  let errors = 0;

  for (let i = 0; i < subscribers.length; i += 50) {
    const batch = subscribers.slice(i, i + 50);

    // Send individually (Resend BCC/batch) with unsubscribe link
    for (const email of batch) {
      const unsubLink = `https://www.ament.law/unsubscribe/?email=${encodeURIComponent(email)}`;
      const fullHtml = html +
        `<div style="border-top:1px solid #e2e8f0;margin-top:32px;padding-top:16px;font-size:12px;color:#94a3b8;text-align:center;">
          <p>Ament Law Group, P.C. | 3950 William Penn Highway, Floor 1, Murrysville, PA 15668</p>
          <p>(724) 733-3500 | <a href="https://www.ament.law" style="color:#94a3b8;">www.ament.law</a></p>
          <p><a href="${unsubLink}" style="color:#94a3b8;">Unsubscribe from this newsletter</a></p>
        </div>`;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromAddr,
            to: [email],
            subject: subject,
            html: fullHtml,
            headers: {
              "List-Unsubscribe": `<${unsubLink}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });
        if (res.ok) { sent++; } else { errors++; }
      } catch {
        errors++;
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, errors, total: subscribers.length }), { status: 200, headers });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
