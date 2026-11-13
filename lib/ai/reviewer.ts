// lib/ai/reviewer.ts

// Updated to an active model ID on Groq
const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export type AIReviewResult = {
  is_incident: boolean;
  confidence: number;
  recommendation: "publish" | "review" | "reject";
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
  severity: "Low" | "Moderate" | "High" | "Critical";
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

function truncateText(text: string, maxCharacters: number) {
  if (text.length <= maxCharacters) {
    return text;
  }
  return `${text.slice(0, maxCharacters)}\n\n[ARTICLE TEXT TRUNCATED]`;
}

function cleanText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export function extractArticleText(html: string): string {
  let text = html;

  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  text = text.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ");
  text = text.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ");
  text = text.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ");
  text = text.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ");
  text = text.replace(/<\/(p|article|section|div|li|h1|h2|h3|h4|blockquote)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");

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

function buildPrompt(article: ArticleInput) {
  return `
You are the automated incident-review system for Frontier.
Frontier is a public database tracking SIGNIFICANT AI INCIDENTS.

A Frontier incident is a documented case where an AI model or AI-powered system behaved outside the intended scope, instructions, constraints, or safety boundaries of the task it was given.

ARTICLE INFORMATION:
Title: ${article.title}
Source: ${article.sourceName || "Unknown"}
Source URL: ${article.sourceUrl}
Article URL: ${article.articleUrl}
Published: ${article.publishedAt || "Unknown"}
RSS / discovery summary: ${article.summary || "No summary available"}

FULL ARTICLE TEXT:
${
  article.articleText ||
  "[The article text could not be fetched due to paywalls or access blocks. Assess using the available title and RSS summary metadata only, reducing evidence quality score accordingly.]"
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
`;
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function reviewCandidate(article: ArticleInput): Promise<AIReviewResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in your environment variables.");
  }

  const prompt = buildPrompt(article);

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an AI safety analyst evaluating news articles for significant AI incident reports.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText.slice(0, 1000)}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("Groq returned an empty response.");
  }

  let rawResult: any;

  try {
    const cleanedText = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    rawResult = JSON.parse(cleanedText);
  } catch {
    throw new Error("Groq returned invalid JSON format.");
  }

  return {
    is_incident: Boolean(rawResult.is_incident),
    confidence: Number(rawResult.confidence || 0),
    recommendation: rawResult.recommendation || "reject",
    company: normalizeNullableString(rawResult.company),
    model: normalizeNullableString(rawResult.model),
    category: rawResult.category || "Other",
    severity: rawResult.severity || "Low",
    incident_summary: normalizeNullableString(rawResult.incident_summary),
    incident_description: normalizeNullableString(rawResult.incident_description),
    intended_behavior: normalizeNullableString(rawResult.intended_behavior),
    observed_behavior: normalizeNullableString(rawResult.observed_behavior),
    scope_violation: normalizeNullableString(rawResult.scope_violation),
    evidence_summary: typeof rawResult.evidence_summary === "string" ? rawResult.evidence_summary : "",
    evidence_quality: Number(rawResult.evidence_quality || 0),
    reasoning: typeof rawResult.reasoning === "string" ? rawResult.reasoning : "",
    additional_sources: Array.isArray(rawResult.additional_sources)
      ? rawResult.additional_sources.map((source: any) => ({
          name: typeof source?.name === "string" ? source.name : "",
          url: typeof source?.url === "string" ? source.url : "",
          relevance: typeof source?.relevance === "string" ? source.relevance : "",
        }))
      : [],
  };
}