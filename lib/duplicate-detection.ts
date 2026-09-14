/*
 * Lightweight duplicate detection.
 *
 * Different publishers often cover the same underlying event with
 * different headlines ("OpenAI agent leaks user data" vs "ChatGPT
 * data leak sparks concern"), so an exact title match is too
 * strict. This uses word-overlap (Jaccard) similarity instead,
 * which catches "same story, different phrasing" without needing
 * an extra AI call per comparison.
 *
 * This is a heuristic, not a guarantee — it's meant to catch the
 * common case (same company, same week, clearly the same event),
 * not every possible duplicate.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "in", "on", "for", "and", "or",
  "is", "are", "was", "were", "with", "that", "this", "as", "at",
  "by", "from", "has", "have", "had", "its", "it", "be", "been",
  "will", "after", "over", "into", "new", "says", "said", "amid",
  "than", "but", "not", "their", "they", "he", "she", "we", "you",
  "about", "how", "what", "when", "why", "who", "which", "can",
  "could", "would", "should", "may", "might", "these", "those",
]);

function wordsOf(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  );
}

/**
 * Jaccard similarity between two strings, 0 (nothing in common)
 * to 1 (same set of significant words).
 */
export function textSimilarity(a: string, b: string): number {
  const wordsA = wordsOf(a);
  const wordsB = wordsOf(b);

  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersection++;
    }
  }

  const union = new Set([...wordsA, ...wordsB]).size;

  return intersection / union;
}

/**
 * Returns the best-matching candidate above the threshold, or null.
 * `getText` lets the caller decide what to compare (title, summary,
 * or a combination) without this helper needing to know the shape
 * of each table.
 */
export function findBestMatch<T>(
  target: string,
  candidates: T[],
  getText: (item: T) => string,
  threshold: number
): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;

  for (const candidate of candidates) {
    const score = textSimilarity(target, getText(candidate));

    if (score >= threshold && (!best || score > best.score)) {
      best = { item: candidate, score };
    }
  }

  return best;
}