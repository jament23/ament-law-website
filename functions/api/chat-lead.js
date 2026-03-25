/**
 * Ament Law Group — Chat Lead Capture
 * Cloudflare Pages Function at /api/chat-lead
 *
 * Receives contact info + conversation summary from chat widget,
 * emails the firm via Resend.
 *
 * Required env vars: RESEND_API_KEY, FIRM_EMAIL (or defaults to jwa@ament.law)
 */

const ALLOWED_ORIGINS = [
  "https://www.ament.law",
  "https://ament.law",
  "https://ament-law-website.pages.dev",
];

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".ament-law-website.pages.dev") ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1");

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { name, phone, email, area, notes, conversation } = body;

  if (!name || !phone) {
    return new Response(JSON.stringify({ error: "Name and phone required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build conversation HTML
  let convoHtml = "";
  if (Array.isArray(conversation) && conversation.length > 0) {
    convoHtml = conversation
      .filter(m => m.role && m.content)
      .map(m => {
        const label = m.role === "user" ? "Visitor" : "AI Assistant";
        const bg = m.role === "user" ? "#f0f4ff" : "#f9fafb";
        return `<tr><td style="padding:8px 12px;background:${bg};border-bottom:1px solid #e5e7eb;"><strong>${label}:</strong> ${esc(m.content)}</td></tr>`;
      })
      .join("");
    convoHtml = `
      <tr><td style="padding:16px 24px;">
        <p style="margin:0 0 8px;font-weight:700;color:#374151;">Chat Conversation:</p>
        <table width="100%" style="border:1px solid #e5e7eb;border-radius:6px;border-collapse:collapse;font-size:13px;">
          ${convoHtml}
        </table>
      </td></tr>`;
  }

  const areaLabel = area || "Not specified";
  const firmEmail = env.FIRM_EMAIL || "jwa@ament.law";
  const fromAddr = env.EMAIL_FROM || "Ament Law Group <jwa@ament.law>";
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const html = `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
      <tr><td style="background:#0a1530;padding:16px 24px;">
        <h2 style="margin:0;color:#fff;font-size:16px;">New Lead from AI Chat Assistant</h2>
      </td></tr>
      <tr><td style="padding:20px 24px;">
        <table width="100%" style="border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;width:100px;">Name:</td><td style="padding:6px 0;font-weight:600;">${esc(name)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Phone:</td><td style="padding:6px 0;font-weight:600;">${esc(phone)}</td></tr>
          ${email ? `<tr><td style="padding:6px 0;color:#6b7280;">Email:</td><td style="padding:6px 0;">${esc(email)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#6b7280;">Area of Need:</td><td style="padding:6px 0;">${esc(areaLabel)}</td></tr>
          ${notes ? `<tr><td style="padding:6px 0;color:#6b7280;">Notes:</td><td style="padding:6px 0;">${esc(notes)}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#6b7280;">Submitted:</td><td style="padding:6px 0;">${timestamp}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Source:</td><td style="padding:6px 0;">Website AI Chat</td></tr>
        </table>
      </td></tr>
      ${convoHtml}
      <tr><td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">This lead was captured by the AI chat assistant at www.ament.law. The visitor requested a callback.</p>
      </td></tr>
    </table>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [firmEmail],
        subject: `Chat Lead: ${name} — ${areaLabel}`,
        html: html,
        reply_to: email || undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", res.status, errText);
      return new Response(JSON.stringify({ error: "Failed to send" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Lead capture error:", err);
    return new Response(JSON.stringify({ error: "Service error" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".ament-law-website.pages.dev") ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1");
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
