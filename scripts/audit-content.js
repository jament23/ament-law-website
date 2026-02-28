#!/usr/bin/env node

/**
 * Content Accuracy Audit for Ament Law Group Website
 *
 * Scans all site content for legal references (statutory citations, dollar
 * amounts, tax rates, filing fees, deadlines, procedural details) and sends
 * each page to the Claude API for accuracy review.
 *
 * Outputs a Markdown report of flagged items for attorney review.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node scripts/audit-content.js
 *   npm run audit-content              (if ANTHROPIC_API_KEY is set)
 *
 * Options:
 *   --output=<path>    Write report to file (default: stdout)
 *   --model=<model>    Claude model to use (default: claude-sonnet-4-6)
 *   --verbose          Print progress to stderr
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONTENT_DIRS = [
  { dir: "practice-areas", globs: ["*.njk"] },
  { dir: "blog/posts", globs: ["*.md"] },
  { dir: ".", globs: ["faq.njk", "how-we-help.njk", "about.njk", "resources.njk"] },
  { dir: "areas-we-serve", globs: ["*.njk"] },
  { dir: "how-we-help", globs: ["*.njk"] },
];

const SYSTEM_PROMPT = `You are a legal content accuracy reviewer for a Pennsylvania law firm website (Ament Law Group, P.C., Murrysville, PA). Your job is to identify content that may be outdated, incorrect, or stale.

For each page you review, check for:

1. **Statutory citations** — Are section numbers correct? Has the statute been amended, repealed, or renumbered? (e.g., 20 Pa.C.S. § 2102, 68 Pa.C.S. § 7301)
2. **Dollar thresholds** — Are amounts current? (e.g., spousal share amounts, small estate limits, gift tax exclusions, filing fees)
3. **Tax rates** — Are PA inheritance tax rates, transfer tax rates, and federal estate/gift tax rates correct?
4. **Filing fees** — Are court fees, Department of State fees, and other government fees current?
5. **Deadlines and time periods** — Are filing deadlines, look-back periods, and discount periods accurate?
6. **Procedural details** — Have court procedures, filing requirements, or administrative processes changed?
7. **Time-sensitive language** — Phrases like "as of 2025", "new for 2026", "currently", "recently" that may become stale
8. **Outdated references** — References to laws, programs, or organizations that may have changed

IMPORTANT GUIDELINES:
- Only flag items where you have reasonable confidence something may be wrong or outdated
- For each flagged item, explain WHY you think it may be incorrect and what the current law/rate/amount may be
- If you are uncertain, say so — this report goes to attorneys for review, not directly to the public
- Do NOT flag general legal principles that are unlikely to change (e.g., "probate is administered through the Register of Wills")
- Do NOT flag stylistic or grammatical issues — focus only on factual accuracy
- If the page has no issues, say so briefly

Respond in this exact JSON format:
{
  "issues": [
    {
      "severity": "high|medium|low",
      "category": "statute|amount|rate|fee|deadline|procedure|stale-language|other",
      "text": "The exact text from the page that may be incorrect",
      "concern": "Why this may be wrong and what the correct information may be",
      "line_hint": "Brief description of where this appears on the page"
    }
  ],
  "summary": "One sentence summary: either 'No issues found' or a brief count of what was flagged"
}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = { verbose: false, output: null, model: "claude-sonnet-4-6" };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--verbose") args.verbose = true;
    else if (arg.startsWith("--output=")) args.output = arg.split("=")[1];
    else if (arg.startsWith("--model=")) args.model = arg.split("=")[1];
  }
  return args;
}

function log(msg) {
  if (parseArgs().verbose) process.stderr.write(msg + "\n");
}

function findFiles(baseDir, dir, globs) {
  const fullDir = path.join(baseDir, dir);
  if (!fs.existsSync(fullDir)) return [];

  const files = [];
  for (const glob of globs) {
    // Simple glob: if it starts with *, match extension; otherwise exact match
    const entries = fs.readdirSync(fullDir);
    for (const entry of entries) {
      if (entry.startsWith("_") || entry.startsWith(".")) continue;
      if (entry === "README.md" || entry === "_TEMPLATE.md") continue;

      const ext = path.extname(entry);
      if (glob.startsWith("*")) {
        if (ext === glob.slice(1)) files.push(path.join(fullDir, entry));
      } else {
        if (entry === glob) files.push(path.join(fullDir, entry));
      }
    }
  }
  return files.sort();
}

function stripFrontMatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : content;
}

function stripHtmlTags(content) {
  return content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // remove script blocks
    .replace(/<[^>]+>/g, " ") // strip HTML tags
    .replace(/\{%[\s\S]*?%\}/g, "") // strip Nunjucks tags
    .replace(/\{\{[\s\S]*?\}\}/g, "") // strip Nunjucks expressions
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

function getPageSlug(filePath, baseDir) {
  return path.relative(baseDir, filePath);
}

// ---------------------------------------------------------------------------
// Claude API
// ---------------------------------------------------------------------------

async function callClaude(apiKey, model, pageSlug, pageContent) {
  const body = JSON.stringify({
    model: model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Review the following page from ament.law for factual accuracy.\n\n**Page:** ${pageSlug}\n\n---\n\n${pageContent}`,
      },
    ],
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  // Extract JSON from response (handle markdown code fences)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  try {
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    return { issues: [], summary: `Parse error — raw response: ${text.slice(0, 200)}` };
  }
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function generateReport(results, dateStr) {
  const lines = [];
  lines.push("# Content Accuracy Audit Report");
  lines.push("");
  lines.push(`**Generated:** ${dateStr}`);
  lines.push(`**Site:** ament.law (Ament Law Group, P.C.)`);
  lines.push("");

  // Summary counts
  let totalHigh = 0;
  let totalMedium = 0;
  let totalLow = 0;
  let cleanPages = 0;

  for (const result of results) {
    for (const issue of result.issues) {
      if (issue.severity === "high") totalHigh++;
      else if (issue.severity === "medium") totalMedium++;
      else totalLow++;
    }
    if (result.issues.length === 0) cleanPages++;
  }

  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Pages audited:** ${results.length}`);
  lines.push(`- **Pages with no issues:** ${cleanPages}`);
  lines.push(`- **High severity:** ${totalHigh}`);
  lines.push(`- **Medium severity:** ${totalMedium}`);
  lines.push(`- **Low severity:** ${totalLow}`);
  lines.push("");

  if (totalHigh + totalMedium + totalLow === 0) {
    lines.push("No issues found across any audited pages.");
    lines.push("");
    return lines.join("\n");
  }

  // High severity first, then medium, then low
  for (const severity of ["high", "medium", "low"]) {
    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    const pagesWithIssues = results.filter((r) =>
      r.issues.some((i) => i.severity === severity)
    );
    if (pagesWithIssues.length === 0) continue;

    lines.push(`## ${label} Severity`);
    lines.push("");

    for (const result of pagesWithIssues) {
      const issues = result.issues.filter((i) => i.severity === severity);
      if (issues.length === 0) continue;

      lines.push(`### ${result.page}`);
      lines.push("");
      for (const issue of issues) {
        lines.push(`- **[${issue.category}]** ${issue.concern}`);
        lines.push(`  - *Text:* "${issue.text}"`);
        if (issue.line_hint) lines.push(`  - *Location:* ${issue.line_hint}`);
        lines.push("");
      }
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(
    "*This report was generated by an AI content auditor. All flagged items should be reviewed by a licensed attorney before any changes are made to the website.*"
  );
  lines.push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error(
      "Error: ANTHROPIC_API_KEY environment variable is required.\n" +
        "Set it before running: ANTHROPIC_API_KEY=sk-... node scripts/audit-content.js"
    );
    process.exit(1);
  }

  const baseDir = path.resolve(__dirname, "..");

  // Collect all content files
  const allFiles = [];
  for (const { dir, globs } of CONTENT_DIRS) {
    allFiles.push(...findFiles(baseDir, dir, globs));
  }

  if (allFiles.length === 0) {
    console.error("No content files found.");
    process.exit(1);
  }

  process.stderr.write(`Auditing ${allFiles.length} pages...\n`);

  const results = [];

  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i];
    const slug = getPageSlug(filePath, baseDir);

    process.stderr.write(`  [${i + 1}/${allFiles.length}] ${slug}...`);

    const raw = fs.readFileSync(filePath, "utf-8");
    const body = stripFrontMatter(raw);
    const cleaned = stripHtmlTags(body);

    // Skip very short pages (likely just a redirect or layout-only)
    if (cleaned.length < 100) {
      process.stderr.write(" (skipped — too short)\n");
      continue;
    }

    try {
      const result = await callClaude(apiKey, args.model, slug, cleaned);
      results.push({ page: slug, issues: result.issues || [], summary: result.summary });
      const issueCount = (result.issues || []).length;
      process.stderr.write(
        issueCount > 0 ? ` ${issueCount} issue(s) found\n` : " clean\n"
      );
    } catch (err) {
      process.stderr.write(` ERROR: ${err.message}\n`);
      results.push({ page: slug, issues: [], summary: `Error: ${err.message}` });
    }

    // Rate limit: wait between requests to stay within API limits
    if (i < allFiles.length - 1) {
      await sleep(1000);
    }
  }

  // Generate report
  const dateStr = new Date().toISOString().split("T")[0];
  const report = generateReport(results, dateStr);

  if (args.output) {
    const outputPath = path.resolve(args.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, report);
    process.stderr.write(`\nReport written to: ${outputPath}\n`);
  } else {
    process.stdout.write(report);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
