/*
 * ------------------------------------------------------------
 * Semantic duplicate detection
 * ------------------------------------------------------------
 *
 * Word-overlap similarity (see duplicate-detection.ts) misses a
 * lot of real duplicates in practice: different publishers write
 * completely different headlines and summaries about the same
 * underlying event, so two articles about the exact same incident
 * can share almost no words in common. It also depends on the
 * "company" field matching exactly between two AI review calls,
 * which isn't reliable — one pass might extract "OpenAI" and
 * another "OpenAI Inc." or nothing at all, silently skipping the
 * comparison entirely.
 *
 * This asks an LLM directly: "does this new item describe the
 * same real-world event as any of these existing ones?" — which
 * is robust to different wording in a way text-similarity never
 * will be. It's only called for candidates that already cleared
 * the relevance/confidence bar and are about to be published, so
 * it adds one extra API call per *publish*, not per candidate
 * reviewed.
 */

const apiKey = process.env.GROQ_API_KEY;

const GROQ_MODEL =
  process.env.GROQ_MODEL ??
  "llama-3.3-70b-versatile";

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

export type DuplicateCandidate = {
  id: string;
  title: string;
  summary: string;
};

export type DuplicateJudgment = {
  is_duplicate: boolean;
  matching_id: string | null;
  reasoning: string;
};

export async function judgeDuplicate({
  newTitle,
  newSummary,
  candidates,
}: {
  newTitle: string;
  newSummary: string;
  candidates: DuplicateCandidate[];
}): Promise<DuplicateJudgment> {

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  if (candidates.length === 0) {
    return {
      is_duplicate: false,
      matching_id: null,
      reasoning: "Nothing to compare against.",
    };
  }

  const candidateList = candidates
    .map(
      (c, i) =>
        `[${i}] id=${c.id}\nTitle: ${c.title}\nSummary: ${c.summary}`
    )
    .join("\n\n");

  const prompt = `
You are deciding whether a NEW article describes the SAME real-world event as any EXISTING article already published on an AI news/incident tracking site.

"Same event" means: the same specific thing happened, being reported by (possibly) different outlets with different wording, different emphasis, or different levels of detail. It does NOT mean "same company" or "same general topic" — two different incidents involving the same company are NOT duplicates of each other.

Examples of DUPLICATES (same event, different wording):
- "OpenAI's AI Agent Went Rogue and Hacked a Startup" and "OpenAI Reveals Its Model Launched Unauthorized Cyberattack" — likely the same underlying disclosure, if other details (timing, target) line up.
- "Anthropic Tightens Security After Agents Misbehaved" and "Claude Agents Went Off-Script During Training, Anthropic Says" — likely the same disclosure if timing matches.

Examples of NOT DUPLICATES:
- Two different security incidents at the same company, months apart.
- A follow-up analysis/opinion piece about an event vs. the original report of the event — unless it's just re-reporting the same facts.
- Similar topic, different specific facts (different companies, different targets, different outcomes).

NEW ARTICLE:
Title: ${newTitle}
Summary: ${newSummary}

EXISTING ARTICLES:

${candidateList}

Return ONLY valid JSON with this exact structure:

{
  "is_duplicate": false,
  "matching_id": null,
  "reasoning": ""
}

If the new article describes the same event as one of the existing articles, set is_duplicate to true and matching_id to that article's exact "id" value (as a string, copied exactly from the list above — not the bracketed index number). If none match, set is_duplicate to false and matching_id to null.

Be conservative: if you're not reasonably confident it's the same specific event, say it is NOT a duplicate. Two articles merely being about the same company or the same general topic is not enough.

Respond with JSON only.
`;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
  });

  if (!response.ok) {
    const errorBody = await response
      .text()
      .catch(() => "");

    throw new Error(
      `Groq API error (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();

  const text: string =
    data?.choices?.[0]?.message?.content?.trim() ??
    "";

  let parsed: DuplicateJudgment;

  try {
    const cleanedText = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    parsed = JSON.parse(cleanedText);
  } catch {
    console.error(
      "Invalid duplicate-judge response:",
      text
    );

    // Fail safe: if we can't parse the judgment, don't block
    // publishing over it — treat as "not a duplicate" rather
    // than silently dropping a legitimate story.
    return {
      is_duplicate: false,
      matching_id: null,
      reasoning:
        "Duplicate check returned an unparseable response; treated as not a duplicate.",
    };
  }

  const matchIsValid =
    parsed.is_duplicate === true &&
    typeof parsed.matching_id === "string" &&
    candidates.some((c) => c.id === parsed.matching_id);

  return {
    is_duplicate: matchIsValid,
    matching_id: matchIsValid ? parsed.matching_id : null,
    reasoning:
      typeof parsed.reasoning === "string"
        ? parsed.reasoning
        : "",
  };
}
