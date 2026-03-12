/**
 * Ament Law Group — Attorney Message Relay
 * Cloudflare Pages Function at /api/attorney-message
 *
 * Routes messages to attorneys by slug without exposing email addresses.
 * The mapping is server-side only — never sent to the browser.
 *
 * Required env: RESEND_API_KEY
 * Optional env: ATTY_EMAIL_JOHN, ATTY_EMAIL_ROBERT, ATTY_EMAIL_LAURA, ATTY_EMAIL_PATRICK
 *   (If not set, falls back to FIRM_EMAIL / hello@ament.law)
 */

const ALLOWED_ORIGINS = [
  "https://www.ament.law",
  "https://ament.law",
  "https://ament-law-website.pages.dev",
];

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Attorney slug → env var key mapping
const ATTORNEY_MAP = {
  "john-ament":      "ATTY_EMAIL_JOHN",
  "robert-ament":    "ATTY_EMAIL_ROBERT",
  "laura-cohen":     "ATTY_EMAIL_LAURA",
  "patrick-shannon": "ATTY_EMAIL_PATRICK",
};

const ATTORNEY_NAMES = {
  "john-ament":      "John W. Ament, Esq.",
  "robert-ament":    "W. Robert Ament, Esq.",
  "laura-cohen":     "Laura Cohen, Esq.",
  "patrick-shannon": "Patrick J. Shannon, Esq.",
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    (origin && origin.endsWith(".ament-law-website.pages.dev")) ||
    (origin && origin.startsWith("http://localhost"));

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503, headers });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const { attorney, name, email, message } = body;

  if (!attorney || !name || !email || !message) {
    return new Response(JSON.stringify({ error: "All fields required" }), { status: 400, headers });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers });
  }

  // Resolve attorney email — falls back to firm email
  const envKey = ATTORNEY_MAP[attorney];
  const attyEmail = (envKey && env[envKey]) || env.FIRM_EMAIL || "hello@ament.law";
  const attyName = ATTORNEY_NAMES[attorney] || "Attorney";
  const firmEmail = env.FIRM_EMAIL || "hello@ament.law";
  const fromAddr = env.EMAIL_FROM || "Ament Law Group <hello@ament.law>";
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const html = `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
      <tr><td style="background:#0a1530;padding:16px 24px;">
        <h2 style="margin:0;color:#fff;font-size:16px;">Website Message for ${esc(attyName)}</h2>
      </td></tr>
      <tr><td style="padding:20px 24px;">
        <table width="100%" style="border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;width:80px;">From:</td><td style="padding:6px 0;font-weight:600;">${esc(name)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Email:</td><td style="padding:6px 0;"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Sent:</td><td style="padding:6px 0;">${timestamp}</td></tr>
        </table>
        <div style="margin-top:16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
          <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap;">${esc(message)}</p>
        </div>
        <p style="margin-top:16px;font-size:13px;color:#6b7280;">You can reply directly to this email to respond to ${esc(name)}.</p>
      </td></tr>
      <tr><td style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Sent from the attorney profile page at www.ament.law</p>
      </td></tr>
    </table>`;

  try {
    const recipients = [attyEmail];
    // Also CC firm email if attorney email is different
    if (attyEmail !== firmEmail) {
      recipients.push(firmEmail);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddr,
        to: recipients,
        subject: `Website Message: ${name} → ${attyName}`,
        html: html,
        reply_to: email,
      }),
    });

    if (!res.ok) {
      console.error("Resend error:", res.status, await res.text());
      return new Response(JSON.stringify({ error: "Failed to send" }), { status: 502, headers });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (err) {
    console.error("Attorney message error:", err);
    return new Response(JSON.stringify({ error: "Service error" }), { status: 502, headers });
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    (origin && origin.endsWith(".ament-law-website.pages.dev")) ||
    (origin && origin.startsWith("http://localhost"));
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
