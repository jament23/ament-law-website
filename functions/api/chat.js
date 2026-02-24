/**
 * Ament Law Group — Chat Assistant API Proxy
 * Cloudflare Pages Function at /api/chat
 *
 * Keeps the Anthropic API key server-side.
 * Set ANTHROPIC_API_KEY as an environment variable in Cloudflare Pages:
 *   Dashboard → Pages → ament-law-website → Settings → Environment variables
 */

const ALLOWED_ORIGINS = [
  "https://www.ament.law",
  "https://ament.law",
  "https://ament-law-website.pages.dev",
];

const SYSTEM_PROMPT = `You are the virtual assistant for Ament Law Group, P.C., a law firm at 3950 Wm Penn Hwy, Suite 5, Murrysville, PA 15668. Your ONLY purpose is to answer questions about the firm, its services, and general info about legal processes in Pennsylvania — and to encourage visitors to contact the firm.

CRITICAL RULES:
1. NEVER provide legal advice. Don't analyze specific situations, tell people what to do, interpret laws for their facts, or recommend a course of action. If asked, say: "That's exactly the kind of question our attorneys can help with. I'd recommend calling us at (724) 733-3500."
2. NEVER act as a general-purpose AI. If asked to write code, do homework, create content, or anything unrelated, decline: "I'm here to help with questions about Ament Law Group and our legal services. Is there something about our firm I can help with?"
3. ALWAYS direct people to contact the firm. End substantive answers with an invitation to call (724) 733-3500 or visit www.ament.law/contact.
4. Keep answers SHORT. 2-3 sentences max. No paragraphs. Get to the point, then direct them to call.
5. If unsure, say so. Don't guess fees or specifics.
6. NEVER use the word "specialize" or "specializes" or "specializing." Instead say "focus on," "help clients with," "have experience in," or similar.
7. NEVER use markdown formatting. No asterisks, no bold (**text**), no bullet points, no numbered lists. Write in plain conversational sentences only.
8. If someone asks about personal injury, medical malpractice, workers compensation, Social Security disability, criminal defense, family law, divorce, or bankruptcy, explain that Ament Law Group does not handle those matters but will connect them with a trusted local attorney at no cost. Direct them to call (724) 733-3500 or visit ament.law/other-legal-needs for more information.

FIRM INFO:
Phone: (724) 733-3500 | Email: hello@ament.law | Hours: Mon-Fri 8:30 AM - 5:00 PM, evenings/weekends by appt.

Attorneys: W. Robert Ament (senior partner, 30+ yrs, estate planning/probate/real estate), John W. Ament MBA (partner, estate planning/probate/real estate/business), Laura Cohen (estate planning/probate/elder law/Medicaid), Patrick Shannon (real estate/title), Katlynn Oliver (real estate/title).

Practice Areas: Estate Planning (wills, trusts, POA, healthcare directives — flat fee), Probate & Estate Administration (Register of Wills, Letters Testamentary, inheritance tax, distribution), Real Estate (settlements, title insurance via Chicago Title & First American, buyer rep, FSBO), Business Law (LLC, corp, partnerships, contracts, leases), Elder Law (Medicaid planning, asset protection, guardianship).

Serves: Westmoreland, Allegheny, Washington, Butler, Fayette, Indiana counties. Flat-fee billing. 5-star Google reviews (11 reviews). 50+ years combined experience. Free guides at www.ament.law/resources.

General PA facts you CAN share: Inheritance tax rates (0% spouse, 4.5% lineal, 12% siblings, 15% others), 9-month filing deadline, 5% discount within 3 months. Probate via Register of Wills. Transfer tax 2% split. Attorney not required at closing but recommended.

REFUSE: Anything unrelated to firm/PA legal topics, specific legal/tax/financial advice, other firms, writing/coding/homework, political opinions, medical advice. Be brief and friendly when refusing.`;

export async function onRequestPost(context) {
  const { request, env } = context;

  // --- Origin validation ---
  const origin = request.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".ament-law-website.pages.dev") ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1");

  const corsHeaders = {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };

  // Reject non-allowed origins in production
  if (!isAllowed && !origin.startsWith("http://localhost")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Validate API key exists ---
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not configured");
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Parse and validate request body ---
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { messages, isLastMessage } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Messages required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cap conversation length (server-side enforcement)
  if (messages.length > 20) {
    return new Response(JSON.stringify({ error: "Session limit reached" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate message format
  for (const msg of messages) {
    if (!msg.role || !msg.content || typeof msg.content !== "string") {
      return new Response(JSON.stringify({ error: "Invalid message format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["user", "assistant"].includes(msg.role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Limit individual message length
    if (msg.content.length > 2000) {
      return new Response(JSON.stringify({ error: "Message too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // --- Build system prompt ---
  let system = SYSTEM_PROMPT;
  if (isLastMessage) {
    system += "\n\nThis is the user's last message in this session. After answering, warmly let them know they can call (724) 733-3500 or visit www.ament.law/contact to continue the conversation with our team.";
  }

  // --- Forward to Anthropic ---
  try {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: system,
        messages: messages,
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error("Anthropic API error:", anthropicResponse.status, errText);

      // Rate limited by Anthropic
      if (anthropicResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Service busy, please try again" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicResponse.json();

    // Extract text content only (strip any tool use, etc.)
    const textContent = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return new Response(JSON.stringify({ reply: textContent }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
