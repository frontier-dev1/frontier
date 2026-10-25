const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  "llama-3.3-70b-versatile";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

export type AIReviewResult = {
  is_incident: boolean;

  confidence: number;

  recommendation:
    | "publish"
    | "review"
    | "reject";

  company: string | null;

  model: string | null;

  category:
    | "Autonomous Agent"
    | "Cybersecurity"
    | "Deception"
    | "Hallucination"
    | "Privacy"
    | "Safety"
    | "Manipulation"
    | "Unauthorized Action"
    | "Other";

  severity:
    | "Low"
    | "Moderate"
    | "High"
    | "Critical";

  incident_summary: string | null;

  incident_description: string | null;

  intended_behavior: string | null;

  observed_behavior: string | null;

  scope_violation: string | null;

  evidence_summary: string;

  evidence_quality: number;

  reasoning: string;

  additional_sources: Array<{
    name: string;
    url: string;
    relevance: string;
  }>;
};

type ArticleInput = {
  title: string;
  sourceName: string | null;
  sourceUrl: string;
  articleUrl: string;
  summary: string | null;
  publishedAt: string | null;
  articleText: string | null;
};

function truncateText(
  text: string,
  maxCharacters: number
) {
  if (text.length <= maxCharacters) {
    return text;
  }

  return `${text.slice(
    0,
    maxCharacters
  )}\n\n[ARTICLE TEXT TRUNCATED]`;
}

function cleanText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Extract readable text from an HTML document.
 */
export function extractArticleText(
  html: string
): string {
  let text = html;

  text = text.replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    " "
  );

  text = text.replace(
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    " "
  );

  text = text.replace(
    /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
    " "
  );

  text = text.replace(
    /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
    " "
  );

  text = text.replace(
    /<nav\b[^>]*>[\s\S]*?<\/nav>/gi,
    " "
  );

  text = text.replace(
    /<footer\b[^>]*>[\s\S]*?<\/footer>/gi,
    " "
  );

  text = text.replace(
    /<header\b[^>]*>[\s\S]*?<\/header>/gi,
    " "
  );

  text = text.replace(
    /<\/(p|article|section|div|li|h1|h2|h3|h4|blockquote)>/gi,
    "\n"
  );

  text = text.replace(
    /<[^>]+>/g,
    " "
  );

  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  return cleanText(text);
}

async function fetchArticleText(
  url: string
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",

      headers: {
        "User-Agent":
          "Frontier Incident Research Bot/1.0",

        Accept:
          "text/html,application/xhtml+xml",
      },

      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      console.warn(
        `Article fetch returned ${response.status}: ${url}`
      );

      return null;
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType.includes(
        "text/html"
      ) &&
      !contentType.includes(
        "application/xhtml+xml"
      )
    ) {
      return null;
    }

    const html =
      await response.text();

    const text =
      extractArticleText(html);

    if (text.length < 200) {
      return null;
    }

    return truncateText(
      text,
      50000
    );
  } catch (error) {
    console.warn(
      `Unable to fetch article ${url}:`,
      error
    );

    return null;
  }
}

