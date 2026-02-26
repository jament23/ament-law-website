/**
 * Ament Law Group — Assessment Appeal Report Emailer
 * Cloudflare Pages Function at /api/appeal-report
 *
 * Accepts a POST with the appeal analysis results + prospect contact info,
 * then sends two emails via Resend:
 *   1. A formatted HTML report to the prospect
 *   2. A lead notification to the firm
 *
 * Required environment variables (set in Cloudflare Pages → Settings → Env vars):
 *   RESEND_API_KEY  — from resend.com
 *   FIRM_EMAIL      — e.g. hello@ament.law
 *
 * Optional (falls back to defaults):
 *   EMAIL_FROM      — verified sender, e.g. "Ament Law Group <hello@ament.law>"
 */

const ALLOWED_ORIGINS = [
  "https://www.ament.law",
  "https://ament.law",
  "https://ament-law-website.pages.dev",
];

const CORS = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(n) {
  if (n == null || isNaN(n)) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return "—";
  return (n > 0 ? "+" : "") + n.toFixed(1) + "%";
}

// ── Email templates ──────────────────────────────────────────────────────────

function buildProspectEmail(d) {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const county = d.county === "westmoreland" ? "Westmoreland" : "Allegheny";
  const clr    = d.county === "westmoreland" ? "8.88%" : "50.14%";

  const varianceColor = d.variancePct > 10 ? "#991b1b" : d.variancePct < -10 ? "#1d4ed8" : "#15803d";
  const varianceBg    = d.variancePct > 10 ? "#fef2f2" : d.variancePct < -10 ? "#eff6ff" : "#f0fdf4";
  const savingsSection = d.savings > 0 ? `
    <tr>
      <td style="padding:20px 32px;background:#f0fdf4;border-top:3px solid #15803d;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#15803d;">Estimated Annual Tax Savings if Appeal Succeeds</p>
        <p style="margin:0;font-size:36px;font-weight:800;color:#15803d;">${fmt$(d.savings)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#166534;">Based on ${fmt$(d.avgComparableSale)} avg comparable sale &times; ${fmtPct(d.variancePct)} variance &times; ${d.totalMillage ? d.totalMillage.toFixed(2) : "—"} total millage</p>
      </td>
    </tr>` : `
    <tr>
      <td style="padding:20px 32px;background:#f9fafb;border-top:3px solid #d1d5db;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">Estimated Annual Tax Savings</p>
        <p style="margin:0;font-size:28px;font-weight:800;color:#6b7280;">$0 — No savings identified</p>
        <p style="margin:6px 0 0;font-size:13px;color:#9ca3af;">Your assessment appears to be in line with comparable sales.</p>
      </td>
    </tr>`;

  const compsRows = (d.comparables || []).slice(0, 8).map(c =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;">${c.address || "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:600;white-space:nowrap;">${fmt$(c.price)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;">${c.date || c.sqft || "—"}</td>
    </tr>`
  ).join("");

  const compsSection = compsRows ? `
    <tr><td style="padding:24px 32px 8px;">
      <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0f1d40;">Comparable Sales Evidence</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#0f1d40;">
            <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#fff;">Address</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#fff;">Sale Price</th>
            <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#fff;">Date / Sq. Ft.</th>
          </tr>
        </thead>
        <tbody>${compsRows}</tbody>
      </table>
    </td></tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

      <!-- Header -->
      <tr><td style="background:#0f1d40;padding:28px 32px;">
        <p style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-.01em;">Ament Law Group, P.C.</p>
        <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.65);">Assessment Appeal Analysis Report &mdash; ${county} County</p>
      </td></tr>

      <!-- Date / intro -->
      <tr><td style="padding:24px 32px 16px;">
        <p style="margin:0 0 6px;font-size:13px;color:#888;">Prepared ${date} for ${d.firstName ? d.firstName + " " + (d.lastName || "") : d.email}</p>
        ${d.address ? `<p style="margin:0;font-size:20px;font-weight:700;color:#0f1d40;">${d.address}</p>` : ""}
        ${d.municipality ? `<p style="margin:4px 0 0;font-size:13px;color:#666;">${d.municipality}</p>` : ""}
      </td></tr>

      <!-- Key metrics -->
      <tr><td style="padding:0 32px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding-right:8px;">
              <div style="background:#f5f7fd;border:1px solid #c7d2fe;border-radius:8px;padding:16px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#888;">Current Assessment</p>
                <p style="margin:0;font-size:26px;font-weight:800;color:#0f1d40;">${fmt$(d.currentAssessment)}</p>
              </div>
            </td>
            <td width="50%" style="padding-left:8px;">
              <div style="background:#f5f7fd;border:1px solid #c7d2fe;border-radius:8px;padding:16px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#888;">Implied Market Value</p>
                <p style="margin:0;font-size:26px;font-weight:800;color:#0f1d40;">${fmt$(d.impliedValue)}</p>
                <p style="margin:3px 0 0;font-size:11px;color:#888;">At ${clr} CLR</p>
              </div>
            </td>
          </tr>
          <tr><td colspan="2" style="padding-top:12px;">
            <div style="background:${varianceBg};border-radius:8px;padding:14px 16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${varianceColor};">Value Variance vs. Comparable Sales</p>
              <p style="margin:0;font-size:28px;font-weight:800;color:${varianceColor};">${fmtPct(d.variancePct)}</p>
              ${d.avgComparableSale ? `<p style="margin:3px 0 0;font-size:12px;color:${varianceColor};">Avg comparable sale: ${fmt$(d.avgComparableSale)}</p>` : ""}
            </div>
          </td></tr>
        </table>
      </td></tr>

      <!-- Savings -->
      ${savingsSection}

      <!-- Comps -->
      ${compsSection}

      <!-- CTA -->
      <tr><td style="padding:28px 32px;background:#0f1d40;">
        <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#fff;">Ready to move forward?</p>
        <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,.75);line-height:1.6;">Our attorneys represent property owners in ${county} County assessment appeals. We'll review your specific situation and let you know whether an appeal makes sense.</p>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#fff;border-radius:7px;padding:0;"><a href="https://www.ament.law/contact/" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:#0f1d40;text-decoration:none;">Schedule a Consultation</a></td>
          <td style="padding-left:12px;"><a href="tel:724-733-3500" style="font-size:14px;color:rgba(255,255,255,.85);text-decoration:none;">(724) 733-3500</a></td>
        </tr></table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:20px 32px;border-top:1px solid #eee;">
        <p style="margin:0;font-size:11px;color:#bbb;line-height:1.6;">
          Ament Law Group, P.C. &bull; 3950 William Penn Highway, Floor 1, Murrysville, PA 15668 &bull; (724) 733-3500<br>
          This report is for informational purposes only and does not constitute legal advice. The ${clr} CLR is the 2026 ${county} County Common Level Ratio. Tax estimates are approximations. Actual appeal outcomes vary. Consult an attorney before filing.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildLeadEmail(d) {
  const date = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
  const county = d.county === "westmoreland" ? "Westmoreland" : "Allegheny";

  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;max-width:560px;margin:0 auto;padding:24px;">
<div style="background:#0f1d40;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0;">
  <strong style="font-size:16px;">&#128188; New Appeal Report Lead</strong>
  <span style="font-size:13px;opacity:.7;margin-left:10px;">${date}</span>
</div>
<div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:20px 24px;">

  <table width="100%" style="font-size:14px;border-collapse:collapse;">
    <tr><td style="padding:5px 0;color:#888;width:160px;">Name</td><td style="padding:5px 0;font-weight:600;">${(d.firstName || "") + " " + (d.lastName || "") || "—"}</td></tr>
    <tr><td style="padding:5px 0;color:#888;">Email</td><td style="padding:5px 0;"><a href="mailto:${d.email}" style="color:#0f1d40;">${d.email}</a></td></tr>
    <tr><td style="padding:5px 0;color:#888;">County</td><td style="padding:5px 0;">${county}</td></tr>
    ${d.address ? `<tr><td style="padding:5px 0;color:#888;">Property</td><td style="padding:5px 0;font-weight:600;">${d.address}</td></tr>` : ""}
    ${d.municipality ? `<tr><td style="padding:5px 0;color:#888;">Municipality</td><td style="padding:5px 0;">${d.municipality}</td></tr>` : ""}
    <tr><td style="padding:5px 0;color:#888;">Current Assessment</td><td style="padding:5px 0;">${fmt$(d.currentAssessment)}</td></tr>
    <tr><td style="padding:5px 0;color:#888;">Implied Value</td><td style="padding:5px 0;">${fmt$(d.impliedValue)}</td></tr>
    <tr><td style="padding:5px 0;color:#888;">Avg Comp Sale</td><td style="padding:5px 0;">${fmt$(d.avgComparableSale)}</td></tr>
    <tr><td style="padding:5px 0;color:#888;">Variance</td><td style="padding:5px 0;font-weight:700;color:${d.variancePct > 10 ? "#991b1b" : "#15803d"};">${fmtPct(d.variancePct)}</td></tr>
    ${d.savings > 0 ? `<tr><td style="padding:5px 0;color:#888;">Est. Savings</td><td style="padding:5px 0;font-weight:700;color:#15803d;">${fmt$(d.savings)}</td></tr>` : ""}
  </table>

  <div style="margin-top:20px;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;font-size:13px;color:#15803d;">
    This prospect emailed themselves an appeal report from ament.law/assessment-appeal/
  </div>
</div>
</body></html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = request.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin)
    || origin.endsWith(".ament-law-website.pages.dev")
    || origin.startsWith("http://localhost")
    || origin.startsWith("http://127.0.0.1");

  const corsHeaders = {
    ...CORS,
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
  };

  if (!isAllowed && !origin.startsWith("http://localhost")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey   = env.RESEND_API_KEY;
  const firmEmail = env.FIRM_EMAIL || "hello@ament.law";
  const fromAddr  = env.EMAIL_FROM || "Ament Law Group <hello@ament.law>";

  if (!apiKey) {
    console.error("RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body;
  try { body = await request.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate email
  const { email, firstName, lastName, ...reportData } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Valid email address required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const d = { email, firstName, lastName, ...reportData };
  const county = d.county === "westmoreland" ? "Westmoreland" : "Allegheny";
  const prospectName = [firstName, lastName].filter(Boolean).join(" ") || null;

  // Send to prospect
  const prospectPayload = {
    from: fromAddr,
    to: [email],
    subject: `Your ${county} County Assessment Appeal Report — Ament Law Group`,
    html: buildProspectEmail(d),
  };

  // Lead notification to firm
  const leadPayload = {
    from: fromAddr,
    to: [firmEmail],
    subject: `Appeal report lead: ${prospectName || email}${d.address ? " — " + d.address : ""}`,
    html: buildLeadEmail(d),
    reply_to: email,
  };

  try {
    const [r1, r2] = await Promise.all([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(prospectPayload),
      }),
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(leadPayload),
      }),
    ]);

    if (!r1.ok) {
      const err = await r1.text();
      console.error("Resend prospect error:", r1.status, err);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  } catch (err) {
    console.error("Appeal report proxy error:", err);
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS, "Access-Control-Allow-Origin": "*" },
  });
}
