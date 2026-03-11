/**
 * Ament Law Group — Newsletter Subscribe
 * Cloudflare Pages Function at /api/newsletter-subscribe
 *
 * Stores subscriber in KV, sends welcome email via Resend,
 * notifies firm of new subscriber.
 *
 * Required env: RESEND_API_KEY
 * Required KV binding: NEWSLETTER (create in Cloudflare Dashboard)
 */

const ALLOWED_ORIGINS = [
  "https://www.ament.law",
  "https://ament.law",
  "https://ament-law-website.pages.dev",
];

function cors(origin) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    (origin && origin.endsWith(".ament-law-website.pages.dev")) ||
    (origin && origin.startsWith("http://localhost"));
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin") || "";
  const headers = { ...cors(origin), "Content-Type": "application/json" };

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Valid email required" }), { status: 400, headers });
  }

  // Store in KV
  const kv = env.NEWSLETTER;
  if (kv) {
    const existing = await kv.get(`sub:${email}`);
    if (existing) {
      return new Response(JSON.stringify({ ok: true, already: true }), { status: 200, headers });
    }
    await kv.put(`sub:${email}`, JSON.stringify({
      email,
      subscribed: new Date().toISOString(),
      active: true,
    }));
  }

  // Send welcome email
  const apiKey = env.RESEND_API_KEY;
  if (apiKey) {
    const fromAddr = env.EMAIL_FROM || "Ament Law Group <hello@ament.law>";
    const firmEmail = env.FIRM_EMAIL || "hello@ament.law";

    // Welcome email to subscriber
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddr,
          to: [email],
          subject: "Welcome to the Ament Law Group Newsletter",
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
            <div style="border-bottom:2px solid #c8a862;padding:16px 0;margin-bottom:20px;">
              <strong style="color:#0a1530;font-size:15px;">AMENT LAW GROUP, P.C.</strong>
            </div>
            <p style="font-size:15px;line-height:1.7;">Thank you for subscribing to our newsletter. You'll receive quarterly updates on Pennsylvania law changes, estate planning insights, and practical tips for protecting your family and assets.</p>
            <p style="font-size:15px;line-height:1.7;">In the meantime, you might find these resources helpful:</p>
            <ul style="font-size:14px;line-height:2;">
              <li><a href="https://www.ament.law/resources/" style="color:#0a1530;">Free Legal Guides & Checklists</a></li>
              <li><a href="https://www.ament.law/blog/" style="color:#0a1530;">Our Blog</a></li>
              <li><a href="https://www.ament.law/faq/" style="color:#0a1530;">Frequently Asked Questions</a></li>
            </ul>
            <p style="font-size:15px;line-height:1.7;">If you have a legal question or need to schedule a consultation, call us at <a href="tel:724-733-3500" style="color:#0a1530;font-weight:600;">(724) 733-3500</a> or visit <a href="https://www.ament.law/contact/" style="color:#0a1530;">ament.law/contact</a>.</p>
            <div style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:16px;font-size:12px;color:#94a3b8;">
              <p>Ament Law Group, P.C. | 3950 William Penn Highway, Floor 1, Murrysville, PA 15668</p>
              <p><a href="https://www.ament.law/unsubscribe/?email=${encodeURIComponent(email)}" style="color:#94a3b8;">Unsubscribe</a></p>
            </div>
          </div>`,
        }),
      });
    } catch (e) {
      console.error("Welcome email failed:", e);
    }

    // Notify firm
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddr,
          to: [firmEmail],
          subject: `Newsletter Subscriber: ${email}`,
          html: `<p>New newsletter subscriber: <strong>${email}</strong></p><p>Subscribed: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}</p>`,
        }),
      });
    } catch (e) {
      console.error("Notification email failed:", e);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get("Origin") || "";
  return new Response(null, { status: 204, headers: cors(origin) });
}