function buildPrompt(
  article: ArticleInput
) {
  return `
You are the automated incident-review system for Frontier.

Frontier is a public database tracking SIGNIFICANT AI INCIDENTS.

A Frontier incident is a documented case where an AI model or AI-powered system behaved outside the intended scope, instructions, constraints, or safety boundaries of the task it was given.

Examples include:

- An AI agent taking unauthorized actions.
- An AI system accessing resources it was not supposed to access.
- A model deliberately deceiving an evaluator or operator.
- An AI agent bypassing restrictions or safeguards.
- An AI system attempting unauthorized replication, persistence, exfiltration, or escape.
- An AI system behaving unexpectedly in a real deployment or controlled experiment in a way that materially exceeded the intended task.
- A model exploiting a reward or evaluation system in an unintended way when the behavior demonstrates a meaningful scope or objective violation.

IMPORTANT:

Do NOT classify something as an incident merely because the article:

- discusses AI risk hypothetically;
- says AI "could go rogue";
- discusses future possibilities;
- reports a normal model hallucination without meaningful consequences;
- describes a benchmark without an actual behavioral violation;
- describes an ordinary cybersecurity attack against an AI company without the AI itself behaving outside its intended scope;
- is an opinion article;
- repeats an old incident without providing meaningful new information.

The distinction between:

"AI might do X"

and

"AI actually did X"

is fundamental.

You must only treat observed, documented behavior as an incident.

You must also distinguish between:

1. what the AI was instructed or intended to do;
2. what the AI actually did;
3. why the actual behavior was outside the intended scope.

Do NOT invent facts that are not supported by the supplied material.

If the article does not establish a fact, return an EMPTY STRING for that field.

Do not use the words "unknown", "not specified", or "insufficient information" as a substitute for an empty string.

EVIDENCE STANDARD:

A high-quality incident should have direct or reasonably credible evidence such as:

- research results;
- experiment logs;
- model evaluation results;
- official company reports;
- security disclosures;
- documented demonstrations;
- reputable reporting that clearly attributes claims to primary evidence.

Secondary reporting can still be relevant, but reduce evidence quality when the underlying evidence is unclear.

RECOMMENDATION:

"publish" should only be used for strong, clearly documented incidents where the article provides enough evidence to justify inclusion after a human editor checks it.

"review" should be used when the event may qualify but evidence, context, or classification is uncertain.

"reject" should be used when this is clearly not a Frontier incident.

The recommendation is NOT permission to automatically publish.

SEVERITY:

Low:
Minor or low-impact deviation with limited consequences.

Moderate:
Meaningful unintended behavior, but limited scope or impact.

High:
Serious unauthorized, deceptive, unsafe, security-related, or consequential behavior.

Critical:
Extremely consequential behavior involving major harm, significant loss of control, severe security impact, or behavior demonstrating a particularly serious failure of containment or alignment.

FRONTIER CATEGORY:

Choose the category that best describes the AI behavior itself.

ARTICLE INFORMATION:

Title:
${article.title}

Source:
${article.sourceName || "Unknown"}

Source URL:
${article.sourceUrl}

Article URL:
${article.articleUrl}

Published:
${article.publishedAt || "Unknown"}

RSS / discovery summary:
${article.summary || "No summary available"}

FULL ARTICLE TEXT:

${
  article.articleText ||
  "[The article could not be fetched. Assess using the available metadata only and reduce evidence quality accordingly.]"
}

Return ONLY valid JSON with this exact structure:

{
  "is_incident": false,
  "confidence": 0,
  "recommendation": "reject",
  "company": "",
  "model": "",
  "category": "Other",
  "severity": "Low",
  "incident_summary": "",
  "incident_description": "",
  "intended_behavior": "",
  "observed_behavior": "",
  "scope_violation": "",
  "evidence_summary": "",
  "evidence_quality": 0,
  "reasoning": "",
  "additional_sources": []
}

Field rules:

is_incident: boolean — whether the source describes a real observed AI behavioral incident.

confidence: integer 0-100 — confidence that this qualifies as a significant Frontier AI incident.

recommendation: exactly one of "publish", "review", "reject".

company: the company/organization responsible for the AI system, or "" if unknown.

model: the AI model involved, or "" if unknown.

category: exactly one of "Autonomous Agent", "Cybersecurity", "Deception", "Hallucination", "Privacy", "Safety", "Manipulation", "Unauthorized Action", "Other".

severity: exactly one of "Low", "Moderate", "High", "Critical".

incident_summary: concise summary of the documented incident, or "" if not established.

incident_description: detailed description of what the AI system actually did, or "" if not established.

intended_behavior: the intended instructions/task/behavior, or "" if not established.

observed_behavior: the observed behavior that differed from the intended behavior, or "" if not established.

scope_violation: why the observed behavior exceeded the intended scope or constraints, or "" if not established.

evidence_summary: summary of the evidence supporting or weakening the incident claim.

evidence_quality: integer 0-100.

reasoning: your reasoning for the classification and recommendation.

additional_sources: an array of objects, each with "name", "url", and "relevance" string fields — other sources that corroborate this, or an empty array.

Respond with JSON only, no other text.
`;
}

function normalizeNullableString(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

export async function reviewCandidate(
  article: ArticleInput
): Promise<AIReviewResult> {
  const apiKey =
    process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const articleText =
    article.articleText ??
    (await fetchArticleText(
      article.articleUrl
    ));

  const prompt =
    buildPrompt({
      ...article,
      articleText,
    });

  const response =
    await fetch(
      GROQ_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model: GROQ_MODEL,

          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],

          temperature: 0.1,

          response_format: {
            type: "json_object",
          },
        }),

        signal:
          AbortSignal.timeout(
            60000
          ),
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Groq API error (${response.status}): ${errorText.slice(
        0,
        1000
      )}`
    );
  }

  const payload =
    await response.json();

  const text =
    payload?.choices?.[0]
      ?.message?.content?.trim();

  if (!text) {
    throw new Error(
      "Groq returned an empty response."
    );
  }

  let rawResult: any;

  try {
    const cleanedText =
      text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    rawResult =
      JSON.parse(cleanedText);
  } catch {
    throw new Error(
      "Groq returned invalid JSON."
    );
  }

  /*
   * Convert empty strings returned by the model
   * into null values expected by our application.
   */

  const result: AIReviewResult = {
    is_incident:
      Boolean(
        rawResult.is_incident
      ),

    confidence:
      Number(
        rawResult.confidence
      ),

    recommendation:
      rawResult.recommendation,

    company:
      normalizeNullableString(
        rawResult.company
      ),

    model:
      normalizeNullableString(
        rawResult.model
      ),

    category:
      rawResult.category,

    severity:
      rawResult.severity,

    incident_summary:
      normalizeNullableString(
        rawResult.incident_summary
      ),

    incident_description:
      normalizeNullableString(
        rawResult.incident_description
      ),

    intended_behavior:
      normalizeNullableString(
        rawResult.intended_behavior
      ),

    observed_behavior:
      normalizeNullableString(
        rawResult.observed_behavior
      ),

    scope_violation:
      normalizeNullableString(
        rawResult.scope_violation
      ),

    evidence_summary:
      typeof rawResult.evidence_summary ===
      "string"
        ? rawResult.evidence_summary
        : "",

    evidence_quality:
      Number(
        rawResult.evidence_quality
      ),

    reasoning:
      typeof rawResult.reasoning ===
      "string"
        ? rawResult.reasoning
        : "",

    additional_sources:
      Array.isArray(
        rawResult.additional_sources
      )
        ? rawResult.additional_sources.map(
            (source: any) => ({
              name:
                typeof source?.name ===
                "string"
                  ? source.name
                  : "",

              url:
                typeof source?.url ===
                "string"
                  ? source.url
                  : "",

              relevance:
                typeof source?.relevance ===
                "string"
                  ? source.relevance
                  : "",
            })
          )
        : [],
  };

  return result;
}