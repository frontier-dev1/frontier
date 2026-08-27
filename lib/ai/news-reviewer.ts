import {
  GoogleGenerativeAI,
} from "@google/generative-ai";

export type NewsReviewResult = {
  is_relevant: boolean;
  relevance_score: number;

  title: string;
  summary: string;

  category: string | null;
  company: string | null;
  model: string | null;

  importance:
    | "high"
    | "medium"
    | "low";

  reasoning: string;
};

const apiKey =
  process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not configured."
  );
}

const genAI =
  new GoogleGenerativeAI(
    apiKey
  );

const model =
  genAI.getGenerativeModel({
    model:
      process.env.GEMINI_MODEL ??
      "gemini-2.5-flash-lite",
  });

export async function reviewNewsArticle({
  title,
  sourceName,
  sourceUrl,
  articleUrl,
  summary,
  articleText,
}: {
  title: string;
  sourceName: string;
  sourceUrl: string;
  articleUrl: string;
  summary: string | null;
  articleText: string | null;
}): Promise<NewsReviewResult> {

  const articleContent =
    articleText?.trim() ||
    summary?.trim() ||
    "";

  const prompt = `
You are the AI news editor for Frontier, an intelligence platform focused on artificial intelligence.

Your task is to determine whether the supplied article is important and relevant enough to appear on Frontier's public AI News page.

This is NOT an AI incident classifier.

The article does NOT need to describe an AI system going rogue, violating its intended behavior, or causing a safety incident.

Relevant news can include:

- Major AI model releases
- Significant AI product launches
- Important AI research
- AI company announcements
- Major AI funding or acquisitions
- Important AI regulation or policy
- AI security developments
- Major AI infrastructure developments
- Significant AI industry developments
- Important developments involving autonomous agents
- Major developments involving AI capabilities or limitations
- Important scientific or technical breakthroughs involving AI

Reject articles that are:

- Barely related to AI
- Generic technology news with no meaningful AI component
- Opinion pieces with little substantive information
- Duplicate/repetitive coverage with little new information
- Low-quality promotional material
- Spam
- Extremely minor updates
- Content where the supplied evidence is insufficient to determine what actually happened

SOURCE INFORMATION

Title:
${title}

Source:
${sourceName}

Source URL:
${sourceUrl}

Article URL:
${articleUrl}

RSS / metadata summary:
${summary ?? "None available"}

ARTICLE TEXT:

${articleContent || "No article text was available."}

Evaluate the article based on the evidence provided.

Return ONLY valid JSON with this exact structure:

{
  "is_relevant": true,
  "relevance_score": 0,
  "title": "",
  "summary": "",
  "category": "",
  "company": "",
  "model": "",
  "importance": "high",
  "reasoning": ""
}

Rules:

relevance_score:
0-100.

Use approximately:

90-100 = extremely important AI development
75-89 = clearly important and highly relevant
60-74 = useful/relevant AI news
40-59 = marginal
0-39 = not suitable for Frontier

is_relevant should normally be true when relevance_score >= 60.

summary:
Write a concise, factual summary suitable for a public news card.
Do not mention that you are an AI reviewer.
Do not invent facts.

category:
Use a concise category such as:
"Models"
"Research"
"Companies"
"Products"
"Agents"
"Security"
"Policy"
"Funding"
"Infrastructure"
"Industry"
or another appropriate category.

company:
Identify the primary AI company or organization involved when clearly established.
Use null when unknown.

model:
Identify a specific AI model when clearly established.
Use null when unknown.

importance:
"high", "medium", or "low".

reasoning:
Briefly explain why the article is or is not important enough for Frontier.
`;

  const result =
    await model.generateContent(
      prompt
  );

  const text =
    result.response
      .text()
      .trim();

  let parsed: NewsReviewResult;

  try {
    /*
     * Gemini occasionally wraps JSON in markdown
     * code fences. Remove them before parsing.
     */
    const cleanedText =
      text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    parsed =
      JSON.parse(cleanedText);
  } catch {
    console.error(
      "Invalid Gemini news review response:",
      text
    );

    throw new Error(
      "Gemini returned invalid JSON for the news review."
    );
  }

  /*
   * ---------------------------------------------------------
   * Validate required fields
   * ---------------------------------------------------------
   */

  if (
    typeof parsed.is_relevant !==
    "boolean"
  ) {
    throw new Error(
      "News review returned an invalid is_relevant value."
    );
  }

  if (
    typeof parsed.relevance_score !==
    "number"
  ) {
    throw new Error(
      "News review returned an invalid relevance score."
    );
  }

  /*
   * Keep the score within the expected range.
   */

  parsed.relevance_score =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          parsed.relevance_score
        )
      )
    );

  /*
   * Ensure optional fields are either strings
   * or null.
   */

  parsed.category =
    typeof parsed.category ===
    "string"
      ? parsed.category
      : null;

  parsed.company =
    typeof parsed.company ===
    "string"
      ? parsed.company
      : null;

  parsed.model =
    typeof parsed.model ===
    "string"
      ? parsed.model
      : null;

  /*
   * Make sure the public-facing fields have
   * safe fallback values.
   */

  parsed.title =
    typeof parsed.title ===
    "string" &&
    parsed.title.trim()
      ? parsed.title.trim()
      : title;

  parsed.summary =
    typeof parsed.summary ===
      "string" &&
    parsed.summary.trim()
      ? parsed.summary.trim()
      : summary ??
        "No summary available.";

  parsed.reasoning =
    typeof parsed.reasoning ===
      "string"
      ? parsed.reasoning
      : "";

  /*
   * Normalize importance.
   */

  if (
    parsed.importance !==
      "high" &&
    parsed.importance !==
      "medium" &&
    parsed.importance !==
      "low"
  ) {
    parsed.importance =
      parsed.relevance_score >= 85
        ? "high"
        : parsed.relevance_score >= 60
        ? "medium"
        : "low";
  }

  /*
   * Keep is_relevant consistent with the score.
   *
   * This prevents Gemini from returning something
   * like:
   *
   * is_relevant: false
   * relevance_score: 92
   */

  parsed.is_relevant =
    parsed.relevance_score >= 60;

  return parsed;
}