import Parser from "rss-parser";

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  creator?: string;
  source?: {
    name?: string;
  };
};

const parser = new Parser();

const RSS_FEEDS = [
  "https://news.google.com/rss/search?q=%22rogue+AI%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+hack&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+%22unauthorized%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+%22unexpected+behavior%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+model%22+%22went+rogue%22&hl=en-US&gl=US&ceid=US:en",

  "https://news.google.com/rss/search?q=%22AI+agent%22+%22safety+incident%22&hl=en-US&gl=US&ceid=US:en",
];

const KEYWORDS: Record<string, number> = {
  "rogue AI": 30,
  "went rogue": 30,
  "AI agent": 10,
  "unauthorized": 20,
  "unexpected behavior": 25,
  "unexpected action": 25,
  "escaped": 25,
  "escape": 20,
  "hacked": 25,
  "hack": 20,
  "breach": 20,
  "compromised": 20,
  "deceived": 25,
  "deception": 20,
  "misaligned": 25,
  "misalignment": 25,
  "reward hacking": 25,
  "scheming": 25,
  "self-replicated": 30,
  "exfiltrated": 30,
  "exfiltration": 25,
  "refused shutdown": 30,
  "bypassed": 20,
  "broke containment": 30,
  "escaped containment": 35,
};

const TRUSTED_SOURCES = [
  "reuters.com",
  "apnews.com",
  "wired.com",
  "technologyreview.com",
  "arstechnica.com",
  "theguardian.com",
  "nytimes.com",
  "washingtonpost.com",
  "bbc.com",
  "bbc.co.uk",
  "cnn.com",
  "axios.com",
  "openai.com",
  "anthropic.com",
  "deepmind.google",
  "metr.org",
];

function calculateRelevance(
  title: string,
  summary: string
) {
  const text = `${title} ${summary}`.toLowerCase();

  let score = 0;
  const matchedKeywords: string[] = [];

  for (const [keyword, weight] of Object.entries(
    KEYWORDS
  )) {
    if (text.includes(keyword.toLowerCase())) {
      score += weight;
      matchedKeywords.push(keyword);
    }
  }

  return {
    score: Math.min(score, 100),
    matchedKeywords,
  };
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function isTrustedSource(url: string) {
  const domain = getDomain(url);

  return TRUSTED_SOURCES.some(
    (trusted) =>
      domain === trusted ||
      domain.endsWith(`.${trusted}`)
  );
}

async function resolveUrl(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });

    return response.url || url;
  } catch {
    return url;
  }
}

export async function discoverCandidates() {
  const candidates = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);

      for (const rawItem of feed.items as FeedItem[]) {
        if (!rawItem.title || !rawItem.link) {
          continue;
        }

        const title = rawItem.title.trim();

        const summary = (
          rawItem.contentSnippet ??
          rawItem.content ??
          ""
        ).trim();

        const relevance = calculateRelevance(
          title,
          summary
        );

        if (relevance.score < 25) {
          continue;
        }

        const articleUrl = await resolveUrl(
          rawItem.link
        );

        const trusted = isTrustedSource(
          articleUrl
        );

        /*
         * We don't throw away non-trusted sources.
         * Instead, we give them a lower score.
         *
         * This lets us discover things from smaller
         * publications while keeping editorial review
         * in the loop.
         */

        const finalScore = trusted
          ? Math.min(relevance.score + 10, 100)
          : relevance.score;

        candidates.push({
          title,
          source_url: articleUrl,
          article_url: articleUrl,
          source_name:
            getDomain(articleUrl) || "Unknown",
          summary: summary || null,
          published_at:
            rawItem.pubDate
              ? new Date(
                  rawItem.pubDate
                ).toISOString()
              : null,
          relevance_score: finalScore,
          matched_keywords:
            relevance.matchedKeywords,
        });
      }
    } catch (error) {
      console.error(
        `Failed to process feed ${feedUrl}`,
        error
      );
    }
  }

  /*
   * Remove duplicates.
   */
  const unique = Array.from(
    new Map(
      candidates.map((candidate) => [
        candidate.article_url,
        candidate,
      ])
    ).values()
  );

  /*
   * Highest relevance first.
   */
  unique.sort(
    (a, b) =>
      b.relevance_score -
      a.relevance_score
  );

  return unique;
}