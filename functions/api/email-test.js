/**
 * Ament Law Group — Email Diagnostics
 * Cloudflare Pages Function at /api/email-test
 *
 * Tests the Resend configuration. Hit this URL in a browser to see what's working.
 * Should be removed after debugging.
 */

export async function onRequestGet(context) {
  const { env } = context;
  const headers = { "Content-Type": "application/json" };

  const checks = {
    RESEND_API_KEY: env.RESEND_API_KEY ? "SET (" + env.RESEND_API_KEY.substring(0, 6) + "...)" : "NOT SET",
    FIRM_EMAIL: env.FIRM_EMAIL || "NOT SET (will default to jwa@ament.law)",
    EMAIL_FROM: env.EMAIL_FROM || "NOT SET (will default to 'Ament Law Group <jwa@ament.law>')",
  };

  // Try sending a test email
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ checks, error: "No API key" }, null, 2), { headers });
  }

  const firmEmail = env.FIRM_EMAIL || "jwa@ament.law";
  const fromAddr = env.EMAIL_FROM || "Ament Law Group <jwa@ament.law>";

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
        subject: "Email Test — Ament Law Website",
        html: "<p>This is a test email from the Ament Law website diagnostic endpoint. If you received this, email sending is working correctly.</p><p>Sent: " + new Date().toISOString() + "</p>",
      }),
    });

    const resBody = await res.text();
    checks.resend_status = res.status;
    checks.resend_response = resBody;
    checks.test_from = fromAddr;
    checks.test_to = firmEmail;

    if (res.ok) {
      checks.result = "SUCCESS — Check your inbox at " + firmEmail;
    } else {
      checks.result = "FAILED — See resend_response for details";
    }
  } catch (err) {
    checks.result = "ERROR: " + err.message;
  }

  return new Response(JSON.stringify(checks, null, 2), { headers });
}
