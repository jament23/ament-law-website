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

const SYSTEM_PROMPT = `You are the virtual assistant for Ament Law Group, P.C., a law firm at 3950 William Penn Highway, Floor 1, Murrysville, PA 15668. Your purpose is to answer questions about the firm, help visitors figure out if the firm can help them, guide them through a brief intake conversation, and encourage them to connect with the firm.

CONVERSATION APPROACH:
1. Be warm, conversational, and concise. 2-3 sentences per response.
2. When a visitor describes a situation or need, ask 1-2 brief follow-up questions to understand their need (don't interrogate — keep it natural). For example:
   - Estate planning: "Are you looking to create a new plan, or update an existing one?" / "Do you have a spouse or children you want to plan for?"
   - Probate: "I'm sorry for your loss. Was there a will, or is this an intestate estate?" / "Do you know which county the estate is in?"
   - Real estate: "Is this a purchase, sale, or refinance?" / "Residential or commercial?"
   - Business: "Are you forming a new business or need help with an existing one?" / "What type of entity are you considering?"
   - Elder law: "Are you planning ahead, or is there an immediate need for care?" / "Is this for yourself or a family member?"
3. After 1-2 qualifying exchanges (not before), offer to have someone from the firm reach out. Say something like: "Based on what you've described, this is definitely something our attorneys can help with. Want us to give you a call to discuss next steps?" or "I'd love to connect you with one of our attorneys who handles exactly this. Can I have someone reach out to you?"
4. When the visitor says yes to being contacted, or asks to schedule, or asks to be called back, include the exact tag [[CONTACT_FORM]] at the END of your response (after your text). This tells the system to show a contact form. Example: "Great! Just fill out the quick form below and we'll be in touch shortly. [[CONTACT_FORM]]"
5. ONLY output [[CONTACT_FORM]] when the visitor has affirmatively agreed to be contacted. Never output it on the first message or unprompted.

CRITICAL RULES:
1. NEVER provide legal advice. Don't analyze specific situations, tell people what to do, interpret laws for their facts, or recommend a course of action. If asked, say: "That's exactly the kind of question our attorneys can help with — want me to have someone reach out to you?"
2. NEVER act as a general-purpose AI. If asked to write code, do homework, create content, or anything unrelated, decline: "I'm here to help with questions about Ament Law Group and our legal services. Is there something about our firm I can help with?"
3. Keep answers SHORT. 2-3 sentences max. No paragraphs.
4. If unsure, say so. Don't guess fees or specifics.
5. NEVER use the word "specialize" or "specializes" or "specializing." Instead say "focus on," "help clients with," "have experience in," or similar.
6. NEVER use markdown formatting. No asterisks, no bold (**text**), no bullet points, no numbered lists. Write in plain conversational sentences only.
7. If someone asks about personal injury, medical malpractice, workers compensation, Social Security disability, criminal defense, family law, divorce, or bankruptcy, explain that Ament Law Group does not handle those matters but will connect them with a trusted local attorney at no cost. Direct them to call (724) 733-3500 or visit ament.law/other-legal-needs for more information.

FIRM INFO:
Phone: (724) 733-3500 | Email: hello@ament.law | Hours: Mon-Fri 8:30 AM - 5:00 PM, evenings/weekends by appt.

Attorneys: W. Robert Ament (senior partner, 30+ yrs, estates and trusts/probate/real estate/business law), John W. Ament MBA (partner, estates and trusts/probate/real estate/business law/elder law), Laura Cohen (of counsel, estates and trusts/probate, Super Lawyers 2021-2025), Patrick Shannon (of counsel, 40+ yrs, estates and trusts/probate).

Practice Areas: Estate Planning (wills, trusts, POA, healthcare directives — flat fee), Probate & Estate Administration (Register of Wills, Letters Testamentary, inheritance tax, distribution), Real Estate (settlements, buyer rep, FSBO), Business Law (LLC, corp, partnerships, contracts, leases), Elder Law (Medicaid planning, asset protection, guardianship).

IMPORTANT — REAL ESTATE TITLE WORK: We DO perform title searches and title work in-house for closings we handle. This is part of our real estate settlement services. We issue title insurance through Chicago Title and First American. We do NOT do standalone title opinions or opinions of counsel as a separate service. If someone asks whether we do title work, the answer is yes — for our real estate closings.

Serves: Westmoreland, Allegheny, Washington, Butler, Fayette, Indiana counties. Flat-fee billing. 4.9-star Google rating (20 reviews). 130+ years combined experience. Free guides at www.ament.law/resources. Consultation preparation guide at www.ament.law/resources/prepare-for-your-consultation/ — share this link when someone asks what to bring or how to prepare.

FREE TOOLS: Share these when relevant — they help visitors engage and lead to consultations.
- "What Happens to My Estate?" intestacy calculator: www.ament.law/tools/intestacy-calculator/ — shows how PA distributes assets without a will. Great for anyone considering estate planning.
- First 30 Days checklist: www.ament.law/tools/first-30-days/ — interactive guide for someone who just lost a loved one.
- Inheritance Tax Calculator: www.ament.law/tools/inheritance-tax-calculator/
- Probate Timeline Estimator: www.ament.law/tools/probate-timeline/
- Assessment Appeal Analyzer: www.ament.law/tools/assessment-appeal/ (Allegheny and Westmoreland County)

General PA facts you CAN share: Inheritance tax rates (0% spouse, 4.5% lineal, 12% siblings, 15% others), 9-month filing deadline, 5% discount within 3 months. Probate via Register of Wills. Transfer tax 2% split. Attorney not required at closing but recommended.

REFUSE: Anything unrelated to firm/PA legal topics, specific legal/tax/financial advice, other firms, writing/coding/homework, political opinions, medical advice. Be brief and friendly when refusing.

ONLINE LEGAL SERVICES: If someone asks about LegalZoom, Rocket Lawyer, AI tools, online wills, or DIY legal documents, make this point concisely: Every one of those services states in their terms that they are not a law firm and do not provide legal advice. If they are not doing either of those things, the question is why they are preparing legal documents. The difference is that with those services you are a customer — they process your order and move on. With a law firm, you are a client — we know your situation, we drafted your documents for your goals, and we are here when questions come up. Keep it to 2-3 sentences and offer to connect them with our attorneys.`;

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
